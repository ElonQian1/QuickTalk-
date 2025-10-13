#!/bin/bash

# ==============================================
# ELonTalk 系统服务安装脚本 v2.0
# ==============================================

echo "⚙️ ELonTalk 系统服务安装工具"
echo "=============================================="
echo "⏰ 安装时间: $(date '+%Y-%m-%d %H:%M:%S')"

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 此脚本需要root权限运行"
    echo "💡 请使用: sudo ./install-service.sh"
    exit 1
fi

# 获取当前脚本所在目录的绝对路径
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="elontalk-customer-service"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

echo "📁 部署目录: $DEPLOY_DIR"
echo "🔧 服务名称: $SERVICE_NAME"

# 检查systemd是否可用
if ! command -v systemctl >/dev/null 2>&1; then
    echo "❌ 系统不支持systemd"
    echo "💡 此脚本仅适用于使用systemd的Linux发行版"
    exit 1
fi

echo ""
echo "🔍 环境检查..."

# 检查必要文件
if [ ! -f "$DEPLOY_DIR/customer-service-backend" ]; then
    echo "❌ 找不到可执行文件: $DEPLOY_DIR/customer-service-backend"
    exit 1
fi
echo "✅ 可执行文件存在"

if [ ! -f "$DEPLOY_DIR/.env" ]; then
    if [ -f "$DEPLOY_DIR/.env.example" ]; then
        echo "📋 复制示例配置文件..."
        cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env"
        echo "✅ 配置文件已创建"
    else
        echo "❌ 找不到配置文件: $DEPLOY_DIR/.env"
        exit 1
    fi
fi
echo "✅ 配置文件存在"

# 获取运行用户
DEPLOY_USER=$(stat -c '%U' "$DEPLOY_DIR" 2>/dev/null)
if [ -z "$DEPLOY_USER" ] || [ "$DEPLOY_USER" = "root" ]; then
    # 尝试获取实际用户
    if [ -n "$SUDO_USER" ]; then
        DEPLOY_USER="$SUDO_USER"
    else
        echo "⚠️  无法确定运行用户，请手动指定:"
        read -p "请输入运行服务的用户名: " DEPLOY_USER
        if [ -z "$DEPLOY_USER" ]; then
            echo "❌ 用户名不能为空"
            exit 1
        fi
    fi
fi

echo "👤 运行用户: $DEPLOY_USER"

# 验证用户是否存在
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
    echo "❌ 用户 $DEPLOY_USER 不存在"
    exit 1
fi

