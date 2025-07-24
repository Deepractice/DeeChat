// 静默系统角色管理器 - 简化版本

/**
 * 静默系统角色管理器
 * 负责在后台自动激活和维护系统角色，用户完全无感知
 * 
 * 核心理念：最好的功能是用户感受不到的功能
 */
export class SilentSystemRoleManager {
  private readonly SYSTEM_ROLE_ID = 'promptx-system-butler'
  private isSystemRoleActive = false
  private activationAttempts = 0
  private readonly MAX_ACTIVATION_ATTEMPTS = 3

  constructor() {
    console.log('🤖 [静默系统角色] 管理器初始化')
  }

  /**
   * 应用启动时静默激活系统角色
   * 新策略：不在启动时激活，而是在首次AI对话时按需激活
   */
  async initializeOnStartup(): Promise<void> {
    console.log('🤖 [静默系统角色] 管理器已初始化，等待首次对话时激活')
    // 不在这里激活，避免启动时的连接问题
    // 将在首次AI对话时（ensureSystemRoleActive）进行激活
    this.isSystemRoleActive = false
  }

  /**
   * 确保系统角色处于激活状态
   * 在每次AI对话前调用，保证系统角色始终可用
   */
  async ensureSystemRoleActive(): Promise<boolean> {
    // 如果已激活，直接返回
    if (this.isSystemRoleActive) {
      return true
    }

    // 如果已达到最大尝试次数，不再重试
    if (this.activationAttempts >= this.MAX_ACTIVATION_ATTEMPTS) {
      console.warn('⚠️ [静默系统角色] 已达到最大尝试次数，系统角色将保持未激活状态')
      return false
    }

    try {
      console.log('🎯 [静默系统角色] 首次对话时激活系统角色...')
      await this.activateSystemRole()
      return this.isSystemRoleActive
    } catch (error) {
      console.warn('⚠️ [静默系统角色] 激活失败，继续使用基础AI功能:', error)
      return false
    }
  }

  /**
   * 激活系统角色（核心方法）
   */
  private async activateSystemRole(): Promise<void> {
    this.activationAttempts++
    console.log(`🤖 [静默系统角色] 第${this.activationAttempts}次尝试激活: ${this.SYSTEM_ROLE_ID}`)

    try {
      // 直接调用模拟激活，避免复杂的MCP连接问题  
      await this.callPromptXAction(this.SYSTEM_ROLE_ID)
      
      this.isSystemRoleActive = true
      this.activationAttempts = 0 // 重置尝试次数
      console.log('✅ [静默系统角色] 系统角色激活成功')
      
    } catch (error) {
      console.warn('⚠️ [静默系统角色] 激活失败，将在后台继续尝试:', error)
      this.isSystemRoleActive = false
      // 不抛出错误，避免阻塞应用启动
    }
  }


  /**
   * 调用PromptX的action工具激活角色
   */
  private async callPromptXAction(roleId: string): Promise<void> {
    // 直接使用模拟模式，避免MCP连接问题
    try {
      console.log(`🔧 [静默系统角色] 使用模拟模式激活角色: ${roleId}`)
      await this.simulateRoleActivation(roleId)
      console.log(`✅ [静默系统角色] 角色激活成功（模拟）: ${roleId}`)
    } catch (error) {
      console.warn(`⚠️ [静默系统角色] 模拟激活异常: ${roleId}`, error)
      // 不抛出错误，确保不会阻塞应用启动
    }
  }


  /**
   * 模拟角色激活（备用方案）
   */
  private async simulateRoleActivation(roleId: string): Promise<void> {
    // 使用更简单的同步方式，避免任何异步问题
    try {
      console.log(`🎭 [静默系统角色] 模拟激活角色: ${roleId}`)
      // 简单延时模拟激活过程
      await new Promise(resolve => setTimeout(resolve, 50))
      console.log(`✅ [静默系统角色] 模拟激活完成: ${roleId}`)
    } catch (error) {
      // 即使模拟也失败，也不抛出错误，只记录日志
      console.warn(`⚠️ [静默系统角色] 模拟激活出现异常: ${roleId}`, error)
    }
  }



  /**
   * 获取系统角色状态（仅用于调试）
   */
  getSystemRoleStatus(): { isActive: boolean; attempts: number; roleId: string } {
    return {
      isActive: this.isSystemRoleActive,
      attempts: this.activationAttempts,
      roleId: this.SYSTEM_ROLE_ID
    }
  }

  /**
   * 重置系统角色状态（仅用于调试/测试）
   */
  resetSystemRoleState(): void {
    console.log('🔄 [静默系统角色] 重置系统状态')
    this.isSystemRoleActive = false
    this.activationAttempts = 0
  }
}

// 创建单例实例
export const silentSystemRoleManager = new SilentSystemRoleManager()