import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 流式事件监听
  onStreamEvent: (callback: (data: any) => void) => {
    ipcRenderer.on('conversation:stream-event', (event, data) => callback(data))
  },
  onStreamComplete: (callback: (data: any) => void) => {
    ipcRenderer.on('conversation:stream-complete', (event, data) => callback(data))
  },
  onStreamError: (callback: (data: any) => void) => {
    ipcRenderer.on('conversation:stream-error', (event, data) => callback(data))
  },
  removeStreamListeners: () => {
    ipcRenderer.removeAllListeners('conversation:stream-event')
    ipcRenderer.removeAllListeners('conversation:stream-complete')
    ipcRenderer.removeAllListeners('conversation:stream-error')
  },
  // AI配置相关API - 对应后端 AIConfigurationDomain (新版本)
  aiConfig: {
    // 创建AI配置 - ai-config:create
    create: (input: {
      name: string           // 用户友好名称
      api_key: string        // API密钥
      base_url: string       // API服务地址
      is_default?: boolean   // 是否默认
      is_active?: boolean    // 是否启用
    }) => ipcRenderer.invoke('ai-config:create', input),
    
    // 获取所有配置 - ai-config:getAll
    getAll: () => ipcRenderer.invoke('ai-config:getAll'),
    
    // 获取单个配置 - ai-config:get
    get: (nameOrId?: string | number) => 
      ipcRenderer.invoke('ai-config:get', nameOrId),
    
    // 更新配置 - ai-config:update
    update: (id: number, input: Partial<CreateAIConfigInput>) => 
      ipcRenderer.invoke('ai-config:update', id, input),
    
    // 删除配置 - ai-config:delete
    delete: (nameOrId: string | number) => 
      ipcRenderer.invoke('ai-config:delete', nameOrId),
    
    // 获取可用模型 - ai-config:getModels
    getModels: (configName: string) => 
      ipcRenderer.invoke('ai-config:getModels', configName),
    
    // 模型偏好管理
    setModelPreference: (configName: string, model: string) => 
      ipcRenderer.invoke('ai-config:setModelPreference', configName, model),
    
    getModelPreference: (configName: string) => 
      ipcRenderer.invoke('ai-config:getModelPreference', configName),
    
    getAllModelPreferences: () => 
      ipcRenderer.invoke('ai-config:getAllModelPreferences')
  },

  // 对话相关API - 对应后端 ConversationDomain
  conversation: {
    // 创建会话
    createSession: (input: {
      title?: string
      ai_config: {
        baseUrl: string
        model: string
        apiKey: string
        temperature?: number
        maxTokens?: number
      }
      system_prompt?: string
    }) => ipcRenderer.invoke('conversation:create-session', input),
    
    // 获取所有会话
    getSessions: () => ipcRenderer.invoke('conversation:get-sessions'),
    
    // 获取单个会话
    getSession: (sessionId: string) => ipcRenderer.invoke('conversation:get-session', sessionId),
    
    // 发送消息（同步）
    sendMessage: (input: {
      session_id: string
      content: string
      ai_config: {
        baseUrl: string
        model: string
        apiKey: string
        temperature?: number
        maxTokens?: number
      }
      options?: {
        temperature?: number
        max_tokens?: number
        system_prompt?: string
      }
    }) => ipcRenderer.invoke('conversation:send-message', input),
    
    // 发送消息（流式）
    sendMessageStream: (input: {
      session_id: string
      content: string
      ai_config: {
        baseUrl: string
        model: string
        apiKey: string
        temperature?: number
        maxTokens?: number
      }
      options?: {
        temperature?: number
        max_tokens?: number
        system_prompt?: string
      }
    }) => ipcRenderer.invoke('conversation:send-message-stream', input),
    
    // 获取消息历史
    getMessageHistory: (sessionId: string) => ipcRenderer.invoke('conversation:get-message-history', sessionId),
    
    // 删除会话
    deleteSession: (sessionId: string) => ipcRenderer.invoke('conversation:delete-session', sessionId),
    
    // 清理缓存
    clearCache: () => ipcRenderer.invoke('conversation:clear-cache')
  },

  // PromptX 角色管理API - 对应后端 RoleManagementDomain
  promptx: {
    // 发现可用资源（角色、工具等）
    discover: (focus?: 'all' | 'roles' | 'tools') =>
      ipcRenderer.invoke('promptx:discover', focus),

    // 激活指定角色
    action: (roleId: string) =>
      ipcRenderer.invoke('promptx:action', roleId),

    // 通用执行接口（扩展功能时使用）
    execute: (command: string, args?: any[]) =>
      ipcRenderer.invoke('promptx:execute', command, args)
  },

  // MCP服务器管理API - 对应后端 McpDomain
  mcp: {
    // 服务器管理
    listServers: () => ipcRenderer.invoke('mcp:list-servers'),
    addServer: (config: McpServerConfig) => ipcRenderer.invoke('mcp:add-server', config),
    updateServer: (serverId: string, updates: Partial<McpServerConfig>) =>
      ipcRenderer.invoke('mcp:update-server', serverId, updates),
    removeServer: (serverId: string) => ipcRenderer.invoke('mcp:remove-server', serverId),

    // 连接管理
    connect: (serverId: string) => ipcRenderer.invoke('mcp:connect', serverId),
    disconnect: (serverId: string) => ipcRenderer.invoke('mcp:disconnect', serverId),

    // MCP功能调用
    listTools: (serverId: string) => ipcRenderer.invoke('mcp:list-tools', serverId),
    callTool: (serverId: string, toolName: string, args?: any) =>
      ipcRenderer.invoke('mcp:call-tool', serverId, toolName, args),
    listResources: (serverId: string) => ipcRenderer.invoke('mcp:list-resources', serverId),
    readResource: (serverId: string, uri: string) =>
      ipcRenderer.invoke('mcp:read-resource', serverId, uri)
  },

  // 系统API (预留扩展)
  system: {
    platform: process.platform,
    version: process.versions.electron
  }
})

