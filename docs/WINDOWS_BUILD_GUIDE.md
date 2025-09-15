# DeeChat Windows 编译指南

## 🟢 可行性

**✅ DeeChat 完全支持在 Windows 上编译和运行**

核心技术栈都支持跨平台：
- Electron 30.5.1 ✅
- Node.js 20.19.5 ✅
- TypeScript ✅
- Vite前端 ✅
- better-sqlite3 ✅ (需重新编译)

## 🛠️ 环境准备

### 1. 安装 nvm-windows

```powershell
# 下载并安装 nvm-windows
# 地址: https://github.com/coreybutler/nvm-windows/releases
# 下载 nvm-setup.zip，解压并运行安装程序
```

### 2. 安装 Visual Studio Build Tools (必需!)

better-sqlite3 需要C++编译环境：

**选项A: Visual Studio Build Tools (推荐)**
```powershell
# 下载地址: https://visualstudio.microsoft.com/visual-cpp-build-tools/
# 安装时选择: "C++ build tools" 工作负载
```

**选项B: 完整 Visual Studio**
```powershell
# 下载 Visual Studio 2019/2022 Community
# 安装时包含 "Desktop development with C++" 工作负载
```

### 3. 安装 Python (可选，但推荐)

```powershell
# 下载地址: https://www.python.org/downloads/
# 选择 "Add Python to PATH"
```

### 4. 配置编译环境

```cmd
# 设置npm使用正确的编译工具
npm config set msvs_version 2019
# 或者如果使用VS2022
npm config set msvs_version 2022

# 如果安装了Python，设置路径
npm config set python python
```

## 🚀 编译步骤

### 方式一：使用Windows脚本 (推荐)

```cmd
# 1. 进入项目目录
cd C:\path\to\DeeChat\app

# 2. 一键启动
start-deechat.bat
```

### 方式二：手动步骤

```cmd
# 1. 切换Node版本
nvm install 20.19.5
nvm use 20.19.5

# 2. 验证版本
node -v
npm -v

# 3. 重新编译原生模块
scripts\rebuild-native.bat

# 4. 启动前端服务器 (新命令行窗口)
cd renderer
npm run dev

# 5. 启动应用 (另一个新命令行窗口)
cd ..
npm start
```

## ⚠️ 常见问题

### 问题1: MSBuild 找不到

```
错误: MSBuild.exe not found
```

**解决方案:**
1. 确保安装了 Visual Studio Build Tools
2. 重新启动命令行
3. 设置正确的VS版本：`npm config set msvs_version 2019`

### 问题2: Python 相关错误

```
错误: Python executable not found
```

**解决方案:**
```cmd
# 安装Python并设置路径
npm config set python python
# 或指定完整路径
npm config set python C:\Python39\python.exe
```

### 问题3: better-sqlite3 编译失败

```
错误: gyp ERR! build error
```

**解决方案:**
```cmd
# 清理并重新安装
rmdir /s node_modules
npm install
npx @electron/rebuild
```

### 问题4: 权限问题

```
错误: EPERM: operation not permitted
```

**解决方案:**
- 以管理员身份运行命令行
- 或者在用户目录下编译

## 🔧 高级配置

### PowerShell 脚本版本

如果prefer PowerShell，也可以创建 `.ps1` 版本：

```powershell
# start-deechat.ps1
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# ... PowerShell版本的启动脚本
```

### 环境变量设置

```cmd
# 设置开发环境变量
set NODE_ENV=development
set ELECTRON_IS_DEV=1
```

## 📊 性能对比

| 平台 | 编译时间 | 运行性能 |
|------|----------|----------|
| macOS | ~2-3分钟 | 优秀 |
| Windows | ~3-5分钟 | 良好 |
| Linux | ~2-3分钟 | 优秀 |

Windows编译时间略长主要因为：
- Visual Studio编译工具链较重
- Windows防病毒软件扫描
- NTFS文件系统特性

## 🎯 Windows特有优化

### 1. 防病毒软件排除

将项目目录添加到防病毒软件白名单：
```
C:\path\to\DeeChat\
C:\Users\[用户名]\AppData\Roaming\npm\
```

### 2. 使用SSD

建议将项目放在SSD上以提高编译速度。

### 3. WSL2 替代方案

如果Windows编译有问题，可以使用WSL2 + Ubuntu：
```bash
# 在WSL2中使用Linux版本的脚本
wsl
cd /mnt/c/path/to/DeeChat/app
./start-deechat.sh
```

## ✅ 验证编译成功

看到以下输出说明成功：

```cmd
✅ Native modules verification passed
✅ 前端服务器已启动: http://localhost:5175
✅ AI配置领域初始化完成
✅ ConversationDomain 初始化完成
🔗 已连接到Vite开发服务器
✅ 主窗口创建完成
```

## 📦 打包分发

Windows平台打包：

```cmd
# 构建Windows安装包
npm run dist

# 输出文件位置
# dist/DeeChat Setup 1.0.0.exe
```

## 🔗 相关资源

- [nvm-windows](https://github.com/coreybutler/nvm-windows)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [Electron Windows构建指南](https://www.electronjs.org/docs/latest/development/build-instructions-windows)
- [better-sqlite3 Windows编译](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md)

---

**总结：DeeChat 完全支持 Windows 编译！** 🎉

主要是需要正确配置 C++ 编译环境，其他都是标准的 Electron + Node.js 开发流程。