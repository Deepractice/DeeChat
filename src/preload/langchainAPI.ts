/**
 * LangChain API的preload脚本
 * 为渲染进程提供安全的LangChain功能访问接口
 */

import { contextBridge, ipcRenderer } from 'electron';
import { ModelConfigEntity } from '../shared/entities/ModelConfigEntity.js';
import { LLMRequest } from '../shared/interfaces/IModelProvider.js';

// LangChain API接口定义
export interface LangChainAPI {
  // 配置管理
  getAllConfigs: () => Promise<ModelConfigEntity[]>;
  saveConfig: (config: ModelConfigEntity) => Promise<void>;
  deleteConfig: (id: string) => Promise<void>;
  
  // 配置测试
  testConfig: (config: ModelConfigEntity) => Promise<{
    success: boolean;
    responseTime?: number;
    response?: string;
    error?: string;
  }>;
  
  // 模型发现
  getAvailableModels: (config: ModelConfigEntity) => Promise<string[]>;
  refreshProviderModels: (configId: string) => Promise<string[]>;
  
  // 消息发送
  sendMessageWithConfig: (request: LLMRequest, config: ModelConfigEntity) => Promise<any>;
  sendMessageWithDefault: (request: LLMRequest) => Promise<any>;
  
  // 统计和批量操作
  getProviderStats: () => Promise<{
    total: number;
    enabled: number;
    available: number;
    byProvider: Record<string, number>;
  }>;
  testAllEnabledConfigs: () => Promise<Array<{
    configId: string;
    name: string;
    result: any;
  }>>;

  // 会话管理
  getAllSessions: () => Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }>;
  saveSession: (sessionData: any) => Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }>;
  deleteSession: (sessionId: string) => Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }>;
}

// 实现LangChain API
const langChainAPI: LangChainAPI = {
  // 配置管理
  getAllConfigs: () => ipcRenderer.invoke('langchain:getAllConfigs'),
  
  saveConfig: (config: ModelConfigEntity) => 
    ipcRenderer.invoke('langchain:saveConfig', config.toData()),
  
  deleteConfig: (id: string) => 
    ipcRenderer.invoke('langchain:deleteConfig', id),

  // 配置测试
  testConfig: (config: ModelConfigEntity) => 
    ipcRenderer.invoke('langchain:testConfig', config.toData()),

  // 模型发现
  getAvailableModels: (config: ModelConfigEntity) => 
    ipcRenderer.invoke('langchain:getAvailableModels', config.toData()),
  
  refreshProviderModels: (configId: string) => 
    ipcRenderer.invoke('langchain:refreshProviderModels', configId),

  // 消息发送
  sendMessageWithConfig: (request: LLMRequest, config: ModelConfigEntity) => 
    ipcRenderer.invoke('langchain:sendMessageWithConfig', request, config.toData()),
  
  sendMessageWithDefault: (request: LLMRequest) => 
    ipcRenderer.invoke('langchain:sendMessageWithDefault', request),

  // 统计和批量操作
  getProviderStats: () =>
    ipcRenderer.invoke('langchain:getProviderStats'),

  testAllEnabledConfigs: () =>
    ipcRenderer.invoke('langchain:testAllEnabledConfigs'),

  // 会话管理
  getAllSessions: () =>
    ipcRenderer.invoke('langchain:getAllSessions'),

  saveSession: (sessionData: any) =>
    ipcRenderer.invoke('langchain:saveSession', sessionData),

  deleteSession: (sessionId: string) =>
    ipcRenderer.invoke('langchain:deleteSession', sessionId)
};

/**
 * 暴露LangChain API到渲染进程
 */
export function exposeLangChainAPI() {
  try {
    contextBridge.exposeInMainWorld('electronAPI', {
      langchain: langChainAPI
    });
    console.log('LangChain API已暴露到渲染进程');
  } catch (error) {
    console.error('暴露LangChain API失败:', error);
  }
}

// 如果在preload环境中，自动暴露API
// 注释掉自动执行，避免覆盖主preload文件中的electronAPI
// if (typeof window !== 'undefined') {
//   exposeLangChainAPI();
// }
