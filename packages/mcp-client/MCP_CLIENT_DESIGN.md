# @deechat/mcp-client 设计文档

## 📋 项目概述

`@deechat/mcp-client` 是 DeeChat 项目的 MCP (Model Context Protocol) 客户端包，负责与各种 MCP 服务器进行通信。

### 核心职责
- 🔗 **协议实现** - JSON-RPC over 多种传输方式
- 📡 **连接管理** - 管理与多个 MCP 服务器的连接
- 📋 **配置管理** - 持久化服务器配置
- 🔄 **消息路由** - 将请求路由到正确的服务器
- ❌ **错误处理** - 网络异常、协议错误处理

### 设计原则
1. **单一职责** - 只做 MCP 协议客户端，不实现具体工具逻辑
2. **简洁 API** - 提供易用的接口设计
3. **可扩展性** - 支持多种传输方式（stdio、http、websocket）
4. **配置驱动** - 基于 JSON 配置文件管理服务器

## 🏗️ 架构设计

### 核心架构
```
McpClient (主入口)
├── ConfigManager (配置管理)
├── ConnectionManager (连接管理) 
├── TransportFactory (传输工厂)
└── ProtocolHandler (协议处理)
```

### 模块职责

#### McpClient (主类)
- 提供统一的 API 入口
- 协调各个子模块
- 管理客户端生命周期

#### ConfigManager (配置管理)
- JSON 配置文件的读取、写入
- 服务器配置的 CRUD 操作
- 配置验证和默认值处理

#### ConnectionManager (连接管理)
- 管理多个服务器连接
- 连接状态监控
- 自动重连机制

#### TransportFactory (传输工厂)
- 创建不同类型的传输实例
- 支持 stdio、http、websocket 等传输方式

#### ProtocolHandler (协议处理)
- JSON-RPC 协议的封装和解析
- MCP 协议标准实现
- 错误处理和响应解析

## 📋 API 设计

### 主要接口

```typescript
class McpClient {
  // 初始化和生命周期
  async initialize(configFile?: string): Promise<void>;
  async dispose(): Promise<void>;
  
  // 配置管理
  async addServer(config: McpServerConfig): Promise<void>;
  async removeServer(serverId: string): Promise<void>;
  async updateServer(serverId: string, updates: Partial<McpServerConfig>): Promise<void>;
  async getServer(serverId: string): Promise<McpServerConfig | null>;
  async listServers(): Promise<McpServerConfig[]>;
  
  // 连接管理
  async connect(serverId: string): Promise<void>;
  async disconnect(serverId: string): Promise<void>;
  async isConnected(serverId: string): boolean;
  async getConnectionStatus(serverId: string): ConnectionStatus;
  
  // MCP 协议调用（核心功能）
  async callTool(serverId: string, toolName: string, args: any): Promise<any>;
  async readResource(serverId: string, uri: string): Promise<any>;
  async getPrompt(serverId: string, name: string, args?: any): Promise<any>;
  
  // 发现功能
  async listTools(serverId: string): Promise<ToolInfo[]>;
  async listResources(serverId: string): Promise<ResourceInfo[]>;
  async listPrompts(serverId: string): Promise<PromptInfo[]>;
  
  // 原始协议调用（高级用户）
  async sendRequest(serverId: string, method: string, params?: any): Promise<any>;
}
```

### 类型定义

```typescript
interface McpServerConfig {
  id: string;
  name: string;
  description?: string;
  transport: TransportConfig;
  enabled: boolean;
  autoReconnect?: boolean;
  timeout?: number;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface TransportConfig {
  type: 'stdio' | 'http' | 'websocket';
  // stdio 配置
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  // http/websocket 配置
  url?: string;
  headers?: Record<string, string>;
}

interface ToolInfo {
  name: string;
  description?: string;
  inputSchema: any;
}

interface ResourceInfo {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

interface PromptInfo {
  name: string;
  description?: string;
  arguments?: any;
}

enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}
```

## 📁 项目文件结构

```
src/
├── index.ts                 # 主入口，导出 McpClient
├── McpClient.ts            # 主类实现
├── config/
│   ├── ConfigManager.ts    # 配置文件管理
│   ├── types.ts           # 配置相关类型
│   └── validator.ts       # 配置验证
├── connection/
│   ├── ConnectionManager.ts # 连接管理器
│   ├── Connection.ts       # 单个连接抽象
│   └── types.ts           # 连接相关类型
├── transport/
│   ├── TransportFactory.ts # 传输工厂
│   ├── BaseTransport.ts   # 传输基类
│   ├── StdioTransport.ts  # stdio 传输
│   ├── HttpTransport.ts   # http 传输
│   └── types.ts          # 传输相关类型
├── protocol/
│   ├── ProtocolHandler.ts # JSON-RPC 协议处理
│   ├── types.ts          # 协议相关类型
│   └── errors.ts         # MCP 错误定义
└── utils/
    ├── logger.ts         # 日志工具
    └── errors.ts         # 通用错误类

examples/
├── basic-usage.ts        # 基础使用示例
├── multiple-servers.ts   # 多服务器示例
└── mock-server.js       # 测试用模拟服务器

tests/
├── unit/                # 单元测试
├── integration/         # 集成测试
└── fixtures/           # 测试数据
```

## 📝 配置文件设计

### 配置文件结构 (`~/.deechat/mcp-servers.json`)

