declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>;
      generateUUID: () => string;
      
      // File API
      file: {
        list: (filters?: any) => Promise<any[]>;
        get: (fileId: string) => Promise<any>;
        read: (fileId: string) => Promise<string>;
        stats: () => Promise<any>;
        save: (fileData: any) => Promise<any>;
        delete: (fileId: string) => Promise<void>;
        export: (fileId: string, targetPath: string) => Promise<void>;
        tree: (category?: string) => Promise<any[]>;
        updateContent: (fileId: string, content: string) => Promise<void>;
      };
      
      // Model API
      model: {
        getAll: () => Promise<any[]>;
        save: (config: any) => Promise<any>;
        delete: (id: string) => Promise<void>;
        test: (id: string) => Promise<any>;
        update: (config: any) => Promise<any>;
      };
      
      // AI API
      ai: {
        sendMessage: (request: any) => Promise<any>;
        sendMessageWithMCPTools: (request: any) => Promise<any>;
        testProvider: (configId: string) => Promise<any>;
        getAvailableModels: (params: any) => Promise<any[]>;
      };
      
      // MCP API
      mcp: {
        addServer: (serverConfig: any) => Promise<any>;
        removeServer: (serverId: string) => Promise<void>;
        getAllServers: () => Promise<any[]>;
        getServerStatus: (serverId: string) => Promise<any>;
        testServerConnection: (serverId: string) => Promise<any>;
        updateServerConfig: (serverId: string, updates: any) => Promise<any>;
        discoverServerTools: (serverId: string) => Promise<any[]>;
        getAllTools: () => Promise<any[]>;
        callTool: (request: any) => Promise<any>;
        searchTools: (query: string) => Promise<any[]>;
        getToolUsageStats: () => Promise<any>;
        exportConfigs: () => Promise<any>;
        importConfigs: (configData: string) => Promise<any>;
      };
      
      // PromptX API
      promptx: {
        execute: (command: string, args?: any[]) => Promise<any>;
        isCommandAvailable: (command: string) => Promise<boolean>;
        getAvailableCommands: () => Promise<string[]>;
        getAvailableRoles: () => Promise<any[]>;
        activateRole: (roleId: string) => Promise<any>;
        learn: (resourceUrl: string) => Promise<any>;
        initWorkspace: (workspacePath?: string, ideType?: string) => Promise<any>;
        remember: (role: string, content: string) => Promise<any>;
        recall: (role: string, query?: string) => Promise<any>;
        think: (role: string, thought: any) => Promise<any>;
      };
      
      // Other APIs...
      preference: {
        get: () => Promise<any>;
        save: (preferences: any) => Promise<any>;
      };
      
      session: {
        getModel: (sessionId: string) => Promise<any>;
        switchModel: (sessionId: string, modelId: string) => Promise<any>;
      };
      
      langchain: {
        getAllConfigs: () => Promise<any[]>;
        saveConfig: (configData: any) => Promise<any>;
        deleteConfig: (id: string) => Promise<void>;
        testConfig: (configData: any) => Promise<any>;
        getAvailableModels: (configData: any) => Promise<any[]>;
        refreshProviderModels: (configId: string) => Promise<any>;
        sendMessageWithConfig: (request: any, configData: any) => Promise<any>;
        sendMessageWithDefault: (request: any) => Promise<any>;
        getProviderStats: () => Promise<any>;
        testAllEnabledConfigs: () => Promise<any>;
        getAllSessions: () => Promise<any[]>;
        saveSession: (sessionData: any) => Promise<any>;
        deleteSession: (sessionId: string) => Promise<void>;
      };
      
      debug: {
        getSystemRoleStatus: () => Promise<any>;
        resetSystemRole: () => Promise<void>;
      };
      
      // Legacy APIs
      sendMessage: (message: string, config: any) => Promise<any>;
      getConfig: () => Promise<any>;
      setConfig: (config: any) => Promise<any>;
      getChatHistory: () => Promise<any>;
      saveChatMessage: (message: any) => Promise<any>;
    };
  }
}

export {};