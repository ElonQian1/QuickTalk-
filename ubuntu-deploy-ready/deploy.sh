#!/bin/bash

# ELonTalk 客服系统 - Ubuntu 全自动部署脚本
# 支持: Ubuntu 24.04 LTS, Sea-ORM 自动数据库迁移, HTTPS强制模式
# 部署路径: /root/ubuntu-deploy-ready/

set -e

echo "🚀 ELonTalk 客服系统 - 全自动部署"
echo "=================================="
echo "📅 部署时间: $(date)"
echo "🖥️  目标系统: Ubuntu 24.04 LTS"
echo "🔒 模式: HTTPS 强制"
echo "📂 部署路径: /root/ubuntu-deploy-ready/"
echo ""

# 检查权限
if [[ $EUID -ne 0 ]]; then
   echo "❌ 错误: 请以root用户运行此脚本"
   echo "请使用: sudo bash deploy.sh"
   exit 1
fi

# 检查系统
if ! grep -q "Ubuntu" /etc/os-release; then
    echo "⚠️  警告: 未检测到 Ubuntu 系统，继续部署可能存在兼容性问题"
    read -p "是否继续? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 更新系统
echo "📦 更新系统包..."
apt update && apt upgrade -y

# 安装必要工具
echo "🔧 安装必要工具..."
apt install -y curl wget ufw net-tools

# 设置工作目录
echo "📂 设置工作目录..."
cd /root/ubuntu-deploy-ready

# 检查部署文件
echo "📋 检查部署文件..."
required_files=(
    "customer-service-backend"
    ".env"
    "customer-service.service"
    "start.sh"
    "certs/server.crt"
    "certs/server.key"
    "static/index.html"
)

for file in "${required_files[@]}"; do
    if [[ ! -f "$file" && ! -d "$file" ]]; then
        echo "❌ 错误: 缺少必要文件: $file"
        exit 1
    fi
done

echo "✅ 所有必要文件检查通过"

# 设置权限
echo "🔧 设置文件权限..."
chmod +x customer-service-backend
chmod +x start.sh
chmod 644 .env
chmod 600 certs/server.key
chmod 644 certs/server.crt
chmod -R 755 static/

# 创建数据库文件
echo "📊 准备数据库..."
if [[ ! -f "customer_service.db" ]]; then
    touch customer_service.db
fi
chmod 644 customer_service.db

# 配置防火墙
echo "🔥 配置防火墙..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 8080/tcp  # HTTP
ufw allow 8443/tcp  # HTTPS
ufw --force enable

echo "✅ 防火墙配置完成"

# 配置系统服务
echo "🔧 配置系统服务..."
cp customer-service.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable customer-service

# 停止旧服务
echo "🛑 停止旧服务..."
systemctl stop customer-service 2>/dev/null || true

# 启动服务
echo "🚀 启动服务..."
systemctl start customer-service

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
if systemctl is-active --quiet customer-service; then
    echo ""
    echo "🎉 部署成功！"
    echo "==============="
    echo ""
    echo "📊 服务状态:"
    systemctl status customer-service --no-pager --lines=0
    echo ""
    echo "🌐 访问地址:"
    echo "  HTTP:  http://43.139.82.12:8080 (自动重定向到HTTPS)"
    echo "  HTTPS: https://elontalk.duckdns.org:8443"
    echo "  管理:  https://elontalk.duckdns.org:8443"
    echo ""
    echo "🔧 管理命令:"
    echo "  查看日志: journalctl -u customer-service -f"
    echo "  重启服务: systemctl restart customer-service"
    echo "  停止服务: systemctl stop customer-service"
    echo "  服务状态: systemctl status customer-service"
    echo ""
    echo "📝 配置文件:"
    echo "  环境配置: /root/ubuntu-deploy-ready/.env"
    echo "  服务配置: /etc/systemd/system/customer-service.service"
    echo "  SSL证书: /root/ubuntu-deploy-ready/certs/"
    echo ""
    echo "🔍 测试连接:"
    echo "  curl -k https://elontalk.duckdns.org:8443"
    echo ""
    echo "✅ 部署完成！系统已就绪。"
else
    echo ""
    echo "❌ 服务启动失败！"
    echo "=================="
    echo ""
    echo "🔍 错误信息:"
    journalctl -u customer-service -n 20 --no-pager
    echo ""
    echo "🛠️  排查建议:"
    echo "1. 检查配置文件: cat .env"
    echo "2. 检查权限: ls -la customer-service-backend"
    echo "3. 检查端口: netstat -tlnp | grep ':8443'"
    echo "4. 检查证书: ls -la certs/"
    echo "5. 手动启动: ./customer-service-backend"
    echo ""
    exit 1
fi