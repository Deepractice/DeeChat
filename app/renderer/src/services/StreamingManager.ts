/**
 * 流式内容管理服务
 *
 * 核心功能：
 * 1. RAF + 节流组合优化渲染性能
 * 2. 管理多个流式消息的状态
 * 3. 自动清理资源防止内存泄漏
 *
 * 设计理念：
 * - 节流控制更新频率（100ms）
 * - RAF选择最佳渲染时机
 * - 智能合并多个连续更新
 */

interface StreamingState {
  messageId: string
  content: string
  isStreaming: boolean
  isComplete: boolean
  error?: string
  lastUpdateTime: number
}

interface StreamingUpdateCallback {
  (content: string, isStreaming: boolean, isComplete: boolean): void
}

class StreamingManagerClass {
  // 消息状态管理
  private states = new Map<string, StreamingState>()

  // 性能优化相关
  private throttlers = new Map<string, ReturnType<typeof this.createThrottler>>()
  private rafIds = new Map<string, number>()

  // 回调函数存储
  private callbacks = new Map<string, StreamingUpdateCallback>()

  // 配置参数
  private readonly THROTTLE_DELAY = 16 // 16ms节流（约60fps）
  private readonly MAX_CONTENT_LENGTH = 100000 // 最大内容长度

  /**
   * 创建专用的节流函数（改进版 - 确保不丢失最后的内容）
   */
  private createThrottler(callback: Function, delay: number) {
    let timeoutId: NodeJS.Timeout | null = null
    let lastExecTime = 0
    let pendingArgs: any[] | null = null

    const throttledFn = (...args: any[]) => {
      const currentTime = Date.now()
      pendingArgs = args  // 始终保存最新的参数

      if (currentTime - lastExecTime > delay) {
        // 立即执行
        callback(...args)
        lastExecTime = currentTime
        pendingArgs = null
      } else {
        // 延迟执行，确保执行最新的参数
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        timeoutId = setTimeout(() => {
          if (pendingArgs) {
            callback(...pendingArgs)
            lastExecTime = Date.now()
            pendingArgs = null
          }
          timeoutId = null
        }, delay - (currentTime - lastExecTime))
      }
    }

    // 提供取消方法
    throttledFn.cancel = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      pendingArgs = null
    }

