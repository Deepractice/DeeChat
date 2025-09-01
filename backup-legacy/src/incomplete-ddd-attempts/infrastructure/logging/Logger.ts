/**
 * 统一日志系统
 * 提供结构化的日志记录功能
 */

import { writeFile, appendFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { Result } from '../../domain/shared/primitives/Result'

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface ILogEntry {
  timestamp: Date
  level: LogLevel
  message: string
  context?: string
  correlationId?: string
  userId?: string
  sessionId?: string
  metadata?: Record<string, any>
  error?: Error
}

export interface ILoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableFile: boolean
  logDirectory?: string
  maxFileSize?: number
  maxFiles?: number
  enableStructured?: boolean
}

export class Logger {
  private config: ILoggerConfig
  private logQueue: ILogEntry[] = []
  private isProcessing = false

  constructor(config: Partial<ILoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: true,
      logDirectory: './logs',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      enableStructured: true,
      ...config
    }
  }

  /**
   * 初始化日志系统
   */
  async initialize(): Promise<Result<void, Error>> {
    try {
      console.log('🔄 [Logger] 初始化日志系统')

      // 创建日志目录
      if (this.config.enableFile && this.config.logDirectory) {
        await this.ensureLogDirectory()
      }

      // 启动日志处理队列
      this.startLogProcessing()

      console.log('✅ [Logger] 日志系统初始化完成')
      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to initialize logger: ${error.message}`))
    }
  }

  /**
   * 记录DEBUG级别日志
   */
  debug(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context, metadata)
  }

  /**
   * 记录INFO级别日志
   */
  info(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context, metadata)
  }

  /**
   * 记录WARN级别日志
   */
  warn(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context, metadata)
  }

  /**
   * 记录ERROR级别日志
   */
  error(message: string, error?: Error, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, { ...metadata, error })
  }

  /**
   * 记录FATAL级别日志
   */
  fatal(message: string, error?: Error, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.FATAL, message, context, { ...metadata, error })
  }

  /**
   * 创建子日志记录器
   */
  createChildLogger(context: string): Logger {
    return new ContextualLogger(this, context)
  }

  /**
   * 核心日志记录方法
   */
  private log(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: Record<string, any>
  ): void {
    // 检查日志级别
    if (level < this.config.level) {
      return
    }

    const logEntry: ILogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      correlationId: metadata?.correlationId,
      userId: metadata?.userId,
      sessionId: metadata?.sessionId,
      metadata: this.sanitizeMetadata(metadata),
      error: metadata?.error
    }

    // 添加到队列
    this.logQueue.push(logEntry)

    // 立即处理控制台输出
    if (this.config.enableConsole) {
      this.writeToConsole(logEntry)
    }
  }

  /**
   * 启动日志处理队列
   */
  private startLogProcessing(): void {
    setInterval(() => {
      if (!this.isProcessing && this.logQueue.length > 0) {
        this.processLogQueue()
      }
    }, 1000) // 每秒处理一次
  }

  /**
   * 处理日志队列
   */
  private async processLogQueue(): Promise<void> {
    if (this.isProcessing || this.logQueue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      const logsToProcess = [...this.logQueue]
      this.logQueue = []

      // 写入文件
      if (this.config.enableFile) {
        await this.writeToFile(logsToProcess)
      }
    } catch (error) {
      console.error('❌ [Logger] 处理日志队列失败:', error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 写入控制台
   */
  private writeToConsole(logEntry: ILogEntry): void {
    const levelName = LogLevel[logEntry.level]
    const timestamp = logEntry.timestamp.toISOString()
    const contextPart = logEntry.context ? `[${logEntry.context}] ` : ''
    const correlationPart = logEntry.correlationId ? `(${logEntry.correlationId}) ` : ''
    
    let logLine = `${timestamp} ${levelName} ${contextPart}${correlationPart}${logEntry.message}`

    // 添加元数据（如果启用结构化日志）
    if (this.config.enableStructured && logEntry.metadata) {
      const metadataStr = JSON.stringify(logEntry.metadata, null, 0)
      logLine += ` ${metadataStr}`
    }

    // 根据级别选择输出方法
    switch (logEntry.level) {
      case LogLevel.DEBUG:
        console.debug(logLine)
        break
      case LogLevel.INFO:
        console.info(logLine)
        break
      case LogLevel.WARN:
        console.warn(logLine)
        break
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(logLine)
        if (logEntry.error) {
          console.error(logEntry.error)
        }
        break
    }
  }

  /**
   * 写入文件
   */
  private async writeToFile(logEntries: ILogEntry[]): Promise<void> {
    if (!this.config.logDirectory) return

    try {
      const logFileName = this.getLogFileName()
      const logFilePath = join(this.config.logDirectory, logFileName)

      // 检查文件大小，必要时轮转
      await this.rotateLogFileIfNeeded(logFilePath)

      // 格式化日志条目
      const logLines = logEntries.map(entry => this.formatLogEntry(entry))
      const logContent = logLines.join('\n') + '\n'

      // 写入文件
      await appendFile(logFilePath, logContent, 'utf8')
    } catch (error) {
      console.error('❌ [Logger] 写入日志文件失败:', error)
    }
  }

  /**
   * 格式化日志条目
   */
  private formatLogEntry(logEntry: ILogEntry): string {
    if (this.config.enableStructured) {
      // JSON格式
      return JSON.stringify({
        timestamp: logEntry.timestamp.toISOString(),
        level: LogLevel[logEntry.level],
        message: logEntry.message,
        context: logEntry.context,
        correlationId: logEntry.correlationId,
        userId: logEntry.userId,
        sessionId: logEntry.sessionId,
        metadata: logEntry.metadata,
        error: logEntry.error ? {
          name: logEntry.error.name,
          message: logEntry.error.message,
          stack: logEntry.error.stack
        } : undefined
      })
    } else {
      // 纯文本格式
      const levelName = LogLevel[logEntry.level]
      const timestamp = logEntry.timestamp.toISOString()
      const contextPart = logEntry.context ? `[${logEntry.context}] ` : ''
      const correlationPart = logEntry.correlationId ? `(${logEntry.correlationId}) ` : ''
      
      let line = `${timestamp} ${levelName} ${contextPart}${correlationPart}${logEntry.message}`
      
      if (logEntry.error) {
        line += `\nError: ${logEntry.error.message}\nStack: ${logEntry.error.stack}`
      }
      
      return line
    }
  }

  /**
   * 获取日志文件名
   */
  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    return `deechat-${date}.log`
  }

  /**
   * 轮转日志文件
   */
  private async rotateLogFileIfNeeded(logFilePath: string): Promise<void> {
    try {
      if (!existsSync(logFilePath)) return

      const stats = await import('fs').then(fs => fs.promises.stat(logFilePath))
      
      if (stats.size > (this.config.maxFileSize || 10 * 1024 * 1024)) {
        // 重命名当前文件
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const rotatedName = logFilePath.replace('.log', `-${timestamp}.log`)
        
        await import('fs').then(fs => fs.promises.rename(logFilePath, rotatedName))
        
        console.log(`🔄 [Logger] 日志文件已轮转: ${rotatedName}`)
      }
    } catch (error) {
      console.error('❌ [Logger] 轮转日志文件失败:', error)
    }
  }

  /**
   * 确保日志目录存在
   */
  private async ensureLogDirectory(): Promise<void> {
    if (!this.config.logDirectory) return

    try {
      if (!existsSync(this.config.logDirectory)) {
        await mkdir(this.config.logDirectory, { recursive: true })
        console.log(`📁 [Logger] 创建日志目录: ${this.config.logDirectory}`)
      }
    } catch (error) {
      throw new Error(`Failed to create log directory: ${error.message}`)
    }
  }

  /**
   * 清理元数据
   */
  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined

    const sanitized: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(metadata)) {
      // 过滤掉敏感信息
      if (key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('secret')) {
        sanitized[key] = '[REDACTED]'
      } else if (key === 'error') {
        // error已经单独处理
        continue
      } else {
        sanitized[key] = value
      }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined
  }
}

/**
 * 带上下文的日志记录器
 */
class ContextualLogger {
  constructor(
    private readonly parentLogger: Logger,
    private readonly context: string
  ) {}

  debug(message: string, metadata?: Record<string, any>): void {
    this.parentLogger.debug(message, this.context, metadata)
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.parentLogger.info(message, this.context, metadata)
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.parentLogger.warn(message, this.context, metadata)
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.parentLogger.error(message, error, this.context, metadata)
  }

  fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.parentLogger.fatal(message, error, this.context, metadata)
  }

  createChildLogger(childContext: string): ContextualLogger {
    const fullContext = `${this.context}.${childContext}`
    return new ContextualLogger(this.parentLogger, fullContext)
  }
}