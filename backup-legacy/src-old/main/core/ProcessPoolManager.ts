/**
 * 🔧 进程池管理器
 * 统一管理所有子进程，避免进程泄漏和重复启动
 * 
 * 核心功能：
 * 1. 统一进程生命周期管理
 * 2. 进程复用和资源优化
 * 3. 异常进程自动清理
 * 4. 进程状态监控
 */

import { EventEmitter } from 'events'
import { ChildProcess, spawn } from 'child_process'

export interface ProcessConfig {
  processId: string
  command: string
  args: string[]
  workingDirectory?: string
  env?: Record<string, string>
  timeout?: number
  autoRestart?: boolean
  maxRestarts?: number
}

export interface ManagedProcess {
  processId: string
  process: ChildProcess
  config: ProcessConfig
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
  startTime: Date
  restartCount: number
  lastError?: string
}

export class ProcessPoolManager extends EventEmitter {
  private processes: Map<string, ManagedProcess> = new Map()
  private isInitialized = false
  private cleanupInterval?: NodeJS.Timeout

  /**
   * 初始化进程池
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    console.log('🔧 [ProcessPool] 初始化进程池管理器...')

    // 启动定期清理任务
    this.startCleanupTask()

    // 监听应用退出事件
    this.setupExitHandlers()

    this.isInitialized = true
    console.log('✅ [ProcessPool] 进程池管理器初始化完成')
  }

  /**
   * 获取或创建进程
   */
  public async getOrCreateProcess(config: ProcessConfig): Promise<ManagedProcess> {
    const existingProcess = this.processes.get(config.processId)

    // 如果进程存在且运行正常，直接返回
    if (existingProcess && this.isProcessHealthy(existingProcess)) {
      console.log(`♻️ [ProcessPool] 复用现有进程: ${config.processId}`)
      return existingProcess
    }

    // 如果进程存在但不健康，先清理
    if (existingProcess) {
      console.log(`🧹 [ProcessPool] 清理不健康进程: ${config.processId}`)
      await this.terminateProcess(config.processId)
    }

    // 创建新进程
    return await this.createProcess(config)
  }

