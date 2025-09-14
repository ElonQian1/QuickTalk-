#!/bin/bash

# QuickTalk客服系统 - Linux生产环境启动脚本

echo "🚀 启动QuickTalk客服系统（生产模式）..."

# 设置生产环境变量
export NODE_ENV=production

# 检查Node.js版本
NODE_VERSION=$(node --version)
echo "Node.js版本: $NODE_VERSION"

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖包..."
    npm install --production
fi

# 启动服务器
echo "✅ 启动服务器..."
npm start