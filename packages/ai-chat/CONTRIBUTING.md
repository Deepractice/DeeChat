# 贡献指南

感谢你对 @ai-chat/core 项目的关注和贡献！

## 🚀 快速开始

### 开发环境
- Node.js >= 16.0.0
- TypeScript >= 5.0.0
- Git

### 设置本地开发环境

1. **Fork 并克隆项目**
```bash
git clone https://github.com/your-username/DeeChat.git
cd DeeChat/packages/ai-chat
```

2. **安装依赖**
```bash
npm install
```

3. **运行测试**
```bash
npm test
```

## 📋 贡献流程

### 1. 开始贡献前
- 查看 [Issues](https://github.com/DeeChat/issues) 了解需要帮助的地方
- 阅读 [开发指南](./docs/development.md) 了解编码规范
- 查看 [架构设计](./docs/architecture.md) 理解项目结构

### 2. 代码贡献流程
1. **创建分支**: `git checkout -b feature/your-feature-name`
2. **编写代码**: 遵循编码规范，添加必要的测试
3. **运行测试**: 确保所有测试通过
4. **提交代码**: 遵循提交规范
5. **创建 PR**: 提供清晰的 PR 描述

### 3. 提交信息规范
使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**类型说明**:
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式化
- `refactor`: 重构代码
- `test`: 测试相关
- `chore`: 构建工具等

**示例**:
```bash
feat(openai): add GPT-4 support
fix(streaming): resolve memory leak issue
docs(api): update sendMessage documentation
```

## 🧪 测试要求

### 必须包含测试的情况
- 新增功能
- 修复bug
- 重构代码

### 测试标准
- 单元测试覆盖率 ≥ 90%
- 所有测试必须通过
- 关键路径100%覆盖

### 运行测试
```bash
npm test                 # 运行所有测试
npm run test:watch       # 监听模式
npm run test:coverage    # 查看覆盖率
```

## 📝 文档贡献

### 文档类型
- **用户文档**: README.md, 使用示例
- **开发文档**: development.md, architecture.md
- **API文档**: API_DESIGN.md, JSDoc 注释

### 文档更新原则
- 新功能必须更新相关文档
- API 变更必须更新 API 文档
- 重要变更必须更新 CHANGELOG.md

## 🎯 贡献建议

### 适合新手的任务
- 文档改进和错字修复
- 添加测试用例
- 代码注释补充
- 示例代码编写

### 需要经验的任务  
- 新功能开发
- 性能优化
- 架构重构
- 复杂bug修复

## 🔍 代码审查

### 审查要点
- [ ] 代码符合编码规范
- [ ] 测试覆盖充分
- [ ] 文档同步更新
- [ ] 性能影响评估
- [ ] 向后兼容性
- [ ] 安全性检查

### 审查流程
1. 自动化检查(CI/CD)
2. 代码审查(人工)
3. 测试验证
4. 文档检查
5. 合并到主分支

## 🚨 报告问题

### Bug 报告
使用 [Bug 报告模板](https://github.com/DeeChat/issues/new?template=bug_report.md):
- 详细描述问题
- 提供复现步骤  
- 包含环境信息
- 附上错误日志

### 功能请求
使用 [功能请求模板](https://github.com/DeeChat/issues/new?template=feature_request.md):
- 描述功能需求
- 说明使用场景
- 考虑替代方案
- 评估实现复杂度

## 💬 社区交流

- **GitHub Discussions**: 讨论功能和想法
- **Issues**: 报告bug和功能请求
- **PR Reviews**: 代码审查和讨论

## 📜 行为准则

我们致力于营造一个开放、友好的社区环境：

- **尊重他人**: 尊重不同的观点和经验
- **建设性沟通**: 提供有帮助的反馈
- **协作精神**: 共同改进项目
- **学习态度**: 欢迎提问和学习

## 🏆 贡献者认可

我们感谢所有贡献者的付出：
- 所有贡献者将在 README 中获得认可
- 重要贡献者将获得项目维护者权限
- 优秀贡献将在发布说明中特别提及

---

再次感谢你对 @ai-chat/core 项目的贡献！🎉