```json
{
  "version": "1.0.0",
  "servers": {
    "calculator": {
      "id": "calculator",
      "name": "Calculator Server",
      "description": "Basic math operations server",
      "transport": {
        "type": "stdio",
        "command": "node",
        "args": ["calc-server.js"],
        "cwd": "./servers/calculator",
        "env": {
          "NODE_ENV": "production"
        }
      },
      "enabled": true,
      "autoReconnect": true,
      "timeout": 30000,
      "tags": ["math", "tools"],
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    },
    "file-tools": {
      "id": "file-tools", 
      "name": "File Tools Server",
      "description": "File system operations",
      "transport": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": {
          "Authorization": "Bearer token123",
          "Content-Type": "application/json"
        }
      },
      "enabled": true,
      "timeout": 15000,
      "tags": ["files", "system"]
    },
    "ai-assistant": {
      "id": "ai-assistant",
      "name": "AI Assistant Tools",
      "transport": {
        "type": "websocket",
        "url": "ws://localhost:8080/mcp"
      },
      "enabled": false,
      "autoReconnect": true,
      "timeout": 45000
    }
  },
  "defaults": {
    "timeout": 30000,
    "autoReconnect": true,
    "maxReconnectAttempts": 3,
    "reconnectDelay": 1000
  }
}
```

### 配置文件特性

- **版本控制** - 支持配置格式升级
- **服务器管理** - 支持多个 MCP 服务器配置
- **传输多样性** - 支持 stdio、http、websocket 传输
- **灵活配置** - 支持环境变量、工作目录、请求头等
- **默认值** - 提供合理的默认配置
- **元数据** - 记录创建和更新时间

## 🔄 数据流设计

### 典型调用流程

```
1. DeeChat App
   ↓ client.callTool('calculator', 'add', {a: 5, b: 3})
   
2. McpClient
   ↓ 路由到对应服务器
   
3. ConnectionManager
   ↓ 获取或创建连接
   
4. Transport (stdio/http/ws)
   ↓ 发送 JSON-RPC 请求
   
5. MCP Server
   ↓ 处理请求，返回结果
   
6. Transport
   ↓ 接收响应
   
7. ProtocolHandler
   ↓ 解析 JSON-RPC 响应
   
8. McpClient
   ↓ 返回结果给调用方
   
9. DeeChat App
```

### JSON-RPC 消息格式

**请求示例**:
```json
{
  "jsonrpc": "2.0",
  "id": "req-123",
  "method": "tools/call",
  "params": {
    "name": "calculator",
    "arguments": {
      "operation": "add",
      "a": 5,
      "b": 3
    }
  }
}
```

**响应示例**:
```json
{
  "jsonrpc": "2.0",
  "id": "req-123",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "5 + 3 = 8"
      }
    ]
  }
}
```

## 🎯 使用示例

### 基础使用

```typescript
import { McpClient } from '@deechat/mcp-client';

// 初始化客户端
const client = new McpClient();
await client.initialize('./mcp-config.json');

// 添加服务器
await client.addServer({
  id: 'calculator',
  name: 'Calculator Server',
  transport: {
    type: 'stdio',
    command: 'node',
    args: ['calc-server.js']
  },
  enabled: true
});

// 连接并使用
await client.connect('calculator');

// 查看可用工具
const tools = await client.listTools('calculator');
console.log('Available tools:', tools);

// 调用工具
const result = await client.callTool('calculator', 'add', { a: 5, b: 3 });
console.log('Result:', result);

// 清理
await client.dispose();
```

### 多服务器管理

```typescript
// 添加多个服务器
await client.addServer({
  id: 'math-server',
  name: 'Math Server',
  transport: { type: 'stdio', command: 'math-server' },
  enabled: true
});

await client.addServer({
  id: 'file-server', 
  name: 'File Server',
  transport: { type: 'http', url: 'http://localhost:3000/mcp' },
  enabled: true
});

// 连接所有启用的服务器
const servers = await client.listServers();
for (const server of servers.filter(s => s.enabled)) {
  await client.connect(server.id);
}

// 分别调用不同服务器的功能
const mathResult = await client.callTool('math-server', 'calculate', { 
  expression: '(5 + 3) * 2' 
});

const fileContent = await client.readResource('file-server', 'file://data.txt');
```

### 错误处理

```typescript
try {
  await client.connect('calculator');
  const result = await client.callTool('calculator', 'divide', { a: 10, b: 0 });
} catch (error) {
  if (error.code === 'CONNECTION_FAILED') {
    console.error('Failed to connect to server:', error.message);
  } else if (error.code === 'TOOL_ERROR') {
    console.error('Tool execution failed:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## 🚀 实现计划

### 第一阶段 - 核心功能
1. ✅ 设计文档完成
2. 🔄 基础项目结构搭建
3. 🔄 ConfigManager 实现
4. 🔄 基础传输层实现 (stdio)
5. 🔄 ProtocolHandler 实现
6. 🔄 McpClient 主类实现

### 第二阶段 - 扩展功能
1. 🔄 HTTP 传输实现
2. 🔄 WebSocket 传输实现
3. 🔄 连接管理和重连机制
4. 🔄 完善错误处理
5. 🔄 事件系统

### 第三阶段 - 完善和测试
1. 🔄 单元测试
2. 🔄 集成测试
3. 🔄 文档和示例
4. 🔄 性能优化
5. 🔄 发布准备

## 📦 依赖管理

### 生产依赖
- `@modelcontextprotocol/sdk` - MCP 官方 SDK（类型定义）
- 无其他重依赖，保持轻量

### 开发依赖
- `typescript` - TypeScript 编译器
- `jest` - 测试框架
- `eslint` - 代码检查
- `prettier` - 代码格式化

## 🔒 设计约束

1. **轻量化** - 最小化依赖，避免过度工程化
2. **TypeScript 优先** - 提供完整的类型支持
3. **Node.js 兼容** - 支持 Node.js 18+
4. **配置驱动** - 所有行为可通过配置控制
5. **错误透明** - 提供清晰的错误信息和处理机制

---

*本设计文档版本: 1.0.0*  
*最后更新: 2024-09-10*