#!/usr/bin/env node

/**
 * 测试配置格式兼容性
 */

import { McpClient } from './dist/index.js';
import fs from 'fs/promises';
import path from 'path';

async function testConfigFormats() {
  console.log('🔧 测试配置格式兼容性');
  
  // 创建测试目录
  const testDir = './test-configs';
  await fs.mkdir(testDir, { recursive: true });
  
  // 1. 测试Claude Desktop格式
  console.log('\n📋 测试1: Claude Desktop格式支持');
  const claudeDesktopConfig = {
    "mcpServers": {
      "brave-search": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-brave-search"],
        "env": {
          "BRAVE_API_KEY": "test-key"
        }
      },
      "calculator": {
        "command": "node",
        "args": ["examples/mock-calculator-server.js"]
      }
    }
  };
  
  const claudeConfigPath = path.join(testDir, 'claude-desktop-config.json');
  await fs.writeFile(claudeConfigPath, JSON.stringify(claudeDesktopConfig, null, 2));
  
  try {
    const client1 = new McpClient({ configFile: claudeConfigPath });
    await client1.initialize();
    
    const servers = client1.listServers();
    console.log(`✅ 成功读取Claude Desktop格式，找到 ${servers.length} 个服务器:`);
    servers.forEach(server => {
      console.log(`   - ${server.id}: ${server.name} (${server.transport.type})`);
    });
    
    // 测试导出为官方格式
    const exportedConfig = client1.configManager?.exportToClaudeDesktop?.();
    if (exportedConfig) {
      console.log('✅ 成功导出为Claude Desktop格式');
      console.log('   导出的配置:', Object.keys(exportedConfig.mcpServers));
    }
    
    await client1.dispose();
  } catch (error) {
    console.error('❌ Claude Desktop格式测试失败:', error.message);
  }
  
  // 2. 测试我们的扩展格式
  console.log('\n📋 测试2: DeeChat扩展格式支持');
  const deechatConfig = {
    "servers": [
      {
        "id": "calculator-extended",
        "name": "Enhanced Calculator",
        "description": "A calculator with advanced features",
        "transport": {
          "type": "stdio",
          "command": "node",
          "args": ["examples/mock-calculator-server.js"]
        },
        "enabled": true,
        "autoReconnect": true,
        "timeout": 15000,
        "tags": ["math", "calculator", "tools"]
      },
      {
        "id": "web-service",
        "name": "Web Service",
        "description": "HTTP-based service",
        "transport": {
          "type": "http",
          "url": "http://localhost:3000/mcp",
          "headers": {
            "Authorization": "Bearer token123"
          }
        },
        "enabled": false,
        "autoReconnect": false,
        "timeout": 30000,
        "tags": ["web", "http"]
      }
    ]
  };
  
  const deechatConfigPath = path.join(testDir, 'deechat-config.json');
  await fs.writeFile(deechatConfigPath, JSON.stringify(deechatConfig, null, 2));
  
  try {
    const client2 = new McpClient({ configFile: deechatConfigPath });
    await client2.initialize();
    
    const servers = client2.listServers();
    console.log(`✅ 成功读取DeeChat格式，找到 ${servers.length} 个服务器:`);
    servers.forEach(server => {
      console.log(`   - ${server.id}: ${server.name} (${server.transport.type}) ${server.enabled ? '启用' : '禁用'}`);
      console.log(`     标签: ${server.tags?.join(', ') || '无'}`);
    });
    
    await client2.dispose();
  } catch (error) {
    console.error('❌ DeeChat格式测试失败:', error.message);
  }
  
  // 3. 测试格式转换
  console.log('\n📋 测试3: 格式转换功能');
  try {
    const client3 = new McpClient({ configFile: deechatConfigPath });
    await client3.initialize();
    
    // 导出为Claude Desktop格式（注意：只有stdio类型的服务器会被导出）
    if (client3.configManager?.exportToClaudeDesktop) {
      const claudeFormat = client3.configManager.exportToClaudeDesktop();
      console.log('✅ 转换为Claude Desktop格式:');
      console.log('   服务器数量:', Object.keys(claudeFormat.mcpServers).length);
      
      // 保存转换后的配置
      const convertedPath = path.join(testDir, 'converted-claude-desktop.json');
      await fs.writeFile(convertedPath, JSON.stringify(claudeFormat, null, 2));
      console.log('   已保存到:', convertedPath);
    }
    
    await client3.dispose();
  } catch (error) {
    console.error('❌ 格式转换测试失败:', error.message);
  }
  
  // 清理测试文件
  await fs.rm(testDir, { recursive: true, force: true });
  
  console.log('\n✅ 配置格式兼容性测试完成');
}

// 运行测试
testConfigFormats().catch(console.error);