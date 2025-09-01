# CoreLLMService - DeeChat统一底层LLM服务

## 📋 概述

CoreLLMService是DeeChat的新一代统一底层LLM服务，采用清晰的模块化架构，旨在替代原有的复杂双层服务结构。

### 🎯 设计目标

- **简化架构**：从双层服务简化为单一统一服务
- **职责清晰**：每个模块单一职责，易于理解和维护
- **易于扩展**：基于接口设计，便于功能扩展
- **高可测试性**：模块化设计，支持独立单元测试

### 🏗️ 架构对比

**原有架构（复杂）:**
```
IPC Handler → CoreLLMService → [ConfigManager, ModelManager, StreamProcessor, ToolIntegrator, PromptBuilder] → AI调用
```

**新架构（简化）:**
```
IPC Handler → CoreLLMService → [ConfigManager, ModelManager, StreamProcessor, ToolIntegrator, PromptBuilder]
```

## 🧩 核心模块

### 1. CoreLLMService (协调层)
- **职责**: 统一协调各个管理器，提供对外接口
- **位置**: `CoreLLMService.ts`
- **主要方法**: `streamMessage()`, `batchMessages()`, `testProvider()`

### 2. ConfigManager (配置层)
- **职责**: 管理模型配置，包括获取、缓存、默认配置创建
- **接口**: `IConfigManager.ts`
- **功能**: 配置获取、Provider检测、配置缓存

### 3. ModelManager (模型层)  
- **职责**: 管理模型实例，包括创建、缓存、测试
- **接口**: `IModelManager.ts`
- **功能**: 模型创建、实例缓存、连接测试

### 4. StreamProcessor (执行层)
- **职责**: 处理AI模型调用和流式输出
- **接口**: `IStreamProcessor.ts`
- **功能**: 流式处理、批量处理、状态管理

### 5. ToolIntegrator (工具层)
- **职责**: 集成MCP工具，处理工具调用
- **接口**: `IToolIntegrator.ts`  
- **功能**: 工具绑定、工具调用、使用统计

### 6. PromptBuilder (提示词层)
- **职责**: 构建完整的提示词上下文
- **接口**: `IPromptBuilder.ts`
- **功能**: 角色激活、历史处理、提示词优化

## 🚀 使用方式

### 基本用法

```typescript
// 1. 通过工厂创建服务实例
const service = CoreLLMServiceFactory.create()

// 2. 准备请求
const request: LLMRequest = {
  message: 'Hello, world!',
  activeRole: 'assistant',
  sessionId: 'session-123'
}

// 3. 调用流式处理
const response = await service.streamMessage(
  request,
  'gpt-3.5-turbo',
  (chunk: string) => {
    console.log('收到流式内容:', chunk)
  }
)
```

### 过渡期使用

```typescript
// 使用过渡服务，支持新旧服务切换
const transitionService = new TransitionLLMService()

// 启用新服务
transitionService.enableNewService()

// 启用对比验证
transitionService.enableComparison()

// 正常调用，内部会根据配置选择服务
const response = await transitionService.streamMessage(request, configId)
```

## 🔄 迁移计划

### Phase 1: 基础架构搭建 ✅
- [x] 创建所有接口定义
- [x] 实现CoreLLMService主类
- [x] 创建TransitionLLMService过渡服务
- [x] 编写基础单元测试

### Phase 2: 管理器实现 (进行中)
- [ ] 实现ConfigManager
- [ ] 实现ModelManager  
- [ ] 实现StreamProcessor
- [ ] 实现ToolIntegrator
- [ ] 实现PromptBuilder

### Phase 3: 双系统验证
- [ ] 集成测试验证
- [ ] 性能对比测试
- [ ] 功能对等验证
- [ ] 修复差异问题

### Phase 4: 无缝切换
- [ ] 修改主进程使用新服务
- [ ] 监控运行状态
- [ ] 逐步清理旧代码

## 🧪 测试策略