// 新版本AI配置类型定义
interface AIConfig {
  id: number
  name: string
  api_key: string
  base_url: string
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

interface CreateAIConfigInput {
  name: string
  api_key: string
  base_url: string
  is_default?: boolean
  is_active?: boolean
}

// 对话相关类型定义
interface ConversationSession {
  id: string
  title: string
  ai_model: string
  created_at: string
  updated_at: string
  message_count: number
}

interface ConversationMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  token_usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface AIConfigInput {
  baseUrl: string
  model: string
  apiKey: string
  temperature?: number
  maxTokens?: number
}

interface CreateSessionInput {
  title?: string
  ai_config: AIConfigInput
  system_prompt?: string
}

interface SendMessageInput {
  session_id: string
  content: string
  ai_config: AIConfigInput
  options?: {
    temperature?: number
    max_tokens?: number
    system_prompt?: string
  }
}

// MCP相关类型定义
interface McpServerConfig {
  id: string
  name: string
  description?: string
  transport: {
    type: 'stdio' | 'http' | 'websocket'
    command: string
    args?: string[]
    env?: Record<string, string>
    cwd?: string
    url?: string
  }
  enabled: boolean
  autoReconnect?: boolean
  timeout?: number
  tags?: string[]
  createdAt?: string
  updatedAt?: string
}

interface McpServerWithStatus extends McpServerConfig {
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error'
  toolCount?: number
  resourceCount?: number
  lastError?: string
}

interface McpToolInfo {
  name: string
  description?: string
  inputSchema?: any
}

interface McpResourceInfo {
  uri: string
  name?: string
  description?: string
  mimeType?: string
}

// TypeScript类型声明
declare global {
  interface Window {
    electronAPI: {
      aiConfig: {
        create: (input: CreateAIConfigInput) => Promise<{ success: boolean; data?: AIConfig; error?: string }>
        getAll: () => Promise<{ success: boolean; data?: AIConfig[]; error?: string }>
        get: (nameOrId?: string | number) => Promise<{ success: boolean; data?: AIConfig | null; error?: string }>
        update: (id: number, input: Partial<CreateAIConfigInput>) => Promise<{ success: boolean; data?: AIConfig; error?: string }>
        delete: (nameOrId: string | number) => Promise<{ success: boolean; error?: string }>
        getModels: (configName: string) => Promise<{ success: boolean; data?: any; error?: string }>
        setModelPreference: (configName: string, model: string) => Promise<{ success: boolean; error?: string }>
        getModelPreference: (configName: string) => Promise<{ success: boolean; data?: string | null; error?: string }>
        getAllModelPreferences: () => Promise<{ success: boolean; data?: Record<string, string>; error?: string }>
      }
      conversation: {
        createSession: (input: CreateSessionInput) => Promise<{ success: boolean; data?: ConversationSession; error?: string }>
        getSessions: () => Promise<{ success: boolean; data?: ConversationSession[]; error?: string }>
        getSession: (sessionId: string) => Promise<{ success: boolean; data?: ConversationSession | null; error?: string }>
        sendMessage: (input: SendMessageInput) => Promise<{ success: boolean; data?: { userMessage: ConversationMessage; aiMessage: ConversationMessage }; error?: string }>
        sendMessageStream: (input: SendMessageInput) => Promise<{ success: boolean; data?: string[]; error?: string }>
        getMessageHistory: (sessionId: string) => Promise<{ success: boolean; data?: ConversationMessage[]; error?: string }>
        deleteSession: (sessionId: string) => Promise<{ success: boolean; error?: string }>
        clearCache: () => Promise<{ success: boolean; error?: string }>
      }
      promptx: {
        discover: (focus?: 'all' | 'roles' | 'tools') => Promise<any>
        action: (roleId: string) => Promise<any>
        execute: (command: string, args?: any[]) => Promise<any>
      }
      mcp: {
        listServers: () => Promise<{ success: boolean; data?: McpServerWithStatus[]; error?: string }>
        addServer: (config: McpServerConfig) => Promise<{ success: boolean; error?: string }>
        updateServer: (serverId: string, updates: Partial<McpServerConfig>) => Promise<{ success: boolean; error?: string }>
        removeServer: (serverId: string) => Promise<{ success: boolean; error?: string }>
        connect: (serverId: string) => Promise<{ success: boolean; error?: string }>
        disconnect: (serverId: string) => Promise<{ success: boolean; error?: string }>
        listTools: (serverId: string) => Promise<{ success: boolean; data?: McpToolInfo[]; error?: string }>
        callTool: (serverId: string, toolName: string, args?: any) => Promise<{ success: boolean; data?: any; error?: string }>
        listResources: (serverId: string) => Promise<{ success: boolean; data?: McpResourceInfo[]; error?: string }>
        readResource: (serverId: string, uri: string) => Promise<{ success: boolean; data?: any; error?: string }>
      }
      system: {
        platform: string
        version: string
      }
    }
  }
}

// 导出一个空对象以让TypeScript将此文件视为模块
export {}