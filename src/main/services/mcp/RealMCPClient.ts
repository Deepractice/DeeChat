/**
 * 真实的MCP客户端实现
 * 基于MCP协议规范实现
 */

import log from 'electron-log'
import { MCPServerEntity } from '../../../shared/entities/MCPServerEntity';
import { MCPToolEntity } from '../../../shared/entities/MCPToolEntity';
import {
  IMCPClient,
  MCPConnectionStatus,
  MCPToolCallRequest,
  MCPToolCallResponse
} from '../../../shared/interfaces/IMCPProvider';
import { StdioMCPAdapter, SSEMCPAdapter, MCPTransportAdapter } from '../../adapters/MCPTransportAdapter';
// import { MCPSandboxManager } from '../runtime/MCPSandboxManager';

/**
 * 真实的MCP客户端实现
 */
export class RealMCPClient implements IMCPClient {
  private server: MCPServerEntity;
  private adapter: MCPTransportAdapter;
  private status: MCPConnectionStatus = MCPConnectionStatus.DISCONNECTED;
  private tools: MCPToolEntity[] = [];
  private serverInfo?: { name: string; version: string };

  constructor(server: MCPServerEntity) {
    this.server = server;
    
    // 根据服务器类型创建适配器
    if (server.type === 'stdio') {
      this.adapter = new StdioMCPAdapter(server);
    } else {
      this.adapter = new SSEMCPAdapter(server);
    }

    // 监听适配器事件
    this.adapter.onEvent((event: any) => {
      switch (event.type) {
        case 'server_connected':
          this.status = MCPConnectionStatus.CONNECTED;
          break;
        case 'server_disconnected':
          this.status = MCPConnectionStatus.DISCONNECTED;
          break;
        case 'server_error':
          this.status = MCPConnectionStatus.ERROR;
          break;
      }
    });
  }

