# Token Calculator

基于策略模式的多厂商AI模型Token计算器，支持精确的token计数和成本估算。

## 特性

- 🎯 **多厂商支持**: OpenAI、Anthropic、通用fallback策略
- 🚀 **简单易用**: 一行代码即可计算tokens
- 💰 **成本估算**: 基于最新定价的准确成本计算
- 📊 **批量处理**: 支持批量文本处理
- 🔧 **策略模式**: 易于扩展新的AI厂商
- ⚡ **高性能**: 轻量级设计，专注核心功能
- 🛡️ **类型安全**: 完整的TypeScript支持

## 安装

```bash
npm install @deechat/token-calculator
```

## 快速开始

### 基本使用

```typescript
import { countTokens, countGPT4, countClaude } from '@deechat/token-calculator'

// 通用接口
const tokens = countTokens('Hello, world!', 'openai', 'gpt-4')
console.log(`Tokens: ${tokens}`) // Tokens: 4

// 便捷方法
const gpt4Tokens = countGPT4('Hello, world!')
const claudeTokens = countClaude('Hello, world!')
```

### 成本估算

```typescript
import { estimateCost } from '@deechat/token-calculator'

const cost = estimateCost(
  'Your input text here',
  100, // 预期输出tokens
  'gpt-4'
)

console.log(`Total cost: $${cost.totalCost}`)
```

### 提供者对比

```typescript
import { compareProviders, getMostEconomical } from '@deechat/token-calculator'

// 对比不同提供者的token计数
const comparison = compareProviders('Hello, world!')
// { openai: 4, anthropic: 4, generic: 5 }

// 找到最经济的选择
const economical = getMostEconomical('Your text', 100)
console.log(`Most economical: ${economical.model}`)
console.log(`Cost: $${economical.cost.totalCost}`)
```

## API 文档

### 核心函数

#### `countTokens(text: string, provider?: string, model?: string): number`

通用token计数函数。

```typescript
// OpenAI
countTokens('Hello', 'openai', 'gpt-4')
countTokens('Hello', 'openai') // 默认 gpt-4

// Anthropic  
countTokens('Hello', 'anthropic', 'claude-3-sonnet')
countTokens('Hello', 'claude') // 自动识别厂商

// 通用策略
countTokens('Hello', 'generic')
countTokens('Hello') // 默认使用第一个可用策略
```

#### 便捷函数

```typescript
countGPT4(text: string): number           // GPT-4
countGPT35(text: string): number          // GPT-3.5 Turbo  
countClaude(text: string, model?: string): number // Claude (默认3-sonnet)
```

#### 成本估算

```typescript
estimateCost(
  inputText: string,
  outputTokens: number = 0, 
  model: string,
  provider?: string
): CostEstimate

// 返回格式
interface CostEstimate {
  inputCost: number
  outputCost: number  
  totalCost: number
  currency: string
}
```

#### 批量操作

```typescript
batchCount(texts: string[], provider?: string, model?: string): BatchTokenResult[]

// 批量成本估算
const calculator = new TokenCalculator()
const costCalculator = new CostCalculator(calculator)
const costs = costCalculator.batchEstimateCost(texts, 100, 'gpt-4')
```

### 高级用法

#### 类实例化

```typescript
import { TokenCalculator, CostCalculator } from '@deechat/token-calculator'

const calculator = new TokenCalculator()
const costCalculator = new CostCalculator(calculator)

// 基本计数
const tokens = calculator.count('Hello', 'openai', 'gpt-4')

// 智能检测
const smartTokens = calculator.smartCount('Hello', 'gpt-4-turbo')

// 编码/解码 (如果支持)
const encoded = calculator.encode('Hello', 'openai', 'gpt-4')
const decoded = calculator.decode(encoded, 'openai', 'gpt-4')

// 成本分析
const economical = costCalculator.getMostEconomical('Hello', 100)
const monthlyCost = costCalculator.estimateMonthlyCost(1000, 500, 'gpt-4')
```

#### 健康检查

```typescript
import { healthCheck, getAvailableProviders, getSupportedModels } from '@deechat/token-calculator'

// 检查所有提供者状态
const health = healthCheck()
console.log('Health:', health)

// 获取可用提供者
const providers = getAvailableProviders()
console.log('Providers:', providers)

// 获取支持的模型
const models = getSupportedModels('openai')
console.log('OpenAI models:', models)
```

## 支持的模型

### OpenAI
- gpt-4
- gpt-4-turbo
- gpt-4o
- gpt-3.5-turbo
- text-davinci-003

### Anthropic  
- claude-3-opus
- claude-3-sonnet
- claude-3-haiku
- claude-3-5-sonnet
- claude-2.1
- claude-2
- claude-instant-1.2

### 通用策略
- generic (基于字符统计的近似计算)

## 定价信息

所有定价数据基于2024年官方价格，单位为USD per 1K tokens。成本会根据最新定价自动更新。

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 测试
npm test

# 清理
npm run clean
```

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request来改进这个项目！

---

由 DeeChat 团队开发 ❤️