/**
 * LangChain集成服务的IPC处理器
 * 为渲染进程提供LangChain功能的访问接口
 */

import { ipcMain } from 'electron';
import { LLMService } from '../services/llm/LLMService.js';
import { ModelConfigEntity } from '../../shared/entities/ModelConfigEntity.js';
import { ProviderConfigEntity } from '../../shared/entities/ProviderConfigEntity.js';
import { LLMRequest } from '../../shared/interfaces/IModelProvider.js';
import { ChatSessionEntity } from '../../shared/entities/ChatSessionEntity.js';
import { LocalStorageService } from '../services/core/LocalStorageService.js';

// 创建服务实例
const langChainService = new LLMService();
const storageService = new LocalStorageService();

/**
 * 注册所有LangChain相关的IPC处理器
 */
export function registerLangChainHandlers() {
  console.log('注册LangChain IPC处理器...');

  // 获取所有配置
  ipcMain.handle('langchain:getAllConfigs', async () => {
    try {
      // console.log('IPC: 获取所有模型配置');
      const configs = await langChainService.getAllConfigs();
      // console.log(`IPC: 返回 ${configs.length} 个配置`);
      return configs.map((config: ModelConfigEntity) => config.toData());
    } catch (error) {
      console.error('IPC: 获取配置失败:', error);
      throw error;
    }
  });


  // 保存配置
  ipcMain.handle('langchain:saveConfig', async (_, configData) => {
    try {
      console.log('IPC: 保存提供商配置:', configData.name);

      // 确保日期字段是正确的格式
      const normalizedData = {
        ...configData,
        createdAt: configData.createdAt instanceof Date ? configData.createdAt : new Date(configData.createdAt || Date.now()),
        updatedAt: configData.updatedAt instanceof Date ? configData.updatedAt : new Date(configData.updatedAt || Date.now())
      };

      const config = new ProviderConfigEntity(normalizedData);
      await langChainService.saveConfig(config);
      console.log('IPC: 配置保存成功');
      return true;
    } catch (error) {
      console.error('IPC: 保存配置失败:', error);
      throw error;
    }
  });

  // 删除配置
  ipcMain.handle('langchain:deleteConfig', async (_, configId: string) => {
    try {
      console.log('IPC: 删除模型配置:', configId);
      await langChainService.deleteConfig(configId);
      console.log('IPC: 配置删除成功');
      return true;
    } catch (error) {
      console.error('IPC: 删除配置失败:', error);
      throw error;
    }
  });

  // 测试配置
  ipcMain.handle('langchain:testConfig', async (_, configData) => {
    try {
      console.log('IPC: 测试提供商配置:', configData.name);
      const config = new ProviderConfigEntity(configData);
      const result = await langChainService.testConfig(config);
      console.log('IPC: 配置测试完成:', result.success);
      return result;
    } catch (error) {
      console.error('IPC: 测试配置失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '测试异常'
      };
    }
  });

  // 获取可用模型列表
  ipcMain.handle('langchain:getAvailableModels', async (_, configData) => {
    try {
      console.log('IPC: 获取可用模型列表:', configData.provider);
      const config = new ModelConfigEntity(configData);
      const models = await langChainService.getAvailableModels(config);
      console.log(`IPC: 获取到 ${models.length} 个模型`);
      return models;
    } catch (error) {
      console.error('IPC: 获取模型列表失败:', error);
      throw error;
    }
  });

  // 发送消息（使用配置）
  ipcMain.handle('langchain:sendMessageWithConfig', async (_, request: LLMRequest, configData) => {
    try {
      console.log('IPC: 发送消息:', request.message.substring(0, 50) + '...');
      const config = new ModelConfigEntity(configData);
      const response = await langChainService.sendMessageWithConfig(request, config);
      console.log('IPC: 消息发送成功');
      return response;
    } catch (error) {
      console.error('IPC: 发送消息失败:', error);
      throw error;
    }
  });

  // 使用默认配置发送消息
  ipcMain.handle('langchain:sendMessageWithDefault', async (_, request: LLMRequest) => {
    try {
      console.log('IPC: 使用默认配置发送消息');
      const response = await langChainService.sendMessageWithDefault(request);
      console.log('IPC: 默认配置消息发送成功');
      return response;
    } catch (error) {
      console.error('IPC: 默认配置消息发送失败:', error);
      throw error;
    }
  });

  // 获取提供商统计
  ipcMain.handle('langchain:getProviderStats', async () => {
    try {
      console.log('IPC: 获取提供商统计');
      const stats = await langChainService.getProviderStats();
      console.log('IPC: 统计获取成功:', stats);
      return stats;
    } catch (error) {
      console.error('IPC: 获取统计失败:', error);
      throw error;
    }
  });

  // 刷新提供商模型列表
  ipcMain.handle('langchain:refreshProviderModels', async (_, configId: string) => {
    try {
      console.log('IPC: 刷新提供商模型列表:', configId);
      const models = await langChainService.refreshProviderModels(configId);
      console.log(`IPC: 刷新成功，获取到 ${models.length} 个模型`);
      return models;
    } catch (error) {
      console.error('IPC: 刷新模型列表失败:', error);
      throw error;
    }
  });

  // 批量测试所有启用的配置
  ipcMain.handle('langchain:testAllEnabledConfigs', async () => {
    try {
      console.log('IPC: 批量测试所有启用的配置');
      const results = await langChainService.testAllEnabledConfigs();
      console.log(`IPC: 批量测试完成，测试了 ${results.length} 个配置`);
      return results;
    } catch (error) {
      console.error('IPC: 批量测试失败:', error);
      throw error;
    }
  });

  // 新架构：AI服务API
  console.log('注册 ai:sendMessage 处理器...');
  ipcMain.handle('ai:sendMessage', async (_, request: any) => {
    try {
      console.log('IPC: AI发送消息:', request.llmRequest?.message?.substring(0, 50) + '...');
      console.log('IPC: 配置ID:', request.configId);
      const response = await langChainService.sendMessage(request.llmRequest, request.configId);
      console.log('IPC: AI消息发送成功');
      return { success: true, data: response };
    } catch (error) {
      console.error('IPC: AI消息发送失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });
  console.log('ai:sendMessage 处理器注册完成');

  ipcMain.handle('ai:testProvider', async (_, configId: string) => {
    try {
      console.log('IPC: AI测试提供商:', configId);
      const result = await langChainService.testProvider(configId);
      console.log('IPC: AI测试提供商成功');
      return { success: true, data: result };
    } catch (error) {
      console.error('IPC: AI测试提供商失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });

  // 支持MCP工具的AI消息发送
  ipcMain.handle('ai:sendMessageWithMCPTools', async (_, request: any) => {
    try {
      console.log('IPC: AI发送消息(启用MCP工具):', request.llmRequest?.message?.substring(0, 50) + '...');
      console.log('IPC: 配置ID:', request.configId);
      console.log('IPC: 启用MCP工具:', request.enableMCPTools);

      const response = await langChainService.sendMessageWithMCPTools(
        request.llmRequest,
        request.configId,
        request.enableMCPTools || false
      );

      console.log('IPC: AI消息发送成功(MCP工具)');
      return { success: true, data: response };
    } catch (error) {
      console.error('IPC: AI消息发送失败(MCP工具):', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });

  // 获取可用模型列表 (AI API)
  ipcMain.handle('ai:getAvailableModels', async (_, params: any) => {
    try {
      console.log('IPC: AI获取可用模型列表:', params.baseURL);
      
      // 构造临时配置对象来调用/models API
      const tempConfig = new ModelConfigEntity({
        id: 'temp-config',
        name: 'Temporary Config',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        apiKey: params.apiKey,
        baseURL: params.baseURL,
        isEnabled: true,
        priority: 1,
        enabledModels: [],
        status: 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      const models = await langChainService.getAvailableModels(tempConfig);
      console.log(`IPC: AI获取到 ${models.length} 个模型`);
      return models;
    } catch (error) {
      console.error('IPC: AI获取模型列表失败:', error);
      throw error;
    }
  });

  // === 会话管理相关处理器 ===

  // 获取所有会话
  ipcMain.handle('langchain:getAllSessions', async () => {
    try {
      // console.log('IPC: 获取所有聊天会话');
      const sessions = await storageService.loadChatSessions();
      // console.log(`IPC: 返回 ${sessions.length} 个会话`);
      return {
        success: true,
        data: sessions.map((session: ChatSessionEntity) => session.toData())
      };
    } catch (error) {
      console.error('IPC: 获取会话失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取会话失败'
      };
    }
  });

  // 保存会话
  ipcMain.handle('langchain:saveSession', async (_, sessionData) => {
    try {
      console.log('IPC: 保存聊天会话:', sessionData.title);

      // 确保日期字段是正确的格式
      const normalizedData = {
        ...sessionData,
        createdAt: sessionData.createdAt instanceof Date ? sessionData.createdAt.toISOString() : sessionData.createdAt,
        updatedAt: sessionData.updatedAt instanceof Date ? sessionData.updatedAt.toISOString() : sessionData.updatedAt
      };

      const session = new ChatSessionEntity(normalizedData);

      // 获取现有会话列表
      const existingSessions = await storageService.loadChatSessions();

      // 查找是否已存在该会话
      const existingIndex = existingSessions.findIndex((s: ChatSessionEntity) => s.id === session.id);

      if (existingIndex >= 0) {
        // 更新现有会话
        existingSessions[existingIndex] = session;
      } else {
        // 添加新会话
        existingSessions.unshift(session);
      }

      // 保存到存储
      await storageService.saveChatSessions(existingSessions);

      console.log('IPC: 会话保存成功');
      return {
        success: true,
        data: session.toData()
      };
    } catch (error) {
      console.error('IPC: 保存会话失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存会话失败'
      };
    }
  });

  // 删除会话
  ipcMain.handle('langchain:deleteSession', async (_, sessionId) => {
    try {
      console.log('IPC: 删除聊天会话:', sessionId);

      // 获取现有会话列表
      const existingSessions = await storageService.loadChatSessions();

      // 过滤掉要删除的会话
      const filteredSessions = existingSessions.filter((s: ChatSessionEntity) => s.id !== sessionId);

      // 保存更新后的会话列表
      await storageService.saveChatSessions(filteredSessions);

      console.log('IPC: 会话删除成功');
      return {
        success: true,
        data: { deletedSessionId: sessionId }
      };
    } catch (error) {
      console.error('IPC: 删除会话失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除会话失败'
      };
    }
  });

  console.log('LangChain IPC处理器注册完成');
}

/**
 * 注销所有LangChain相关的IPC处理器
 */
export function unregisterLangChainHandlers() {
  console.log('注销LangChain IPC处理器...');
  
  const handlers = [
    'langchain:getAllConfigs',
    'langchain:getOrCreateDefaultConfig',
    'langchain:saveConfig',
    'langchain:deleteConfig',
    'langchain:testConfig',
    'langchain:getAvailableModels',
    'langchain:sendMessageWithConfig',
    'langchain:sendMessageWithDefault',
    'langchain:getProviderStats',
    'langchain:refreshProviderModels',
    'langchain:testAllEnabledConfigs',
    'langchain:getAllSessions',
    'langchain:saveSession',
    'langchain:deleteSession',
    'ai:sendMessage',
    'ai:testProvider',
    'ai:getAvailableModels',
    'ai:sendMessageWithMCPTools'
  ];

  handlers.forEach(handler => {
    ipcMain.removeAllListeners(handler);
  });

  console.log('LangChain IPC处理器注销完成');
}
