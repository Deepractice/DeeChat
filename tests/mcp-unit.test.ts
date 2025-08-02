/**
 * MCP基础层单元测试
 * 不依赖Electron环境的纯单元测试
 */

import { MCPTransportFactory } from '../src/main/services/mcp/transports/MCPTransportFactory';
import { InMemoryTransport } from '../src/main/services/mcp/transports/InMemoryTransport';
import { 
  MCPTransportType, 
  getProtocolDisplayName,
  getExecutionModeDisplayName,
  getCollectionDisplayName,
  isNetworkProtocol,
  supportsAuth,
  PROTOCOL_FEATURES
} from '../src/shared/types/mcp-protocol';
import { 
  createDefaultConfig, 
  validateConfig, 
  inferExecutionMode,
  MCPServerConfig 
} from '../src/shared/entities/MCPServerConfigV2';

describe('MCP协议类型测试', () => {
  test('应该正确返回协议显示名称', () => {
    expect(getProtocolDisplayName('stdio')).toBe('本地进程');
    expect(getProtocolDisplayName('sse')).toBe('SSE (已弃用)');
    expect(getProtocolDisplayName('streamable-http')).toBe('HTTP流式传输');
    expect(getProtocolDisplayName('websocket')).toBe('WebSocket');
    expect(getProtocolDisplayName('inmemory')).toBe('内存传输');
  });

  test('应该正确返回执行模式显示名称', () => {
    expect(getExecutionModeDisplayName('inprocess')).toBe('进程内执行');
    expect(getExecutionModeDisplayName('sandbox')).toBe('沙箱隔离');
    expect(getExecutionModeDisplayName('standard')).toBe('标准模式');
  });

  test('应该正确返回集合显示名称', () => {
    expect(getCollectionDisplayName('system')).toBe('系统');
    expect(getCollectionDisplayName('project')).toBe('项目');
    expect(getCollectionDisplayName('user')).toBe('用户');
  });

  test('应该正确判断网络协议', () => {
    expect(isNetworkProtocol('stdio')).toBe(false);
    expect(isNetworkProtocol('inmemory')).toBe(false);
    expect(isNetworkProtocol('sse')).toBe(true);
    expect(isNetworkProtocol('streamable-http')).toBe(true);
    expect(isNetworkProtocol('websocket')).toBe(true);
  });

  test('应该正确判断认证支持', () => {
    expect(supportsAuth('stdio')).toBe(false);
    expect(supportsAuth('inmemory')).toBe(false);
    expect(supportsAuth('sse')).toBe(true);
    expect(supportsAuth('streamable-http')).toBe(true);
    expect(supportsAuth('websocket')).toBe(true);
  });

  test('协议特性映射应该正确', () => {
    // Stdio
    expect(PROTOCOL_FEATURES.stdio.streaming).toBe(true);
    expect(PROTOCOL_FEATURES.stdio.notifications).toBe(true);
    expect(PROTOCOL_FEATURES.stdio.sessions).toBe(false);
    expect(PROTOCOL_FEATURES.stdio.reconnect).toBe(false);
    expect(PROTOCOL_FEATURES.stdio.auth).toBe(false);

    // WebSocket
    expect(PROTOCOL_FEATURES.websocket.streaming).toBe(true);
    expect(PROTOCOL_FEATURES.websocket.notifications).toBe(true);
    expect(PROTOCOL_FEATURES.websocket.sessions).toBe(true);
    expect(PROTOCOL_FEATURES.websocket.reconnect).toBe(true);
    expect(PROTOCOL_FEATURES.websocket.auth).toBe(true);
  });
});

