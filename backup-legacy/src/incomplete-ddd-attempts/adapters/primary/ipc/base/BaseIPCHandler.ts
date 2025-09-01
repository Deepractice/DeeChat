/**
 * IPC处理器基类
 * 提供所有IPC处理器的通用功能
 */

import { ConversationApplicationService } from '../../../../application/services/ConversationApplicationService'
import { IntelligenceApplicationService } from '../../../../application/services/IntelligenceApplicationService'
import { ToolApplicationService } from '../../../../application/services/ToolApplicationService'
import { Logger } from '../../../../infrastructure/logging/Logger'
import { EventBus } from '../../../../infrastructure/messaging/EventBus'
import { BrowserWindow } from 'electron'

export abstract class BaseIPCHandler {
  protected conversationService: ConversationApplicationService
  protected intelligenceService: IntelligenceApplicationService
  protected toolService: ToolApplicationService
  protected logger: Logger
  protected eventBus: EventBus
  protected mainWindow?: BrowserWindow

  constructor(
    conversationService: ConversationApplicationService,
    intelligenceService: IntelligenceApplicationService,
    toolService: ToolApplicationService,
    logger: Logger,
    eventBus: EventBus,
    mainWindow?: BrowserWindow
  ) {
    this.conversationService = conversationService
    this.intelligenceService = intelligenceService
    this.toolService = toolService
    this.logger = logger
    this.eventBus = eventBus
    this.mainWindow = mainWindow
  }

  /**
   * 生成关联ID
   */
  protected generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 发布事件到渲染进程
   */
  protected async publishToRenderer(eventName: string, data: any): Promise<void> {
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(eventName, data)
        
        this.logger.debug(`📤 [BaseIPCHandler] 发送事件到渲染进程: ${eventName}`, 'BaseIPCHandler', {
          eventName,
          hasData: !!data
        })
      }
    } catch (error) {
      this.logger.error('❌ [BaseIPCHandler] 发送事件到渲染进程失败', error, 'BaseIPCHandler', {
        eventName
      })
    }
  }

  /**
   * 发布应用事件
   */
  protected async publishApplicationEvent(eventType: string, eventName: string, payload: any, correlationId?: string): Promise<void> {
    try {
      await this.eventBus.publish({
        eventType,
        eventName,
        payload,
        correlationId,
        timestamp: new Date()
      })
    } catch (error) {
      this.logger.error('❌ [BaseIPCHandler] 发布应用事件失败', error, 'BaseIPCHandler', {
        eventType,
        eventName,
        correlationId
      })
    }
  }

  /**
   * 处理错误
   */
  protected handleError(error: Error, context: string, correlationId?: string): any {
    this.logger.error(`❌ [BaseIPCHandler] ${context}`, error, 'BaseIPCHandler', {
      correlationId,
      context
    })

    return {
      success: false,
      error: error.message || 'Unknown error',
      correlationId
    }
  }

  /**
   * 验证必填字段
   */
  protected validateRequired(obj: any, fields: string[]): string[] {
    const missing: string[] = []
    
    for (const field of fields) {
      if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
        missing.push(field)
      }
    }
    
    return missing
  }

  /**
   * 清理字符串字段
   */
  protected cleanStringField(value: any): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : undefined
    }
    return undefined
  }

  /**
   * 清理和验证分页参数
   */
  protected cleanPaginationParams(page?: number, limit?: number): { page: number, limit: number } {
    const cleanPage = Math.max(1, Math.floor(page || 1))
    const cleanLimit = Math.max(1, Math.min(100, Math.floor(limit || 20))) // 限制最大100条
    
    return { page: cleanPage, limit: cleanLimit }
  }

  /**
   * 创建标准响应
   */
  protected createSuccessResponse(data: any, correlationId?: string): any {
    return {
      success: true,
      data,
      correlationId
    }
  }

  /**
   * 创建错误响应
   */
  protected createErrorResponse(error: string | Error, correlationId?: string): any {
    const errorMessage = error instanceof Error ? error.message : error
    
    return {
      success: false,
      error: errorMessage,
      correlationId
    }
  }

  /**
   * 记录性能指标
   */
  protected recordPerformance(operation: string, startTime: number, correlationId?: string): void {
    const duration = Date.now() - startTime
    
    this.logger.info(`⏱️ [BaseIPCHandler] 操作耗时: ${operation} (${duration}ms)`, 'BaseIPCHandler', {
      operation,
      duration,
      correlationId
    })
  }

  /**
   * 安全地获取嵌套属性
   */
  protected safeGet(obj: any, path: string, defaultValue?: any): any {
    try {
      return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : defaultValue
      }, obj)
    } catch {
      return defaultValue
    }
  }

  /**
   * 验证用户权限（占位符实现）
   */
  protected async validateUserPermission(userId: string, operation: string): Promise<boolean> {
    // TODO: 实现实际的权限验证逻辑
    this.logger.debug(`🔐 [BaseIPCHandler] 权限验证: ${userId} -> ${operation}`, 'BaseIPCHandler', {
      userId,
      operation
    })
    
    return true // 临时允许所有操作
  }

  /**
   * 限流检查（占位符实现）
   */
  protected async checkRateLimit(userId: string, operation: string): Promise<boolean> {
    // TODO: 实现实际的限流逻辑
    this.logger.debug(`🚦 [BaseIPCHandler] 限流检查: ${userId} -> ${operation}`, 'BaseIPCHandler', {
      userId,
      operation
    })
    
    return true // 临时允许所有请求
  }

  /**
   * 设置主窗口引用
   */
  setMainWindow(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow
  }
}