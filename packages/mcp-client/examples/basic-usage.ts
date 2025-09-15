/**
 * Basic usage example for @deechat/mcp-client
 */

import { McpClient } from '../src/index.js';

async function basicUsageExample() {
  console.log('🚀 MCP Client - Basic Usage Example');

  // 创建客户端实例
  const client = new McpClient({
    configFile: './examples/example-config.json'
  });

  try {
    // 初始化客户端
    await client.initialize();
    console.log('✅ Client initialized');

    // 添加一个示例服务器（计算器）
    await client.addServer({
      id: 'calculator',
      name: 'Calculator Server',
      description: 'A simple calculator MCP server',
      transport: {
        type: 'stdio',
        command: 'node',
        args: ['./examples/mock-calculator-server.js']
      },
      enabled: true,
      autoReconnect: true,
      timeout: 30000,
      tags: ['math', 'tools']
    });
    console.log('✅ Added calculator server');

    // 添加一个 HTTP 服务器示例
    await client.addServer({
      id: 'http-example',
      name: 'HTTP Example Server',
      description: 'An example HTTP MCP server',
      transport: {
        type: 'http',
        url: 'http://localhost:3000/mcp',
        headers: {
          'Authorization': 'Bearer example-token'
        }
      },
      enabled: false, // 暂时禁用，因为可能没有真实的服务器
      timeout: 15000
    });
    console.log('✅ Added HTTP server (disabled)');

    // 列出所有配置的服务器
    const servers = client.listServers();
    console.log(`📋 Configured servers: ${servers.length}`);
    servers.forEach(server => {
      console.log(`   - ${server.id}: ${server.name} (${server.enabled ? 'enabled' : 'disabled'})`);
    });

    // 连接到计算器服务器
    console.log('\\n🔗 Connecting to calculator server...');
    await client.connect('calculator');
    console.log('✅ Connected to calculator server');

    // 检查连接状态
    const isConnected = client.isConnected('calculator');
    console.log(`📊 Calculator server connected: ${isConnected}`);

    // 列出可用的工具
    console.log('\\n🛠️  Listing available tools...');
    const tools = await client.listTools('calculator');
    console.log(`Found ${tools.length} tools:`);
    tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description || 'No description'}`);
    });

    // 调用计算器工具
    console.log('\\n🧮 Calling calculator tool...');
    const result = await client.callTool('calculator', 'add', {
      a: 15,
      b: 27
    });
    console.log('Calculation result:', result);

    // 尝试读取资源（如果服务器支持）
    try {
      console.log('\\n📄 Attempting to read resources...');
      const resources = await client.listResources('calculator');
      console.log(`Found ${resources.length} resources`);
    } catch (error) {
      console.log('💡 Server does not support resources (this is normal)');
    }

    // 尝试获取提示词（如果服务器支持）
    try {
      console.log('\\n💬 Attempting to list prompts...');
      const prompts = await client.listPrompts('calculator');
      console.log(`Found ${prompts.length} prompts`);
    } catch (error) {
      console.log('💡 Server does not support prompts (this is normal)');
    }

    console.log('\\n✅ Basic usage example completed successfully!');

  } catch (error) {
    console.error('❌ Error in basic usage example:', error);
  } finally {
    // 清理
    console.log('\\n🧹 Cleaning up...');
    await client.dispose();
    console.log('✅ Client disposed');
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  basicUsageExample().catch(console.error);
}

export { basicUsageExample };