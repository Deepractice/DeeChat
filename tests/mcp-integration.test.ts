/**
 * MCP基础层集成测试
 * 验证新架构的正确性
 */

import { MCPTransportFactory } from '../src/main/services/mcp/transports/MCPTransportFactory';
import { MCPConfigManager } from '../src/main/services/mcp/MCPConfigManager';
import { MCPClientManagerV2 } from '../src/main/services/mcp/MCPClientManagerV2';
import { MCPServerConfig } from '../src/shared/entities/MCPServerConfigV2';
import { MCPTransportType } from '../src/shared/types/mcp-protocol';
import log from 'electron-log';

// 设置测试日志
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';

describe('MCP基础层集成测试', () => {
  let configManager: MCPConfigManager;
  let clientManager: MCPClientManagerV2;
  
  beforeAll(async () => {
    // 初始化管理器
    configManager = new MCPConfigManager();
    await configManager.initialize();
    
    clientManager = new MCPClientManagerV2();
    await clientManager.initialize();
  });
  
  afterAll(async () => {
    // 清理资源
    await clientManager.cleanup();
  });
  
  describe('传输层工厂测试', () => {
    test('应该支持所有5种传输协议', () => {
      const supportedTypes = MCPTransportFactory.getSupportedTypes();
      expect(supportedTypes).toContain('stdio');
      expect(supportedTypes).toContain('sse');
      expect(supportedTypes).toContain('streamable-http');
      expect(supportedTypes).toContain('websocket');
      expect(supportedTypes).toContain('inmemory');
      expect(supportedTypes.length).toBe(5);
    });
    
    test('应该能自动检测协议类型', () => {
      expect(MCPTransportFactory.detectProtocolType('ws://localhost:8080')).toBe('websocket');
      expect(MCPTransportFactory.detectProtocolType('wss://api.example.com')).toBe('websocket');
      expect(MCPTransportFactory.detectProtocolType('http://localhost:3000')).toBe('streamable-http');
      expect(MCPTransportFactory.detectProtocolType('https://api.example.com')).toBe('streamable-http');
      expect(MCPTransportFactory.detectProtocolType('https://api.example.com/sse')).toBe('sse');
      expect(MCPTransportFactory.detectProtocolType('invalid-url')).toBeNull();
    });
    
    test('应该创建InMemory传输实例', async () => {
      const config: MCPServerConfig = {
        id: 'test-inmemory',
        name: 'Test InMemory',
        type: 'inmemory',
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const transport = await MCPTransportFactory.create(config);
      expect(transport).toBeDefined();
      expect(transport.features.streaming).toBe(true);
      expect(transport.features.notifications).toBe(true);
      expect(transport.features.sessions).toBe(false);
      
      await transport.destroy();
    });
  });
  
  describe('配置管理器测试', () => {
    test('应该能添加新配置', async () => {
      const config = await configManager.addConfig({
        name: 'Test Server',
        type: 'inmemory',
        collection: 'user',
        tags: ['test', 'integration']
      });
      
      expect(config.id).toBeDefined();
      expect(config.name).toBe('Test Server');
      expect(config.type).toBe('inmemory');
      expect(config.collection).toBe('user');
      expect(config.execution).toBe('inprocess'); // InMemory自动推断为inprocess
      
      // 清理
      await configManager.removeConfig(config.id);
    });
    
    test('应该能按Collection获取配置', async () => {
      // 添加测试配置
      const configs = await Promise.all([
        configManager.addConfig({ name: 'System Test', type: 'stdio', collection: 'system', command: 'node' }),
        configManager.addConfig({ name: 'Project Test', type: 'stdio', collection: 'project', command: 'node' }),
        configManager.addConfig({ name: 'User Test 1', type: 'stdio', collection: 'user', command: 'node' }),
        configManager.addConfig({ name: 'User Test 2', type: 'stdio', collection: 'user', command: 'node' })
      ]);
      
      // 验证分组
      const systemConfigs = configManager.getConfigsByCollection('system');
      const projectConfigs = configManager.getConfigsByCollection('project');
      const userConfigs = configManager.getConfigsByCollection('user');
      
      expect(systemConfigs.length).toBeGreaterThanOrEqual(1);
      expect(projectConfigs.length).toBeGreaterThanOrEqual(1);
      expect(userConfigs.length).toBeGreaterThanOrEqual(2);
      
      // 清理
      await Promise.all(configs.map(c => configManager.removeConfig(c.id)));
    });
    
    test('应该验证配置完整性', async () => {
      // 无效配置 - 缺少必需字段
      await expect(configManager.addConfig({
        type: 'stdio'
        // 缺少name和command
      })).rejects.toThrow();
      
      // 无效配置 - URL格式错误
      await expect(configManager.addConfig({
        name: 'Invalid URL',
        type: 'websocket',
        url: 'not-a-valid-url'
      })).rejects.toThrow();
    });
  });
  
  describe('客户端管理器测试', () => {
    test('应该能创建InMemory客户端并调用工具', async () => {
      // 添加测试服务器
      const config = await configManager.addConfig({
        name: 'Test InMemory Server',
        type: 'inmemory',
        collection: 'user',
        extra: {
          channel: 'test-channel',
          selfHandle: true // 启用自处理模式
        }
      });
      
      try {
        // 发现工具
        const tools = await clientManager.discoverTools(config.id);
        expect(tools.length).toBeGreaterThan(0);
        
        const testTool = tools.find(t => t.name === 'test-tool');
        expect(testTool).toBeDefined();
        
        // 调用工具
        const result = await clientManager.callTool({
          serverId: config.id,
          toolName: 'test-tool',
          arguments: { input: 'Hello MCP' },
          callId: 'test-call-1'
        });
        
        expect(result.success).toBe(true);
        expect(result.result).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);
        
      } finally {
        // 清理
        await clientManager.closeClient(config.id);
        await configManager.removeConfig(config.id);
      }
    });
    
    test('应该正确推断执行模式', async () => {
      // PromptX -> inprocess
      const promptxConfig = await configManager.addConfig({
        name: 'PromptX Test',
        type: 'stdio',
        command: 'node',
        args: ['promptx.js', 'mcp-server']
      });
      expect(promptxConfig.execution).toBe('inprocess');
      await configManager.removeConfig(promptxConfig.id);
      
      // NPX -> sandbox
      const npxConfig = await configManager.addConfig({
        name: 'NPX Test',
        type: 'stdio',
        command: 'npx',
        args: ['some-package']
      });
      expect(npxConfig.execution).toBe('sandbox');
      await configManager.removeConfig(npxConfig.id);
      
      // Network -> standard
      const wsConfig = await configManager.addConfig({
        name: 'WebSocket Test',
        type: 'websocket',
        url: 'ws://localhost:8080'
      });
      expect(wsConfig.execution).toBe('standard');
      await configManager.removeConfig(wsConfig.id);
    });
  });
  
  describe('端到端测试', () => {
    test('完整的服务器生命周期', async () => {
      // 1. 添加配置
      const config = await configManager.addConfig({
        name: 'E2E Test Server',
        description: '端到端测试服务器',
        type: 'inmemory',
        collection: 'user',
        tags: ['e2e', 'test'],
        extra: {
          channel: 'e2e-test',
          selfHandle: true
        }
      });
      
      // 2. 验证配置
      const savedConfig = configManager.getConfig(config.id);
      expect(savedConfig).toBeDefined();
      expect(savedConfig!.name).toBe('E2E Test Server');
      
      // 3. 创建客户端（自动连接）
      const tools = await clientManager.discoverTools(config.id);
      expect(tools.length).toBeGreaterThan(0);
      
      // 4. 调用工具
      const callResult = await clientManager.callTool({
        serverId: config.id,
        toolName: 'test-tool',
        arguments: { input: 'E2E Test' },
        callId: 'e2e-test-1'
      });
      expect(callResult.success).toBe(true);
      
      // 5. 获取状态
      const statusMap = clientManager.getServersStatus();
      const status = statusMap.get(config.id);
      expect(status).toBeDefined();
      
      // 6. 更新配置
      const updatedConfig = await configManager.updateConfig(config.id, {
        description: '更新后的描述',
        tags: ['e2e', 'test', 'updated']
      });
      expect(updatedConfig.description).toBe('更新后的描述');
      expect(updatedConfig.tags).toContain('updated');
      
      // 7. 关闭客户端
      await clientManager.closeClient(config.id);
      
      // 8. 删除配置
      await configManager.removeConfig(config.id);
      
      // 9. 验证删除
      const deletedConfig = configManager.getConfig(config.id);
      expect(deletedConfig).toBeUndefined();
    });
  });
});

// 运行测试的辅助脚本
if (require.main === module) {
  console.log('运行MCP基础层集成测试...');
  console.log('请使用 npm test 或 jest 命令运行测试');
}