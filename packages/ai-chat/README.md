# @deepracticex/ai-chat

Universal AI chat client with intelligent tool calling format adapter. Supports OpenAI, Claude, Kimi, and any OpenAI-compatible APIs with robust error handling.

## 🎯 Core Purpose

`@deepracticex/ai-chat` is designed with a clear focus on core AI interaction:
1. **AI Request Processing** - Send messages to AI providers and handle responses
2. **Tool Calling Coordination** - Manage tool calls and results with intelligent format adaptation
3. **Universal Compatibility** - Works with OpenAI, Claude, Kimi, and any OpenAI-compatible APIs
4. **Robust Error Handling** - Graceful fallback when tool calls fail to parse

## 🌟 Key Features (v0.4.0)

### 🚀 **Universal Tool Calling Format Adapter**
- **Smart Format Detection**: Automatically detects and adapts different AI service formats
- **Multi-Strategy JSON Parsing**: Handles malformed JSON, empty strings, special tokens
- **Error Recovery**: Falls back to empty parameters instead of crashing
- **Extensible Design**: Easy to add new AI service adapters

### 📦 **Supported AI Services**
- ✅ **OpenAI** (GPT-3.5, GPT-4, GPT-4o)
- ✅ **Kimi/Moonshot** (with special handling for format quirks)
- ✅ **Claude** (Anthropic)
- ✅ **Any OpenAI-compatible API** (Ollama, LocalAI, etc.)

### 🛡️ **Production-Ready**
- **TypeScript First**: Full type safety and IntelliSense support
- **Zero Breaking Changes**: Drop-in replacement for existing code
- **Performance Monitoring**: Built-in adapter statistics and debugging
- **Battle Tested**: Handles edge cases from real-world usage

This package does **NOT** handle:
- ❌ Model discovery and selection (use `model-manager` packages)
- ❌ Provider configuration management (use `config-manager`)
- ❌ Conversation history management (use `context-manager`)
- ❌ Message persistence (use `context-manager`) 
- ❌ Session state tracking (use `context-manager`)
- ❌ Token calculation and cost estimation (use dedicated token calculation packages)
- ❌ Specific tool implementations (use `mcp-client` or custom providers)

## 🚀 Quick Start

```typescript
import { AIChat } from '@deepracticex/ai-chat'

// ✨ Simple and direct - specify exactly what you need
const aiChat = new AIChat({
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY
})

// 🌐 Works with any OpenAI-compatible API
const claude = new AIChat({
  baseUrl: 'https://api.anthropic.com/v1',
  model: 'claude-3-sonnet-20240229',
  apiKey: process.env.CLAUDE_API_KEY
})

const azure = new AIChat({
  baseUrl: 'https://your-resource.openai.azure.com',
  model: 'gpt-4',
  apiKey: process.env.AZURE_OPENAI_KEY
})

const ollama = new AIChat({
  baseUrl: 'http://localhost:11434',
  model: 'llama3'
  // No API key needed for local services
})

// 🚀 Send streaming messages
for await (const chunk of aiChat.sendMessage(messages)) {
  if (chunk.content) process.stdout.write(chunk.content)
  if (chunk.done) break
}
```

## 📖 Core API

### AIChat Class

```typescript
class AIChat {
  constructor(config: AIChatConfig)
  
  // Send message and get complete response
  sendMessage(
    messages: Message[], 
    options?: ChatOptions
  ): Promise<ChatResponse>
  
  // Send message and get streaming response
  sendMessageStream(
    messages: Message[],
    options?: ChatOptions  
  ): AsyncIterable<ChatStreamChunk>
}
```

### Simple Configuration

Direct and explicit configuration - no magic, no guessing:

```typescript
interface AIChatConfig {
  baseUrl: string   // API service endpoint URL - always required
  model: string     // Model name - always required
  apiKey?: string   // API key - optional for local services
  temperature?: number
  maxTokens?: number
}

// ✅ Examples - Clear and explicit
{
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4',
  apiKey: 'sk-...'
}

{
  baseUrl: 'https://api.anthropic.com/v1', 
  model: 'claude-3-sonnet-20240229',
  apiKey: 'sk-ant-...'
}

{
  baseUrl: 'http://localhost:11434',
  model: 'llama3'
  // No API key needed for local Ollama
}
```

