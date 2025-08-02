/**
 * MCP端到端测试
 * 在实际应用中测试新架构
 */

import { MCPTransportFactory } from '../src/main/services/mcp/transports/MCPTransportFactory';
import { MCPServerConfig } from '../src/shared/entities/MCPServerConfigV2';
import { InMemoryTransport } from '../src/main/services/mcp/transports/InMemoryTransport';

describe('MCP新架构端到端测试', () => {
  test('完整的MCP服务器交互流程', async () => {
    // 1. 创建服务器配置
    const serverConfig: MCPServerConfig = {
      id: 'e2e-test-server',
      name: 'E2E Test Server',
      description: '端到端测试服务器',
      type: 'inmemory',
      collection: 'user',
      isEnabled: true,
      tags: ['test', 'e2e'],
      createdAt: new Date(),
      updatedAt: new Date(),
      extra: {
        channel: 'e2e-channel',
        selfHandle: true
      }
    };

    // 2. 创建传输层
    const transport = await MCPTransportFactory.create(serverConfig);
    expect(transport).toBeInstanceOf(InMemoryTransport);

    // 3. 连接传输
    await transport.connect();
    expect(transport.isConnected()).toBe(true);
    expect(transport.status).toBe('connected');

    // 4. 初始化协议
    const initResponse = await transport.request('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {
        tools: {},
        resources: {}
      },
      clientInfo: {
        name: 'DeeChat',
        version: '1.0.0'
      }
    });

    expect(initResponse).toMatchObject({
      protocolVersion: '2025-03-26',
      serverInfo: {
        name: serverConfig.name,
        version: '1.0.0'
      }
    });

    // 5. 列出工具
    const toolsResponse = await transport.request('tools/list');
    expect(toolsResponse.tools).toBeDefined();
    expect(Array.isArray(toolsResponse.tools)).toBe(true);
    expect(toolsResponse.tools.length).toBeGreaterThan(0);

    const testTool = toolsResponse.tools.find((t: any) => t.name === 'test-tool');
    expect(testTool).toBeDefined();
    expect(testTool.description).toBe('A test tool for InMemory transport');

    // 6. 调用工具
    const toolResult = await transport.request('tools/call', {
      name: 'test-tool',
      arguments: {
        input: 'Hello from E2E test!'
      }
    });

    expect(toolResult.toolResult).toBe('Processed: Hello from E2E test!');

    // 7. 测试通知
    const notificationPromise = new Promise<void>((resolve) => {
      transport.once('message', (message) => {
        if (message.method === 'test-notification') {
          expect(message.params).toEqual({ data: 'test' });
          resolve();
        }
      });
    });

    await transport.notify('test-notification', { data: 'test' });
    
    // 等待通知被处理（InMemory是异步的）
    await new Promise(resolve => setTimeout(resolve, 50));

    // 8. 检查统计信息
    const stats = transport.stats;
    expect(stats.messagesSent).toBeGreaterThan(0);
    expect(stats.messagesReceived).toBeGreaterThan(0);
    expect(stats.bytesOut).toBeGreaterThan(0);
    expect(stats.bytesIn).toBeGreaterThan(0);

    // 9. 断开连接
    await transport.disconnect();
    expect(transport.isConnected()).toBe(false);
    expect(transport.status).toBe('disconnected');

    // 10. 验证重连功能
    await transport.connect();
    expect(transport.isConnected()).toBe(true);

    // 11. 清理
    await transport.destroy();
  });

  test('多协议并发测试', async () => {
    const configs: MCPServerConfig[] = [
      {
        id: 'inmemory-1',
        name: 'InMemory Server 1',
        type: 'inmemory',
        collection: 'user',
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        extra: { channel: 'test-multi', selfHandle: true }
      },
      {
        id: 'inmemory-2',
        name: 'InMemory Server 2',
        type: 'inmemory',
        collection: 'user',
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        extra: { channel: 'test-multi', selfHandle: true }
      }
    ];

    // 创建多个传输实例
    const transports = await Promise.all(
      configs.map(config => MCPTransportFactory.create(config))
    );

    // 并发连接
    await Promise.all(transports.map(t => t.connect()));

    // 验证所有连接成功
    transports.forEach(t => {
      expect(t.isConnected()).toBe(true);
    });

    // 并发调用工具
    const results = await Promise.all(
      transports.map((t, i) => 
        t.request('tools/call', {
          name: 'test-tool',
          arguments: { input: `Transport ${i}` }
        })
      )
    );

    results.forEach((result, i) => {
      expect(result.toolResult).toBe(`Processed: Transport ${i}`);
    });

    // 清理
    await Promise.all(transports.map(t => t.destroy()));
  });

  test('错误处理和重试机制', async () => {
    const config: MCPServerConfig = {
      id: 'error-test',
      name: 'Error Test Server',
      type: 'inmemory',
      collection: 'user',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      timeout: 1000, // 1秒超时
      retryConfig: {
        maxRetries: 2,
        initialDelay: 100,
        maxDelay: 500,
        backoffFactor: 2
      }
    };

    const transport = await MCPTransportFactory.create(config);

    // 测试超时
    transport.setTimeout(100); // 设置很短的超时
    
    await transport.connect();

    // 这个请求应该超时
    await expect(
      transport.request('slow-operation', { delay: 1000 })
    ).rejects.toThrow('Request timeout');

    // 测试错误处理
    let errorCount = 0;
    transport.on('error', () => {
      errorCount++;
    });

    // 触发一个错误
    (transport as any).handleError(new Error('Test error'));
    
    expect(errorCount).toBe(1);
    expect(transport.stats.errors).toBe(1);

    await transport.destroy();
  });

  test('协议特性验证', async () => {
    // 测试不同协议的特性
    const protocols: MCPTransportType[] = ['stdio', 'sse', 'streamable-http', 'websocket', 'inmemory'];
    
    for (const type of protocols) {
      const info = MCPTransportFactory.getTypeInfo(type);
      expect(info).toBeDefined();
      expect(info!.validator).toBeDefined();
      expect(info!.factory).toBeDefined();
      
      // 验证协议是否被正确支持
      expect(MCPTransportFactory.isSupported(type)).toBe(true);
    }

    // 测试协议自动检测
    const testCases = [
      { url: 'ws://localhost:8080', expected: 'websocket' },
      { url: 'wss://api.example.com/mcp', expected: 'websocket' },
      { url: 'http://localhost:3000/api', expected: 'streamable-http' },
      { url: 'https://api.example.com/mcp', expected: 'streamable-http' },
      { url: 'https://api.example.com/sse', expected: 'sse' },
      { url: 'https://api.example.com/events', expected: 'sse' }
    ];

    testCases.forEach(({ url, expected }) => {
      const detected = MCPTransportFactory.detectProtocolType(url);
      expect(detected).toBe(expected);
    });
  });
});

// 性能测试
describe('MCP性能测试', () => {
  test('InMemory传输性能', async () => {
    const config: MCPServerConfig = {
      id: 'perf-test',
      name: 'Performance Test',
      type: 'inmemory',
      collection: 'user',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      extra: { channel: 'perf-test', selfHandle: true }
    };

    const transport = await MCPTransportFactory.create(config);
    await transport.connect();

    const iterations = 1000;
    const startTime = Date.now();

    // 批量调用
    const promises = [];
    for (let i = 0; i < iterations; i++) {
      promises.push(
        transport.request('tools/call', {
          name: 'test-tool',
          arguments: { input: `Test ${i}` }
        })
      );
    }

    await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;
    const opsPerSecond = (iterations / duration) * 1000;

    console.log(`InMemory传输性能: ${iterations} 次调用耗时 ${duration}ms`);
    console.log(`每秒操作数: ${opsPerSecond.toFixed(2)} ops/s`);

    // 性能应该很高（InMemory是零延迟的）
    expect(opsPerSecond).toBeGreaterThan(1000); // 至少1000 ops/s

    await transport.destroy();
  });
});