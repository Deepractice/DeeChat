#!/bin/bash
# DeeChat Native Module Rebuild Script
# 用于确保 native modules (主要是 better-sqlite3) 与 Electron 版本兼容

set -e  # 遇到错误立即退出

echo "🔧 DeeChat Native Module Rebuild Script"
echo "======================================="

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

# 获取当前 Electron 版本对应的 Node.js 版本
ELECTRON_VERSION=$(node -pe "require('./package.json').devDependencies.electron.replace('^', '')")
echo "🔍 Detected Electron version: $ELECTRON_VERSION"

# Electron 30.x 使用 Node.js 20.x
NODE_VERSION="20"

echo "🎯 Target Node.js version: $NODE_VERSION"

# 检查并安装 Node.js 版本
if ! nvm list | grep -q "v$NODE_VERSION"; then
    echo "📦 Installing Node.js $NODE_VERSION..."
    nvm install "$NODE_VERSION"
fi

# 切换到正确的 Node.js 版本
echo "🔄 Switching to Node.js $NODE_VERSION..."
nvm use "$NODE_VERSION"

# 显示当前版本信息
echo "📋 Current versions:"
echo "   Node.js: $(node --version)"
echo "   npm: $(npm --version)"

# 清理现有的 native modules
echo "🧹 Cleaning existing native modules..."
if [[ -d "node_modules" ]]; then
    # 只删除 native modules，避免重新下载所有依赖
    find node_modules -name "*.node" -type f -delete 2>/dev/null || true
    find node_modules -name "build" -type d -exec rm -rf {} + 2>/dev/null || true
fi

# 重新安装依赖（确保使用正确的 Node.js 版本）
echo "📦 Installing dependencies with correct Node.js version..."
npm install

# 使用 @electron/rebuild 重建 native modules
echo "🔨 Rebuilding native modules for Electron..."
npx @electron/rebuild

# 验证 better-sqlite3 是否正确编译（检查工作空间和本地）
SQLITE3_PATHS=("node_modules/better-sqlite3/build/Release/better_sqlite3.node" "../node_modules/better-sqlite3/build/Release/better_sqlite3.node")
SQLITE3_PATH=""

for path in "${SQLITE3_PATHS[@]}"; do
    if [[ -f "$path" ]]; then
        SQLITE3_PATH="$path"
        break
    fi
done
if [[ -n "$SQLITE3_PATH" ]]; then
    echo "✅ better-sqlite3 successfully built at: $SQLITE3_PATH"

    # 检查模块版本兼容性
    NODE_MODULE_VERSION=$(node -e "console.log(process.versions.modules)")
    echo "📊 Current NODE_MODULE_VERSION: $NODE_MODULE_VERSION"

    # 尝试加载模块进行验证
    if node -e "require('better-sqlite3')" 2>/dev/null; then
        echo "✅ better-sqlite3 module loads successfully"
    else
        echo "⚠️  better-sqlite3 module failed to load, but binary exists"
    fi
else
    echo "❌ better-sqlite3 build failed - binary not found at $SQLITE3_PATH"
    exit 1
fi

echo ""
echo "🎉 Native module rebuild completed successfully!"
echo "💡 You can now run: npm start"
echo "======================================="