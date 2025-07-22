// Mock Electron API for development in browser
export const mockElectronAPI = {
  __isMock: true,

  // 应用信息
  getVersion: async () => '1.0.0-dev',

  // 工具函数
  generateUUID: () => 'mock-uuid-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),

  // LLM API 相关
  sendMessage: async (message: string, config: any) => {
    console.log('Mock sendMessage:', { message, config })
    return {
      success: false,
      error: 'Mock API - 需要在Electron环境中运行'
    }
  },

  // 配置管理
  getConfig: async () => {
    console.log('Mock getConfig called')
    return {
      success: true,
      data: {
        theme: 'light',
        language: 'zh-CN'
      }
    }
  },

  setConfig: async (config: any) => {
    console.log('Mock setConfig:', config)
    return { success: true }
  },

  // 聊天历史
  getChatHistory: async () => {
    console.log('Mock getChatHistory called')
    return {
      success: true,
      data: []
    }
  },

  saveChatMessage: async (message: any) => {
    console.log('Mock saveChatMessage:', message)
    return { success: true }
  },

  // 模型管理API
  model: {
    getAll: async () => {
      console.log('Mock model.getAll called')
      return {
        success: true,
        data: [
          {
            id: 'mock-openai-1',
            name: 'Mock OpenAI GPT-3.5',
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            apiKey: 'mock-key',
            baseURL: 'https://api.openai.com/v1',
            status: 'available',
            priority: 1,
            isEnabled: true,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 'mock-claude-1',
            name: 'Mock Claude 3',
            provider: 'anthropic',
            model: 'claude-3-sonnet-20240229',
            apiKey: 'mock-key',
            baseURL: 'https://api.anthropic.com',
            status: 'unavailable',
            priority: 2,
            isEnabled: false,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      }
    },

    save: async (config: any) => {
      console.log('Mock model.save:', config)
      return {
        success: true,
        data: {
          ...config,
          id: 'mock-' + Date.now(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
    },

    delete: async (id: string) => {
      console.log('Mock model.delete:', id)
      return { success: true }
    },

    test: async (id: string) => {
      console.log('Mock model.test:', id)
      return {
        success: false,
        error: 'Mock API - 无法在浏览器环境中测试真实API'
      }
    },

    update: async (config: any) => {
      console.log('Mock model.update:', config)
      return {
        success: true,
        data: {
          ...config,
          updatedAt: new Date()
        }
      }
    }
  },

  // 用户偏好API
  preference: {
    get: async () => {
      console.log('Mock preference.get called')
      return {
        success: true,
        data: {
          theme: 'light',
          language: 'zh-CN',
          autoSave: true
        }
      }
    },

    save: async (preferences: any) => {
      console.log('Mock preference.save:', preferences)
      return { success: true }
    }
  },

  // 会话管理API
  session: {
    getModel: async (sessionId: string) => {
      console.log('Mock session.getModel:', sessionId)
      return {
        success: true,
        data: {
          sessionId,
          modelId: 'mock-openai-1'
        }
      }
    },

    switchModel: async (sessionId: string, modelId: string) => {
      console.log('Mock session.switchModel:', { sessionId, modelId })
      return { success: true }
    }
  },

  // AI服务API
  ai: {
    sendMessage: async (request: any) => {
      console.log('Mock ai.sendMessage:', request)
      return {
        success: false,
        error: 'Mock API - 需要在Electron环境中运行'
      }
    },

    sendMessageWithMCPTools: async (request: any) => {
      console.log('Mock ai.sendMessageWithMCPTools:', request)
      return {
        success: false,
        error: 'Mock API - 需要在Electron环境中运行'
      }
    },

    testProvider: async (configId: string) => {
      console.log('Mock ai.testProvider:', configId)
      return {
        success: false,
        error: 'Mock API - 无法在浏览器环境中测试真实API'
      }
    }
  },

  // LangChain API
  langchain: {
    getAllConfigs: async () => {
      console.log('Mock langchain.getAllConfigs called')
      return {
        success: true,
        data: [
          {
            id: 'mock-provider-1',
            name: 'Mock OpenAI Provider',
            provider: 'openai',
            apiKey: 'mock-key',
            baseURL: 'https://api.openai.com/v1',
            isEnabled: true,
            priority: 1,
            availableModels: ['gpt-3.5-turbo', 'gpt-4'],
            enabledModels: ['gpt-3.5-turbo'],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      }
    },

    saveConfig: async (config: any) => {
      console.log('Mock langchain.saveConfig:', config)
      return {
        success: true,
        data: {
          ...config,
          id: config.id || 'mock-' + Date.now(),
          createdAt: config.createdAt || new Date(),
          updatedAt: new Date()
        }
      }
    },

    getAvailableModels: async (provider: string) => {
      console.log('Mock langchain.getAvailableModels:', provider)
      const mockModels = {
        openai: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
        anthropic: ['claude-3-sonnet-20240229', 'claude-3-opus-20240229'],
        google: ['gemini-pro', 'gemini-pro-vision']
      }
      return {
        success: true,
        data: mockModels[provider as keyof typeof mockModels] || []
      }
    },

    sendMessageWithConfig: async (message: string, configId: string) => {
      console.log('Mock langchain.sendMessageWithConfig:', { message, configId })
      return {
        success: false,
        error: 'Mock API - 需要在Electron环境中运行'
      }
    },

    testConfig: async (configId: string) => {
      console.log('Mock langchain.testConfig:', configId)
      return {
        success: false,
        error: 'Mock API - 无法在浏览器环境中测试真实配置'
      }
    },

    getStatistics: async () => {
      console.log('Mock langchain.getStatistics called')
      return {
        success: true,
        data: {
          totalMessages: 0,
          totalTokens: 0,
          totalCost: 0,
          providerStats: {}
        }
      }
    },

    getSessionModel: async (sessionId: string) => {
      console.log('Mock langchain.getSessionModel:', sessionId)
      return {
        success: true,
        data: {
          sessionId,
          modelId: 'mock-provider-1',
          modelName: 'Mock OpenAI Provider'
        }
      }
    },

    switchSessionModel: async (sessionId: string, modelId: string) => {
      console.log('Mock langchain.switchSessionModel:', { sessionId, modelId })
      return {
        success: true,
        data: {
          sessionId,
          modelId,
          switched: true
        }
      }
    },

    // 配置删除
    deleteConfig: async (id: string) => {
      console.log('Mock langchain.deleteConfig:', id)
      return { success: true }
    },

    // 模型刷新
    refreshProviderModels: async (configId: string) => {
      console.log('Mock langchain.refreshProviderModels:', configId)
      return {
        success: true,
        data: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']
      }
    },

    // 默认消息发送
    sendMessageWithDefault: async (request: any) => {
      console.log('Mock langchain.sendMessageWithDefault:', request)
      return {
        success: false,
        error: 'Mock API - 需要在Electron环境中运行'
      }
    },

    // 提供商统计
    getProviderStats: async () => {
      console.log('Mock langchain.getProviderStats called')
      return {
        success: true,
        data: {
          totalProviders: 1,
          enabledProviders: 0,
          totalRequests: 0,
          totalTokens: 0
        }
      }
    },

    // 批量测试
    testAllEnabledConfigs: async () => {
      console.log('Mock langchain.testAllEnabledConfigs called')
      return {
        success: true,
        data: {
          tested: 0,
          passed: 0,
          failed: 0,
          results: []
        }
      }
    },

    // 会话管理
    getAllSessions: async () => {
      console.log('Mock langchain.getAllSessions called')
      return {
        success: true,
        data: []
      }
    },

    saveSession: async (sessionData: any) => {
      console.log('Mock langchain.saveSession:', sessionData)
      return {
        success: true,
        data: {
          ...sessionData,
          id: sessionData.id || 'mock-session-' + Date.now()
        }
      }
    },

    deleteSession: async (sessionId: string) => {
      console.log('Mock langchain.deleteSession:', sessionId)
      return { success: true }
    }
  },

  // MCP API
  mcp: {
    // 服务器管理
    addServer: async (serverConfig: any) => {
      console.log('Mock mcp.addServer:', serverConfig)
      return {
        success: true,
        data: {
          ...serverConfig,
          id: 'mock-server-' + Date.now()
        }
      }
    },

    removeServer: async (serverId: string) => {
      console.log('Mock mcp.removeServer:', serverId)
      return { success: true }
    },

    getAllServers: async () => {
      console.log('Mock mcp.getAllServers called')
      return {
        success: true,
        data: []
      }
    },

    getServerStatus: async (serverId: string) => {
      console.log('Mock mcp.getServerStatus:', serverId)
      return {
        success: true,
        data: {
          id: serverId,
          status: 'disconnected',
          lastConnected: null
        }
      }
    },

    testServerConnection: async (serverId: string) => {
      console.log('Mock mcp.testServerConnection:', serverId)
      return {
        success: false,
        error: 'Mock API - 无法在浏览器环境中测试MCP连接'
      }
    },

    updateServerConfig: async (serverId: string, updates: any) => {
      console.log('Mock mcp.updateServerConfig:', { serverId, updates })
      return {
        success: true,
        data: {
          id: serverId,
          ...updates
        }
      }
    },

    // 工具管理
    discoverServerTools: async (serverId: string) => {
      console.log('Mock mcp.discoverServerTools:', serverId)
      return {
        success: true,
        data: []
      }
    },

    getAllTools: async () => {
      console.log('Mock mcp.getAllTools called')
      return {
        success: true,
        data: []
      }
    },

    callTool: async (request: any) => {
      console.log('Mock mcp.callTool:', request)
      return {
        success: false,
        error: 'Mock API - 无法在浏览器环境中调用MCP工具'
      }
    },

    searchTools: async (query: string) => {
      console.log('Mock mcp.searchTools:', query)
      return {
        success: true,
        data: []
      }
    },

    getToolUsageStats: async () => {
      console.log('Mock mcp.getToolUsageStats called')
      return {
        success: true,
        data: {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          toolStats: {}
        }
      }
    },

    // 配置管理
    exportConfigs: async () => {
      console.log('Mock mcp.exportConfigs called')
      return {
        success: true,
        data: '{}'
      }
    },

    importConfigs: async (configData: string) => {
      console.log('Mock mcp.importConfigs:', configData)
      return {
        success: true,
        data: {
          imported: 0,
          skipped: 0,
          errors: []
        }
      }
    }
  }
}

// 在开发环境中设置mock API
// 自动加载Mock API以统一浏览器和Electron环境的行为
if (typeof window !== 'undefined' && !window.electronAPI) {
  (window as any).electronAPI = mockElectronAPI
  console.log('🔧 Mock Electron API 已加载 - 开发模式')
}
