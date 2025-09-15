# @ai-chat/core 使用指南

## 🚀 快速开始

### 1. 基础安装和配置

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 设置环境变量
export OPENAI_API_KEY="your-api-key-here"
```

### 2. 基础使用

```javascript
const { AIChat } = require('./dist/index')

const aiChat = new AIChat({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4'
})

// 简单对话
const messages = [{ role: 'user', content: '你好！' }]

for await (const chunk of aiChat.sendMessage(messages)) {
  if (chunk.content) {
    process.stdout.write(chunk.content)
  }
  if (chunk.done) break
}
```

## 🛠️ 工具调用功能

### 工具定义

```javascript
const tools = [
  {
    name: 'get_weather',
    description: '获取天气信息',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: '城市名称' }
      },
      required: ['city']
    }
  }
]
```

### 工具处理器

```javascript
async function handleToolCall(call) {
  if (call.name === 'get_weather') {
    // 调用你的天气API
    const weather = await getWeatherFromAPI(call.arguments.city)
    
    return {
      toolCallId: call.id,
      result: `${call.arguments.city}天气：${weather.description}`
    }
  }
}
```

### 完整工具调用示例

```javascript
for await (const chunk of aiChat.sendMessage(messages, {
  tools,
  onToolCall: handleToolCall
})) {
  // 阶段变化
  if (chunk.phase) {
    console.log(`阶段: ${chunk.phase}`)
  }
  
  // 工具调用
  if (chunk.toolCalls) {
    console.log('AI调用工具:', chunk.toolCalls)
  }
  
  // 工具执行中
  if (chunk.toolExecuting) {
    console.log('执行工具:', chunk.toolExecuting.name)
  }
  
  // 工具结果
  if (chunk.toolResults) {
    console.log('工具结果:', chunk.toolResults)
  }
  
  // AI回复
  if (chunk.content) {
    process.stdout.write(chunk.content)
  }
}
```

## 📝 示例脚本

### 1. 基础功能测试
```bash
node quick-test.js
```

### 2. 完整示例演示
```bash
node example-usage.js
```

### 3. 交互式命令行工具
```bash
node cli-demo.js
```

### 4. Web服务器 (需要安装express)
```bash
npm install express cors
node web-server-example.js
```

## 🔧 配置选项

```javascript
const aiChat = new AIChat({
  provider: 'openai',        // 必需：AI提供商
  apiKey: 'your-key',        // 必需：API密钥
  model: 'gpt-4',            // 可选：模型名称
  temperature: 0.7,          // 可选：温度参数
  maxTokens: 1000           // 可选：最大token数
})
```

## 📊 流式响应格式

```javascript
interface ChatStreamChunk {
  // 基础响应
  content?: string          // AI回复内容
  done?: boolean           // 是否完成
  usage?: TokenUsage       // Token使用统计
  model?: string           // 使用的模型
  error?: string           // 错误信息
  
  // 工具调用相关
  phase?: 'thinking' | 'calling_tools' | 'processing_results' | 'responding'
  toolCalls?: ToolCall[]           // AI发起的工具调用
  toolExecuting?: ToolExecuting    // 正在执行的工具
  toolResults?: ToolResult[]       // 工具执行结果
  toolError?: ToolExecutionError   // 工具执行错误
}
```

## ⚠️ 注意事项

1. **API密钥**：确保设置正确的OPENAI_API_KEY环境变量
2. **工具安全**：工具处理器应该验证输入参数
3. **错误处理**：工具执行失败不会中断对话
4. **循环限制**：系统会自动防止无限工具调用循环

## 🔍 调试技巧

```javascript
// 启用详细日志
for await (const chunk of aiChat.sendMessage(messages, options)) {
  console.log('Chunk:', JSON.stringify(chunk, null, 2))
}

// 跟踪对话历史
const history = []
history.push({ role: 'user', content: userInput })
// ... 处理响应后
history.push({ role: 'assistant', content: aiResponse })
```

## 🌐 Web集成

参考 `web-server-example.js` 了解如何：
- 创建REST API
- 实现流式响应 (Server-Sent Events)
- 处理跨域请求
- 创建Web测试界面

## 📚 更多资源

- 查看 `__tests__/` 目录了解测试用例
- 参考 `src/types/index.ts` 了解完整类型定义
- 阅读源码了解实现细节