# 设置文件权限
echo ""
echo "🔐 设置文件权限..."
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_DIR"
chmod +x "$DEPLOY_DIR/customer-service-backend"
chmod +x "$DEPLOY_DIR"/*.sh 2>/dev/null || true

# 确保数据库文件权限
if [ -f "$DEPLOY_DIR/customer_service.db" ]; then
    chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_DIR/customer_service.db"
    chmod 664 "$DEPLOY_DIR/customer_service.db"
fi

# 确保日志目录权限
mkdir -p "$DEPLOY_DIR/logs"
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_DIR/logs"
chmod 755 "$DEPLOY_DIR/logs"

echo "✅ 权限设置完成"

# 读取配置获取端口信息
source "$DEPLOY_DIR/.env" 2>/dev/null || true
HTTP_PORT=${SERVER_PORT:-8080}
HTTPS_PORT=${TLS_PORT:-8443}

echo ""
echo "⚙️  创建systemd服务配置..."

# 创建systemd服务文件
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=ELonTalk Customer Service System
Documentation=https://github.com/ElonQian1/QuickTalk-
After=network.target network-online.target
Wants=network-online.target
StartLimitIntervalSec=500
StartLimitBurst=5

[Service]
Type=simple
User=$DEPLOY_USER
Group=$DEPLOY_USER
WorkingDirectory=$DEPLOY_DIR

# 环境变量
Environment=RUST_LOG=info
Environment=DATABASE_URL=sqlite:customer_service.db
EnvironmentFile=-$DEPLOY_DIR/.env

# 执行命令
ExecStart=$DEPLOY_DIR/customer-service-backend
ExecReload=/bin/kill -HUP \$MAINPID

# 重启策略
Restart=always
RestartSec=10
KillMode=mixed
KillSignal=SIGTERM
TimeoutStartSec=60
TimeoutStopSec=30

# 输出重定向
StandardOutput=append:$DEPLOY_DIR/logs/service.log
StandardError=append:$DEPLOY_DIR/logs/service.error.log
SyslogIdentifier=elontalk-service

# 资源限制
LimitNOFILE=65536
LimitNPROC=4096
LimitCORE=0

# 安全设置
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DEPLOY_DIR
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
RestrictNamespaces=true
LockPersonality=true
MemoryDenyWriteExecute=true
RestrictRealtime=true
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
EOF

echo "✅ 服务配置文件已创建"

# 创建日志轮转配置
echo "📋 配置日志轮转..."
logrotate_file="/etc/logrotate.d/elontalk-service"
cat > "$logrotate_file" << EOF
$DEPLOY_DIR/logs/*.log {
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
    create 644 $DEPLOY_USER $DEPLOY_USER
    postrotate
        systemctl reload $SERVICE_NAME 2>/dev/null || true
    endscript
}
EOF
echo "✅ 日志轮转配置完成"

# 重新加载systemd配置
echo ""
echo "🔄 重新加载systemd配置..."
systemctl daemon-reload

# 启用服务
echo "✅ 启用服务自启动..."
systemctl enable "$SERVICE_NAME"

# 检查防火墙配置
echo ""
echo "🔥 检查防火墙配置..."
firewall_configured=false

# 检查ufw
if command -v ufw >/dev/null 2>&1 && ufw status >/dev/null 2>&1; then
    ufw_status=$(ufw status 2>/dev/null | head -n1)
    echo "📋 UFW状态: $ufw_status"
    
    if echo "$ufw_status" | grep -q "Status: active"; then
        echo "🔧 配置UFW规则..."
        ufw allow "$HTTP_PORT/tcp" comment "ELonTalk HTTP" >/dev/null 2>&1 || true
        ufw allow "$HTTPS_PORT/tcp" comment "ELonTalk HTTPS" >/dev/null 2>&1 || true
        firewall_configured=true
    fi
fi

# 检查firewalld
if command -v firewall-cmd >/dev/null 2>&1; then
    if systemctl is-active --quiet firewalld; then
        echo "📋 Firewalld 活动中"
        echo "🔧 配置Firewalld规则..."
        firewall-cmd --permanent --add-port="$HTTP_PORT/tcp" >/dev/null 2>&1 || true
        firewall-cmd --permanent --add-port="$HTTPS_PORT/tcp" >/dev/null 2>&1 || true
        firewall-cmd --reload >/dev/null 2>&1 || true
        firewall_configured=true
    fi
fi

# 检查iptables
if [ "$firewall_configured" = false ] && command -v iptables >/dev/null 2>&1; then
    echo "📋 配置iptables规则..."
    iptables -C INPUT -p tcp --dport "$HTTP_PORT" -j ACCEPT >/dev/null 2>&1 || \
        iptables -A INPUT -p tcp --dport "$HTTP_PORT" -j ACCEPT
    iptables -C INPUT -p tcp --dport "$HTTPS_PORT" -j ACCEPT >/dev/null 2>&1 || \
        iptables -A INPUT -p tcp --dport "$HTTPS_PORT" -j ACCEPT
    
    # 尝试保存规则
    if command -v iptables-save >/dev/null 2>&1; then
        iptables-save > /etc/iptables/rules.v4 2>/dev/null || \
        iptables-save > /etc/iptables.rules 2>/dev/null || true
    fi
    firewall_configured=true
fi

if [ "$firewall_configured" = true ]; then
    echo "✅ 防火墙规则配置完成"
else
    echo "⚠️  未检测到防火墙或配置失败"
    echo "💡 请手动开放端口 $HTTP_PORT 和 $HTTPS_PORT"
fi

echo ""
echo "🎉 系统服务安装完成！"
echo "=============================================="
echo "📊 服务信息:"
echo "   服务名称: $SERVICE_NAME"
echo "   配置文件: $SERVICE_FILE"
echo "   工作目录: $DEPLOY_DIR"
echo "   运行用户: $DEPLOY_USER"
echo "   HTTP端口: $HTTP_PORT"
echo "   HTTPS端口: $HTTPS_PORT"

echo ""
echo "📋 日志配置:"
echo "   服务日志: $DEPLOY_DIR/logs/service.log"
echo "   错误日志: $DEPLOY_DIR/logs/service.error.log"
echo "   轮转配置: $logrotate_file"

echo ""
echo "🚀 服务管理命令:"
echo "   启动服务: systemctl start $SERVICE_NAME"
echo "   停止服务: systemctl stop $SERVICE_NAME"
echo "   重启服务: systemctl restart $SERVICE_NAME"
echo "   查看状态: systemctl status $SERVICE_NAME"
echo "   查看日志: journalctl -u $SERVICE_NAME -f"

echo ""
echo "🔧 其他有用命令:"
echo "   禁用自启: systemctl disable $SERVICE_NAME"
echo "   查看配置: systemctl cat $SERVICE_NAME"
echo "   重载配置: systemctl daemon-reload && systemctl restart $SERVICE_NAME"
echo "   实时日志: tail -f $DEPLOY_DIR/logs/service.log"

# 询问是否立即启动
echo ""
read -p "现在启动服务? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo "🚀 启动服务..."
    systemctl start "$SERVICE_NAME"
    
    sleep 5
    
    # 检查服务状态
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo "✅ 服务启动成功！"
        
        # 显示服务状态
        echo ""
        echo "📊 服务状态:"
        systemctl status "$SERVICE_NAME" --no-pager -l | head -n 20
        
        # 显示访问地址
        server_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")
        echo ""
        echo "🌐 访问地址:"
        echo "   HTTP:  http://$server_ip:$HTTP_PORT"
        
        # 检查HTTPS证书
        if [ -f "$DEPLOY_DIR/certs/server.crt" ] && [ -f "$DEPLOY_DIR/certs/server.key" ]; then
            echo "   HTTPS: https://$server_ip:$HTTPS_PORT"
        else
            echo "   HTTPS: 未配置证书"
            echo "💡 运行以下命令配置SSL证书:"
            echo "     自签名: ./generate-cert.sh"
            echo "     Let's Encrypt: sudo ./setup-ssl.sh"
        fi
        
        echo ""
        echo "📋 服务管理:"
        echo "   查看日志: journalctl -u $SERVICE_NAME -f"
        echo "   重启服务: systemctl restart $SERVICE_NAME"
        
    else
        echo "❌ 服务启动失败"
        echo ""
        echo "📋 错误诊断:"
        systemctl status "$SERVICE_NAME" --no-pager -l
        echo ""
        echo "📋 查看详细日志:"
        echo "   journalctl -u $SERVICE_NAME --no-pager -l -n 50"
        exit 1
    fi
else
    echo "⏸️  服务已安装但未启动"
    echo "💡 使用以下命令手动启动: systemctl start $SERVICE_NAME"
fi

echo ""
echo "🎉 安装完成！ELonTalk 现在作为系统服务运行"