  async connect(server: MCPServerEntity): Promise<void> {
    log.info(`[Real MCP Client] 🔗 开始连接服务器: ${server.name}`);
    log.info(`[Real MCP Client] 🔧 服务器完整配置:`, {
      id: server.id,
      name: server.name,
      type: server.type,
      command: server.command,
      args: server.args,
      workingDirectory: server.workingDirectory,
      env: server.env,
      timeout: server.timeout,
      isEnabled: server.isEnabled
    });

    this.status = MCPConnectionStatus.CONNECTING;
    log.info(`[Real MCP Client] 📊 状态更新: CONNECTING`);

    try {
      log.info(`[Real MCP Client] 🔌 第一步：调用适配器连接...`);
      log.info(`[Real MCP Client] 🔍 适配器类型: ${this.adapter.constructor.name}`);
      log.info(`[Real MCP Client] 🔍 适配器连接状态: ${this.adapter.isConnected()}`);
      
      await this.adapter.connect();
      log.info(`[Real MCP Client] ✅ 适配器连接成功`);
      log.info(`[Real MCP Client] 🔍 连接后适配器状态: ${this.adapter.isConnected()}`);

      log.info(`[Real MCP Client] 🤝 第二步：开始初始化MCP会话...`);
      await this.initializeSession();
      log.info(`[Real MCP Client] ✅ MCP会话初始化成功`);

      log.info(`[Real MCP Client] 🛠️ 第三步：加载服务器工具列表...`);
      await this.loadTools();
      log.info(`[Real MCP Client] ✅ 工具列表加载完成，共${this.tools.length}个工具`);

      this.status = MCPConnectionStatus.CONNECTED;
      log.info(`[Real MCP Client] 📊 状态更新: CONNECTED`);
      log.info(`[Real MCP Client] 🎉 连接完全成功: ${server.name}`);

    } catch (error) {
      this.status = MCPConnectionStatus.ERROR;
      log.error(`[Real MCP Client] ❌ 连接过程失败: ${server.name}`);
      log.error(`[Real MCP Client] 💥 错误详情:`, error);
      log.error(`[Real MCP Client] 📊 状态更新: ERROR`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    log.info(`[Real MCP Client] 断开连接: ${this.server.name}`);
    
    try {
      await this.adapter.disconnect();
      this.status = MCPConnectionStatus.DISCONNECTED;
      this.tools = [];
      this.serverInfo = undefined;
      
      log.info(`[Real MCP Client] 断开连接完成: ${this.server.name}`);
    } catch (error) {
      log.error(`[Real MCP Client] 断开连接失败: ${this.server.name}`, error);
      throw error;
    }
  }

  getStatus(): MCPConnectionStatus {
    return this.status;
  }

  async discoverTools(): Promise<MCPToolEntity[]> {
    log.info(`[Real MCP Client] 开始发现工具: ${this.server.name}, 当前状态: ${this.status}`);

    if (this.status !== MCPConnectionStatus.CONNECTED) {
      log.error(`[Real MCP Client] 客户端未连接，状态: ${this.status}`);
      throw new Error(`客户端未连接，当前状态: ${this.status}`);
    }

    // 🔥 检查适配器状态
    if (!this.adapter) {
      log.error(`[Real MCP Client] 适配器不存在: ${this.server.name}`);
      throw new Error('适配器不存在');
    }

    log.info(`[Real MCP Client] 发现工具: ${this.server.name}`);

    try {
      // 🔥 检查适配器连接状态
      const adapterStatus = (this.adapter as any).connected;
      log.info(`[Real MCP Client] 适配器连接状态: ${adapterStatus}`);

      if (!adapterStatus) {
        log.error(`[Real MCP Client] 适配器已断开连接: ${this.server.name}`);
        this.status = MCPConnectionStatus.DISCONNECTED;
        throw new Error('适配器已断开连接');
      }

      // 发送tools/list请求
      log.info(`[Real MCP Client] 发送tools/list请求: ${this.server.name}`);
      const response = await this.adapter.sendRequest({
        method: 'tools/list',
        params: {}
      });

      if (!response || !Array.isArray(response.tools)) {
        log.warn(`[Real MCP Client] 无效的工具列表响应: ${this.server.name}`);
        return [];
      }

      // 转换为MCPToolEntity
      this.tools = response.tools.map((tool: any) => {
        return MCPToolEntity.create({
          name: tool.name,
          description: tool.description,
          serverId: this.server.id,
          serverName: this.server.name,
          inputSchema: tool.inputSchema,
          category: this.extractCategory(tool),
          tags: this.extractTags(tool)
        });
      });

      log.info(`[Real MCP Client] 发现 ${this.tools.length} 个工具: ${this.server.name}`);
      return this.tools;

    } catch (error) {
      log.error(`[Real MCP Client] 工具发现失败: ${this.server.name}`, error);
      throw error;
    }
  }

  async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    // 简化连接检查 - 主要检查适配器是否可用
    if (!this.adapter.isConnected()) {
      log.error(`[Real MCP Client] ❌ 适配器未连接`);
      throw new Error('适配器未连接，需要重新连接');
    }

    log.info(`[Real MCP Client] 🔧 调用工具: ${request.toolName}`, request.arguments);

    try {
      // 验证工具是否存在
      const tool = this.tools.find(t => t.name === request.toolName);
      if (!tool) {
        return {
          success: false,
          error: `工具不存在: ${request.toolName}`,
          callId: request.callId
        };
      }

      // 验证参数
      const validation = tool.validateArgs(request.arguments);
      if (!validation.isValid) {
        return {
          success: false,
          error: `参数验证失败: ${validation.errors.join(', ')}`,
          callId: request.callId
        };
      }

      const startTime = Date.now();

      // 发送tools/call请求
      const response = await this.adapter.sendRequest({
        method: 'tools/call',
        params: {
          name: request.toolName,
          arguments: request.arguments
        }
      });

      const duration = Date.now() - startTime;

      if (response.error) {
        return {
          success: false,
          error: response.error.message || '工具调用失败',
          callId: request.callId,
          duration
        };
      }

      // 更新工具使用统计
      tool.recordUsage();

      log.info(`[Real MCP Client] 工具调用成功: ${request.toolName} (${duration}ms)`);
      return {
        success: true,
        result: response.content || response.result,
        callId: request.callId,
        duration
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '工具调用失败';
      log.error(`[Real MCP Client] 工具调用失败: ${request.toolName}`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        callId: request.callId
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (this.status !== MCPConnectionStatus.CONNECTED) {
        return false;
      }

      // 发送ping请求测试连接
      const response = await this.adapter.sendRequest({
        method: 'ping',
        params: {}
      });

      return response !== null;
    } catch (error) {
      log.error(`[Real MCP Client] 连接测试失败: ${this.server.name}`, error);
      return false;
    }
  }

  async getServerInfo(): Promise<{ name: string; version: string }> {
    if (this.serverInfo) {
      log.info(`[Real MCP Client] 📋 使用缓存的服务器信息:`, this.serverInfo);
      return this.serverInfo;
    }

    if (!this.adapter.isConnected()) {
      log.error(`[Real MCP Client] ❌ 无法获取服务器信息，适配器未连接`);
      throw new Error('适配器未连接');
    }

    try {
      log.info(`[Real MCP Client] 📡 发送initialize请求获取服务器信息...`);
      const initRequest = {
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          clientInfo: {
            name: 'DeeChat',
            version: '1.0.0'
          }
        }
      };
      log.info(`[Real MCP Client] 📝 initialize请求内容:`, initRequest);

      const response = await this.adapter.sendRequest(initRequest);
      log.info(`[Real MCP Client] 📥 initialize响应:`, response);

      this.serverInfo = {
        name: response.serverInfo?.name || this.server.name,
        version: response.serverInfo?.version || '1.0.0'
      };

      log.info(`[Real MCP Client] ✅ 服务器信息设置完成:`, this.serverInfo);
      return this.serverInfo;
    } catch (error) {
      log.error(`[Real MCP Client] ❌ 获取服务器信息失败: ${this.server.name}`, error);
      log.error(`[Real MCP Client] 🔄 使用默认服务器信息作为fallback`);
      
      const fallbackInfo = {
        name: this.server.name,
        version: '1.0.0'
      };
      
      this.serverInfo = fallbackInfo;
      return fallbackInfo;
    }
  }

  /**
   * 初始化MCP会话
   */
  private async initializeSession(): Promise<void> {
    try {
      log.info(`[Real MCP Client] 🤝 初始化MCP会话开始: ${this.server.name}`);
      
      log.info(`[Real MCP Client] 📝 步骤1: 获取服务器信息...`);
      await this.getServerInfo();
      log.info(`[Real MCP Client] ✅ 服务器信息获取成功:`, this.serverInfo);
      
      log.info(`[Real MCP Client] 📝 步骤2: 发送initialized通知...`);
      const initResponse = await this.adapter.sendRequest({
        method: 'notifications/initialized',
        params: {}
      });
      log.info(`[Real MCP Client] ✅ initialized通知发送成功:`, initResponse);

      log.info(`[Real MCP Client] 🎉 MCP会话初始化完成: ${this.server.name}`);
    } catch (error) {
      log.error(`[Real MCP Client] ❌ MCP会话初始化失败: ${this.server.name}`, error);
      // 不抛出错误，允许继续使用基本功能
    }
  }

  /**
   * 加载服务器工具列表
   */
  private async loadTools(): Promise<void> {
    try {
      log.info(`[Real MCP Client] 🛠️ 开始加载工具列表: ${this.server.name}`);
      
      log.info(`[Real MCP Client] 📝 发送tools/list请求...`);
      const response = await this.adapter.sendRequest({
        method: 'tools/list',
        params: {}
      });
      
      log.info(`[Real MCP Client] 📥 工具列表响应:`, response);

      if (!response) {
        log.warn(`[Real MCP Client] ⚠️ 工具列表响应为空: ${this.server.name}`);
        this.tools = [];
        return;
      }

      if (!response.tools || !Array.isArray(response.tools)) {
        log.warn(`[Real MCP Client] ⚠️ 无效的工具列表格式: ${this.server.name}`, response);
        this.tools = [];
        return;
      }

      // 转换为MCPToolEntity
      this.tools = response.tools.map((tool: any, index: number) => {
        log.info(`[Real MCP Client] 🔧 处理工具${index + 1}:`, tool.name);
        return MCPToolEntity.create({
          name: tool.name,
          description: tool.description,
          serverId: this.server.id,
          serverName: this.server.name,
          inputSchema: tool.inputSchema,
          category: this.extractCategory(tool),
          tags: this.extractTags(tool)
        });
      });

      log.info(`[Real MCP Client] ✅ 工具列表加载完成: ${this.server.name}, 共${this.tools.length}个工具`);
      this.tools.forEach((tool, index) => {
        log.info(`[Real MCP Client] 📋 工具${index + 1}: ${tool.name} - ${tool.description}`);
      });

    } catch (error) {
      log.error(`[Real MCP Client] ❌ 工具列表加载失败: ${this.server.name}`, error);
      this.tools = [];
      // 不抛出错误，允许服务器连接但不提供工具
    }
  }

  /**
   * 从工具定义中提取分类
   */
  private extractCategory(tool: any): string {
    // 根据工具名称或描述推断分类
    const name = tool.name.toLowerCase();
    const description = (tool.description || '').toLowerCase();

    if (name.includes('time') || name.includes('date')) {
      return 'utility';
    } else if (name.includes('weather') || name.includes('climate')) {
      return 'information';
    } else if (name.includes('fetch') || name.includes('http') || name.includes('web')) {
      return 'web';
    } else if (name.includes('file') || name.includes('fs')) {
      return 'filesystem';
    } else if (name.includes('db') || name.includes('database')) {
      return 'database';
    } else if (description.includes('search') || description.includes('query')) {
      return 'search';
    } else {
      return 'general';
    }
  }

  /**
   * 从工具定义中提取标签
   */
  private extractTags(tool: any): string[] {
    const tags: string[] = [];
    const name = tool.name.toLowerCase();
    const description = (tool.description || '').toLowerCase();

    // 基于名称添加标签
    if (name.includes('get')) tags.push('getter');
    if (name.includes('set')) tags.push('setter');
    if (name.includes('create')) tags.push('creator');
    if (name.includes('delete')) tags.push('deleter');
    if (name.includes('update')) tags.push('updater');

    // 基于描述添加标签
    if (description.includes('async')) tags.push('async');
    if (description.includes('real-time')) tags.push('realtime');
    if (description.includes('cache')) tags.push('cached');

    return tags;
  }
}
