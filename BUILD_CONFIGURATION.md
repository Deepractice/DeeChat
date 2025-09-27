# DeeChat 构建配置文档

## 项目架构概览

DeeChat 使用 monorepo 架构，包含以下主要组件：

```
DeeChat/
├── package.json          # 根目录配置，workspace管理
├── app/                  # Electron主应用
│   ├── package.json      # 应用依赖和构建配置
│   ├── package-lock.json # 锁定依赖版本
│   ├── main/            # Electron主进程
│   ├── renderer/        # 渲染进程前端
│   └── assets/          # 应用资源文件
└── .github/workflows/   # CI/CD配置
```

## 核心配置文件

### 1. 根目录 package.json

```json
{
  "name": "deechat",
  "version": "1.0.5",
  "private": true,
  "workspaces": ["app"],
  "scripts": {
    "dev": "cd app && npm run dev",
    "start": "cd app && npm start",
    "build": "cd app && npm run build",
    "clean": "cd app && npm run clean"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/ws": "^8.18.1",
    "electron": "^30.5.1",           // 关键：根目录electron依赖
    "electron-rebuild": "^3.2.9",
    "rimraf": "^5.0.0",
    "typescript": "^5.2.0"
  },
  "dependencies": {
    "@deepracticex/mcp-client": "^1.0.3",
    "better-sqlite3": "^12.2.0"
  }
}
```

#### 关键配置说明
- **workspaces**: 定义子包目录，支持 monorepo 管理
- **electron**: 在根目录安装，确保 electron-vite 能正确解析模块
- **scripts**: 统一的构建入口，代理到 app 目录

### 2. 应用 package.json (app/package.json)

```json
{
  "name": "deechat-app",
  "version": "1.0.5",
  "main": "out/main/index.js",
  "type": "module",
  "scripts": {
    "start": "electron-vite preview",
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "clean": "rimraf dist out",
    "rebuild": "npx @electron/rebuild",
    "dist": "npm run build && electron-builder",
    "dist:mac": "npm run build && electron-builder --mac --publish=never",
    "dist:win": "npm run build && electron-builder --win --publish=never",
    "dist:linux": "npm run build && electron-builder --linux --publish=never"
  },
  "dependencies": {
    "@deepracticex/ai-chat": "^0.5.0",
    "@deepracticex/ai-config": "^0.4.1",
    "@deepracticex/context-manager": "^1.0.1",
    "@deepracticex/conversation-storage": "^0.4.5",
    "@deepracticex/database-adapter": "^2.0.1",
    "@deepracticex/mcp-client": "^1.0.8",
    "@deepracticex/token-calculator": "^0.2.1",
    "@promptx/core": "^1.20.0",
    "better-sqlite3": "^12.2.0",
    "lucide-react": "^0.544.0",
    "reflect-metadata": "^0.2.2",
    "typedi": "^0.10.0"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.7.2",
    "@types/node": "^20.0.0",
    "electron": "^30.5.1",
    "electron-builder": "^26.0.12",
    "electron-vite": "^4.0.0",
    "typescript": "^5.2.0"
  }
}
```

#### 关键配置说明
- **type: "module"**: 启用 ES 模块支持
- **main**: Electron 入口文件路径
- **rebuild**: 使用 @electron/rebuild 重建原生模块
- **electron-builder**: 跨平台打包工具

## Electron Builder 配置

### 核心构建配置

```json
{
  "build": {
    "appId": "com.deechat.app",
    "productName": "DeeChat",
    "electronVersion": "30.5.1",
    "nodeGypRebuild": false,
    "buildDependenciesFromSource": false,
    "directories": {
      "output": "release",
      "buildResources": "assets"
    },
    "compression": "maximum",
    "files": [
      "out/**/*",
      "node_modules/**/*",
      "!node_modules/.cache",
      "!node_modules/@types",
      "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}",
      "!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}",
      "!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vs,.nyc_output}"
    ]
  }
}
```

### 平台特定配置

#### macOS
```json
{
  "mac": {
    "target": [
      {"target": "dmg", "arch": ["x64", "arm64"]},
      {"target": "zip", "arch": ["x64", "arm64"]}
    ],
    "icon": "assets/icon.icns",
    "category": "public.app-category.productivity",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "assets/entitlements.mac.plist",
    "entitlementsInherit": "assets/entitlements.mac.plist",
    "notarize": false,
    "minimumSystemVersion": "10.15.0"
  }
}
```

