#!/bin/bash
# DeeChat Application Runtime Script
# 确保使用正确的 Node.js 版本运行应用

set -e  # 遇到错误立即退出

echo "🚀 DeeChat Application Runtime"
echo "============================="

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "📁 Working directory: $PROJECT_DIR"
cd "$PROJECT_DIR"

# 检查 nvm 是否可用
if ! command -v nvm &> /dev/null; then
    echo "⚠️  nvm not found, trying to load from common locations..."

    # 尝试加载 nvm
    if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
        echo "📥 Loading nvm from ~/.nvm/nvm.sh"
        source "$HOME/.nvm/nvm.sh"
    elif [[ -s "/opt/homebrew/opt/nvm/nvm.sh" ]]; then
        echo "📥 Loading nvm from /opt/homebrew/opt/nvm/nvm.sh"
        source "/opt/homebrew/opt/nvm/nvm.sh"
    else
        echo "❌ nvm not found. Please install nvm first."
        exit 1
    fi
fi

# 获取目标 Node.js 版本（与 Electron 30.x 匹配的 Node.js 20.x）
NODE_VERSION="20"

echo "🎯 Target Node.js version: $NODE_VERSION"

# 检查 Node.js 版本是否已安装
if ! nvm list | grep -q "v$NODE_VERSION"; then
    echo "❌ Node.js $NODE_VERSION is not installed."
    echo "💡 Please run the rebuild script first: npm run rebuild"
    exit 1
fi

# 切换到正确的 Node.js 版本
echo "🔄 Switching to Node.js $NODE_VERSION..."
nvm use "$NODE_VERSION"

# 显示当前版本信息
echo "📋 Current versions:"
echo "   Node.js: $(node --version)"
echo "   npm: $(npm --version)"

# 检查 better-sqlite3 是否存在且可用（检查工作空间和本地）
SQLITE3_PATHS=("node_modules/better-sqlite3/build/Release/better_sqlite3.node" "../node_modules/better-sqlite3/build/Release/better_sqlite3.node")
SQLITE3_PATH=""

for path in "${SQLITE3_PATHS[@]}"; do
    if [[ -f "$path" ]]; then
        SQLITE3_PATH="$path"
        break
    fi
done

if [[ -z "$SQLITE3_PATH" ]]; then
    echo "⚠️  better-sqlite3 native module not found in expected locations:"
    for path in "${SQLITE3_PATHS[@]}"; do
        echo "   - $path"
    done
    echo "💡 Please run the rebuild script first: npm run rebuild"
    exit 1
fi

# 验证模块是否可以加载
echo "🔍 Verifying native modules..."
if ! node -e "require('better-sqlite3')" 2>/dev/null; then
    echo "❌ better-sqlite3 module failed to load."
    echo "💡 Please run the rebuild script: npm run rebuild"
    exit 1
fi

echo "✅ Native modules verification passed"

# 检查是否需要构建 TypeScript
if [[ ! -d "dist" ]] || [[ "main/main.ts" -nt "dist/main.js" ]]; then
    echo "🔨 Building TypeScript files..."
    npm run build:main
fi

echo "📊 Environment check:"
echo "   NODE_MODULE_VERSION: $(node -e "console.log(process.versions.modules)")"
echo "   Architecture: $(node -e "console.log(process.arch)")"
echo "   Platform: $(node -e "console.log(process.platform)")"

# 根据传入参数决定运行模式
case "${1:-start}" in
    "dev")
        echo "🔧 Starting in development mode..."
        export NODE_ENV=development
        npm run electron:dev
        ;;
    "start")
        echo "🎬 Starting application..."
        export NODE_ENV=development
        npx electron .
        ;;
    "build")
        echo "📦 Building application..."
        npm run build
        ;;
    "dist")
        echo "📦 Building distribution..."
        npm run dist
        ;;
    *)
        echo "❓ Unknown command: $1"
        echo "Usage: $0 [dev|start|build|dist]"
        echo "   dev   - Start in development mode"
        echo "   start - Start the application (default)"
        echo "   build - Build the application"
        echo "   dist  - Create distribution package"
        exit 1
        ;;
esac