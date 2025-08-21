# DeeChat 测试目录

## 📁 目录结构

```
tests/
├── README.md                           # 测试目录说明
├── AI_STATE_MACHINE_TEST_REPORT.md     # AI状态机测试详细报告
├── setup.ts                            # Jest测试环境配置
│
├── shared/                              # 共享模块测试
│   ├── langchain/                       # LangChain相关测试
│   │   ├── LangChainLLMService.test.ts  # LLM服务和AI状态机测试
│   │   ├── LangChainModelFactory.test.ts # 模型工厂测试
│   │   └── ProjectSChatModel.test.ts    # 项目聊天模型测试
│   └── services/                        # (已清理，功能已合并到其他测试)
│
├── integration/                         # 集成测试
│   └── AIStateMachine.integration.test.ts # AI状态机集成测试
│
├── performance/                         # 性能测试
│   └── AIStateMachine.performance.test.ts # AI状态机性能测试
│
├── archive/                             # 已归档的测试文件
│   └── test-unified-provider.js         # 旧的统一提供者测试
│
└── MCP相关测试                          # MCP协议测试
    ├── mcp-unit.test.ts                 # MCP单元测试
    ├── mcp-integration.test.ts          # MCP集成测试
    └── mcp-e2e.test.ts                  # MCP端到端测试
```

## 🧪 测试分类

### AI状态机测试（Issue #14解决方案）
- **单元测试**: `shared/langchain/LangChainLLMService.test.ts`
- **集成测试**: `integration/AIStateMachine.integration.test.ts` 
- **性能测试**: `performance/AIStateMachine.performance.test.ts`
- **测试报告**: `AI_STATE_MACHINE_TEST_REPORT.md`

### MCP协议测试
- **单元测试**: `mcp-unit.test.ts` - 基础功能测试
- **集成测试**: `mcp-integration.test.ts` - 组件交互测试
- **端到端测试**: `mcp-e2e.test.ts` - 完整流程测试

### LangChain生态测试
- **LLM服务**: `shared/langchain/LangChainLLMService.test.ts`
- **模型工厂**: `shared/langchain/LangChainModelFactory.test.ts`
- **聊天模型**: `shared/langchain/ProjectSChatModel.test.ts`

## 🚀 运行测试

### 运行所有AI状态机测试
```bash
npm test -- --testPathPatterns="AIStateMachine|LangChainLLMService"
```

### 运行特定测试类别
```bash
# 单元测试
npm test tests/shared/

# 集成测试
npm test tests/integration/

# 性能测试
npm test tests/performance/

# MCP测试
npm test -- --testPathPatterns="mcp"
```

### 运行所有测试
```bash
npm test
```

## 📊 测试统计

### AI状态机测试 (32个测试)
- ✅ **LangChain LLM服务**: 9个测试
- ✅ **集成测试**: 9个测试 
- ✅ **性能测试**: 14个测试
- ✅ **通过率**: 100%

### 主要测试成就
1. **解决了Issue #14**: AI对话中断问题
2. **100%测试覆盖**: 单元、集成、性能三层测试
3. **性能验证**: 高效处理，无性能瓶颈
4. **稳定性验证**: 并发处理和边界条件测试

## 🛠️ 开发指南

### 添加新测试
1. 选择合适的测试分类（unit/integration/performance）
2. 使用现有的测试文件作为模板
3. 遵循测试命名约定：`*.test.ts`
4. 更新此README文档

### 测试最佳实践
- 使用描述性的测试名称（中文）
- 每个测试专注于单一功能点
- 包含正常流程和边界条件测试
- 性能测试设置合理的基准值

### Mock配置
- 全局Mock配置在 `setup.ts` 中
- electron-log已配置全局Mock
- 避免在单个测试文件中重复Mock

## 📋 已清理的文件

以下文件已在测试清理过程中移除：
- `tests/shared/services/AIStateRouter.test.ts` - 有electron-log Mock问题
- `tests/shared/langchain/LangChainLLMService.simple.test.ts` - 临时测试文件
- `tests/shared/langchain/LangChainLLMService.final.test.ts` - 已重命名为标准文件名
- `test-path-unification.js` - 根目录临时文件

所有功能已整合到最终的测试文件中，无功能丢失。