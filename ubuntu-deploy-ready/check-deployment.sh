#!/bin/bash

# ==============================================
# 部署目录检测和路径配置脚本
# ==============================================

echo "🔍 检测当前部署路径..."

# 获取当前脚本所在目录 (部署目录)
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "📁 检测到部署目录: $DEPLOY_DIR"

# 检测权限
if [ -w "$DEPLOY_DIR" ]; then
    echo "✅ 目录权限: 可写"
else
    echo "⚠️  目录权限: 只读 (可能影响数据库文件创建)"
fi

# 检测是否为推荐位置
case "$DEPLOY_DIR" in
    /opt/*)
        echo "📍 部署位置: 标准系统目录 (/opt)"
        echo "   优点: 符合Linux标准，适合生产环境"
        ;;
    /home/*)
        echo "📍 部署位置: 用户主目录"
        echo "   优点: 无需sudo权限，简单易管理"
        ;;
    /var/www/*)
        echo "📍 部署位置: Web应用目录"
        echo "   优点: Web服务传统位置"
        ;;
    *)
        echo "📍 部署位置: 自定义目录"
        echo "   注意: 请确保路径在系统服务配置中正确设置"
        ;;
esac

# 检查必要文件
echo ""
echo "🔍 检查必要文件..."
files_ok=true

if [ -f "customer-service-backend" ]; then
    echo "✅ customer-service-backend"
else
    echo "❌ customer-service-backend (缺失)"
    files_ok=false
fi

if [ -f ".env" ]; then
    echo "✅ .env (配置文件)"
elif [ -f ".env.example" ]; then
    echo "📋 .env.example (需要复制为 .env)"
    echo "   运行: cp .env.example .env"
else
    echo "❌ .env 配置文件 (缺失)"
    files_ok=false
fi

if [ -d "static" ]; then
    echo "✅ static/ (前端文件)"
else
    echo "❌ static/ (前端文件缺失)"
    files_ok=false
fi

# 生成系统服务配置
echo ""
echo "🛠️  生成系统服务配置..."

cat > customer-service-auto.service << EOF
[Unit]
Description=ELonTalk Customer Service System (Auto-configured)
After=network.target

[Service]
Type=simple
User=$USER
Group=$(id -gn)
WorkingDirectory=$DEPLOY_DIR
ExecStart=$DEPLOY_DIR/customer-service-backend
EnvironmentFile=$DEPLOY_DIR/.env
Restart=always
RestartSec=5
KillMode=mixed
KillSignal=SIGINT
TimeoutStopSec=30

# 安全配置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$DEPLOY_DIR

[Install]
WantedBy=multi-user.target
EOF

echo "✅ 生成了自动配置的系统服务文件: customer-service-auto.service"
echo ""

# 显示安装命令
echo "🚀 安装系统服务的命令:"
echo "sudo cp customer-service-auto.service /etc/systemd/system/"
echo "sudo systemctl daemon-reload"
echo "sudo systemctl enable customer-service-auto"
echo "sudo systemctl start customer-service-auto"
echo ""

# 总结
if [ "$files_ok" = true ]; then
    echo "✅ 所有文件检查通过，可以开始部署！"
    echo ""
    echo "📝 下一步操作:"
    echo "1. 配置环境: cp .env.example .env && nano .env"
    echo "2. 启动服务: ./start.sh"
    echo "3. 安装系统服务 (可选): 使用上述命令"
else
    echo "❌ 文件检查失败，请检查部署包完整性"
fi