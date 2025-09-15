# @deepracticex/ai-config

一个极简的 AI 配置管理库，专注于配置存储和偏好管理。基于"如非必要，勿增实体"的设计原则。

## 🎯 设计原则

- **职责纯粹** - 只做配置存储，不预设业务逻辑
- **基础设施** - 提供稳定的数据持久化能力
- **消费者驱动** - 让使用者决定默认值和业务规则
- **类型安全** - 完整的 TypeScript 支持

## 🌟 特性

- ✅ **极简设计** - 只保留核心的配置和偏好管理功能
- ✅ **本地存储** - 基于 SQLite 的本地数据库，不依赖外部服务
- ✅ **跨项目共享** - 配置存储在用户目录，多个项目可共享
- ✅ **完整 TypeScript 支持** - 类型安全，智能提示
- ✅ **简单 API** - 就像操作对象一样简单
- ✅ **零预设** - 不强加任何默认值，保持基础设施的纯粹性
- ✅ **偏好管理** - 分类管理用户偏好设置

## 📦 安装

```bash
npm install @deechat/ai-config
```

## 🚀 快速开始

### 基础用法

```typescript
import { initializeAIConfig, getProvider, createConfig, getResolvedConfig } from '@deechat/ai-config';

// 1. 初始化（自动创建本地数据库 ~/.ai-config/config.db）
await initializeAIConfig();

// 2. 查看预置的供应商
const openai = getProvider('openai');
console.log(openai.display_name); // "OpenAI"

// 3. 创建配置
await createConfig({
  provider_code: 'openai',
  config_name: 'my-config',
  config_data: { 
    apiKey: 'sk-your-api-key-here',
    model: 'gpt-4',
    temperature: 0.7
  }
});

// 4. 使用配置（自动合并供应商默认值）
const config = await getResolvedConfig('openai', 'my-config');
console.log(config.merged_config);
// {
//   apiKey: 'sk-your-api-key-here',
//   model: 'gpt-4',
//   temperature: 0.7,
//   baseUrl: 'https://api.openai.com/v1'  // 来自供应商默认值
// }
```

### 高级用法

```typescript
import { AIConfigManager } from '@deechat/ai-config';

// 使用自定义配置
const manager = new AIConfigManager({
  database_path: '/custom/path/config.db',
  auto_migrate: true,
  backup_enabled: true
});

await manager.initialize();

// 供应商管理
const providers = manager.providers.findAll({ is_enabled: true });
const openaiConfigs = manager.configs.findByProvider('openai');

// 偏好管理
await manager.preferences.set({
  key: 'default_provider',
  value: 'openai',
  category: 'ai'
});

const theme = manager.preferences.getWithDefault('ui_theme', 'system');

// 获取统计信息
const stats = await manager.getStats();
console.log(stats);
```

## 📖 详细文档

### 供应商管理

预置供应商包括：OpenAI、Anthropic Claude、Google Gemini、Ollama 等。

```typescript
import { createProvider, getProviders, getProvider } from '@deechat/ai-config';

// 查看所有供应商
const allProviders = getProviders();

// 查看启用的供应商
const enabledProviders = getProviders({ is_enabled: true });

// 添加自定义供应商
await createProvider({
  provider_code: 'my-ai',
  display_name: 'My AI Service',
  default_base_url: 'https://api.my-ai.com/v1',
  supported_models: ['my-model-1', 'my-model-2'],
  default_model: 'my-model-1',
  description: 'My custom AI service'
});
```

### 配置管理

```typescript
import { createConfig, getConfig, getResolvedConfig } from '@deechat/ai-config';

// 创建配置
await createConfig({
  provider_code: 'anthropic',
  config_name: 'production',
  config_data: {
    apiKey: 'sk-ant-xxx',
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096
  },
  is_default: true  // 设为默认配置
});

// 获取配置
const config = getConfig('anthropic', 'production');

// 获取默认配置
const defaultConfig = getConfig('anthropic');

// 获取解析后的配置（合并供应商默认值）
const resolved = await getResolvedConfig('anthropic');
```

