import { EnhancedChatSession, ChatSession } from '../../../shared/types'
import { ModelConfigEntity } from '../../../shared/entities/ModelConfigEntity'
import { parseModelId } from '../../../shared/utils/modelIdHelper'
import { store } from '../store'

/**
 * 会话服务 - 负责完整的会话数据加载和管理
 * 实现数据驱动的架构，消除组件间的状态同步问题
 */
export class SessionService {
  
  /**
   * 加载完整的会话数据（包含模型配置）
   * @param sessionId 会话ID
   * @returns 包含完整模型配置的增强会话对象
   */
  static async loadSessionWithConfig(sessionId: string): Promise<EnhancedChatSession | null> {
    try {
      console.log('🔍 [SessionService] 开始加载完整会话数据:', sessionId)

      // 🔥 修复：使用 Redux 中的会话数据，而不是重新从后端获取
      const state = store.getState()
      const sessions = state.chat.sessions

      console.log('🔍 [SessionService] 从Redux获取会话列表:', sessions.map((s: any) => ({ id: s.id, title: s.title })))
      console.log('🔍 [SessionService] 查找的会话ID:', sessionId)

      const session = sessions.find((s: ChatSession) => s.id === sessionId)
      if (!session) {
        console.error('❌ [SessionService] 未找到会话:', sessionId)
        console.error('❌ [SessionService] 可用的会话IDs:', sessions.map((s: any) => s.id))
        return null
      }

      console.log('✅ [SessionService] 找到基础会话:', session.title)
      console.log('🔍 [SessionService] 会话详细信息:', {
        id: session.id,
        title: session.title,
        selectedModelId: session.selectedModelId,
        messagesCount: session.messages?.length || 0
      })
      
      // 2. 如果会话有选中的模型，加载完整的模型配置
      let selectedModelConfig: ModelConfigEntity | undefined
      let modelDisplayName: string | undefined
      
      if (session.selectedModelId) {
        console.log('🔍 [SessionService] 开始加载模型配置:', session.selectedModelId)
        
        // 使用parseModelId解析selectedModelId
        const { configId } = parseModelId(session.selectedModelId)
        
        console.log('🔍 [SessionService] 解析配置ID:', {
          原始modelId: session.selectedModelId,
          解析出的configId: configId
        })
        
        // 🔥 修复：获取所有配置，处理不同的API响应格式
        const configsResponse = await window.electronAPI?.langchain?.getAllConfigs()
        console.log('🔍 [SessionService] 配置API原始响应:', configsResponse)

        // 处理不同的响应格式
        let configs: any[] = []
        if (Array.isArray(configsResponse)) {
          // 直接返回数组格式
          configs = configsResponse
        } else if (configsResponse?.success && configsResponse.data) {
          // 标准 {success, data} 格式
          configs = configsResponse.data
        } else if (configsResponse?.data) {
          // 只有 data 字段
          configs = configsResponse.data
        }

        console.log('🔍 [SessionService] 解析后的配置列表:', {
          配置数量: configs.length,
          配置列表: configs.map((c: any) => ({ id: c.id, name: c.name }))
        })

        if (configs.length > 0) {
          const configData = configs.find((c: any) => c.id === configId)
          console.log('🔍 [SessionService] 查找配置结果:', {
            查找的configId: configId,
            找到的配置: configData ? { id: configData.id, name: configData.name } : null
          })

          if (configData) {
            // 🔥 修复：使用普通对象而不是类实例，避免Redux序列化警告
            selectedModelConfig = configData as ModelConfigEntity

            // 从 selectedModelId 中提取模型名称
            const modelName = session.selectedModelId.replace(configId + '-', '')
            const model = selectedModelConfig.models?.find((m: any) => m.id === modelName)
            modelDisplayName = model?.name || modelName

            console.log('✅ [SessionService] 加载模型配置成功:', {
              配置名称: selectedModelConfig.name,
              模型名称: modelDisplayName
            })
          } else {
            console.warn('⚠️ [SessionService] 未找到模型配置:', configId)
          }
        } else {
          console.error('❌ [SessionService] 获取配置列表失败或为空:', configsResponse)
        }
      }
      
      // 3. 构建增强会话对象
      const enhancedSession: EnhancedChatSession = {
        ...session,
        selectedModelConfig,
        modelDisplayName
      }
      
      console.log('✅ [SessionService] 完整会话数据加载完成:', {
        会话ID: enhancedSession.id,
        会话标题: enhancedSession.title,
        有模型配置: !!enhancedSession.selectedModelConfig,
        模型显示名: enhancedSession.modelDisplayName
      })
      
      return enhancedSession
      
    } catch (error) {
      console.error('❌ [SessionService] 加载会话数据失败:', error)
      return null
    }
  }
  
  /**
   * 切换到指定会话（数据驱动方式）
   * @param sessionId 会话ID
   * @returns 完整的会话数据
   */
  static async switchToSession(sessionId: string): Promise<EnhancedChatSession | null> {
    console.log('🔄 [SessionService] 开始切换会话:', sessionId)
    
    const enhancedSession = await this.loadSessionWithConfig(sessionId)
    
    if (enhancedSession) {
      console.log('✅ [SessionService] 会话切换成功:', enhancedSession.title)
    } else {
      console.error('❌ [SessionService] 会话切换失败:', sessionId)
    }
    
    return enhancedSession
  }
  
  /**
   * 获取所有会话的基础信息（用于侧边栏显示）
   * @returns 会话列表
   */
  static async getAllSessions(): Promise<ChatSession[]> {
    try {
      const response = await window.electronAPI?.langchain?.getAllSessions()
      if (response?.success && response.data) {
        return response.data
      }
      return []
    } catch (error) {
      console.error('❌ [SessionService] 获取会话列表失败:', error)
      return []
    }
  }
  
  /**
   * 保存会话数据
   * @param session 会话数据
   */
  static async saveSession(session: ChatSession): Promise<boolean> {
    try {
      const response = await window.electronAPI?.langchain?.saveSession(session)
      return response?.success || false
    } catch (error) {
      console.error('❌ [SessionService] 保存会话失败:', error)
      return false
    }
  }
}