### 单元测试
- 每个管理器独立测试
- CoreLLMService协调逻辑测试
- Mock所有依赖，专注业务逻辑

### 集成测试  
- 端到端流程测试
- 真实AI调用测试
- 工具集成测试

### 对比测试
- 新旧服务结果对比
- 性能表现对比
- 错误处理对比

## 📁 文件结构

```
src/main/services/llm/
├── CoreLLMService.ts                    # 主服务类
├── CoreLLMServiceFactory.ts             # 工厂类
├── TransitionLLMService.ts              # 过渡服务
├── LLMService.ts                        # 原有服务(deprecated)
├── README.md                            # 说明文档
├── managers/                            # 管理器模块
│   ├── IConfigManager.ts               # 配置管理接口
│   ├── ConfigManager.ts                # 配置管理实现
│   ├── IModelManager.ts                # 模型管理接口
│   ├── ModelManager.ts                 # 模型管理实现
│   ├── IStreamProcessor.ts             # 流式处理接口
│   ├── StreamProcessor.ts              # 流式处理实现
│   ├── IToolIntegrator.ts              # 工具集成接口
│   ├── ToolIntegrator.ts               # 工具集成实现
│   ├── IPromptBuilder.ts               # 提示词构建接口
│   └── PromptBuilder.ts                # 提示词构建实现
└── tests/                              # 测试文件
    ├── CoreLLMService.test.ts
    ├── ConfigManager.test.ts
    └── ...
```

## ⚙️ 配置选项

### 开发环境配置
```typescript
// 启用调试模式
const service = CoreLLMServiceFactory.create()
const response = await service.streamMessage(request, configId, {
  debug: true,
  timeout: 30000
})
```

### 过渡期配置
```typescript
const transitionService = new TransitionLLMService()

// 获取当前状态
const status = transitionService.getStatus()
console.log('使用新服务:', status.useNewService)
console.log('性能统计:', status.stats)

// 控制切换
transitionService.enableNewService()   // 启用新服务
transitionService.disableNewService()  // 回退到旧服务
transitionService.enableComparison()   // 启用对比验证
```

## 🛡️ 错误处理

### 自动回退机制
新服务出错时会自动回退到旧服务，确保功能稳定性：

```typescript
// TransitionLLMService内部处理
try {
  return await this.newService.streamMessage(...)
} catch (error) {
  log.error('新服务失败，自动回退到旧服务', error)
  return await this.oldService.streamMessage(...)
}
```

### 错误类型
- **配置错误**: 配置不存在或格式错误
- **模型错误**: 模型创建或调用失败  
- **网络错误**: API调用超时或连接失败
- **工具错误**: MCP工具调用异常

## 📊 性能监控

### 内置统计
- 调用次数统计
- 平均响应时间
- 错误率统计
- 缓存命中率

### 监控接口
```typescript
const status = service.getStatus()
console.log('模型缓存大小:', status.modelCacheSize)
console.log('工具使用统计:', status.toolStats)

const transitionStatus = transitionService.getStatus()
console.log('新服务调用次数:', transitionStatus.stats.newServiceCalls)
console.log('新服务错误次数:', transitionStatus.stats.newServiceErrors)
```

## 🔗 相关资源

- **GitHub Issue**: [#18 重构：创建CoreLLMService统一底层LLM服务](https://github.com/Deepractice/DeeChat/issues/18)
- **设计文档**: 本README文档
- **API文档**: 各个接口文件中的TypeScript类型定义

## 🤝 贡献指南

1. **开发新管理器**: 实现对应的接口，确保单一职责
2. **编写测试**: 每个功能都需要对应的单元测试
3. **保持兼容**: 确保新实现与旧服务功能对等
4. **文档更新**: 重要变更需要更新文档

## ⚠️ 注意事项

1. **渐进迁移**: 不要一次性删除所有旧代码
2. **充分测试**: 每个阶段都要有完整的测试验证
3. **监控运行**: 部署后密切监控服务运行状态
4. **回退准备**: 确保任何时候都能快速回退到稳定版本