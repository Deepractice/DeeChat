#!/usr/bin/env node

/**
 * Mock Calculator MCP Server
 * 
 * 一个简单的模拟 MCP 服务器，用于测试和演示
 */

import readline from 'readline';

// 创建 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// 服务器状态
let initialized = false;

// 支持的工具
const tools = [
  {
    name: 'add',
    description: 'Add two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' }
      },
      required: ['a', 'b']
    }
  },
  {
    name: 'subtract',
    description: 'Subtract second number from first',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' }
      },
      required: ['a', 'b']
    }
  },
  {
    name: 'multiply',
    description: 'Multiply two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' }
      },
      required: ['a', 'b']
    }
  },
  {
    name: 'divide',
    description: 'Divide first number by second',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' }
      },
      required: ['a', 'b']
    }
  }
];

// JSON-RPC 消息处理
function handleMessage(message) {
  try {
    const request = JSON.parse(message);
    
    if (!request.jsonrpc || request.jsonrpc !== '2.0') {
      sendError(request.id, -32600, 'Invalid Request', 'Missing or invalid jsonrpc field');
      return;
    }

    if (!request.method) {
      sendError(request.id, -32600, 'Invalid Request', 'Missing method field');
      return;
    }

    // 处理不同的方法
    switch (request.method) {
      case 'initialize':
        handleInitialize(request);
        break;
      case 'tools/list':
        handleToolsList(request);
        break;
      case 'tools/call':
        handleToolsCall(request);
        break;
      case 'resources/list':
        // 这个服务器不支持资源
        sendError(request.id, -32601, 'Method not found', 'This server does not support resources');
        break;
      case 'prompts/list':
        // 这个服务器不支持提示词
        sendError(request.id, -32601, 'Method not found', 'This server does not support prompts');
        break;
      default:
        sendError(request.id, -32601, 'Method not found', `Unknown method: ${request.method}`);
    }

  } catch (error) {
    sendError(null, -32700, 'Parse error', 'Invalid JSON');
  }
}

// 处理初始化请求
function handleInitialize(request) {
  initialized = true;
  sendResponse(request.id, {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: { listChanged: false }
    },
    serverInfo: {
      name: 'Mock Calculator Server',
      version: '1.0.0'
    }
  });
}

// 处理工具列表请求
function handleToolsList(request) {
  if (!initialized) {
    sendError(request.id, -32002, 'Server not initialized');
    return;
  }

  sendResponse(request.id, {
    tools: tools
  });
}

// 处理工具调用请求
function handleToolsCall(request) {
  if (!initialized) {
    sendError(request.id, -32002, 'Server not initialized');
    return;
  }

  const { name, arguments: args } = request.params || {};

  if (!name) {
    sendError(request.id, -32602, 'Invalid params', 'Tool name is required');
    return;
  }

  // 查找工具
  const tool = tools.find(t => t.name === name);
  if (!tool) {
    sendError(request.id, -32001, 'Tool not found', `Tool '${name}' not found`);
    return;
  }

  // 执行工具
  try {
    const result = executeCalculation(name, args);
    sendResponse(request.id, {
      content: [
        {
          type: 'text',
          text: result.toString()
        }
      ],
      isError: false
    });
  } catch (error) {
    sendResponse(request.id, {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    });
  }
}

// 执行计算
function executeCalculation(operation, args) {
  if (!args || typeof args.a !== 'number' || typeof args.b !== 'number') {
    throw new Error('Both a and b must be numbers');
  }

  const { a, b } = args;

  switch (operation) {
    case 'add':
      return a + b;
    case 'subtract':
      return a - b;
    case 'multiply':
      return a * b;
    case 'divide':
      if (b === 0) {
        throw new Error('Division by zero');
      }
      return a / b;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

// 发送响应
function sendResponse(id, result) {
  const response = {
    jsonrpc: '2.0',
    id: id,
    result: result
  };
  console.log(JSON.stringify(response));
}

// 发送错误
function sendError(id, code, message, data = undefined) {
  const response = {
    jsonrpc: '2.0',
    id: id,
    error: {
      code: code,
      message: message,
      ...(data && { data })
    }
  };
  console.log(JSON.stringify(response));
}

// 监听标准输入
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (trimmed) {
    handleMessage(trimmed);
  }
});

// 错误处理
rl.on('error', (err) => {
  console.error('Readline error:', err);
  process.exit(1);
});

// 进程退出处理
process.on('SIGINT', () => {
  rl.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  rl.close();
  process.exit(0);
});

// 启动消息
console.error('Mock Calculator MCP Server started');