## 🎯 Provider and Model Management

**Models and providers are managed externally** - use dedicated packages for configuration:

```typescript
// ✅ Get configuration from external model management
import { getModelConfig } from '@deechat/model-manager'

const modelConfig = await getModelConfig({
  task: 'coding',
  preference: 'fastest' 
})

const aiChat = new AIChat(modelConfig)
// modelConfig = {
//   baseUrl: 'https://api.openai.com/v1',
//   model: 'gpt-4-turbo',
//   apiKey: '...'
// }

// ✅ Or use provider configuration helpers
import { openaiConfig, claudeConfig } from '@deechat/provider-configs'

const aiChat = new AIChat(
  openaiConfig('gpt-4', { apiKey: process.env.OPENAI_KEY })
)
```

### Tool Integration

```typescript
// Tools are provided as input, not discovered by this package
const response = await aiChat.sendMessage(messages, {
  tools: [
    {
      name: "search_files",
      description: "Search for files",
      parameters: { /* JSON Schema */ }
    }
  ],
  onToolCall: async (call) => {
    // Your tool execution logic here
    // This could call mcp-client, local functions, etc.
    return {
      toolCallId: call.id,
      result: await executeMyTool(call.name, call.arguments)
    }
  }
})
```

## 🌊 Streaming Example

```typescript
const stream = aiChat.sendMessageStream(messages, {
  tools: myTools,
  onToolCall: handleToolCall
})

for await (const chunk of stream) {
  if (chunk.content) {
    process.stdout.write(chunk.content)
  }
  
  if (chunk.toolCalls) {
    console.log('AI wants to call tools:', chunk.toolCalls)
  }
  
  if (chunk.done) {
    console.log('\nResponse complete!')
    break
  }
}
```


## 🏗️ Architecture Integration

This package is designed to work alongside other focused packages:

```typescript
// Example: Complete DeeChat integration
import { AIChat } from '@ai-chat/core'
import { ContextManager } from '@context-manager'  
import { MCPClient } from '@mcp-client'

// Each package handles its own responsibility
const aiChat = new AIChat(aiConfig)           // AI communication
const contextManager = new ContextManager()   // History & state
const mcpClient = new MCPClient()             // Tool implementation

// Compose them together
const sessionId = 'session-123'
const history = contextManager.getMessages(sessionId)

const response = await aiChat.sendMessage(
  [...history, { role: 'user', content: userInput }],
  {
    tools: await mcpClient.getTools(),
    onToolCall: (call) => mcpClient.executeTools(call)
  }
)

// Update context with response
contextManager.addMessage(sessionId, response.message)
```

## 🎯 Features

- **Multiple AI Providers**: OpenAI, Claude, Gemini support
- **Streaming Responses**: Real-time response streaming
- **Tool Calling**: Coordinate tool execution without managing tools
- **TypeScript First**: Full type safety and IntelliSense
- **Lightweight**: Focused scope, minimal dependencies
- **Framework Agnostic**: Works in any Node.js environment

## 📦 Installation

```bash
npm install @ai-chat/core

# Peer dependencies (install the providers you need)
npm install openai anthropic  # for AI providers
```

## 📚 Documentation

### 核心文档
- **[API 设计文档](./docs/API_DESIGN.md)** - 详细的 API 设计和类型定义
- **[产品需求文档](./docs/prd.md)** - 完整的产品需求和用户故事
- **[架构设计](./docs/architecture.md)** - 技术架构和设计决策

### 开发文档  
- **[开发指南](./docs/development.md)** - 开发环境搭建和编码规范
- **[测试指南](./docs/testing.md)** - 测试策略和测试用例编写
- **[变更日志](./docs/CHANGELOG.md)** - 版本变更记录

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md).

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.