#!/bin/bash
# Ubuntu生产服务器快速部署脚本
# 用途: 从GitHub拉取最新代码并重新编译部署

set -e  # 遇到错误立即退出

echo "================================"
echo "🚀 开始部署最新代码"
echo "================================"

# 1. 进入项目目录
cd /root/ubuntu-deploy-ready || exit 1
echo "✅ 当前目录: $(pwd)"

# 2. 显示当前版本
echo ""
echo "📌 当前Git版本:"
git log -1 --oneline

# 3. 拉取最新代码
echo ""
echo "⬇️  拉取最新代码..."
git fetch origin
git pull origin main

# 4. 显示更新后的版本
echo ""
echo "📌 更新后Git版本:"
git log -1 --oneline

# 5. 编译后端
echo ""
echo "🔨 开始编译Rust后端..."
cd backend
cargo build --release

# 6. 停止服务
echo ""
echo "⏸️  停止customer-service服务..."
systemctl stop customer-service || echo "⚠️  服务未运行"

# 7. 备份当前可执行文件
if [ -f "../customer-service-backend" ]; then
    BACKUP_NAME="customer-service-backend.backup.$(date +%Y%m%d_%H%M%S)"
    echo "💾 备份当前版本: $BACKUP_NAME"
    cp ../customer-service-backend "../$BACKUP_NAME"
fi

# 8. 替换可执行文件
echo ""
echo "📦 安装新版本..."
cp target/release/customer-service-backend ../
chmod +x ../customer-service-backend

# 9. 重启服务
echo ""
echo "▶️  启动customer-service服务..."
systemctl start customer-service

# 10. 等待服务启动
sleep 2

# 11. 检查服务状态
echo ""
echo "📊 服务状态:"
systemctl status customer-service --no-pager -l

# 12. 显示最近的日志
echo ""
echo "📋 最近的日志（最后20行）:"
journalctl -u customer-service -n 20 --no-pager

echo ""
echo "================================"
echo "✅ 部署完成！"
echo "================================"
echo ""
echo "💡 实时查看日志:"
echo "   journalctl -u customer-service -f"
echo ""
echo "💡 测试API:"
echo "   curl -k https://43.139.82.12:8443/api/shops/1/customers -H 'Authorization: Bearer YOUR_TOKEN'"
echo ""
