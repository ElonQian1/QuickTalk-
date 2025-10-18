#!/bin/bash
# ELonTalk 客服系统 - 生产环境快速启动脚本
# 部署路径: /root/ubuntu-deploy-ready/

set -e

echo "=========================================="
echo "  ELonTalk 客服系统 - 生产环境启动"
echo "=========================================="

# 确保在正确的目录
cd /root/ubuntu-deploy-ready

# 设置权限
echo "🔧 设置执行权限..."
chmod +x customer-service-backend

# 复制生产环境配置
echo "🔐 加载生产环境配置..."
if [ -f .env.production ]; then
    cp .env.production .env
    echo "✅ 生产环境配置已加载"
else
    echo "⚠️  警告: .env.production 文件不存在"
fi

# 检查证书目录
if [ ! -d "certs" ]; then
    echo "📁 创建证书目录..."
    mkdir -p certs
fi

# 检查数据库
if [ ! -f customer_service.db ]; then
    echo "💾 数据库文件不存在，程序将自动创建和迁移"
fi

# 显示配置信息
echo ""
echo "=========================================="
echo "  配置信息"
echo "=========================================="
echo "📍 域名: elontalk.duckdns.org"
echo "🔒 HTTPS端口: 8443"
echo "📧 管理员邮箱: siwmm@163.com"
echo "🏢 工作目录: $(pwd)"
echo "=========================================="
echo ""

# 询问启动方式
echo "请选择启动方式:"
echo "  1) 前台运行 (可查看日志，Ctrl+C停止)"
echo "  2) 后台运行 (nohup方式)"
echo "  3) systemd服务 (推荐生产环境)"
read -p "请输入选项 [1-3]: " choice

case $choice in
    1)
        echo "🚀 前台启动服务..."
        echo ""
        ./customer-service-backend
        ;;
    2)
        echo "🚀 后台启动服务..."
        nohup ./customer-service-backend > customer-service.log 2>&1 &
        echo "✅ 服务已在后台启动"
        echo "📊 查看日志: tail -f customer-service.log"
        echo "🛑 停止服务: pkill -f customer-service-backend"
        ;;
    3)
        echo "🚀 使用 systemd 启动服务..."
        if [ -f customer-service.service ]; then
            cp customer-service.service /etc/systemd/system/
            systemctl daemon-reload
            systemctl enable customer-service.service
            systemctl restart customer-service.service
            sleep 2
            systemctl status customer-service.service --no-pager
            echo ""
            echo "✅ systemd 服务已启动"
            echo "📊 查看日志: journalctl -u customer-service.service -f"
        else
            echo "❌ customer-service.service 文件不存在"
            exit 1
        fi
        ;;
    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "  访问地址"
echo "=========================================="
echo "🌐 HTTPS: https://elontalk.duckdns.org:8443"
echo "🌐 HTTP:  http://43.139.82.12:8080"
echo "=========================================="