describe('配置模型测试', () => {
  test('应该创建默认配置', () => {
    const config = createDefaultConfig({
      name: 'Test Server',
      type: 'stdio',
      command: 'node'
    });

    expect(config.id).toBeDefined();
    expect(config.name).toBe('Test Server');
    expect(config.type).toBe('stdio');
    expect(config.collection).toBe('user');
    expect(config.isEnabled).toBe(true);
    expect(config.source).toBe('user');
    expect(config.createdAt).toBeDefined();
    expect(config.updatedAt).toBeDefined();
  });

  test('应该验证配置 - 成功案例', () => {
    const config: Partial<MCPServerConfig> = {
      name: 'Valid Server',
      type: 'stdio',
      command: 'node'
    };

    const errors = validateConfig(config);
    expect(errors).toHaveLength(0);
  });

  test('应该验证配置 - 失败案例', () => {
    // 缺少名称
    const config1: Partial<MCPServerConfig> = {
      type: 'stdio',
      command: 'node'
    };
    const errors1 = validateConfig(config1);
    expect(errors1.length).toBeGreaterThan(0);
    expect(errors1[0].field).toBe('name');

    // 缺少命令
    const config2: Partial<MCPServerConfig> = {
      name: 'Test',
      type: 'stdio'
    };
    const errors2 = validateConfig(config2);
    expect(errors2.length).toBeGreaterThan(0);
    expect(errors2[0].field).toBe('command');

    // 无效URL
    const config3: Partial<MCPServerConfig> = {
      name: 'Test',
      type: 'websocket',
      url: 'invalid-url'
    };
    const errors3 = validateConfig(config3);
    expect(errors3.length).toBeGreaterThan(0);
    expect(errors3[0].field).toBe('url');
  });

  test('应该正确推断执行模式', () => {
    // InMemory -> inprocess
    expect(inferExecutionMode({ type: 'inmemory' } as MCPServerConfig)).toBe('inprocess');

    // 网络协议 -> standard
    expect(inferExecutionMode({ type: 'websocket' } as MCPServerConfig)).toBe('standard');
    expect(inferExecutionMode({ type: 'streamable-http' } as MCPServerConfig)).toBe('standard');

    // NPX -> sandbox
    expect(inferExecutionMode({ 
      type: 'stdio', 
      command: 'npx' 
    } as MCPServerConfig)).toBe('sandbox');

    // 沙箱配置 -> sandbox
    expect(inferExecutionMode({ 
      type: 'stdio', 
      command: 'node',
      sandbox: { enabled: true }
    } as MCPServerConfig)).toBe('sandbox');

    // 默认 -> standard
    expect(inferExecutionMode({ 
      type: 'stdio', 
      command: 'node' 
    } as MCPServerConfig)).toBe('standard');
  });
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

  test('应该能获取协议信息', () => {
    const stdioInfo = MCPTransportFactory.getTypeInfo('stdio');
    expect(stdioInfo).toBeDefined();
    expect(stdioInfo?.description).toContain('标准输入输出');

    const wsInfo = MCPTransportFactory.getTypeInfo('websocket');
    expect(wsInfo).toBeDefined();
    expect(wsInfo?.description).toContain('WebSocket');
  });

  test('应该检查协议支持', () => {
    expect(MCPTransportFactory.isSupported('stdio')).toBe(true);
    expect(MCPTransportFactory.isSupported('websocket')).toBe(true);
    expect(MCPTransportFactory.isSupported('invalid' as any)).toBe(false);
  });

  test('应该能自动检测协议类型', () => {
    // WebSocket
    expect(MCPTransportFactory.detectProtocolType('ws://localhost:8080')).toBe('websocket');
    expect(MCPTransportFactory.detectProtocolType('wss://api.example.com')).toBe('websocket');
    
    // HTTP -> streamable-http
    expect(MCPTransportFactory.detectProtocolType('http://localhost:3000')).toBe('streamable-http');
    expect(MCPTransportFactory.detectProtocolType('https://api.example.com')).toBe('streamable-http');
    
    // SSE路径
    expect(MCPTransportFactory.detectProtocolType('https://api.example.com/sse')).toBe('sse');
    expect(MCPTransportFactory.detectProtocolType('https://api.example.com/events')).toBe('sse');
    
    // 无效URL
    expect(MCPTransportFactory.detectProtocolType('invalid-url')).toBeNull();
    expect(MCPTransportFactory.detectProtocolType('')).toBeNull();
  });

  test('应该验证配置错误', async () => {
    // 缺少必需字段
    const invalidConfig = {
      id: 'test',
      name: '',  // 空名称
      type: 'stdio' as MCPTransportType,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await expect(MCPTransportFactory.create(invalidConfig)).rejects.toThrow();
  });
});

describe('InMemory传输测试', () => {
  let transport1: InMemoryTransport;
  let transport2: InMemoryTransport;

  beforeEach(() => {
    const config1: MCPServerConfig = {
      id: 'test1',
      name: 'Test Transport 1',
      type: 'inmemory',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      extra: { channel: 'test-channel' }
    };

    const config2: MCPServerConfig = {
      id: 'test2',
      name: 'Test Transport 2',
      type: 'inmemory',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      extra: { channel: 'test-channel' }
    };

    transport1 = new InMemoryTransport(config1);
    transport2 = new InMemoryTransport(config2);
  });

  afterEach(async () => {
    await transport1.destroy();
    await transport2.destroy();
  });

  test('应该成功连接', async () => {
    await transport1.connect();
    expect(transport1.isConnected()).toBe(true);
    expect(transport1.status).toBe('connected');
  });

  test('应该在同一通道通信', async () => {
    await transport1.connect();
    await transport2.connect();

    const messagePromise = new Promise<any>((resolve) => {
      transport2.on('message', resolve);
    });

    await transport1.send({
      jsonrpc: '2.0',
      method: 'test',
      params: { data: 'hello' }
    });

    const message = await messagePromise;
    expect(message.method).toBe('test');
    expect(message.params).toEqual({ data: 'hello' });
  });

  test('应该支持请求响应', async () => {
    const config = createDefaultConfig({
      name: 'Self Handle Test',
      type: 'inmemory',
      extra: { selfHandle: true }
    });
    
    const transport = new InMemoryTransport(config);
    await transport.connect();

    const result = await transport.request('initialize', {
      protocolVersion: '2025-03-26'
    });

    expect(result.protocolVersion).toBe('2025-03-26');
    expect(result.serverInfo).toBeDefined();

    await transport.destroy();
  });

  test('应该获取通道信息', () => {
    const info = transport1.getChannelInfo();
    expect(info.channel).toBe('test-channel');
    expect(info.participants).toBeGreaterThanOrEqual(0);
  });

  test('应该处理工具调用', async () => {
    const config = createDefaultConfig({
      name: 'Tool Test',
      type: 'inmemory',
      extra: { selfHandle: true }
    });
    
    const transport = new InMemoryTransport(config);
    await transport.connect();

    // 列出工具
    const toolsResult = await transport.request('tools/list');
    expect(toolsResult.tools).toBeDefined();
    expect(toolsResult.tools.length).toBeGreaterThan(0);

    // 调用工具
    const callResult = await transport.request('tools/call', {
      name: 'test-tool',
      arguments: { input: 'test input' }
    });
    expect(callResult.toolResult).toBe('Processed: test input');

    await transport.destroy();
  });

  test('应该正确更新统计信息', async () => {
    await transport1.connect();
    
    const initialStats = transport1.stats;
    expect(initialStats.messagesSent).toBe(0);
    expect(initialStats.messagesReceived).toBe(0);

    await transport1.send({
      jsonrpc: '2.0',
      method: 'test'
    });

    const updatedStats = transport1.stats;
    expect(updatedStats.messagesSent).toBe(1);
    expect(updatedStats.bytesOut).toBeGreaterThan(0);
  });
});

describe('执行模式推断测试', () => {
  test('PromptX应该使用进程内模式', () => {
    const config: MCPServerConfig = {
      id: 'promptx',
      name: 'PromptX',
      type: 'stdio',
      command: 'node',
      args: ['promptx.js', 'mcp-server'],
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    expect(inferExecutionMode(config)).toBe('standard'); // 注意：根据新逻辑，不再特殊处理PromptX
  });

  test('NPX应该使用沙箱模式', () => {
    const config: MCPServerConfig = {
      id: 'npx-server',
      name: 'NPX Server',
      type: 'stdio',
      command: 'npx',
      args: ['some-package'],
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    expect(inferExecutionMode(config)).toBe('sandbox');
  });

  test('标记为inprocess的应该使用进程内模式', () => {
    const config: MCPServerConfig = {
      id: 'tagged',
      name: 'Tagged Server',
      type: 'stdio',
      command: 'node',
      tags: ['inprocess', 'test'],
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    expect(inferExecutionMode(config)).toBe('inprocess');
  });
});