#### Windows
```json
{
  "win": {
    "target": [
      {"target": "nsis", "arch": ["x64", "ia32"]},
      {"target": "portable", "arch": ["x64", "ia32"]}
    ],
    "icon": "assets/icon-512.png",
    "verifyUpdateCodeSignature": false
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "DeeChat"
  }
}
```

#### Linux
```json
{
  "linux": {
    "target": [
      {"target": "AppImage", "arch": ["x64"]},
      {"target": "deb", "arch": ["x64"]},
      {"target": "rpm", "arch": ["x64"]}
    ],
    "icon": "assets/icon-512.png",
    "category": "Office",
    "maintainer": "DeeChat Team <team@deechat.ai>"
  }
}
```

## CI/CD 配置 (GitHub Actions)

### 构建工作流 (.github/workflows/build.yml)

```yaml
name: 🚀 DeeChat Build & Release

on:
  push:
    branches: [main, develop]
    tags: ['v*']
  pull_request:
    branches: [main]

jobs:
  build-macos:
    name: Build macOS
    runs-on: macos-latest
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4

      - name: 🟢 Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: |
            package-lock.json
            app/package-lock.json
            app/renderer/package-lock.json

      - name: 📦 Install all dependencies
        run: |
          npm ci --prefer-offline
          cd app && npm ci --prefer-offline
          cd renderer && npm ci --prefer-offline

      - name: 🔧 Rebuild native modules
        run: |
          cd app
          npm run rebuild

      - name: 🏗️ Build application
        run: npm run build

      - name: 📱 Build macOS app
        run: |
          cd app
          npx electron-builder --mac --x64 --arm64 --publish=never
```

### 关键配置要点

#### 依赖管理
- **缓存策略**: 使用多层级 package-lock.json 缓存
- **安装顺序**: 根目录 → app → renderer
- **确定性安装**: 使用 `npm ci` 而不是 `npm install`

#### 原生模块处理
- **重建时机**: 依赖安装后，构建前
- **重建工具**: @electron/rebuild
- **目标平台**: 当前构建平台的 Electron 版本

#### 构建流程
1. 检出代码
2. 配置 Node.js 环境
3. 安装依赖（带缓存）
4. 重建原生模块
5. 构建应用
6. 打包分发文件

## 资源文件配置

### 图标文件
```
assets/
├── icon.icns          # macOS 图标 (多尺寸)
├── icon-512.png       # Windows/Linux 图标 (512×512)
├── icon.ico           # Windows 备用图标
├── icon.png           # 通用 PNG 图标
└── DeeChat.iconset/   # macOS 图标源文件
```

### 权限配置 (macOS)
```xml
<!-- assets/entitlements.mac.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
</dict>
</plist>
```

## 依赖管理策略

### 核心依赖
- **Electron**: 30.5.1 (跨平台桌面应用框架)
- **electron-vite**: ^4.0.0 (构建工具)
- **electron-builder**: ^26.0.12 (打包工具)
- **better-sqlite3**: ^12.2.0 (数据库)

### 业务依赖
- **@promptx/core**: ^1.20.0 (AI 核心库)
- **@deepracticex/***: 自研业务模块
- **lucide-react**: ^0.544.0 (图标库)
- **typedi**: ^0.10.0 (依赖注入)

### 开发依赖
- **TypeScript**: ^5.2.0 (类型系统)
- **@electron/rebuild**: ^3.7.2 (原生模块重建)
- **@types/node**: ^20.0.0 (Node.js 类型定义)

## 环境要求

### 开发环境
- **Node.js**: >=18.0.0
- **npm**: >=6.0.0
- **操作系统**: macOS, Windows, Linux

### 构建环境 (GitHub Actions)
- **macOS**: macos-latest (支持 Apple Silicon)
- **Windows**: windows-latest (支持 x64/ia32)
- **Linux**: ubuntu-latest (支持 x64)

## 最佳实践

### 1. 依赖管理
- 保持 package-lock.json 与 package.json 同步
- 使用 workspace 管理 monorepo
- 在根目录安装关键依赖以确保模块解析

### 2. 构建优化
- 使用 npm 缓存加速 CI 构建
- 分离构建和打包步骤
- 启用压缩减小分发包大小

### 3. 跨平台兼容
- 使用统一的图标格式 (PNG)
- 配置平台特定的安装包格式
- 测试所有目标平台

### 4. 代码签名 (生产环境)
- macOS: 配置开发者证书和公证
- Windows: 配置代码签名证书
- 使用环境变量管理敏感信息

---

*配置版本: v1.0.5*
*最后更新: 2025-09-27*
*维护团队: DeeChat Team*