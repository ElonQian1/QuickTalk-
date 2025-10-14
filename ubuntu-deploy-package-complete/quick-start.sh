#!/bin/bash

# ELonTalk 快速启动脚本
# 功能：一键启动 HTTPS 服务

echo "🚀 启动 ELonTalk 客服系统..."

# 创建必要目录
mkdir -p logs

# 检查是否有执行权限
if [[ ! -x "start-https.sh" ]]; then
    echo "设置执行权限..."
    chmod +x start-https.sh
    chmod +x customer-service-backend
    chmod +x fix-https.sh
fi

# 执行完整启动脚本
exec ./start-https.sh