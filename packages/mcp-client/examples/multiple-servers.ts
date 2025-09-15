/**
 * Multiple servers example for @deechat/mcp-client
 */

import { McpClient } from '../src/index.js';

async function multipleServersExample() {
  console.log('🚀 MCP Client - Multiple Servers Example');

  const client = new McpClient({
    configFile: './examples/multi-server-config.json'
  });

  try {
    // 初始化
    await client.initialize();
    console.log('✅ Client initialized');

    // 添加多个服务器
    const servers = [
      {
        id: 'calculator',
        name: 'Calculator Server',
        description: 'Math operations server',
        transport: {
          type: 'stdio' as const,
          command: 'node',
          args: ['./examples/mock-calculator-server.js']
        },
        enabled: true,
        tags: ['math', 'tools']
      },
      {
        id: 'file-tools',
        name: 'File Tools Server', 
        description: 'File system operations (mock)',
        transport: {
          type: 'http' as const,
          url: 'http://localhost:3001/mcp',
          headers: { 'Content-Type': 'application/json' }
        },
        enabled: false, // 禁用因为没有真实服务器
        tags: ['files', 'system']
      },
      {
        id: 'websocket-server',
        name: 'WebSocket Server',
        description: 'Real-time communication server (mock)',
        transport: {
          type: 'websocket' as const,
          url: 'ws://localhost:8080/mcp'
        },
        enabled: false, // 禁用因为没有真实服务器
        tags: ['realtime', 'communication']
      }
    ];

    // 添加所有服务器
    for (const server of servers) {
      await client.addServer(server);
      console.log(`✅ Added server: ${server.name}`);
    }

    // 列出所有服务器
    const allServers = client.listServers();
    console.log(`\\n📋 Total configured servers: ${allServers.length}`);
    allServers.forEach(server => {
      console.log(`   - ${server.id}: ${server.name} (${server.enabled ? 'enabled' : 'disabled'})`);
      console.log(`     Transport: ${server.transport.type}`);
      console.log(`     Tags: ${server.tags?.join(', ') || 'none'}`);
    });

    // 连接到启用的服务器
    console.log('\\n🔗 Connecting to enabled servers...');
    const enabledServers = allServers.filter(s => s.enabled);
    
    for (const server of enabledServers) {
      try {
        console.log(`Connecting to ${server.name}...`);
        await client.connect(server.id);
        console.log(`✅ Connected to ${server.name}`);
      } catch (error) {
        console.log(`❌ Failed to connect to ${server.name}: ${error instanceof Error ? error.message : error}`);
      }
    }

    // 检查连接状态
    console.log('\\n📊 Connection status:');
    for (const server of allServers) {
      const status = client.getConnectionStatus(server.id);
      const connected = client.isConnected(server.id);
      console.log(`   - ${server.name}: ${status} ${connected ? '✅' : '❌'}`);
    }

    // 对每个连接的服务器执行操作
    console.log('\\n🔧 Testing connected servers...');
    const connections = client.listConnections();
    const connectedServers = connections.filter(conn => conn.status === 'connected');

    for (const connection of connectedServers) {
      console.log(`\\n--- Testing ${connection.serverId} ---`);
      
      try {
        // 列出工具
        const tools = await client.listTools(connection.serverId);
        console.log(`🛠️  Found ${tools.length} tools`);
        
        // 如果是计算器服务器，执行一些计算
        if (connection.serverId === 'calculator' && tools.length > 0) {
          console.log('🧮 Testing calculator operations...');
          
          const operations = [
            { tool: 'add', args: { a: 10, b: 5 }, expected: 15 },
            { tool: 'multiply', args: { a: 7, b: 8 }, expected: 56 },
            { tool: 'divide', args: { a: 20, b: 4 }, expected: 5 }
          ];

          for (const op of operations) {
            if (tools.some(t => t.name === op.tool)) {
              try {
                const result = await client.callTool(connection.serverId, op.tool, op.args);
                const value = parseFloat(result.content[0].text);
                console.log(`   ${op.tool}(${op.args.a}, ${op.args.b}) = ${value} ${value === op.expected ? '✅' : '❌'}`);
              } catch (error) {
                console.log(`   ${op.tool}: Error - ${error instanceof Error ? error.message : error}`);
              }
            }
          }
        }

      } catch (error) {
        console.log(`❌ Error testing ${connection.serverId}: ${error instanceof Error ? error.message : error}`);
      }
    }

    // 演示服务器管理操作
    console.log('\\n⚙️  Demonstrating server management...');
    
    // 暂时禁用一个服务器
    await client.updateServer('calculator', { enabled: false });
    console.log('✅ Disabled calculator server');
    
    // 重新启用
    await client.updateServer('calculator', { 
      enabled: true, 
      description: 'Updated calculator server'
    });
    console.log('✅ Re-enabled calculator server with updated description');

    // 测试错误处理
    console.log('\\n🧪 Testing error handling...');
    try {
      await client.callTool('calculator', 'nonexistent-tool', {});
    } catch (error) {
      console.log(`Expected error caught: ${error instanceof Error ? error.name : 'Unknown'}`);
    }

    try {
      await client.connect('nonexistent-server');
    } catch (error) {
      console.log(`Expected error caught: ${error instanceof Error ? error.name : 'Unknown'}`);
    }

    console.log('\\n✅ Multiple servers example completed successfully!');

  } catch (error) {
    console.error('❌ Error in multiple servers example:', error);
  } finally {
    // 清理
    console.log('\\n🧹 Cleaning up...');
    await client.dispose();
    console.log('✅ Client disposed');
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  multipleServersExample().catch(console.error);
}

export { multipleServersExample };