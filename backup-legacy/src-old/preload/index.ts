import { contextBridge, ipcRenderer } from 'electron'

// 监听主进程发送的日志消息并输出到渲染进程控制台
ipcRenderer.on('main-process-log', (_event, logData) => {
  const { level, message, timestamp } = logData;
  const formattedMessage = `[${new Date(timestamp).toLocaleTimeString()}] ${message}`;
  
  if (level === 'info') {
    console.info(formattedMessage);
  } else if (level === 'warn') {
    console.warn(formattedMessage);
  } else if (level === 'error') {
    console.error(formattedMessage);
  }
});

// 监听后端日志
ipcRenderer.on('backend-log', (_event, logData) => {
  // 这里可以添加额外的处理逻辑，目前主要是转发给组件
});

// 定义暴露给渲染进程的 API
const electronAPI = {
  // 应用信息
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // 工具函数  
  generateUUID: () => crypto.randomUUID(),

  // LLM API 相关（通过主进程调用，确保安全性）
  sendMessage: (message: string, config: any) =>
    ipcRenderer.invoke('llm:sendMessage', message, config),

  // 🔥 流式消息相关事件监听
  onStreamStart: (callback: (data: any) => void) => {
    ipcRenderer.on('llm:stream-start', (_event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('llm:stream-start')
  },
  onStreamUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('llm:stream-update', (_event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('llm:stream-update')
  },
  onStreamComplete: (callback: (data: any) => void) => {
    ipcRenderer.on('llm:stream-complete', (_event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('llm:stream-complete')
  },

  // 配置管理（旧版兼容）
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: any) => ipcRenderer.invoke('config:set', config),

  // 聊天历史
  getChatHistory: () => ipcRenderer.invoke('chat:getHistory'),
  saveChatMessage: (message: any) => ipcRenderer.invoke('chat:saveMessage', message),

  // 聊天API
  chat: {
    getHistory: () => ipcRenderer.invoke('chat:getHistory'),
    saveMessage: (message: any) => ipcRenderer.invoke('chat:saveMessage', message),
    deleteSession: (sessionId: string) => ipcRenderer.invoke('chat:deleteSession', sessionId),
  },

  // 新架构：模型管理API
  model: {
    getAll: () => ipcRenderer.invoke('model:getAll'),
    save: (config: any) => ipcRenderer.invoke('model:save', config),
    delete: (id: string) => ipcRenderer.invoke('model:delete', id),
    test: (id: string) => ipcRenderer.invoke('model:test', id),
    update: (config: any) => ipcRenderer.invoke('model:update', config),
    fetchModels: (provider: string, apiKey: string, baseURL: string) => 
      ipcRenderer.invoke('model:fetchModels', provider, apiKey, baseURL),
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
    streamMessage: (request: any) => ipcRenderer.invoke('ai:streamMessage', request),
    testProvider: (configId: string) => ipcRenderer.invoke('ai:testProvider', configId),
    getAvailableModels: (params: any) => ipcRenderer.invoke('ai:getAvailableModels', params),
    
    // 🌊 流式消息事件监听
    onStreamChunk: (callback: (data: any) => void) => {
      ipcRenderer.on('ai:streamChunk', (_event, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('ai:streamChunk')
    },
  },

  // 🔥 根层级的streamMessage方法（兼容前端调用）
  streamMessage: (request: any) => ipcRenderer.invoke('ai:streamMessage', request),

  // 🖼️ 窗口管理API（修复App.tsx中的window调用）
  window: {
    resize: (width: number, height: number) => ipcRenderer.invoke('window:resize', width, height),
    getSize: () => ipcRenderer.invoke('window:getSize'),
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

  // PromptX本地调用API
  promptx: {
    execute: (command: string, args?: any[]) => ipcRenderer.invoke('promptx:execute', command, args),
    isCommandAvailable: (command: string) => ipcRenderer.invoke('promptx:isCommandAvailable', command),
    getAvailableCommands: () => ipcRenderer.invoke('promptx:getAvailableCommands'),
    getAvailableRoles: () => ipcRenderer.invoke('promptx:getAvailableRoles'),
    activateRole: (roleId: string) => ipcRenderer.invoke('promptx:activateRole', roleId),
    learn: (resourceUrl: string) => ipcRenderer.invoke('promptx:learn', resourceUrl),
    initWorkspace: (workspacePath?: string, ideType?: string) => 
      ipcRenderer.invoke('promptx:initWorkspace', workspacePath, ideType),
    remember: (role: string, content: string) => ipcRenderer.invoke('promptx:remember', role, content),
    recall: (role: string, query?: string) => ipcRenderer.invoke('promptx:recall', role, query),
    think: (role: string, thought: any) => ipcRenderer.invoke('promptx:think', role, thought),
    // 便捷方法：直接调用welcome命令
    welcome: () => ipcRenderer.invoke('promptx:execute', 'welcome'),
    // 便捷方法：直接调用action命令  
    action: (roleId: string) => ipcRenderer.invoke('promptx:execute', 'action', [roleId])
  },

  // 🤖 调试API（仅开发环境）
  debug: {
    getSystemRoleStatus: () => ipcRenderer.invoke('debug:getSystemRoleStatus'),
    resetSystemRole: () => ipcRenderer.invoke('debug:resetSystemRole')
  },

  // 📁 PromptX资源管理API（保留与PromptX资源管理相关的功能）
  file: {
    // PromptX资源管理API - 保留
    list: (filters?: any) => ipcRenderer.invoke('file:list', filters),
    read: (fileId: string) => ipcRenderer.invoke('file:read', fileId),
    stats: () => ipcRenderer.invoke('file:stats'),
    tree: (category?: string) => ipcRenderer.invoke('file:tree', category),
    updateContent: (fileId: string, content: string) => ipcRenderer.invoke('file:updateContent', fileId, content),
    
    // 工作区文件操作API - 用于直接写入PromptX目录
    write: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
    readFile: (filePath: string) => ipcRenderer.invoke('file:readFile', filePath),
    ensureDir: (dirPath: string) => ipcRenderer.invoke('file:ensureDir', dirPath),
    getPromptXWorkspacePath: () => ipcRenderer.invoke('file:getPromptXWorkspacePath'),
    getAppDataPath: () => ipcRenderer.invoke('file:getAppDataPath'),
    getProjectPath: () => ipcRenderer.invoke('file:getProjectPath'),
    
    // 文件对话框API - 用于导出功能
    showSaveDialog: (options: any) => ipcRenderer.invoke('file:showSaveDialog', options),
    showOpenDialog: (options: any) => ipcRenderer.invoke('file:showOpenDialog', options),
    
    // DeeChat工作区文件操作API
    delete: (filePath: string) => ipcRenderer.invoke('file:delete', filePath),
    showInFolder: (filePath: string) => ipcRenderer.invoke('file:showInFolder', filePath)
    // 📁 以下附件管理API已移除，请使用PromptX的@file://协议:
    // - upload: 文件上传
    // - get: 文件获取
    // - getContent: 文件内容读取
    // - delete: 文件删除
    // - save: 文件保存
    // - export: 文件导出
  },

  // 🔧 文件操作API已移除，请使用PromptX的@file://协议
  // fileOp API已全部移除：read, write, isEditable

  // 🪟 窗口管理API (已在上面定义，移除重复)

  // 🌐 浏览器相关API（保留用于未来扩展）
  browser: {
    // 占位 - 如果需要与主进程通信的浏览器功能可以在这里添加
    openExternal: (url: string) => ipcRenderer.invoke('browser:open-external', url)
  },

  // 🔥 通用事件监听器（用于流式消息）
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, callback)
  },
  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback)
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },

  // 🔧 后端日志监听
  onBackendLog: (callback: (event: any, log: any) => void) => {
    ipcRenderer.on('backend-log', callback)
  }
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 🚨 调试日志：验证API是否正确暴露
console.log('🔧 [Preload] electronAPI已暴露到渲染进程')
console.log('🔧 [Preload] model对象:', electronAPI.model)
console.log('🔧 [Preload] fetchModels方法存在:', typeof electronAPI.model.fetchModels)

// 类型声明（供 TypeScript 使用）
export type ElectronAPI = typeof electronAPI
