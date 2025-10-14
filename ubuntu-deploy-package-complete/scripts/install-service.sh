#!/bin/bash

# ELonTalk 系统服务安装脚本
# 功能：将应用程序安装为 systemd 服务

SERVICE_NAME="elontalk"
INSTALL_DIR="/opt/elontalk"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
CURRENT_DIR=$(pwd)

echo "📦 安装 ELonTalk 为系统服务..."

# 检查权限
if [[ $EUID -ne 0 ]]; then
    echo "❌ 此脚本需要 root 权限运行"
    echo "请使用: sudo ./scripts/install-service.sh"
    exit 1
fi

# 停止现有服务
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "停止现有服务..."
    systemctl stop "$SERVICE_NAME"
fi

# 创建安装目录
echo "创建安装目录: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# 复制文件
echo "复制应用程序文件..."
cp -r "$CURRENT_DIR"/* "$INSTALL_DIR/"

# 设置权限
chown -R root:root "$INSTALL_DIR"
chmod +x "$INSTALL_DIR/customer-service-backend"
chmod +x "$INSTALL_DIR"/*.sh
chmod +x "$INSTALL_DIR/scripts"/*.sh
chmod 600 "$INSTALL_DIR/.env"

# 创建服务文件
echo "创建 systemd 服务文件..."
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=ELonTalk Customer Service System
Documentation=https://github.com/ElonQian1/QuickTalk
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/customer-service-backend
ExecStop=/bin/kill -TERM \$MAINPID
Restart=always
RestartSec=10
StandardOutput=append:$INSTALL_DIR/logs/service.log
StandardError=append:$INSTALL_DIR/logs/service-error.log

# 环境变量
Environment=RUST_LOG=info
Environment=RUST_BACKTRACE=1
EnvironmentFile=$INSTALL_DIR/.env

# 安全设置
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR

# 网络设置
IPAddressAllow=any
IPAddressDeny=

[Install]
WantedBy=multi-user.target
EOF

# 重载 systemd
echo "重载 systemd 配置..."
systemctl daemon-reload

# 启用服务
echo "启用服务..."
systemctl enable "$SERVICE_NAME"

# 启动服务
echo "启动服务..."
if systemctl start "$SERVICE_NAME"; then
    echo "✅ 服务安装并启动成功"
else
    echo "❌ 服务启动失败"
    exit 1
fi

# 显示状态
sleep 3
echo
echo "📊 服务状态："
systemctl status "$SERVICE_NAME" --no-pager -l

echo
echo "🎉 安装完成！"
echo
echo "服务管理命令："
echo "  启动服务: systemctl start $SERVICE_NAME"
echo "  停止服务: systemctl stop $SERVICE_NAME"
echo "  重启服务: systemctl restart $SERVICE_NAME"
echo "  查看状态: systemctl status $SERVICE_NAME"
echo "  查看日志: journalctl -u $SERVICE_NAME -f"
echo
echo "服务文件位置:"
echo "  安装目录: $INSTALL_DIR"
echo "  服务配置: $SERVICE_FILE"
echo "  日志目录: $INSTALL_DIR/logs/"
echo
echo "🌐 访问地址："
echo "  HTTP:  http://$(hostname -I | awk '{print $1}'):8080"
echo "  HTTPS: https://$(hostname -I | awk '{print $1}'):8443"