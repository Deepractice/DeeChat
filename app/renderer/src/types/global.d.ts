/**
 * 全局类型声明
 * 定义 window.electronAPI 接口
 *
 * 注意：此文件不能有顶层的 import/export 语句
 * 否则会被视为模块而非全局声明
 */

// 定义 ElectronAPI 接口
interface ElectronAPI {
      // 流式事件监听
      onStreamEvent: (callback: (data: any) => void) => void
      onStreamComplete: (callback: (data: any) => void) => void
      onStreamError: (callback: (data: any) => void) => void
      removeStreamListeners: () => void

      // AI配置相关API
      aiConfig: {
        create: (input: any) => Promise<{ success: boolean; data?: any; error?: string }>
        getAll: () => Promise<{ success: boolean; data?: any[]; error?: string }>
        get: (nameOrId?: string | number) => Promise<{ success: boolean; data?: any; error?: string }>
        update: (id: number, input: any) => Promise<{ success: boolean; error?: string }>
        delete: (nameOrId: string | number) => Promise<{ success: boolean; error?: string }>
        getModels: (configName: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
        setModelPreference: (configName: string, model: string) => Promise<{ success: boolean; error?: string }>
        getModelPreference: (configName: string) => Promise<{ success: boolean; data?: string; error?: string }>
        getAllModelPreferences: () => Promise<{ success: boolean; data?: Record<string, string>; error?: string }>
      }

      // 对话相关API
      conversation: {
        createSession: (input: any) => Promise<{ success: boolean; data?: any; error?: string }>
        getSessions: () => Promise<{ success: boolean; data?: any[]; error?: string }>
        getSession: (sessionId: string) => Promise<{ success: boolean; data?: any; error?: string }>
        sendMessage: (input: any) => Promise<{ success: boolean; data?: any; error?: string }>
        sendMessageStream: (input: any) => Promise<{ success: boolean; data?: string[]; error?: string }>
        getMessageHistory: (sessionId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
        deleteSession: (sessionId: string) => Promise<{ success: boolean; error?: string }>
        clearCache: () => Promise<{ success: boolean; error?: string }>
        updateSessionTitle: (sessionId: string, newTitle: string) => Promise<{ success: boolean; error?: string }>
      }

      // PromptX相关API
      promptx: {
        discover: (focus?: 'all' | 'roles' | 'tools') => Promise<any>
        action: (roleId: string) => Promise<any>
        execute: (command: string, args?: any[]) => Promise<any>
      }

      // MCP相关API
      mcp: {
        listServers: () => Promise<{ success: boolean; data?: any[]; error?: string }>
        addServer: (config: any) => Promise<{ success: boolean; error?: string }>
        updateServer: (serverId: string, updates: any) => Promise<{ success: boolean; error?: string }>
        removeServer: (serverId: string) => Promise<{ success: boolean; error?: string }>
        connect: (serverId: string) => Promise<{ success: boolean; error?: string }>
        disconnect: (serverId: string) => Promise<{ success: boolean; error?: string }>
        listTools: (serverId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
        callTool: (serverId: string, toolName: string, args?: any) => Promise<{ success: boolean; data?: any; error?: string }>
        listResources: (serverId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
        readResource: (serverId: string, uri: string) => Promise<{ success: boolean; data?: any; error?: string }>
      }

      // 系统信息
      system: {
        platform: string
        version: string
      }

  // 窗口控制（可选 - 如果未实现则为 undefined）
  window?: {
    minimize?: () => void
    maximize?: () => void
    close?: () => void
    isMaximized?: () => Promise<boolean>
  }
}

// 扩展全局 Window 接口
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

// 必须有这个空导出，让 TypeScript 将此文件识别为模块
// 但同时 declare global 会让类型成为全局类型
export {}