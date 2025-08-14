/**
 * 🧵 DeeChat 线程管理系统
 * 负责管理会话级线程的生命周期、状态监控和资源分配
 */

export enum ThreadStatus {
  IDLE = 'idle',           // 空闲
  BUSY = 'busy',           // 繁忙处理中
  WAITING = 'waiting',     // 等待队列中
  ERROR = 'error',         // 错误状态
  TIMEOUT = 'timeout',     // 超时
  TERMINATED = 'terminated' // 已终止
}

export enum ThreadPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export interface ThreadInfo {
  sessionId: string
  status: ThreadStatus
  priority: ThreadPriority
  createdAt: number
  lastActiveAt: number
  currentTaskId?: string
  modelId?: string
  roleId?: string
  // 性能统计
  stats: {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    averageResponseTime: number
    totalTokensUsed: number
    lastResponseTime: number
  }
  // 资源使用
  resources: {
    memoryUsage: number     // MB
    modelCacheSize: number  // 缓存的模型数量
    activeConnections: number
  }
  // 错误信息
  lastError?: {
    message: string
    timestamp: number
    errorType: string
  }
}

export interface ThreadManagerConfig {
  maxConcurrentThreads: number        // 最大并发线程数
  defaultTimeout: number              // 默认超时时间(ms)
  maxIdleTime: number                // 最大空闲时间(ms)
  cleanupInterval: number            // 清理间隔(ms)
  maxMemoryPerThread: number         // 每线程最大内存(MB)
  enablePerformanceMonitoring: boolean
  enableAutoCleanup: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export interface TaskRequest {
  id: string
  sessionId: string
  type: 'chat' | 'tool' | 'role_activation' | 'file_processing'
  priority: ThreadPriority
  data: any
  timeout?: number
  onProgress?: (progress: any) => void
  onComplete?: (result: any) => void
  onError?: (error: Error) => void
}

/**
 * 🎯 核心线程管理器
 * 
 * 功能特性：
 * - 🔄 会话线程生命周期管理
 * - 📊 实时性能监控和统计
 * - ⚡ 智能负载均衡和优先级调度
 * - 🧹 自动资源清理和内存管理
 * - 🔧 异常恢复和容错处理
 * - 📈 详细的运行时统计报告
 */
export class ThreadManager {
  private static instance: ThreadManager
  private threads: Map<string, ThreadInfo> = new Map()
  private taskQueue: TaskRequest[] = []
  private config: ThreadManagerConfig
  private cleanupTimer?: NodeJS.Timeout
  private monitoringTimer?: NodeJS.Timeout
  private eventListeners: Map<string, Function[]> = new Map()

  private constructor(config: Partial<ThreadManagerConfig> = {}) {
    this.config = {
      maxConcurrentThreads: 5,
      defaultTimeout: 120000, // 2分钟
      maxIdleTime: 300000,    // 5分钟
      cleanupInterval: 60000,  // 1分钟
      maxMemoryPerThread: 512, // 512MB
      enablePerformanceMonitoring: true,
      enableAutoCleanup: true,
      logLevel: 'info',
      ...config
    }

    this.startBackgroundServices()
  }

  static getInstance(config?: Partial<ThreadManagerConfig>): ThreadManager {
    if (!ThreadManager.instance) {
      ThreadManager.instance = new ThreadManager(config)
    }
    return ThreadManager.instance
  }

  // ==================== 线程生命周期管理 ====================

  /**
   * 🆕 创建新线程
   */
  createThread(sessionId: string, options: {
    priority?: ThreadPriority
    modelId?: string
    roleId?: string
  } = {}): ThreadInfo {
    if (this.threads.has(sessionId)) {
      this.log('warn', `线程 ${sessionId} 已存在，返回现有线程`)
      return this.threads.get(sessionId)!
    }

    const thread: ThreadInfo = {
      sessionId,
      status: ThreadStatus.IDLE,
      priority: options.priority || ThreadPriority.NORMAL,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      modelId: options.modelId,
      roleId: options.roleId,
      stats: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        totalTokensUsed: 0,
        lastResponseTime: 0
      },
      resources: {
        memoryUsage: 0,
        modelCacheSize: 0,
        activeConnections: 0
      }
    }

