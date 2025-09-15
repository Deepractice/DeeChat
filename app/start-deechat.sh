#!/bin/bash

# DeeChat 应用一键启动脚本
# 使用方法: ./start-deechat.sh

echo "🚀 启动DeeChat开发环境..."
echo "=================================="

# 检查当前目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在DeeChat/app目录下运行此脚本"
    exit 1
fi

# 检查并加载nvm
if [ ! -f "$HOME/.nvm/nvm.sh" ]; then
    echo "❌ 未找到nvm，请先安装nvm"
    exit 1
fi

source ~/.nvm/nvm.sh

# 切换到正确的Node.js版本
echo "🔄 切换到Node.js 20.19.5..."
nvm use 20.19.5

if [ $? -ne 0 ]; then
    echo "📥 安装Node.js 20.19.5..."
    nvm install 20.19.5
    nvm use 20.19.5
fi

# 验证版本
NODE_VERSION=$(node -v)
echo "✅ 当前Node.js版本: $NODE_VERSION"

# 检查原生模块
echo "🔍 验证原生模块..."
if ! node -e "require('better-sqlite3')" 2>/dev/null; then
    echo "🔨 重新编译原生模块..."
    ./scripts/rebuild-native.sh
    if [ $? -ne 0 ]; then
        echo "❌ 原生模块编译失败，请检查错误信息"
        exit 1
    fi
fi

echo "✅ 原生模块验证通过"

# 启动前端服务器（后台）
echo "🎨 启动前端开发服务器..."
cd renderer
npm run dev > /tmp/deechat-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# 等待前端服务器启动
echo "⏳ 等待前端服务器启动..."
sleep 5

# 检查前端服务器是否正常启动
if ! curl -s http://localhost:5175 > /dev/null; then
    echo "❌ 前端服务器启动失败，检查日志："
    tail /tmp/deechat-frontend.log
    kill $FRONTEND_PID 2>/dev/null
    exit 1
fi

echo "✅ 前端服务器已启动: http://localhost:5175"

# 启动Electron应用
echo "⚡ 启动Electron应用..."
echo "=================================="
npm start

# 清理后台进程
echo "🧹 清理后台进程..."
kill $FRONTEND_PID 2>/dev/null
echo "✅ DeeChat已关闭"