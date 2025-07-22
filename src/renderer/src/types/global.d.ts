// 直接定义ElectronAPI类型，确保与preload实现一致
declare global {
  interface Window {
    electronAPI: {
      // 应用信息
      getVersion: () => Promise<string>
      generateUUID: () => string

      // 旧版LLM API（兼容性）
      sendMessage: (message: string, config: any) => Promise<any>
      getConfig: () => Promise<any>
      setConfig: (config: any) => Promise<any>
      getChatHistory: () => Promise<any>
      saveChatMessage: (message: any) => Promise<any>

      // 模型管理API
      model: {
        getAll: () => Promise<any>
        save: (config: any) => Promise<any>
        delete: (id: string) => Promise<any>
        test: (id: string) => Promise<any>
        update: (config: any) => Promise<any>
      }

      // 用户偏好API
      preference: {
        get: () => Promise<any>
        save: (preferences: any) => Promise<any>
      }

      // 会话管理API
      session: {
        getModel: (sessionId: string) => Promise<any>
        switchModel: (sessionId: string, modelId: string) => Promise<any>
      }

      // AI服务API
      ai: {
        sendMessage: (request: any) => Promise<any>
        testProvider: (configId: string) => Promise<any>
      }

      // LangChain集成API
      langchain: {
        getAllConfigs: () => Promise<any>
        saveConfig: (configData: any) => Promise<any>
        deleteConfig: (id: string) => Promise<any>
        testConfig: (configData: any) => Promise<any>
        getAvailableModels: (configData: any) => Promise<any>
        refreshProviderModels: (configId: string) => Promise<any>
        sendMessageWithConfig: (request: any, configData: any) => Promise<any>
        sendMessageWithDefault: (request: any) => Promise<any>
        getProviderStats: () => Promise<any>
        testAllEnabledConfigs: () => Promise<any>
        getAllSessions: () => Promise<any>
        saveSession: (sessionData: any) => Promise<any>
        deleteSession: (sessionId: string) => Promise<any>
      }

      // MCP API
      mcp: {
        // 服务器管理
        addServer: (serverConfig: any) => Promise<any>
        removeServer: (serverId: string) => Promise<any>
        getAllServers: () => Promise<any>
        getServerStatus: (serverId: string) => Promise<any>
        testServerConnection: (serverId: string) => Promise<any>
        updateServerConfig: (serverId: string, updates: any) => Promise<any>

        // 工具管理
        discoverServerTools: (serverId: string) => Promise<any>
        getAllTools: () => Promise<any>
        callTool: (request: any) => Promise<any>
        searchTools: (query: string) => Promise<any>
        getToolUsageStats: () => Promise<any>

        // 配置管理
        exportConfigs: () => Promise<any>
        importConfigs: (configData: string) => Promise<any>
      }
    }
  }
}