    this.threads.set(sessionId, thread)
    this.emit('thread:created', thread)
    this.log('info', `✅ 创建线程: ${sessionId}`)
    
    return thread
  }

  /**
   * 📊 获取线程信息
   */
  getThread(sessionId: string): ThreadInfo | undefined {
    return this.threads.get(sessionId)
  }

  /**
   * 📋 获取所有线程
   */
  getAllThreads(): ThreadInfo[] {
    return Array.from(this.threads.values())
  }

  /**
   * 🔄 更新线程状态
   */
  updateThreadStatus(sessionId: string, status: ThreadStatus, error?: Error): void {
    const thread = this.threads.get(sessionId)
    if (!thread) {
      this.log('warn', `尝试更新不存在的线程状态: ${sessionId}`)
      return
    }

    const oldStatus = thread.status
    thread.status = status
    thread.lastActiveAt = Date.now()

    if (error) {
      thread.lastError = {
        message: error.message,
        timestamp: Date.now(),
        errorType: error.name
      }
      thread.stats.failedRequests++
    }

    this.emit('thread:status_changed', { thread, oldStatus, newStatus: status })
    this.log('debug', `🔄 线程 ${sessionId}: ${oldStatus} → ${status}`)
  }

  /**
   * 📈 更新线程统计
   */
  updateThreadStats(sessionId: string, stats: {
    responseTime?: number
    tokensUsed?: number
    success?: boolean
    memoryUsage?: number
    modelCacheSize?: number
    activeConnections?: number
  }): void {
    const thread = this.threads.get(sessionId)
    if (!thread) return

    if (stats.responseTime !== undefined) {
      thread.stats.lastResponseTime = stats.responseTime
      thread.stats.averageResponseTime = 
        (thread.stats.averageResponseTime * thread.stats.totalRequests + stats.responseTime) / 
        (thread.stats.totalRequests + 1)
    }

    if (stats.tokensUsed !== undefined) {
      thread.stats.totalTokensUsed += stats.tokensUsed
    }

    if (stats.success !== undefined) {
      if (stats.success) {
        thread.stats.successfulRequests++
      } else {
        thread.stats.failedRequests++
      }
    }

    thread.stats.totalRequests++

    // 更新资源统计
    if (stats.memoryUsage !== undefined) {
      thread.resources.memoryUsage = stats.memoryUsage
    }
    if (stats.modelCacheSize !== undefined) {
      thread.resources.modelCacheSize = stats.modelCacheSize
    }
    if (stats.activeConnections !== undefined) {
      thread.resources.activeConnections = stats.activeConnections
    }

    this.emit('thread:stats_updated', { sessionId, stats: thread.stats })
  }

  /**
   * 🗑️ 销毁线程
   */
  async destroyThread(sessionId: string, reason: string = '手动销毁'): Promise<void> {
    const thread = this.threads.get(sessionId)
    if (!thread) return

    // 更新状态为终止
    thread.status = ThreadStatus.TERMINATED

    // 清理资源
    await this.cleanupThreadResources(sessionId)

    // 从映射中移除
    this.threads.delete(sessionId)

    this.emit('thread:destroyed', { sessionId, reason })
    this.log('info', `🗑️ 销毁线程: ${sessionId} (原因: ${reason})`)
  }

  // ==================== 任务队列管理 ====================

  /**
   * 📝 添加任务到队列
   */
  enqueueTask(task: TaskRequest): void {
    // 按优先级插入队列
    const insertIndex = this.taskQueue.findIndex(t => t.priority < task.priority)
    if (insertIndex === -1) {
      this.taskQueue.push(task)
    } else {
      this.taskQueue.splice(insertIndex, 0, task)
    }

    this.log('debug', `📝 任务入队: ${task.id} (会话: ${task.sessionId}, 优先级: ${task.priority})`)
    this.emit('task:enqueued', task)
    
    // 尝试处理队列
    this.processTaskQueue()
  }

