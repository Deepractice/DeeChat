// Mock Electron API for development in browser

// 🌊 Mock流式事件监听器存储
const mockStreamListeners = new Map<string, Function>()

export const mockElectronAPI = {
  __isMock: true,

  // 应用信息
  getVersion: async () => '1.0.0-dev',

  // 工具函数
  generateUUID: () => 'mock-uuid-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),

  // 🗑️ [已删除] sendMessage - 统一使用ai.streamMessage

  // 🌊 流式消息事件监听器 (旧版兼容)
  onStreamStart: (callback: (data: any) => void) => {
    console.log('🚨 Mock onStreamStart被调用')
    mockStreamListeners.set('llm:stream-start', callback)
    return () => mockStreamListeners.delete('llm:stream-start')
  },
  
  onStreamUpdate: (callback: (data: any) => void) => {
    console.log('🚨 Mock onStreamUpdate被调用')
    mockStreamListeners.set('llm:stream-update', callback)
    return () => mockStreamListeners.delete('llm:stream-update')
  },
  
  onStreamComplete: (callback: (data: any) => void) => {
    console.log('🚨 Mock onStreamComplete被调用')
    mockStreamListeners.set('llm:stream-complete', callback)
    return () => mockStreamListeners.delete('llm:stream-complete')
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
    // 🗑️ [已删除] sendMessage, sendMessageWithMCPTools - 统一使用streamMessage

    streamMessage: async (request: any) => {
      console.log('🚨 Mock ai.streamMessage被调用:', request)
      
      // 🌊 模拟流式响应 - 模拟真实的流式消息发送
      const mockContent = `这是一个模拟的AI回复，针对您的消息: "${request.llmRequest?.message?.substring(0, 50)}..."

🤖 当前模拟状态:
- 选择的角色: ${request.llmRequest?.activeRole || '未选择'}
- 配置ID: ${request.configId?.substring(0, 8) || '默认'}
- MCP工具: ${request.enableMCPTools ? '启用' : '禁用'}
- 历史消息: ${request.chatHistory?.length || 0} 条

⚠️ 注意: 这是Mock API响应，实际功能需要在Electron环境中运行。`

      // 获取流事件回调
      const streamCallback = mockStreamListeners.get('ai:streamChunk')
      
      if (streamCallback) {
        // 🔥 发送开始事件
        setTimeout(() => {
          streamCallback({
            type: 'start',
            sessionId: request.sessionId
          })
        }, 100)

        // 🌊 模拟逐字输出
        const words = mockContent.split('')
        for (let i = 0; i < words.length; i++) {
          setTimeout(() => {
            streamCallback({
              type: 'token',
              content: words.slice(0, i + 1).join(''),
              sessionId: request.sessionId
            })
          }, 200 + i * 50) // 模拟打字效果
        }

        // 🔥 发送完成事件
        setTimeout(() => {
          streamCallback({
            type: 'complete',
            content: mockContent,
            sessionId: request.sessionId,
            model: 'mock-gpt-3.5-turbo',
            toolExecutions: []
          })
        }, 200 + words.length * 50 + 500)
      }
      
      return {
        success: true,
        data: { content: mockContent }
      }
    },

    onStreamChunk: (callback: (data: any) => void) => {
      console.log('🚨 Mock ai.onStreamChunk被调用')
      mockStreamListeners.set('ai:streamChunk', callback)
      return () => {
        console.log('Mock stream cleanup')
        mockStreamListeners.delete('ai:streamChunk')
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
  },

  // PromptX本地调用API
  promptx: {
    execute: async (command: string, args?: any[]) => {
      console.log('Mock promptx.execute:', { command, args })
      
      // 🔥 模拟PromptX命令执行
      const mockResponses: Record<string, any> = {
        'welcome': 'Mock PromptX系统已初始化 - 浏览器开发模式',
        'action': `Mock 角色激活: ${args?.[0] || 'unknown'} - 这是模拟的角色系统`,
        'recall': `Mock 记忆回调: ${args?.[1] || '无查询'} - 模拟记忆内容`,
        'remember': 'Mock 记忆存储成功',
        'learn': `Mock 资源学习: ${args?.[0] || 'unknown'} - 模拟学习过程`
      }
      
      return {
        success: true,
        data: mockResponses[command] || `Mock命令执行: ${command}`
      }
    },
    
    isCommandAvailable: async (command: string) => {
      console.log('Mock promptx.isCommandAvailable:', command)
      return { success: true, data: true }
    },
    
    getAvailableCommands: async () => {
      console.log('Mock promptx.getAvailableCommands called')
      return {
        success: true,
        data: ['welcome', 'action', 'recall', 'remember', 'learn']
      }
    },
    
    getAvailableRoles: async () => {
      console.log('Mock promptx.getAvailableRoles called')
      return {
        success: true,
        data: [
          { id: 'sean', name: 'Sean', description: 'Mock深度实践创始人' },
          { id: 'luban', name: 'Luban', description: 'Mock工具开发大师' },
          { id: 'noface', name: 'Noface', description: 'Mock万能学习助手' },
          { id: 'nuwa', name: 'Nuwa', description: 'Mock角色创造专家' },
          { id: 'assistant', name: 'Assistant', description: 'Mock基础AI助手' }
        ]
      }
    },
    
    activateRole: async (roleId: string) => {
      console.log('Mock promptx.activateRole:', roleId)
      return {
        success: true,
        data: `Mock角色 ${roleId} 已激活`
      }
    },
    
    learn: async (resourceUrl: string) => {
      console.log('Mock promptx.learn:', resourceUrl)
      return {
        success: true,
        data: `Mock学习资源: ${resourceUrl}`
      }
    },
    
    initWorkspace: async (workspacePath?: string, ideType?: string) => {
      console.log('Mock promptx.initWorkspace:', { workspacePath, ideType })
      return {
        success: true,
        data: 'Mock工作区初始化完成'
      }
    },
    
    remember: async (role: string, content: string) => {
      console.log('Mock promptx.remember:', { role, content })
      return {
        success: true,
        data: `Mock记忆存储: ${role}`
      }
    },
    
    recall: async (role: string, query?: string) => {
      console.log('Mock promptx.recall:', { role, query })
      return {
        success: true,
        data: `Mock记忆回调: ${role} - ${query || '全部记忆'}`
      }
    },
    
    think: async (role: string, thought: any) => {
      console.log('Mock promptx.think:', { role, thought })
      return {
        success: true,
        data: `Mock思考过程: ${role}`
      }
    },
    
    welcome: async () => {
      console.log('Mock promptx.welcome called')
      return {
        success: true,
        data: 'Mock PromptX欢迎信息'
      }
    },
    
    action: async (roleId: string) => {
      console.log('Mock promptx.action:', roleId)
      return {
        success: true,
        data: `Mock角色动作: ${roleId}`
      }
    }
  },

  // 调试API
  debug: {
    getSystemRoleStatus: async () => {
      console.log('Mock debug.getSystemRoleStatus called')
      return {
        success: true,
        data: {
          activeRole: 'mock-assistant',
          roleActivated: true,
          lastActivation: new Date().toISOString()
        }
      }
    },
    
    resetSystemRole: async () => {
      console.log('Mock debug.resetSystemRole called')
      return { success: true }
    }
  },

  // 文件管理API
  file: {
    list: async (filters?: any) => {
      console.log('Mock file.list:', filters)
      return { success: true, data: [] }
    },
    
    read: async (fileId: string) => {
      console.log('Mock file.read:', fileId)
      return { success: true, data: { id: fileId, content: 'Mock文件内容' } }
    },
    
    stats: async () => {
      console.log('Mock file.stats called')
      return { success: true, data: { totalFiles: 0, totalSize: 0 } }
    },
    
    tree: async (category?: string) => {
      console.log('Mock file.tree:', category)
      return { success: true, data: [] }
    },
    
    updateContent: async (fileId: string, content: string) => {
      console.log('Mock file.updateContent:', { fileId, content })
      return { success: true }
    },
    
    write: async (filePath: string, content: string) => {
      console.log('Mock file.write:', { filePath, content })
      return { success: true }
    },
    
    readFile: async (filePath: string) => {
      console.log('Mock file.readFile:', filePath)
      return { success: true, data: 'Mock文件内容' }
    },
    
    ensureDir: async (dirPath: string) => {
      console.log('Mock file.ensureDir:', dirPath)
      return { success: true }
    },
    
    getPromptXWorkspacePath: async () => {
      console.log('Mock file.getPromptXWorkspacePath called')
      return { success: true, data: '/mock/promptx/workspace' }
    },
    
    getAppDataPath: async () => {
      console.log('Mock file.getAppDataPath called')
      return { success: true, data: '/mock/app/data' }
    },
    
    getProjectPath: async () => {
      console.log('Mock file.getProjectPath called')
      return { success: true, data: '/mock/project/path' }
    },
    
    showSaveDialog: async (options: any) => {
      console.log('Mock file.showSaveDialog:', options)
      return { success: true, data: { filePath: '/mock/save/path.txt' } }
    },
    
    showOpenDialog: async (options: any) => {
      console.log('Mock file.showOpenDialog:', options)
      return { success: true, data: { filePaths: ['/mock/open/path.txt'] } }
    },
    
    delete: async (filePath: string) => {
      console.log('Mock file.delete:', filePath)
      return { success: true }
    },
    
    showInFolder: async (filePath: string) => {
      console.log('Mock file.showInFolder:', filePath)
      return { success: true }
    }
  },

  // 窗口管理API
  window: {
    resize: async (width: number, height: number) => {
      console.log('Mock window.resize:', { width, height })
      return { success: true }
    },
    
    getSize: async () => {
      console.log('Mock window.getSize called')
      return { success: true, data: { width: 1200, height: 800 } }
    }
  },

  // 浏览器相关API
  browser: {
    openExternal: async (url: string) => {
      console.log('Mock browser.openExternal:', url)
      window.open(url, '_blank')
      return { success: true }
    }
  }
}

// 在开发环境中设置mock API
// 自动加载Mock API以统一浏览器和Electron环境的行为
if (typeof window !== 'undefined' && !window.electronAPI) {
  (window as any).electronAPI = mockElectronAPI
  console.log('🔧 Mock Electron API 已加载 - 开发模式')
}
