@echo off
echo 🔧 DeeChat Native Module Rebuild Script (Windows)
echo =============================================

REM 获取当前目录
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."

echo 📁 Working directory: %PROJECT_DIR%
cd /d "%PROJECT_DIR%"

REM 检查 nvm-windows
where nvm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ nvm-windows not found
    echo 下载地址: https://github.com/coreybutler/nvm-windows
    pause
    exit /b 1
)

REM 检测Electron版本
for /f "tokens=*" %%i in ('node -p "require('./package.json').devDependencies.electron.replace('^', '')"') do set ELECTRON_VERSION=%%i
echo 🔍 Detected Electron version: %ELECTRON_VERSION%

REM Electron 30.x 对应 Node.js 20.x
set "NODE_VERSION=20"
echo 🎯 Target Node.js version: %NODE_VERSION%

REM 切换Node.js版本
echo 🔄 Switching to Node.js %NODE_VERSION%...
nvm use %NODE_VERSION%
if %errorlevel% neq 0 (
    echo 📥 Installing Node.js %NODE_VERSION%...
    nvm install %NODE_VERSION%
    nvm use %NODE_VERSION%
)

REM 显示当前版本
echo 📋 Current versions:
echo    Node.js:
node -v
echo    npm:
npm -v

REM 检查Visual Studio Build Tools
echo 🔍 Checking Windows build tools...
npm config get msvs_version >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  Setting Visual Studio version...
    npm config set msvs_version 2019
)

REM 清理现有的原生模块
echo 🧹 Cleaning existing native modules...
if exist "node_modules\better-sqlite3\build" rmdir /s /q "node_modules\better-sqlite3\build"

REM 安装依赖并重新编译
echo 📦 Installing dependencies with correct Node.js version...
npm install
if %errorlevel% neq 0 (
    echo ❌ npm install failed
    pause
    exit /b 1
)

REM 使用 electron-rebuild 重新编译
echo 🔨 Rebuilding native modules for Electron...
npx @electron/rebuild
if %errorlevel% neq 0 (
    echo ❌ Electron rebuild failed
    echo 💡 请确保已安装 Visual Studio Build Tools
    echo 💡 下载地址: https://visualstudio.microsoft.com/visual-cpp-build-tools/
    pause
    exit /b 1
)

REM 验证编译结果
if exist "node_modules\better-sqlite3\build\Release\better_sqlite3.node" (
    echo ✅ better-sqlite3 successfully built
) else if exist "..\node_modules\better-sqlite3\build\Release\better_sqlite3.node" (
    echo ✅ better-sqlite3 successfully built at workspace level
) else (
    echo ❌ better-sqlite3 build failed
    pause
    exit /b 1
)

REM 检查 NODE_MODULE_VERSION
for /f "tokens=*" %%i in ('node -e "console.log(process.versions.modules)"') do set MODULE_VERSION=%%i
echo 📊 Current NODE_MODULE_VERSION: %MODULE_VERSION%

REM 测试模块加载
echo 🧪 Testing module loading...
node -e "require('better-sqlite3')" >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ better-sqlite3 module loads successfully
) else (
    echo ❌ better-sqlite3 module failed to load
    pause
    exit /b 1
)

echo.
echo 🎉 Native module rebuild completed successfully!
echo 💡 You can now run: npm start
echo =======================================