  /**
   * ⚡ 处理任务队列
   */
  private async processTaskQueue(): Promise<void> {
    if (this.taskQueue.length === 0) return

    const busyThreads = Array.from(this.threads.values()).filter(t => t.status === ThreadStatus.BUSY)
    if (busyThreads.length >= this.config.maxConcurrentThreads) {
      this.log('debug', `⏳ 达到最大并发限制 (${this.config.maxConcurrentThreads})，等待线程释放`)
      return
    }

    const task = this.taskQueue.shift()
    if (!task) return

    // 确保线程存在
    let thread = this.getThread(task.sessionId)
    if (!thread) {
      thread = this.createThread(task.sessionId, { priority: task.priority })
    }

    // 检查线程是否可用
    if (thread.status === ThreadStatus.BUSY) {
      // 线程忙，重新入队等待
      this.taskQueue.unshift(task)
      return
    }

    // 执行任务
    await this.executeTask(task)
  }

  /**
   * 🔥 执行任务
   */
  private async executeTask(task: TaskRequest): Promise<void> {
    const thread = this.getThread(task.sessionId)
    if (!thread) return

    const startTime = Date.now()
    thread.currentTaskId = task.id
    this.updateThreadStatus(task.sessionId, ThreadStatus.BUSY)

    try {
      this.log('debug', `🔥 开始执行任务: ${task.id}`)
      this.emit('task:started', task)

      // 设置超时
      const timeout = task.timeout || this.config.defaultTimeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`任务超时: ${timeout}ms`)), timeout)
      })

      // 这里需要根据任务类型调用相应的处理器
      // 暂时模拟异步处理
      await Promise.race([
        this.processTaskByType(task),
        timeoutPromise
      ])

      // 任务成功完成
      const responseTime = Date.now() - startTime
      this.updateThreadStats(task.sessionId, {
        responseTime,
        success: true
      })

      this.updateThreadStatus(task.sessionId, ThreadStatus.IDLE)
      this.emit('task:completed', { task, responseTime })
      this.log('debug', `✅ 任务完成: ${task.id} (用时: ${responseTime}ms)`)

      task.onComplete?.({ taskId: task.id, responseTime })

    } catch (error) {
      // 任务执行失败
      const responseTime = Date.now() - startTime
      this.updateThreadStats(task.sessionId, {
        responseTime,
        success: false
      })

      this.updateThreadStatus(task.sessionId, ThreadStatus.ERROR, error as Error)
      this.emit('task:failed', { task, error })
      this.log('error', `❌ 任务失败: ${task.id} - ${(error as Error).message}`)

      task.onError?.(error as Error)
    } finally {
      thread.currentTaskId = undefined
      // 继续处理队列中的下一个任务
      setTimeout(() => this.processTaskQueue(), 100)
    }
  }

  /**
   * 🎯 根据任务类型处理
   */
  private async processTaskByType(task: TaskRequest): Promise<any> {
    switch (task.type) {
      case 'chat':
        return await this.processChatTask(task)
      case 'tool':
        return await this.processToolTask(task)
      case 'role_activation':
        return await this.processRoleActivationTask(task)
      case 'file_processing':
        return await this.processFileTask(task)
      default:
        throw new Error(`不支持的任务类型: ${task.type}`)
    }
  }

  /**
   * 💬 处理聊天任务
   */
  private async processChatTask(task: TaskRequest): Promise<any> {
    // 这里应该调用实际的LLM服务
    // 现在只是模拟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000))
    
    task.onProgress?.({ stage: 'processing', progress: 50 })
    
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000))
    
    task.onProgress?.({ stage: 'completing', progress: 100 })
    
    return { content: 'Mock response', tokens: 150 }
  }

  /**
   * 🔧 处理工具任务
   */
  private async processToolTask(task: TaskRequest): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1500))
    return { toolResult: 'Mock tool result' }
  }

  /**
   * 🎭 处理角色激活任务
   */
  private async processRoleActivationTask(task: TaskRequest): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 500))
    const thread = this.getThread(task.sessionId)
    if (thread) {
      thread.roleId = task.data.roleId
    }
    return { roleActivated: task.data.roleId }
  }

  /**
   * 📄 处理文件任务
   */
  private async processFileTask(task: TaskRequest): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 3000))
    return { fileProcessed: true, size: task.data.size }
  }

  // ==================== 资源清理和监控 ====================

  /**
   * 🧹 清理线程资源
   */
  private async cleanupThreadResources(sessionId: string): Promise<void> {
    // 这里应该清理：
    // - 模型实例缓存
    // - 内存占用
    // - 网络连接
    // - 临时文件等
    this.log('debug', `🧹 清理线程资源: ${sessionId}`)
  }

  /**
   * ⏰ 启动后台服务
   */
  private startBackgroundServices(): void {
    if (this.config.enableAutoCleanup) {
      this.cleanupTimer = setInterval(() => {
        this.performCleanup()
      }, this.config.cleanupInterval)
    }

    if (this.config.enablePerformanceMonitoring) {
      this.monitoringTimer = setInterval(() => {
        this.performMonitoring()
      }, 30000) // 每30秒监控一次
    }
  }

  /**
   * 🧽 执行清理操作
   */
  private async performCleanup(): Promise<void> {
    const now = Date.now()
    const threadsToCleanup: string[] = []

    for (const [sessionId, thread] of this.threads.entries()) {
      // 清理空闲时间过长的线程
      if (thread.status === ThreadStatus.IDLE && 
          (now - thread.lastActiveAt) > this.config.maxIdleTime) {
        threadsToCleanup.push(sessionId)
      }
      
      // 清理错误状态超过一定时间的线程
      if (thread.status === ThreadStatus.ERROR && 
          (now - thread.lastActiveAt) > this.config.maxIdleTime) {
        threadsToCleanup.push(sessionId)
      }
      
      // 清理内存使用过高的线程
      if (thread.resources.memoryUsage > this.config.maxMemoryPerThread) {
        this.log('warn', `线程 ${sessionId} 内存使用过高: ${thread.resources.memoryUsage}MB`)
        threadsToCleanup.push(sessionId)
      }
    }

    // 执行清理
    for (const sessionId of threadsToCleanup) {
      await this.destroyThread(sessionId, '自动清理')
    }

    if (threadsToCleanup.length > 0) {
      this.log('info', `🧽 自动清理完成，清理了 ${threadsToCleanup.length} 个线程`)
    }
  }

  /**
   * 📊 执行性能监控
   */
  private performMonitoring(): void {
    const stats = this.getSystemStats()
    this.emit('monitoring:stats', stats)
    
    if (this.config.logLevel === 'debug') {
      this.log('debug', `📊 系统统计: 活跃线程 ${stats.activeThreads}/${stats.totalThreads}, 队列长度 ${stats.queueLength}`)
    }
  }

  // ==================== 统计和监控 ====================

  /**
   * 📈 获取系统统计信息
   */
  getSystemStats(): {
    totalThreads: number
    activeThreads: number
    idleThreads: number
    busyThreads: number
    errorThreads: number
    queueLength: number
    averageResponseTime: number
    totalTokensUsed: number
    totalMemoryUsage: number
    uptime: number
  } {
    const threads = Array.from(this.threads.values())
    
    return {
      totalThreads: threads.length,
      activeThreads: threads.filter(t => t.status !== ThreadStatus.TERMINATED).length,
      idleThreads: threads.filter(t => t.status === ThreadStatus.IDLE).length,
      busyThreads: threads.filter(t => t.status === ThreadStatus.BUSY).length,
      errorThreads: threads.filter(t => t.status === ThreadStatus.ERROR).length,
      queueLength: this.taskQueue.length,
      averageResponseTime: threads.reduce((sum, t) => sum + t.stats.averageResponseTime, 0) / Math.max(threads.length, 1),
      totalTokensUsed: threads.reduce((sum, t) => sum + t.stats.totalTokensUsed, 0),
      totalMemoryUsage: threads.reduce((sum, t) => sum + t.resources.memoryUsage, 0),
      uptime: Date.now() - (ThreadManager.instance ? ThreadManager.instance.threads.values().next().value?.createdAt || Date.now() : Date.now())
    }
  }

  /**
   * 📋 获取线程详细报告
   */
  getThreadReport(sessionId: string): string {
    const thread = this.threads.get(sessionId)
    if (!thread) return `线程 ${sessionId} 不存在`

    return `
🧵 线程报告: ${sessionId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 基本信息:
   状态: ${thread.status}
   优先级: ${thread.priority}
   创建时间: ${new Date(thread.createdAt).toLocaleString()}
   最后活跃: ${new Date(thread.lastActiveAt).toLocaleString()}
   模型ID: ${thread.modelId || '未设置'}
   角色ID: ${thread.roleId || '未设置'}

📈 性能统计:
   总请求数: ${thread.stats.totalRequests}
   成功请求: ${thread.stats.successfulRequests}
   失败请求: ${thread.stats.failedRequests}
   平均响应时间: ${thread.stats.averageResponseTime.toFixed(2)}ms
   最近响应时间: ${thread.stats.lastResponseTime}ms
   总Token使用量: ${thread.stats.totalTokensUsed}

💾 资源使用:
   内存占用: ${thread.resources.memoryUsage.toFixed(2)}MB
   模型缓存数: ${thread.resources.modelCacheSize}
   活跃连接数: ${thread.resources.activeConnections}

${thread.lastError ? `❌ 最近错误:
   错误类型: ${thread.lastError.errorType}
   错误信息: ${thread.lastError.message}
   发生时间: ${new Date(thread.lastError.timestamp).toLocaleString()}` : '✅ 无错误记录'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim()
  }

  // ==================== 事件系统 ====================

  /**
   * 📡 监听事件
   */
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(listener)
  }

  /**
   * 📤 发射事件
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data)
        } catch (error) {
          this.log('error', `事件监听器错误 [${event}]: ${error}`)
        }
      })
    }
  }

  /**
   * 📝 日志记录
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 }
    const configLevel = levels[this.config.logLevel]
    const messageLevel = levels[level]
    
    if (messageLevel >= configLevel) {
      console[level](`[ThreadManager] ${message}`)
    }
  }

  // ==================== 生命周期管理 ====================

  /**
   * 🔄 重启线程
   */
  async restartThread(sessionId: string): Promise<void> {
    const oldThread = this.threads.get(sessionId)
    if (oldThread) {
      const { modelId, roleId, priority } = oldThread
      await this.destroyThread(sessionId, '重启')
      this.createThread(sessionId, { modelId, roleId, priority })
      this.log('info', `🔄 线程重启完成: ${sessionId}`)
    }
  }

  /**
   * ⏸️ 暂停线程
   */
  pauseThread(sessionId: string): void {
    const thread = this.threads.get(sessionId)
    if (thread && thread.status === ThreadStatus.IDLE) {
      this.updateThreadStatus(sessionId, ThreadStatus.WAITING)
      this.log('info', `⏸️ 线程已暂停: ${sessionId}`)
    }
  }

  /**
   * ▶️ 恢复线程
   */
  resumeThread(sessionId: string): void {
    const thread = this.threads.get(sessionId)
    if (thread && thread.status === ThreadStatus.WAITING) {
      this.updateThreadStatus(sessionId, ThreadStatus.IDLE)
      this.log('info', `▶️ 线程已恢复: ${sessionId}`)
      this.processTaskQueue() // 尝试处理等待的任务
    }
  }

  /**
   * 🔧 关闭线程管理器
   */
  async shutdown(): Promise<void> {
    this.log('info', '🔧 开始关闭线程管理器...')
    
    // 停止后台服务
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer)
    }

    // 销毁所有线程
    const destroyPromises = Array.from(this.threads.keys()).map(sessionId => 
      this.destroyThread(sessionId, '系统关闭')
    )
    await Promise.all(destroyPromises)

    // 清空队列
    this.taskQueue.length = 0

    this.log('info', '✅ 线程管理器已关闭')
  }
}