  /**
   * 创建新进程
   */
  private async createProcess(config: ProcessConfig): Promise<ManagedProcess> {
    console.log(`🚀 [ProcessPool] 创建新进程: ${config.processId}`)
    console.log(`📝 [ProcessPool] 命令: ${config.command} ${config.args.join(' ')}`)

    const managedProcess: ManagedProcess = {
      processId: config.processId,
      process: null as any, // 先设为null，下面会赋值
      config,
      status: 'starting',
      startTime: new Date(),
      restartCount: 0
    }

    try {
      // 🔥 优化进程启动参数
      const spawnOptions = {
        stdio: ['pipe', 'pipe', 'pipe'] as ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...config.env,
          // 🔥 优化Node.js性能
          NODE_OPTIONS: '--max-old-space-size=2048',
          // 🔥 禁用不必要的警告
          NODE_NO_WARNINGS: '1'
        },
        cwd: config.workingDirectory || process.cwd(),
        detached: false // 确保子进程会随主进程退出
      }

      console.log(`🔧 [ProcessPool] Spawn选项:`)
      console.log(`  - 命令: ${config.command}`)
      console.log(`  - 参数: [${config.args.join(', ')}]`)
      console.log(`  - 工作目录: ${spawnOptions.cwd}`)
      console.log(`  - 环境变量数量: ${Object.keys(spawnOptions.env).length}`)

      const childProcess = spawn(config.command, config.args, spawnOptions)
      managedProcess.process = childProcess

      // 设置进程事件监听
      this.setupProcessListeners(managedProcess)

      // 等待进程启动
      await this.waitForProcessReady(managedProcess, config.timeout || 10000)

      managedProcess.status = 'running'
      this.processes.set(config.processId, managedProcess)

      console.log(`✅ [ProcessPool] 进程创建成功: ${config.processId} (PID: ${childProcess.pid})`)
      
      // 发送事件
      this.emit('process-created', {
        processId: config.processId,
        pid: childProcess.pid || 0,
        command: config.command
      })

      return managedProcess

    } catch (error) {
      managedProcess.status = 'error'
      managedProcess.lastError = error instanceof Error ? error.message : String(error)
      
      console.error(`❌ [ProcessPool] 进程创建失败: ${config.processId}`, error)
      
      this.emit('process-error', {
        processId: config.processId,
        error: managedProcess.lastError
      })

      throw error
    }
  }

  /**
   * 终止进程
   */
  public async terminateProcess(processId: string): Promise<void> {
    const managedProcess = this.processes.get(processId)
    if (!managedProcess) {
      console.log(`⚠️ [ProcessPool] 进程不存在: ${processId}`)
      return
    }

    console.log(`🛑 [ProcessPool] 终止进程: ${processId}`)
    managedProcess.status = 'stopping'

    try {
      const process = managedProcess.process

      if (process && !process.killed && process.exitCode === null) {
        // 先尝试优雅关闭
        process.kill('SIGTERM')

        // 等待2秒，如果还没退出就强制杀死
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            if (!process.killed && process.exitCode === null) {
              console.log(`💥 [ProcessPool] 强制终止进程: ${processId}`)
              process.kill('SIGKILL')
            }
            resolve()
          }, 2000)

          process.once('exit', () => {
            clearTimeout(timeout)
            resolve()
          })
        })
      }

      managedProcess.status = 'stopped'
      this.processes.delete(processId)

      console.log(`✅ [ProcessPool] 进程已终止: ${processId}`)
      
      this.emit('process-terminated', {
        processId,
        pid: process?.pid
      })

    } catch (error) {
      console.error(`❌ [ProcessPool] 进程终止失败: ${processId}`, error)
      managedProcess.status = 'error'
      managedProcess.lastError = error instanceof Error ? error.message : String(error)
    }
  }

  /**
   * 获取进程状态
   */
  public getProcessStatus(processId: string): ManagedProcess | null {
    return this.processes.get(processId) || null
  }

  /**
   * 获取所有进程状态
   */
  public getAllProcesses(): ManagedProcess[] {
    return Array.from(this.processes.values())
  }

  /**
   * 关闭进程池
   */
  public async shutdown(): Promise<void> {
    console.log('🛑 [ProcessPool] 关闭进程池，终止所有进程...')

    // 停止清理任务
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }

    // 并行终止所有进程
    const terminationPromises = Array.from(this.processes.keys()).map(processId =>
      this.terminateProcess(processId)
    )

    await Promise.allSettled(terminationPromises)

    // 强制清理任何剩余进程
    await this.forceCleanupAll()

    console.log('✅ [ProcessPool] 进程池已关闭')
  }

  /**
   * 检查进程是否健康
   */
  private isProcessHealthy(managedProcess: ManagedProcess): boolean {
    const process = managedProcess.process
    return (
      process &&
      !process.killed &&
      process.exitCode === null &&
      managedProcess.status === 'running'
    )
  }

  /**
   * 设置进程事件监听
   */
  private setupProcessListeners(managedProcess: ManagedProcess): void {
    const { processId, process } = managedProcess

    // 进程启动事件
    process.once('spawn', () => {
      console.log(`✅ [ProcessPool] 进程已启动: ${processId} (PID: ${process.pid})`)
    })

    // 进程退出事件
    process.once('exit', (code, signal) => {
      console.log(`🔴 [ProcessPool] 进程退出: ${processId}, code: ${code}, signal: ${signal}`)
      
      if (code !== 0) {
        managedProcess.status = 'error'
        managedProcess.lastError = `进程异常退出，退出码: ${code}`
        
        // 如果启用自动重启
        if (managedProcess.config.autoRestart && managedProcess.restartCount < (managedProcess.config.maxRestarts || 3)) {
          console.log(`🔄 [ProcessPool] 自动重启进程: ${processId}`)
          this.restartProcess(managedProcess)
        }
      } else {
        managedProcess.status = 'stopped'
      }

      this.emit('process-exit', {
        processId,
        exitCode: code,
        signal
      })
    })

    // 进程错误事件
    process.once('error', (error) => {
      console.error(`❌ [ProcessPool] 进程错误: ${processId}`, error)
      managedProcess.status = 'error'
      managedProcess.lastError = error.message

      this.emit('process-error', {
        processId,
        error: error.message
      })
    })

    // 处理进程输出（用于调试）
    if (process.stdout) {
      process.stdout.on('data', (data) => {
        const output = data.toString().trim()
        if (output) {
          console.log(`📤 [ProcessPool] ${processId} stdout: ${output}`)
        }
      })
    }

    if (process.stderr) {
      process.stderr.on('data', (data) => {
        const error = data.toString().trim()
        if (error) {
          console.error(`📤 [ProcessPool] ${processId} stderr: ${error}`)
        }
      })
    }
  }

  /**
   * 等待进程准备就绪
   */
  private async waitForProcessReady(managedProcess: ManagedProcess, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`进程启动超时: ${managedProcess.processId}`))
      }, timeout)

      const process = managedProcess.process

      // 监听启动成功
      process.once('spawn', () => {
        clearTimeout(timeoutId)
        // 额外等待一小段时间确保进程完全启动
        setTimeout(resolve, 1000)
      })

      // 监听启动失败
      process.once('error', (error) => {
        clearTimeout(timeoutId)
        reject(error)
      })

      process.once('exit', (code) => {
        clearTimeout(timeoutId)
        reject(new Error(`进程启动时退出，退出码: ${code}`))
      })
    })
  }

  /**
   * 重启进程
   */
  private async restartProcess(managedProcess: ManagedProcess): Promise<void> {
    try {
      managedProcess.restartCount++
      console.log(`🔄 [ProcessPool] 重启进程: ${managedProcess.processId} (第${managedProcess.restartCount}次)`)

      // 先终止现有进程
      await this.terminateProcess(managedProcess.processId)

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 重新创建进程
      await this.createProcess(managedProcess.config)

    } catch (error) {
      console.error(`❌ [ProcessPool] 进程重启失败: ${managedProcess.processId}`, error)
    }
  }

  /**
   * 启动定期清理任务
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupDeadProcesses()
    }, 30000) // 每30秒清理一次
  }

  /**
   * 清理死进程
   */
  private cleanupDeadProcesses(): void {
    const deadProcesses = Array.from(this.processes.values()).filter(mp => !this.isProcessHealthy(mp))
    
    if (deadProcesses.length > 0) {
      console.log(`🧹 [ProcessPool] 清理 ${deadProcesses.length} 个死进程`)
      deadProcesses.forEach(mp => {
        this.processes.delete(mp.processId)
      })
    }
  }

  /**
   * 强制清理所有进程
   */
  private async forceCleanupAll(): Promise<void> {
    try {
      const { spawn } = require('child_process')
      
      // 使用系统命令强制清理所有相关进程
      const killProcess = spawn('pkill', ['-f', 'promptx|deechat'], { stdio: 'ignore' })
      
      await new Promise<void>((resolve) => {
        killProcess.on('close', () => {
          console.log('🧹 [ProcessPool] 强制清理完成')
          resolve()
        })
        
        // 最多等待5秒
        setTimeout(resolve, 5000)
      })
      
    } catch (error) {
      console.warn('⚠️ [ProcessPool] 强制清理失败:', error)
    }
  }

  /**
   * 设置退出处理器
   */
  private setupExitHandlers(): void {
    const exitHandler = async () => {
      console.log('🔧 [ProcessPool] 应用退出，清理所有进程...')
      await this.shutdown()
    }

    process.once('exit', exitHandler)
    process.once('SIGINT', exitHandler)
    process.once('SIGTERM', exitHandler)
  }
}