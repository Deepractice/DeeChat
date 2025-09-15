# 统一数据库架构示例

这个示例展示了重构后的 `ai-config` 和 `conversation-storage` 包如何共享同一个数据库文件。

## 🎯 架构特点

### 统一数据库文件
```
~/.deechat/app.db
├── ai_configs 表          (ai-config包管理)
├── preferences 表         (ai-config包管理) 
├── sessions 表            (conversation-storage包管理)
└── messages 表            (conversation-storage包管理)
```

### 包的职责边界
- ✅ **每个包只管理自己的表结构和数据**
- ✅ **数据库文件路径由外部注入**
- ✅ **包内部不关心其他包的表**
- ✅ **真正的解耦 = 依赖注入 + 单一职责**

## 🚀 运行示例

### 方式一：直接运行（推荐）
```bash
# 安装依赖
npm install

# 构建packages
npm run build

# 运行示例
npx ts-node examples/unified-database-demo.ts
```

### 方式二：编译后运行
```bash
# 构建项目
npm run build

# 编译示例
npx tsc examples/unified-database-demo.ts

# 运行编译后的文件
node examples/unified-database-demo.js
```

## 📋 示例功能

1. **统一数据库初始化**
   - 创建共享数据库目录
   - 各包使用同一个数据库文件

2. **AI配置管理演示**
   - 创建AI配置
   - 设置用户偏好

3. **对话存储演示**
   - 创建会话
   - 保存消息
   - 查询历史

4. **跨包数据关联**
   - 通过 `ai_config_name` 关联数据
   - 展示统一数据库的优势

5. **数据验证**
   - 查看表结构
   - 统计信息展示

## 🔧 使用方式对比

### ❌ 修改前（错误的方式）
```typescript
// 包内部硬编码路径，无法共享数据库
const aiConfig = new AIConfigManager(); // 默认 ~/.ai-config/config.db
const conversations = new ConversationStorage(); // 默认 ~/.deechat/conversations.db
```

### ✅ 修改后（正确的方式）
```typescript
// 统一数据库文件，外部注入路径
const DB_PATH = join(homedir(), '.deechat', 'app.db');

const aiConfig = new AIConfigManager({ dbPath: DB_PATH });
const conversations = new ConversationStorage({ dbPath: DB_PATH });

// 各包管理自己的表
await aiConfig.initialize();        // 创建 ai_configs, preferences 表
await conversations.initialize();   // 创建 sessions, messages 表
```

## 🏗️ 架构优势

### 1. 真正的解耦
- 包不依赖彼此的类型或接口
- 只关心自己管理的表
- 数据库路径完全由外部控制

### 2. 统一数据管理
- 单一数据库文件，备份恢复简单
- 支持跨包事务操作
- 数据一致性更好保证

### 3. 灵活的部署
```typescript
// 开发环境：各自独立数据库
const devAiConfig = new AIConfigManager({ dbPath: './dev-ai.db' });
const devConversations = new ConversationStorage({ dbPath: './dev-conv.db' });

// 生产环境：共享数据库  
const PROD_DB = './production.db';
const prodAiConfig = new AIConfigManager({ dbPath: PROD_DB });
const prodConversations = new ConversationStorage({ dbPath: PROD_DB });
```

### 4. 包的独立性
```typescript
// 每个包可以独立测试
const testStorage = new ConversationStorage({ 
  dbPath: './test.db',
  tablePrefix: 'test_'  // 避免测试污染
});
```

## 💡 最佳实践

1. **主应用负责数据库路径管理**
2. **包专注于管理自己的表**
3. **使用表前缀避免命名冲突**
4. **通过外键建立表之间的关联**
5. **利用统一数据库的事务特性**

## 🎉 总结

这种架构实现了：
- **包的解耦**：各包独立，不相互依赖
- **数据统一**：共享数据库文件，便于管理
- **职责清晰**：每个包只管自己的表
- **使用灵活**：支持独立或共享部署

这正是你提到的正确架构思路的完美实现！