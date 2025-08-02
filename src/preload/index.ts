import { contextBridge, ipcRenderer } from 'electron'

// 定义暴露给渲染进程的 API
const electronAPI = {
  // 应用信息
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // 工具函数  
  generateUUID: () => crypto.randomUUID(),

  // LLM API 相关（通过主进程调用，确保安全性）
  sendMessage: (message: string, config: any) =>
    ipcRenderer.invoke('llm:sendMessage', message, config),

  // 配置管理（旧版兼容）
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: any) => ipcRenderer.invoke('config:set', config),

  // 聊天历史
  getChatHistory: () => ipcRenderer.invoke('chat:getHistory'),
  saveChatMessage: (message: any) => ipcRenderer.invoke('chat:saveMessage', message),

  // 新架构：模型管理API
  model: {
    getAll: () => ipcRenderer.invoke('model:getAll'),
    save: (config: any) => ipcRenderer.invoke('model:save', config),
    delete: (id: string) => ipcRenderer.invoke('model:delete', id),
    test: (id: string) => ipcRenderer.invoke('model:test', id),
    update: (config: any) => ipcRenderer.invoke('model:update', config),
  },

  // 新架构：用户偏好API
  preference: {
    get: () => ipcRenderer.invoke('preference:get'),
    save: (preferences: any) => ipcRenderer.invoke('preference:save', preferences),
  },

  // 新架构：会话管理API
  session: {
    getModel: (sessionId: string) => ipcRenderer.invoke('session:getModel', sessionId),
    switchModel: (sessionId: string, modelId: string) =>
      ipcRenderer.invoke('session:switchModel', sessionId, modelId),
  },

  // 新架构：AI服务API
  ai: {
    sendMessage: (request: any) => ipcRenderer.invoke('ai:sendMessage', request),
    sendMessageWithMCPTools: (request: any) => ipcRenderer.invoke('ai:sendMessageWithMCPTools', request),
    testProvider: (configId: string) => ipcRenderer.invoke('ai:testProvider', configId),
    getAvailableModels: (params: any) => ipcRenderer.invoke('ai:getAvailableModels', params),
  },

  // LangChain集成API
  langchain: {
    // 配置管理
    getAllConfigs: () => ipcRenderer.invoke('langchain:getAllConfigs'),
    saveConfig: (configData: any) => ipcRenderer.invoke('langchain:saveConfig', configData),
    deleteConfig: (id: string) => ipcRenderer.invoke('langchain:deleteConfig', id),

    // 配置测试
    testConfig: (configData: any) => ipcRenderer.invoke('langchain:testConfig', configData),

    // 模型发现
    getAvailableModels: (configData: any) => ipcRenderer.invoke('langchain:getAvailableModels', configData),
    refreshProviderModels: (configId: string) => ipcRenderer.invoke('langchain:refreshProviderModels', configId),

    // 消息发送
    sendMessageWithConfig: (request: any, configData: any) =>
      ipcRenderer.invoke('langchain:sendMessageWithConfig', request, configData),
    sendMessageWithDefault: (request: any) =>
      ipcRenderer.invoke('langchain:sendMessageWithDefault', request),

    // 统计和批量操作
    getProviderStats: () => ipcRenderer.invoke('langchain:getProviderStats'),
    testAllEnabledConfigs: () => ipcRenderer.invoke('langchain:testAllEnabledConfigs'),

    // 会话管理
    getAllSessions: () => ipcRenderer.invoke('langchain:getAllSessions'),
    saveSession: (sessionData: any) => ipcRenderer.invoke('langchain:saveSession', sessionData),
    deleteSession: (sessionId: string) => ipcRenderer.invoke('langchain:deleteSession', sessionId)
  },

  // MCP API
  mcp: {
    // 服务器管理
    addServer: (serverConfig: any) => ipcRenderer.invoke('mcp:addServer', serverConfig),
    removeServer: (serverId: string) => ipcRenderer.invoke('mcp:removeServer', serverId),
    getAllServers: () => ipcRenderer.invoke('mcp:getAllServers'),
    getServerStatus: (serverId: string) => ipcRenderer.invoke('mcp:getServerStatus', serverId),
    testServerConnection: (serverId: string) => ipcRenderer.invoke('mcp:testServerConnection', serverId),
    updateServerConfig: (serverId: string, updates: any) =>
      ipcRenderer.invoke('mcp:updateServerConfig', serverId, updates),

    // 工具管理
    discoverServerTools: (serverId: string) => ipcRenderer.invoke('mcp:discoverServerTools', serverId),
    getAllTools: () => ipcRenderer.invoke('mcp:getAllTools'),
    callTool: (request: any) => ipcRenderer.invoke('mcp:callTool', request),
    searchTools: (query: string) => ipcRenderer.invoke('mcp:searchTools', query),
    getToolUsageStats: () => ipcRenderer.invoke('mcp:getToolUsageStats'),

    // 配置管理
    exportConfigs: () => ipcRenderer.invoke('mcp:exportConfigs'),
    importConfigs: (configData: string) => ipcRenderer.invoke('mcp:importConfigs', configData)
  },

  // 🤖 调试API（仅开发环境）
  debug: {
    getSystemRoleStatus: () => ipcRenderer.invoke('debug:getSystemRoleStatus'),
    resetSystemRole: () => ipcRenderer.invoke('debug:resetSystemRole')
  }
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 类型声明（供 TypeScript 使用）
export type ElectronAPI = typeof electronAPI
