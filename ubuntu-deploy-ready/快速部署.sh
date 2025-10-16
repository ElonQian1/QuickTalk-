#!/bin/bash

# 快速部署脚本 - HTTPS版本
# 部署路径: /root/ubuntu-deploy-ready

set -e

echo "=========================================="
echo "  ELonTalk 客服系统 - 快速部署"
echo "=========================================="

# 1. 设置权限
echo "[1/6] 设置文件权限..."
chmod +x customer-service-backend
chmod +x *.sh
chmod 755 /root/ubuntu-deploy-ready
chmod 644 customer_service.db 2>/dev/null || touch customer_service.db && chmod 644 customer_service.db

# 2. 检查证书
echo "[2/6] 检查SSL证书..."
if [ ! -f "certs/server.crt" ] || [ ! -f "certs/server.key" ]; then
    echo "警告: SSL证书文件不存在，将使用自签名证书"
fi

# 3. 配置防火墙
echo "[3/6] 配置防火墙..."
ufw allow 22/tcp
ufw allow 8080/tcp
ufw allow 8443/tcp
ufw --force enable

# 4. 安装systemd服务
echo "[4/6] 配置systemd服务..."
cat > /etc/systemd/system/customer-service.service << 'EOF'
[Unit]
Description=ELonTalk Customer Service System
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/ubuntu-deploy-ready
Environment="DATABASE_URL=sqlite:customer_service.db"
Environment="RUST_LOG=info"
ExecStart=/root/ubuntu-deploy-ready/customer-service-backend
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 5. 启动服务
echo "[5/6] 启动服务..."
systemctl daemon-reload
systemctl enable customer-service
systemctl restart customer-service

# 6. 等待启动
echo "[6/6] 等待服务启动..."
sleep 3

# 检查状态
echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
systemctl status customer-service --no-pager || true

echo ""
echo "访问地址:"
echo "  HTTP:  http://43.139.82.12:8080"
echo "  HTTPS: https://elontalk.duckdns.org:8443"
echo ""
echo "查看日志: journalctl -u customer-service -f"
echo "重启服务: systemctl restart customer-service"
