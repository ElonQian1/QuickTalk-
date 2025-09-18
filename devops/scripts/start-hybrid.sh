#!/bin/bash

echo "🚀 启动 QuickTalk 混合架构系统..."

# 检查Rust是否安装
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust/Cargo 未安装。请先安装Rust: https://rustup.rs/"
    exit 1
fi

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装。请先安装Node.js"
    exit 1
fi

echo "📦 安装Node.js依赖..."
npm install

echo "🦀 构建Rust服务器..."
cd rust-server
cargo build --release
cd ..

echo "🔧 创建必要目录..."
mkdir -p data logs uploads temp

echo "✅ 启动系统服务..."
echo "🦀 Rust主服务器将在端口3030启动"
echo "📱 Node.js微服务将在端口3031启动"
echo ""
echo "访问地址:"
echo "  主页: http://localhost:3030/"
echo "  管理后台: http://localhost:3030/admin"
echo "  API状态: http://localhost:3030/api/health"
echo "  WebSocket: ws://localhost:3030/ws"
echo ""

# 启动混合架构
npm run start:hybrid