### 偏好管理

```typescript
import { setPreference, getPreference } from '@deechat/ai-config';

// 设置偏好
await setPreference('ui_theme', 'dark', 'ui', 'UI theme preference');
await setPreference('max_tokens', 4096, 'ai');

// 获取偏好
const theme = getPreference('ui_theme');
const maxTokens = getPreference('max_tokens', 2048); // 带默认值

// 批量操作
const manager = getAIConfigManager();
await manager.preferences.setBatch({
  'request_timeout': 30000,
  'retry_attempts': 3,
  'log_level': 'info'
}, 'system');
```

## 🗄️ 数据库架构

```sql
-- 供应商表
CREATE TABLE providers (
    provider_code TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    default_base_url TEXT,
    supported_models TEXT,  -- JSON 数组
    default_model TEXT,
    config_schema TEXT,     -- JSON Schema
    description TEXT,
    is_enabled BOOLEAN DEFAULT 1
);

-- 配置表
CREATE TABLE configs (
    id INTEGER PRIMARY KEY,
    provider_code TEXT NOT NULL,
    config_name TEXT NOT NULL,
    config_data TEXT NOT NULL,  -- JSON 对象
    is_default BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (provider_code) REFERENCES providers(provider_code)
);

-- 偏好表
CREATE TABLE preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,  -- JSON 值
    category TEXT,
    description TEXT
);
```

## 📁 文件结构

```
~/.ai-config/
├── config.db          # SQLite 数据库
└── backup-*.db        # 自动备份文件（可选）
```

## 🔧 配置选项

```typescript
interface DatabaseOptions {
  database_path?: string;    // 自定义数据库路径
  auto_migrate?: boolean;    // 自动迁移数据库（默认 true）
  backup_enabled?: boolean;  // 启用备份（默认 true）
  readonly?: boolean;        // 只读模式（默认 false）
}
```

## 🧪 测试

```bash
npm test           # 运行测试
npm run test:watch # 监听模式
npm run test:coverage # 覆盖率报告
```

## 📊 示例：完整的使用流程

```typescript
import { 
  initializeAIConfig, 
  createConfig, 
  getResolvedConfig,
  setPreference,
  getPreference 
} from '@deechat/ai-config';

async function setupAIConfig() {
  // 初始化
  await initializeAIConfig();

  // 配置 OpenAI
  await createConfig({
    provider_code: 'openai',
    config_name: 'development',
    config_data: {
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o-mini', // 开发环境用便宜的模型
      temperature: 0.7
    }
  });

  await createConfig({
    provider_code: 'openai', 
    config_name: 'production',
    config_data: {
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o', // 生产环境用最好的模型
      temperature: 0.5
    },
    is_default: true // 设为默认
  });

  // 设置全局偏好
  await setPreference('default_provider', 'openai', 'ai');
  await setPreference('request_timeout', 30000, 'ai');
  await setPreference('ui_theme', 'system', 'ui');

  // 在应用中使用
  const defaultProvider = getPreference('default_provider');
  const config = await getResolvedConfig(defaultProvider);
  
  console.log('🎯 AI 配置就绪！');
  console.log('Provider:', defaultProvider);
  console.log('Config:', config.merged_config);
}
```

## 📝 API 文档

### 便利函数

- `initializeAIConfig(options?)` - 初始化全局管理器
- `getAIConfigManager()` - 获取全局管理器
- `closeAIConfig()` - 关闭全局管理器

### 供应商操作

- `createProvider(input)` - 创建供应商
- `getProvider(code)` - 获取供应商
- `getProviders(options?)` - 获取供应商列表

### 配置操作

- `createConfig(input)` - 创建配置
- `getConfig(provider, name?)` - 获取配置
- `getResolvedConfig(provider, name?)` - 获取解析配置

### 偏好操作

- `setPreference(key, value, category?, description?)` - 设置偏好
- `getPreference(key, defaultValue?)` - 获取偏好

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT

---

**@deechat/ai-config** - 让 AI 配置管理变得简单！ 🚀