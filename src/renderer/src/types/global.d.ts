// 直接定义ElectronAPI类型，确保与preload实现一致
export {}

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

      // PromptX本地调用API
      promptx: {
        execute: (command: string, args?: any[]) => Promise<any>
        isCommandAvailable: (command: string) => Promise<boolean>
        getAvailableCommands: () => Promise<string[]>
        getAvailableRoles: () => Promise<any>
        activateRole: (roleId: string) => Promise<any>
        learn: (resourceUrl: string) => Promise<any>
        initWorkspace: (workspacePath?: string, ideType?: string) => Promise<any>
        remember: (role: string, content: string) => Promise<any>
        recall: (role: string, query?: string) => Promise<any>
        think: (role: string, thought: any) => Promise<any>
      }

      // 文件管理API
      file: {
        // 新的附件API
        upload: (fileBuffer: ArrayBuffer, metadata: { name: string; mimeType: string }) => Promise<any>
        get: (fileId: string) => Promise<any>
        getContent: (fileId: string) => Promise<any>
        delete: (fileId: string) => Promise<any>
        
        // 保留原有的资源管理API
        list: (filters?: any) => Promise<any[]>
        read: (fileId: string) => Promise<string>
        stats: () => Promise<any>
        save: (fileData: any) => Promise<any>
        export: (fileId: string, targetPath: string) => Promise<void>
        tree: (category?: string) => Promise<any>
        updateContent: (fileId: string, content: string) => Promise<any>
      }
    }
  }
}