    // 提供立即执行挂起内容的方法
    throttledFn.flush = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (pendingArgs) {
        callback(...pendingArgs)
        lastExecTime = Date.now()
        pendingArgs = null
      }
    }

    return throttledFn
  }

  /**
   * RAF批处理更新
   */
  private updateWithRAF(
    messageId: string,
    content: string,
    isStreaming: boolean,
    isComplete: boolean,
    callback: StreamingUpdateCallback
  ) {
    // 取消之前的RAF请求
    const existingRAF = this.rafIds.get(messageId)
    if (existingRAF) {
      cancelAnimationFrame(existingRAF)
    }

    // 在下一帧执行更新
    const rafId = requestAnimationFrame(() => {
      try {
        // 更新状态
        const state = this.states.get(messageId)
        if (state) {
          state.content = content
          state.isStreaming = isStreaming
          state.isComplete = isComplete
          state.lastUpdateTime = Date.now()
        }

        // 执行回调
        callback(content, isStreaming, isComplete)
      } catch (error) {
        console.error('RAF更新失败:', error)
      } finally {
        this.rafIds.delete(messageId)
      }
    })

    this.rafIds.set(messageId, rafId)
  }

  /**
   * 开始流式输出
   */
  startStreaming(messageId: string, callback: StreamingUpdateCallback): void {
    // 存储回调函数
    this.callbacks.set(messageId, callback)

    // 创建初始状态
    const state: StreamingState = {
      messageId,
      content: '',
      isStreaming: true,
      isComplete: false,
      lastUpdateTime: Date.now()
    }

    this.states.set(messageId, state)

    // 创建优化的更新函数
    const optimizedUpdater = this.createThrottler((
      content: string,
      isStreaming: boolean,
      isComplete: boolean
    ) => {
      this.updateWithRAF(messageId, content, isStreaming, isComplete, callback)
    }, this.THROTTLE_DELAY)

    this.throttlers.set(messageId, optimizedUpdater)

    // 初始回调
    callback('', true, false)
  }

  /**
   * 追加内容
   */
  appendContent(messageId: string, chunk: string): void {
    const state = this.states.get(messageId)
    const throttler = this.throttlers.get(messageId)

    if (!state || !throttler) {
      console.warn(`消息 ${messageId} 未找到流式状态`)
      return
    }

    // 累积内容
    const oldLength = state.content.length
    let newContent = state.content + chunk

    // 内容长度限制
    if (newContent.length > this.MAX_CONTENT_LENGTH) {
      console.warn(`消息 ${messageId} 内容过长，进行截断`)
      newContent = newContent.substring(newContent.length - this.MAX_CONTENT_LENGTH)
    }

    // 更新本地状态（避免状态丢失）
    state.content = newContent

    console.log(`📊 [StreamingManager] appendContent: ${messageId.substr(-6)}, chunk: "${chunk}", 总长度: ${oldLength} -> ${newContent.length}`)

    // 通过节流器更新UI
    throttler(newContent, true, false)
  }

  /**
   * 完成流式输出
   */
  completeStreaming(messageId: string): void {
    const state = this.states.get(messageId)
    const throttler = this.throttlers.get(messageId)
    const callback = this.callbacks.get(messageId)

    if (!state || !throttler || !callback) {
      console.warn(`消息 ${messageId} 未找到流式状态`)
      return
    }

    // 先flush所有挂起的内容
    if (throttler.flush) {
      throttler.flush()
    }

    // 取消节流
    throttler.cancel()
    this.cancelRAF(messageId)

    // 立即更新最终状态
    try {
      state.isStreaming = false
      state.isComplete = true
      state.lastUpdateTime = Date.now()

      console.log('🎯 完成流式输出，最终内容长度:', state.content.length)
      callback(state.content, false, true)
    } catch (error) {
      console.error('完成流式输出时出错:', error)
    }
  }

  /**
   * 设置错误状态
   */
  setError(messageId: string, error: string): void {
    const state = this.states.get(messageId)
    if (state) {
      state.error = error
      state.isStreaming = false
      state.isComplete = true
    }

    // 清理相关资源
    this.cleanup(messageId)
  }

  /**
   * 获取消息状态
   */
  getState(messageId: string): StreamingState | undefined {
    return this.states.get(messageId)
  }

  /**
   * 检查是否正在流式输出
   */
  isStreaming(messageId: string): boolean {
    const state = this.states.get(messageId)
    return state?.isStreaming ?? false
  }

  /**
   * 清理资源
   */
  cleanup(messageId: string): void {
    // 取消RAF
    this.cancelRAF(messageId)

    // 清理节流器
    const throttler = this.throttlers.get(messageId)
    if (throttler) {
      throttler.cancel()
      this.throttlers.delete(messageId)
    }

    // 清理回调和状态
    this.callbacks.delete(messageId)
    this.states.delete(messageId)
  }

  /**
   * 清理所有资源
   */
  cleanupAll(): void {
    // 清理所有RAF
    this.rafIds.forEach(rafId => cancelAnimationFrame(rafId))
    this.rafIds.clear()

    // 清理所有节流器
    this.throttlers.forEach(throttler => throttler.cancel())
    this.throttlers.clear()

    // 清理所有回调和状态
    this.callbacks.clear()
    this.states.clear()
  }

  /**
   * 强制立即更新（用于紧急情况）
   */
  forceUpdate(messageId: string, callback: StreamingUpdateCallback): void {
    const state = this.states.get(messageId)
    if (state) {
      // 不清理状态，只是强制更新
      callback(state.content, state.isStreaming, state.isComplete)
    }
  }

  // 私有辅助方法

  private cancelRAF(messageId: string): void {
    const rafId = this.rafIds.get(messageId)
    if (rafId) {
      cancelAnimationFrame(rafId)
      this.rafIds.delete(messageId)
    }
  }


  /**
   * 获取性能统计
   */
  getStats() {
    return {
      activeStreams: this.states.size,
      activeThrottlers: this.throttlers.size,
      activeRAFs: this.rafIds.size,
      states: Array.from(this.states.values()).map(state => ({
        messageId: state.messageId,
        contentLength: state.content.length,
        isStreaming: state.isStreaming,
        isComplete: state.isComplete,
        lastUpdateTime: state.lastUpdateTime
      }))
    }
  }
}

// 单例模式导出
export const streamingManager = new StreamingManagerClass()

// 类型导出
export type { StreamingState, StreamingUpdateCallback }