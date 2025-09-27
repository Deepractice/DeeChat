@echo off
echo 🚀 启动DeeChat开发环境 (Windows)
echo =====================================

REM 检查当前目录
if not exist "package.json" (
    echo ❌ 请在DeeChat/app目录下运行此脚本
    pause
    exit /b 1
)

REM 检查 nvm-windows
where nvm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未找到nvm，请先安装 nvm-windows
    echo 下载地址: https://github.com/coreybutler/nvm-windows
    pause
    exit /b 1
)

REM 切换到正确的Node.js版本
echo 🔄 切换到Node.js 20.19.5...
nvm use 20.19.5
if %errorlevel% neq 0 (
    echo 📥 安装Node.js 20.19.5...
    nvm install 20.19.5
    nvm use 20.19.5
)

REM 验证版本
echo ✅ 当前Node.js版本:
node -v

REM 检查原生模块
echo 🔍 验证原生模块...
node -e "require('better-sqlite3')" >nul 2>nul
if %errorlevel% neq 0 (
    echo 🔨 重新编译原生模块...
    call .\scripts\rebuild-native.bat
    if %errorlevel% neq 0 (
        echo ❌ 原生模块编译失败，请检查Visual Studio Build Tools
        pause
        exit /b 1
    )
)

echo ✅ 原生模块验证通过

REM 启动前端服务器（后台）
echo 🎨 启动前端开发服务器...
cd renderer
start /min cmd /c "npm run dev"
cd ..

REM 等待前端服务器启动
echo ⏳ 等待前端服务器启动...
timeout /t 5 /nobreak >nul

REM 检查前端服务器
curl -s http://localhost:5175 >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 前端服务器启动失败
    pause
    exit /b 1
)

echo ✅ 前端服务器已启动: http://localhost:5175

REM 启动Electron应用
echo ⚡ 启动Electron应用...
echo =====================================
npm start

echo 🧹 DeeChat已关闭
pause