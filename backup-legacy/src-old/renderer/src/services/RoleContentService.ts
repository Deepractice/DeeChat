/**
 * 角色内容服务
 * 
 * 核心理念：客户端直接获取角色内容，注入系统提示词
 * 避免复杂的MCP工具调用，实现秒级角色激活
 */

// 注意：如果在主进程中使用，需要直接调用PromptXLocalService
// 这里先使用条件导入来处理跨进程问题
let promptXService: any

export interface RoleContent {
  roleId: string
  roleName: string
  content: string
  loadedAt: string
  tokenEstimate: number
}

export interface RoleContentCache {
  [roleId: string]: RoleContent
}

/**
 * 角色内容服务
 * 负责获取、缓存和提供角色定义内容
 */
export class RoleContentService {
  private cache: RoleContentCache = {}
  private loadingPromises: Map<string, Promise<RoleContent | null>> = new Map()

  constructor() {
    this.initializePromptXService()
  }

  /**
   * 初始化PromptX服务
   * 在渲染进程中使用IPC通信，在主进程中使用本地服务
   */
  private async initializePromptXService() {
    try {
      if (typeof window !== 'undefined') {
        // 渲染进程中使用IPC通过PromptXService通信
        const { promptXService: rendererService } = await import('./PromptXService')
        promptXService = rendererService
        console.log('[RoleContentService] 使用渲染进程PromptXService（通过IPC）')
      } else {
        // 这种情况不应该发生，RoleContentService应该只在渲染进程中使用
        // 主进程应该通过LangChain直接调用角色激活逻辑
        throw new Error('RoleContentService不应该在主进程中使用')
      }
    } catch (error) {
      console.error('[RoleContentService] PromptX服务初始化失败:', error)
      // 创建一个兜底的服务对象
      promptXService = {
        async execute() {
          throw new Error('PromptX服务不可用')
        }
      }
    }
  }

  /**
   * 获取角色的完整内容
   * 优先从缓存返回，缓存未命中则从PromptX加载
   */
  async getRoleContent(roleId: string, roleName: string): Promise<RoleContent | null> {
    // 检查缓存
    if (this.cache[roleId]) {
      console.log(`[RoleContentService] 从缓存返回角色内容: ${roleId}`)
      return this.cache[roleId]
    }

    // 检查是否正在加载
    if (this.loadingPromises.has(roleId)) {
      console.log(`[RoleContentService] 角色正在加载中，等待结果: ${roleId}`)
      return await this.loadingPromises.get(roleId)!
    }

    // 开始加载
    const loadingPromise = this.loadRoleContent(roleId, roleName)
    this.loadingPromises.set(roleId, loadingPromise)

    try {
      const result = await loadingPromise
      return result
    } finally {
      this.loadingPromises.delete(roleId)
    }
  }

  /**
   * 从PromptX加载角色内容
   */
  private async loadRoleContent(roleId: string, roleName: string): Promise<RoleContent | null> {
    console.log(`[RoleContentService] 开始从PromptX加载角色内容: ${roleId}`)
    
    try {
      // 确保PromptX服务已初始化
      if (!promptXService) {
        await this.initializePromptXService()
      }
      
      const startTime = Date.now()
      
      // 🔥 修复：使用action获取完整的角色激活内容（包含思维、执行、知识、记忆）
      const result = await promptXService.execute('action', [roleId])
      const loadTime = Date.now() - startTime

      // 🔍 调试：详细检查action返回的数据结构
      console.log(`[RoleContentService] action结果详细分析:`, {
        success: result.success,
        dataType: typeof result.data,
        dataStructure: result.data ? Object.keys(result.data) : 'null',
        rawData: result.data,
        stringLength: typeof result.data === 'string' ? result.data.length : 'not string'
      })

      // 检查IPC包装的结果
      if (!result || result.success === false) {
        console.error(`[RoleContentService] 角色加载失败: ${roleId}`, result?.error || 'Unknown error')
        return null
      }

      // 提取内容 - ActionCommand返回的是完整的角色激活结果
      let content: string
      if (typeof result.data === 'string') {
        // ActionCommand返回的是完整激活内容的字符串
        content = result.data
        console.log(`[RoleContentService] 获取完整激活内容，长度: ${content.length}`)
      } else if (result.data && typeof result.data === 'object') {
        // 🔍 检查ActionCommand返回的对象结构
        console.log(`[RoleContentService] ActionCommand对象结构:`, Object.keys(result.data))
        
        if (result.data.content && typeof result.data.content === 'string') {
          content = result.data.content
          console.log(`[RoleContentService] 从ActionCommand.content获取内容，长度: ${content.length}`)
        } else if (typeof result.data.toString === 'function') {
          // ActionCommand的toString方法会返回完整的激活内容（包括思维、执行、知识、记忆）
          const activationContent = result.data.toString()
          if (activationContent && activationContent.length > 50) { // ActionCommand内容通常很丰富
            content = activationContent
            console.log(`[RoleContentService] 从ActionCommand.toString获取完整激活内容，长度: ${content.length}`)
          } else {
            console.warn(`[RoleContentService] ActionCommand返回内容太短:`, activationContent)
            content = `角色 ${roleId} 激活异常，请重试角色选择`
          }
        } else {
          console.warn(`[RoleContentService] ActionCommand返回未知格式`)
          content = `角色 ${roleId} 激活异常，请重试角色选择`
        }
      } else {
        console.warn(`[RoleContentService] ActionCommand返回意外类型`)
        content = `角色 ${roleId} 激活异常，请重试角色选择`
      }

      // 创建角色内容对象
      const roleContent: RoleContent = {
        roleId,
        roleName,
        content,
        loadedAt: new Date().toISOString(),
        tokenEstimate: Math.round(content.length / 4)
      }

      // 缓存内容
      this.cache[roleId] = roleContent

      console.log(`[RoleContentService] 角色内容加载成功: ${roleId}, 耗时: ${loadTime}ms, 预估tokens: ${roleContent.tokenEstimate}`)
      
      return roleContent

    } catch (error) {
      console.error(`[RoleContentService] 角色加载异常: ${roleId}`, error)
      return null
    }
  }

  /**
   * 预热角色缓存
   * 在用户选择角色时立即调用，提前准备内容
   */
  async preloadRole(roleId: string, roleName: string): Promise<void> {
    console.log(`[RoleContentService] 预热角色缓存: ${roleId}`)
    await this.getRoleContent(roleId, roleName)
  }

  /**
   * 检查角色是否已缓存
   */
  isRoleCached(roleId: string): boolean {
    return !!this.cache[roleId]
  }

  /**
   * 清除角色缓存
   */
  clearRoleCache(roleId?: string): void {
    if (roleId) {
      delete this.cache[roleId]
      console.log(`[RoleContentService] 已清除角色缓存: ${roleId}`)
    } else {
      this.cache = {}
      console.log(`[RoleContentService] 已清除所有角色缓存`)
    }
  }

  /**
   * 获取缓存状态
   */
  getCacheStatus(): {
    totalCached: number
    cachedRoles: string[]
    totalTokens: number
  } {
    const cachedRoles = Object.keys(this.cache)
    const totalTokens = Object.values(this.cache)
      .reduce((sum, role) => sum + role.tokenEstimate, 0)

    return {
      totalCached: cachedRoles.length,
      cachedRoles,
      totalTokens
    }
  }
}

// 单例实例
export const roleContentService = new RoleContentService()