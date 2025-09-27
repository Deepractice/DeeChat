# 🤖 DeeChat

<div align="center">

![DeeChat Logo](https://img.shields.io/badge/DeeChat-AI%20Chat%20Application-blue?style=for-the-badge&logo=electron)

**基于DDD架构的高级AI聊天应用程序**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-30.5.1-blue.svg)](https://electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [架构设计](#-架构设计) • [开发指南](#-开发指南) • [部署发布](#-部署发布)

</div>

## 📋 概述

DeeChat 是一款现代化的AI聊天应用程序，采用领域驱动设计(DDD)架构，提供强大的AI对话能力和工具集成功能。支持多种AI模型，具备MCP(Model Context Protocol)工具调用能力，为用户提供智能化的对话体验。

### 🎯 设计理念

- **🏗️ DDD架构**: 采用领域驱动设计，清晰的业务边界和职责分离
- **🔧 工具集成**: 支持MCP协议，可扩展的工具调用系统
- **🎛️ 动态配置**: 实时调节AI参数（温度、Token限制等）
- **💾 对话管理**: 完整的会话历史和上下文管理
- **🚀 高性能**: 流式响应，优化的用户体验

## ✨ 功能特性

### 🤖 AI对话能力
- **多模型支持**: 兼容OpenAI、Claude等主流AI模型
- **流式响应**: 实时流式对话，即时反馈
- **动态参数**: 聊天中可调节温度和Token限制
- **上下文管理**: 智能的对话上下文保持和管理

### 🛠️ 工具系统
- **MCP协议**: 完整支持Model Context Protocol
- **工具调用**: 无限制的工具调用链(可配置)
- **扩展性**: 支持自定义工具和服务器连接
- **实时监控**: 工具执行状态和结果追踪

### 📊 会话管理
- **多会话**: 支持创建和管理多个对话会话
- **历史记录**: 完整的消息历史保存和检索
- **搜索功能**: 快速查找历史对话内容
- **导出功能**: 支持对话内容导出

### ⚙️ 配置管理
- **AI配置**: 灵活的AI服务配置管理
- **MCP服务器**: 可视化的MCP服务器管理
- **用户偏好**: 个性化的用户设置和偏好

## 🚀 快速开始

### 📋 系统要求

- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **操作系统**: macOS 10.15+, Windows 10+, Ubuntu 18.04+

### 📦 安装

```bash
# 克隆项目
git clone https://github.com/Deepractice/DeeChat.git
cd DeeChat

# 安装依赖
npm install

# 安装应用依赖
cd app && npm install
```

### 🏃‍♂️ 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

### 🔧 首次配置

1. **启动应用**: 运行开发模式或安装包
2. **配置AI服务**: 在设置页面添加您的AI API配置
3. **开始对话**: 创建新会话，开始AI对话

## 🏗️ 架构设计

### 📁 项目结构

```
DeeChat/
├── app/                          # Electron应用主体
│   ├── main/                     # 主进程
│   │   ├── domains/              # 业务域(DDD架构)
│   │   │   ├── ai-configuration/ # AI配置域
│   │   │   ├── conversation/     # 对话域
│   │   │   ├── mcp/              # MCP工具域
│   │   │   └── role-management/  # 角色管理域
│   │   ├── infrastructure/       # 基础设施层
│   │   └── ipc/                  # 进程间通信
│   └── renderer/                 # 渲染进程(前端)
│       ├── src/
│       │   ├── components/       # React组件
│       │   ├── contexts/         # React上下文
│       │   └── utils/            # 工具函数
└── packages/                     # 共享包
    ├── ai-chat/                  # AI聊天核心包
    ├── context-manager/          # 上下文管理包
    ├── conversation-storage/     # 对话存储包
    ├── mcp-client/              # MCP客户端包
    └── database-adapter/        # 数据库适配器包
```

### 🏛️ DDD架构层次

```
┌─────────────────────────────────────────────┐
│                用户界面层                      │
│              (React UI)                     │
├─────────────────────────────────────────────┤
│                应用服务层                      │
│           (IPC Adapters)                   │
├─────────────────────────────────────────────┤
│                业务域层                       │
│  ┌─────────────┬─────────────┬─────────────┐ │
│  │ AI配置域    │   对话域    │   MCP域     │ │
│  │ Services    │ Services    │ Services    │ │
│  │ Types       │ Types       │ Types       │ │
│  └─────────────┴─────────────┴─────────────┘ │
├─────────────────────────────────────────────┤
│                基础设施层                      │
│     (Database, HTTP, File System)          │
└─────────────────────────────────────────────┘
```

### 🔄 核心流程

**对话流程**:
```
用户输入 → 会话服务 → AI聊天服务 → 工具调用服务 → MCP服务器 → 响应处理 → 用户界面
```

## 🛠️ 开发指南

### 📂 添加新的业务域

1. **创建域结构**:
```bash
mkdir app/main/domains/your-domain
cd app/main/domains/your-domain
mkdir services adapters types utils
```

2. **实现域服务**:
```typescript
// services/YourDomainService.ts
import { Service } from 'typedi'

@Service()
export class YourDomainService {
  // 业务逻辑实现
}
```

3. **添加IPC适配器**:
```typescript
// adapters/IPCAdapter.ts
export const yourDomainIPCHandlers = {
  'your-domain:action': async (input: any) => {
    // IPC处理逻辑
  }
}
```

### 🔧 添加新的MCP工具

1. **配置MCP服务器**: 在MCP配置页面添加服务器
2. **工具自动发现**: 系统自动发现并注册工具
3. **调用测试**: 在对话中测试工具调用

### 🎨 前端组件开发

```typescript
// 使用TypeScript + React + Ant Design
import React from 'react'
import { Button, Card } from 'antd'

export const YourComponent: React.FC = () => {
  return (
    <Card title="Your Feature">
      <Button type="primary">Action</Button>
    </Card>
  )
}
```

### 🧪 测试

```bash
# 运行测试(待实现)
npm test

# 类型检查
npm run build
```

## 📦 部署发布

### 🖥️ 桌面应用打包

```bash
# 构建所有平台
npm run dist:all

# 单平台构建
npm run dist:mac    # macOS
npm run dist:win    # Windows
npm run dist:linux  # Linux
```

### 📱 支持平台

- **macOS**: DMG + ZIP (Intel & Apple Silicon)
- **Windows**: NSIS安装包 + 便携版 (x64 & x86)
- **Linux**: AppImage + DEB + RPM (x64)

## 🤝 贡献指南

我们欢迎社区贡献！请遵循以下步骤：

1. **Fork项目** 并创建特性分支
2. **遵循代码规范** 和架构设计
3. **添加测试** 覆盖新功能
4. **提交PR** 并描述变更内容

### 📋 代码规范

- **TypeScript**: 严格类型检查
- **ESLint**: 代码风格检查
- **Prettier**: 代码格式化
- **DDD原则**: 遵循领域驱动设计

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

## 👥 团队

- **DeeChat Team** - 项目维护和开发
- **Email**: team@deechat.ai
- **GitHub**: [@Deepractice](https://github.com/Deepractice)

## 🔗 相关链接

- [项目主页](https://github.com/Deepractice/DeeChat)
- [问题反馈](https://github.com/Deepractice/DeeChat/issues)
- [功能请求](https://github.com/Deepractice/DeeChat/discussions)
- [更新日志](CHANGELOG.md)

## 📚 技术栈

- **前端**: React + TypeScript + Ant Design
- **后端**: Electron + Node.js + TypeScript
- **架构**: DDD + 依赖注入(TypeDI)
- **数据库**: SQLite + Better-SQLite3
- **工具协议**: MCP (Model Context Protocol)
- **构建**: Electron-Vite + Electron-Builder

---

<div align="center">

**🌟 如果这个项目对您有帮助，请给我们一个Star！**

Made with ❤️ by DeeChat Team

</div>