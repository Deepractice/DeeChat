/**
 * Streamable HTTP Transport Usage Example
 *
 * 演示如何使用新的 Streamable HTTP 传输
 */

import { McpClient } from '../src/index.js';

async function main() {
  const client = new McpClient();

  try {
    // 初始化客户端
    console.log('🚀 Initializing MCP Client...');
    await client.initialize('./examples/streamable-http-config.json');

    // 添加一个 Streamable HTTP 服务器
    console.log('📡 Adding Streamable HTTP server...');
    await client.addServer({
      id: 'streamable-example',
      name: 'Streamable HTTP Example',
      transport: {
        type: 'streamable-http',
        url: 'http://localhost:3000/mcp',
        headers: {
          'Authorization': 'Bearer demo-token',
          'X-Client-Version': '3.0.1'
        },
        enableDnsRebindingProtection: true,
        allowedHosts: ['127.0.0.1', 'localhost'],
        reconnectDelay: 1000,
        maxReconnectAttempts: 5
      },
      enabled: true,
      autoReconnect: true,
      timeout: 30000
    });

    // 连接到服务器
    console.log('🔗 Connecting to server...');
    await client.connect('streamable-example');

    // 获取连接状态
    const status = await client.getConnectionStatus('streamable-example');
    console.log('📊 Connection status:', status);

    // 列出可用的工具
    console.log('🔧 Listing available tools...');
    const tools = await client.listTools('streamable-example');
    console.log('Available tools:', tools.map(t => t.name));

    // 列出可用的资源
    console.log('📚 Listing available resources...');
    const resources = await client.listResources('streamable-example');
    console.log('Available resources:', resources.map(r => r.uri));

    // 调用一个工具 (假设有一个 'greet' 工具)
    if (tools.some(t => t.name === 'greet')) {
      console.log('👋 Calling greet tool...');
      const result = await client.callTool('streamable-example', 'greet', {
        name: 'Streamable HTTP User'
      });
      console.log('Greet result:', result);
    }

    // 读取一个资源 (假设有资源可用)
    if (resources.length > 0) {
      console.log('📖 Reading first resource...');
      const resource = await client.readResource('streamable-example', resources[0].uri);
      console.log('Resource content:', resource);
    }

    // 演示会话恢复 (如果支持)
    const transport = client.getTransport('streamable-example');
    if (transport && 'getSessionId' in transport) {
      const sessionId = (transport as any).getSessionId();
      if (sessionId) {
        console.log('🔄 Session ID available for resumption:', sessionId);

        // 可以保存这个 sessionId 并在下次连接时使用：
        /*
        await client.addServer({
          id: 'resumed-session',
          name: 'Resumed Session Example',
          transport: {
            type: 'streamable-http',
            url: 'http://localhost:3000/mcp',
            sessionId: sessionId,  // 恢复之前的会话
            // ... 其他配置
          },
          // ...
        });
        */
      }
    }

    console.log('✅ Streamable HTTP example completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // 清理连接
    console.log('🧹 Cleaning up...');
    await client.dispose();
  }
}

// 如果直接运行此文件，则执行 main 函数
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  main().catch(console.error);
}

export { main };