# DeeChat 项目结构指引

## 📁 项目架构概览

DeeChat 采用现代化的模块化架构，基于 Node.js 包 + Electron 应用的设计理念。

```
DeeChat/
├── 🎯 app/              # Electron 主应用
├── 📦 packages/         # 可复用的 Node.js 包
├── 🔧 scripts/          # 所有项目脚本
├── ⚙️  config/           # 应用配置
├── 📚 docs/             # 项目文档
├── 🧪 tests/            # 测试文件
├── 🛠️  tools/            # 开发工具
├── 🎨 resources/        # 静态资源
├── 💾 backup-legacy/    # 遗留代码备份
└── 📋 项目文件          # package.json, README.md 等
```

## 🎯 核心目录详解

### `app/` - Electron 应用层
**职责**: Electron 主应用，负责 UI 和系统集成
```
app/
├── main/        # 主进程代码
├── renderer/    # 渲染进程代码
└── shared/      # 共享代码
```

### `packages/` - 业务包层
**职责**: 可复用的 Node.js 包，核心业务逻辑
```
packages/
├── conversation/     # 对话引擎
├── ai-models/       # AI 模型适配
├── tool-system/     # 工具系统
├── file-handler/    # 文件处理
└── config-manager/  # 配置管理
```

### `scripts/` - 脚本工具层
**职责**: 所有项目相关的可执行脚本
```
scripts/
├── build/           # 构建脚本
├── database/        # 数据库脚本
├── release/         # 发布脚本
├── docker/          # Docker 脚本
├── environments/    # 环境配置
├── dev/            # 开发脚本
└── setup/          # 安装脚本
```

## 🤖 AI 开发指引

### 📋 开发任务分类

| 任务类型 | 主要目录 | 说明 |
|---------|----------|------|
| **UI 功能开发** | `app/` | Electron 界面、用户交互 |
| **业务逻辑开发** | `packages/` | 核心功能、可复用组件 |
| **构建部署** | `scripts/` | 打包、发布、环境配置 |
| **系统配置** | `config/` | 应用设置、环境变量 |
| **测试编写** | `tests/` | 单元测试、集成测试 |
| **工具开发** | `tools/` | 开发辅助工具 |

### 🎨 代码修改原则

1. **优先修改 packages/**
   - 业务逻辑优先放在 packages 中
   - 保持包的独立性和可复用性

2. **app/ 仅负责集成**
   - UI 展示和用户交互
   - 调用 packages 中的业务逻辑

3. **scripts/ 负责自动化**
   - 构建、部署、维护脚本
   - 不包含业务逻辑

### 🔍 文件查找策略

**寻找业务逻辑**: 
```bash
# 在 packages/ 中搜索
packages/conversation/    # 对话相关
packages/ai-models/      # AI 模型相关
packages/tool-system/    # 工具系统相关
```

**寻找 UI 代码**:
```bash
# 在 app/ 中搜索
app/renderer/           # 前端 UI
app/main/              # 主进程逻辑
```

**寻找配置文件**:
```bash
config/                # 应用配置
tools/dev-configs/     # 开发工具配置
```

### 🚀 常见开发场景

#### 场景1: 添加新的 AI 模型支持
- **主要目录**: `packages/ai-models/`
- **次要目录**: `app/renderer/` (UI 配置)
- **配置文件**: `config/ai-providers.json`

#### 场景2: 优化对话功能
- **主要目录**: `packages/conversation/`
- **测试目录**: `tests/conversation/`
- **UI 集成**: `app/renderer/components/chat/`

#### 场景3: 添加新工具
- **主要目录**: `packages/tool-system/`
- **配置目录**: `config/tools/`
- **测试目录**: `tests/tools/`

#### 场景4: 构建部署问题
- **主要目录**: `scripts/build/`, `scripts/release/`
- **配置目录**: `scripts/environments/`

### 💡 开发最佳实践

1. **模块化优先**: 新功能优先考虑是否可以做成独立的 package
2. **配置外置**: 硬编码配置移到 `config/` 目录
3. **测试驱动**: 在 `tests/` 中编写对应测试
4. **脚本自动化**: 重复操作写成 `scripts/` 中的脚本
5. **文档同步**: 重要修改同步更新 `docs/` 中的文档

### 🔧 工具链说明

- **开发配置**: `tools/dev-configs/` (Claude, Cursor, VSCode 等)
- **构建工具**: `scripts/build/` (Webpack, TypeScript 等)
- **测试框架**: `tests/` (Jest 配置)
- **代码质量**: `.eslintrc.js`, `tsconfig.json`

### 📦 Package 设计原则

每个 package 应该:
- **单一职责**: 专注一个核心功能
- **可独立使用**: 可以在其他项目中复用
- **最小依赖**: 减少外部依赖
- **完整测试**: 包含完整的测试覆盖

## 🎯 快速定位指南

| 想要... | 去这里 |
|--------|--------|
| 修改 UI | `app/renderer/` |
| 修改业务逻辑 | `packages/*/` |
| 修改配置 | `config/` |
| 查看文档 | `docs/` |
| 运行脚本 | `scripts/` |
| 查看测试 | `tests/` |
| 使用工具 | `tools/` |
| 查看资源 | `resources/` |

---

**💡 记住**: DeeChat 的核心思想是"业务逻辑包化，应用层集成"。优先在 packages 中实现功能，然后在 app 中集成使用。