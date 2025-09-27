#!/usr/bin/env node

/**
 * 简单的测试MCP服务器
 * 实现基本的MCP协议用于测试JSON导入功能
 */

const readline = require('readline');

// 创建stdin/stdout接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// MCP协议响应
const sendResponse = (id, result = null, error = null) => {
  const response = {
    jsonrpc: "2.0",
    id: id
  };

  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }

  console.log(JSON.stringify(response));
};

// 处理MCP请求
const handleRequest = (message) => {
  try {
    const request = JSON.parse(message);

    switch (request.method) {
      case 'initialize':
        sendResponse(request.id, {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {
              listChanged: true
            }
          },
          serverInfo: {
            name: "test-mcp-server",
            version: "1.0.0"
          }
        });
        break;

      case 'tools/list':
        sendResponse(request.id, {
          tools: [
            {
              name: "echo",
              description: "Echo back the input text",
              inputSchema: {
                type: "object",
                properties: {
                  text: {
                    type: "string",
                    description: "Text to echo back"
                  }
                },
                required: ["text"]
              }
            },
            {
              name: "ping",
              description: "Simple ping tool",
              inputSchema: {
                type: "object",
                properties: {},
                required: []
              }
            }
          ]
        });
        break;

      case 'tools/call':
        const toolName = request.params?.name;
        const args = request.params?.arguments || {};

        if (toolName === 'echo') {
          sendResponse(request.id, {
            content: [
              {
                type: "text",
                text: `Echo: ${args.text || 'No text provided'}`
              }
            ]
          });
        } else if (toolName === 'ping') {
          sendResponse(request.id, {
            content: [
              {
                type: "text",
                text: "Pong! Test MCP server is working."
              }
            ]
          });
        } else {
          sendResponse(request.id, null, {
            code: -32601,
            message: `Unknown tool: ${toolName}`
          });
        }
        break;

      default:
        sendResponse(request.id, null, {
          code: -32601,
          message: `Unknown method: ${request.method}`
        });
    }
  } catch (error) {
    console.error('Error handling request:', error);
    sendResponse(null, null, {
      code: -32700,
      message: 'Parse error'
    });
  }
};

// 监听stdin输入
rl.on('line', (line) => {
  if (line.trim()) {
    handleRequest(line.trim());
  }
});

// 错误处理
rl.on('error', (err) => {
  console.error('Readline error:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.error('Test MCP server shutting down...');
  process.exit(0);
});

console.error('Test MCP server started...');