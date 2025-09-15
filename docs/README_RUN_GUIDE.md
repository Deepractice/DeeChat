# DeeChat 运行指南

## 🚀 一键启动（推荐）

```bash
cd /Users/macmima1234/Desktop/DeeChat/app
./start-deechat.sh
```

## 📋 手动启动

### 环境要求

- **Node.js**: 20.19.5 (必须精确版本)
- **Electron**: 30.5.1
- **nvm**: 用于Node版本管理

### 启动步骤

```bash
# 1. 进入项目目录
cd /Users/macmima1234/Desktop/DeeChat/app

# 2. 切换Node版本
source ~/.nvm/nvm.sh
nvm use 20.19.5

# 3. Terminal 1: 启动前端服务器
cd renderer
npm run dev
# 等待看到: "Local: http://localhost:5175/"

# 4. Terminal 2: 启动Electron应用
cd /Users/macmima1234/Desktop/DeeChat/app
npm start
```

## 🔧 故障排除

### 问题1: NODE_MODULE_VERSION 错误

```bash
# 症状: better-sqlite3 模块加载失败
# 解决方案:
nvm use 20.19.5
./scripts/rebuild-native.sh
```

### 问题2: 前端连接失败

```bash
# 症状: ERR_CONNECTION_REFUSED
# 解决方案: 确保前端服务器在运行
cd renderer && npm run dev
```

### 问题3: 数据库初始化失败

```bash
# 症状: Database adapter is required
# 解决方案: 重新编译原生模块
npx @electron/rebuild
```

## ✅ 启动成功标志

**前端服务器输出:**
```
VITE v7.1.5  ready in 283 ms
➜  Local:   http://localhost:5175/
```

**Electron应用输出:**
```
✅ AI配置领域初始化完成
✅ ConversationDomain 初始化完成
🔗 已连接到Vite开发服务器: http://localhost:5175
✅ 主窗口创建完成
```

## 📁 重要文件

- `start-deechat.sh` - 一键启动脚本
- `scripts/rebuild-native.sh` - 原生模块重编译脚本
- `scripts/run-app.sh` - 应用运行脚本
- `DEECHAT_VERSION_COMPATIBILITY_FIX.md` - 版本兼容性修复文档

## 💡 开发提示

- 必须使用 Node.js 20.19.5
- 每次 Node 版本变更后都要重新编译 better-sqlite3
- 前端和后端必须同时运行
- 使用 `nvm` 管理 Node 版本