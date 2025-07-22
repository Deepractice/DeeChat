# PromptX Desktop Client

PromptX生态的桌面客户端，提供AI对话和角色管理能力。

## 技术栈

- **前端**: React + TypeScript + Ant Design
- **桌面**: Electron
- **状态管理**: Redux Toolkit
- **构建工具**: Vite
- **AI集成**: OpenAI API (后续支持Claude、本地模型)

## 项目结构

```
src/
├── main/                 # Electron主进程
│   ├── index.ts         # 主进程入口
│   └── services/        # 后端服务层
├── preload/             # 预加载脚本
├── renderer/            # React渲染进程
│   ├── src/
│   │   ├── components/  # UI组件
│   │   ├── store/       # Redux状态管理
│   │   └── types/       # 类型定义
└── shared/              # 共享代码
    └── types/           # 共享类型定义
```

## 开发指南

### 环境要求

- Node.js >= 18
- npm >= 8

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

这会同时启动Vite开发服务器和Electron应用。

### 构建应用

```bash
# 构建渲染进程和主进程
npm run build

# 构建完整应用包
npm run build:all
```

### 代码规范

```bash
# 检查代码规范
npm run lint

# 自动修复代码规范问题
npm run lint:fix

# TypeScript类型检查
npm run type-check
```

## 功能特性

### MVP功能 (V1.0)
- [x] 基础对话界面
- [x] OpenAI API集成
- [x] 简单配置管理
- [x] 基础历史记录

### 计划功能 (V2.0)
- [ ] 多模型支持 (Claude、本地模型)
- [ ] MCP协议支持
- [ ] PromptX角色集成
- [ ] 高级配置界面

## 配置说明

应用配置存储在用户数据目录的 `config.json` 文件中：

- **Windows**: `%APPDATA%/promptx-desktop-client/config.json`
- **macOS**: `~/Library/Application Support/promptx-desktop-client/config.json`
- **Linux**: `~/.config/promptx-desktop-client/config.json`

## 开发注意事项

1. **安全性**: 所有API调用都在主进程中进行，确保API密钥安全
2. **类型安全**: 使用TypeScript严格模式，确保类型安全
3. **错误处理**: 完善的错误处理和用户反馈
4. **性能**: 使用React.memo和useMemo优化性能

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

MIT License
