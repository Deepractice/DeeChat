# DeeChat Native Modules 版本兼容性解决方案

## 问题背景

DeeChat 使用 Electron v38.1.0，它内置了 Node.js v22.x (NODE_MODULE_VERSION 139)。但是 better-sqlite3 等 native modules 可能是用其他版本的 Node.js 编译的，导致运行时版本不匹配错误：

```
Error: The module was compiled against a different Node.js version using NODE_MODULE_VERSION X. This version of Node.js requires NODE_MODULE_VERSION Y
```

## 解决方案

我们采用**方案1：统一版本 + 自动化脚本**的解决方案：

### 1. 自动化脚本

#### `scripts/rebuild-native.sh` - Native 模块重建脚本
- **功能**：使用正确的 Node.js 版本重新编译所有 native modules
- **使用**：`npm run rebuild`
- **过程**：
  1. 自动检测并加载 nvm
  2. 安装/切换到 Node.js v22 (匹配 Electron 38.x)
  3. 清理现有的 native modules
  4. 重新安装依赖
  5. 使用 @electron/rebuild 重建模块
  6. 验证 better-sqlite3 是否正确编译

#### `scripts/run-app.sh` - 应用运行脚本
- **功能**：确保使用正确的环境运行应用
- **使用**：
  - `npm start` → 启动应用
  - `npm run dev` → 开发模式
  - `npm run build` → 构建应用
  - `npm run dist` → 创建发布包
- **过程**：
  1. 检查 Node.js 版本是否正确
  2. 验证 native modules 是否存在且可用
  3. 根据需要构建 TypeScript
  4. 运行相应的命令

### 2. 更新的 npm scripts

```json
{
  "scripts": {
    "rebuild": "./scripts/rebuild-native.sh",
    "start": "./scripts/run-app.sh start",
    "dev": "./scripts/run-app.sh dev",
    "build": "./scripts/run-app.sh build",
    "dist": "./scripts/run-app.sh dist",

    // 保留原始命令作为备份
    "electron:start": "NODE_ENV=development electron .",
    "electron:dev": "concurrently \"npm run dev:main\" \"npm run dev:renderer\" \"wait-on http://localhost:5175 && npm run electron:start\""
  }
}
```

## 使用流程

### 初次设置或遇到版本问题时

```bash
# 1. 重建 native modules（确保版本兼容）
npm run rebuild

# 2. 启动应用
npm start
```

### 日常开发

```bash
# 开发模式（包含热重载）
npm run dev

# 或者直接启动
npm start
```

### 构建发布

```bash
# 构建应用
npm run build

# 创建发布包
npm run dist
```

## 版本兼容性表

| Electron版本 | 内置Node.js版本 | NODE_MODULE_VERSION | 使用的Node版本 |
|-------------|----------------|---------------------|---------------|
| 38.1.0      | 22.x.x         | 139                | 22            |
| 37.x.x      | 21.x.x         | 135                | 21            |
| 36.x.x      | 20.x.x         | 127                | 20            |

## 故障排除

### 如果仍然遇到版本问题

1. **完全清理并重建**：
   ```bash
   rm -rf node_modules
   npm install
   npm run rebuild
   ```

2. **检查 Node.js 版本**：
   ```bash
   # 检查当前系统 Node 版本
   node --version

   # 检查 Electron 内置版本
   npx electron --version
   ```

3. **手动验证 better-sqlite3**：
   ```bash
   node -e "console.log('better-sqlite3 loads:', !!require('better-sqlite3'))"
   ```

### 常见问题

**Q: 脚本执行权限错误**
```bash
chmod +x scripts/*.sh
```

**Q: nvm 未找到**
```bash
# macOS/Linux
source ~/.nvm/nvm.sh

# 或者检查 nvm 安装路径
which nvm
```

**Q: 构建失败**
```bash
# 检查是否缺少构建工具
xcode-select --install  # macOS
# 或
npm install -g node-gyp
```

## 技术细节

### 依赖注入架构

我们使用依赖注入模式来解耦 native modules：

```typescript
// 主应用中
import { BetterSQLite3Adapter } from '@deepracticex/database-adapter';

const adapter = new BetterSQLite3Adapter(dbPath);
const storage = new ConversationStorage({ database: adapter });
```

这样即使 better-sqlite3 版本有问题，错误会在适配器层被捕获，不会影响整个应用。

### 自动化原理

- **@electron/rebuild**：专门为 Electron 重建 native modules 的工具
- **NODE_MODULE_VERSION 检查**：确保编译的模块与运行时版本匹配
- **版本探测**：自动从 package.json 读取 Electron 版本并选择对应的 Node.js 版本

这个方案确保了：
✅ 版本完全匹配
✅ 开发流程简化
✅ 自动化程度高
✅ 错误处理完善