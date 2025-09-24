#!/bin/bash

# QuickTalk 纯Rust架构部署脚本
# 专为仅支持Rust的服务器环境设计
# 2025-09-24: 已废弃旧路径 data/database.sqlite，统一使用 backend/quicktalk.sqlite (源码内) 或 /opt/quicktalk/data/quicktalk.sqlite (部署时)

set -e

echo "🦀 QuickTalk 纯Rust架构部署脚本"
echo "=================================="

# 配置
DOMAIN=${1:-"localhost"}
PORT=${2:-"3030"}
INSTALL_DIR="/opt/quicktalk"
SERVICE_USER="quicktalk"

echo "📋 部署配置："
echo "  架构: 纯Rust (无Node.js/Nginx依赖)"
echo "  域名: $DOMAIN"
echo "  端口: $PORT"
echo "  安装目录: $INSTALL_DIR"
echo "  主数据库: $INSTALL_DIR/data/quicktalk.sqlite"
echo ""

# 检查Rust环境
check_rust() {
    echo "🔍 检查Rust环境..."
    
    if ! command -v cargo &> /dev/null; then
        echo "❌ Rust未安装，正在安装..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source ~/.cargo/env
        echo "✅ Rust安装完成"
    else
        echo "✅ Rust已安装: $(rustc --version)"
    fi
    
    # 检查SQLite支持（Rust通过静态链接提供）
    echo "✅ SQLite支持: 通过Rust静态链接"
}

# 创建系统环境
setup_system() {
    echo "🔧 设置系统环境..."
    
    # 创建应用用户
    if ! id "$SERVICE_USER" &>/dev/null; then
        sudo useradd -r -s /bin/false $SERVICE_USER
        echo "✅ 创建用户 $SERVICE_USER"
    fi
    
    # 创建应用目录结构
    sudo mkdir -p $INSTALL_DIR/{bin,data,uploads,logs,static,backups}
    # 兼容旧目录结构: 如果发现 data/database.sqlite 则迁移重命名为 quicktalk.sqlite
    if [ -f "$INSTALL_DIR/data/database.sqlite" ] && [ ! -f "$INSTALL_DIR/data/quicktalk.sqlite" ]; then
        echo "🔁 迁移旧数据库文件 database.sqlite -> quicktalk.sqlite"
        sudo mv "$INSTALL_DIR/data/database.sqlite" "$INSTALL_DIR/data/quicktalk.sqlite"
    fi
    sudo chown -R $SERVICE_USER:$SERVICE_USER $INSTALL_DIR
    
    # 创建配置目录
    sudo mkdir -p /etc/quicktalk
    echo "✅ 目录结构创建完成"
}

# 构建纯Rust应用
build_rust_app() {
    echo "🔨 构建纯Rust应用..."
    
    # 构建前端（如果需要）
    if [ -d "frontend" ]; then
        echo "📱 处理前端资源..."
        # 由于不能使用Node.js，我们直接复制静态文件
        cp -r frontend/public/* frontend/dist/ 2>/dev/null || true
        echo "✅ 前端资源准备完成"
    fi
    
    # 构建Rust应用（生产模式）
    echo "🦀 编译Rust应用..."
    cd backend
    
    # 确保所有功能都启用
    cargo build --release --features "standalone"
    
    if [ $? -eq 0 ]; then
        echo "✅ Rust应用编译成功"
    else
        echo "❌ Rust应用编译失败"
        exit 1
    fi
    
    cd ..
}

# 部署文件
deploy_files() {
    echo "📦 部署应用文件..."
    
    # 复制Rust可执行文件
    sudo cp backend/target/release/quicktalk-rust $INSTALL_DIR/bin/
    sudo chmod +x $INSTALL_DIR/bin/quicktalk-rust
    
    # 复制静态文件
    if [ -d "frontend/dist" ]; then
        sudo cp -r frontend/dist/* $INSTALL_DIR/static/
    fi
    
    # 设置权限
    sudo chown -R $SERVICE_USER:$SERVICE_USER $INSTALL_DIR/
    
    echo "✅ 文件部署完成"
}

# 创建配置
create_config() {
    echo "⚙️  创建配置文件..."
    
    # 创建环境配置
    sudo tee /etc/quicktalk/config.env > /dev/null <<EOF
# QuickTalk 纯Rust配置
RUST_LOG=info
    # 统一数据库路径 (旧: database.sqlite 已废弃)
    DATABASE_URL=sqlite:$INSTALL_DIR/data/quicktalk.sqlite
PORT=$PORT
DOMAIN=$DOMAIN
STATIC_DIR=$INSTALL_DIR/static
UPLOAD_DIR=$INSTALL_DIR/uploads
LOG_DIR=$INSTALL_DIR/logs

# 独立模式配置
STANDALONE_MODE=true
NODE_SERVICE_ENABLED=false
NGINX_ENABLED=false

# 性能配置
WORKER_THREADS=4
MAX_CONNECTIONS=1000
REQUEST_TIMEOUT=30
KEEPALIVE_TIMEOUT=60
EOF
    
    # 初始化数据库
    # 如果仍有遗留 database.sqlite 文件则执行一次迁移
    if [ -f "$INSTALL_DIR/data/database.sqlite" ] && [ ! -f "$INSTALL_DIR/data/quicktalk.sqlite" ]; then
        echo "🔁 检测到遗留 database.sqlite，重命名为 quicktalk.sqlite"
        sudo mv "$INSTALL_DIR/data/database.sqlite" "$INSTALL_DIR/data/quicktalk.sqlite"
    fi
    sudo -u $SERVICE_USER touch $INSTALL_DIR/data/quicktalk.sqlite
    
    echo "✅ 配置创建完成"
}

# 创建systemd服务
create_service() {
    echo "🔧 创建系统服务..."
    
    sudo tee /etc/systemd/system/quicktalk.service > /dev/null <<EOF
[Unit]
Description=QuickTalk Rust Web Server (Standalone)
Documentation=https://github.com/ElonQian1/QuickTalk-
After=network.target
Wants=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR

# 环境配置
EnvironmentFile=/etc/quicktalk/config.env

# 启动命令
ExecStart=$INSTALL_DIR/bin/quicktalk-rust
ExecReload=/bin/kill -HUP \$MAINPID

# 重启配置
Restart=always
RestartSec=3
TimeoutStartSec=30
TimeoutStopSec=30

# 日志配置
StandardOutput=journal
StandardError=journal
SyslogIdentifier=quicktalk

# 安全配置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR /tmp

# 资源限制
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

    echo "✅ 系统服务创建完成"
}

# 优化Rust应用配置
optimize_rust_config() {
    echo "🚀 优化Rust应用配置..."
    
    # 创建优化的Rust配置
    sudo tee $INSTALL_DIR/rust-config.toml > /dev/null <<EOF
# QuickTalk Rust应用配置

[server]
host = "0.0.0.0"
port = $PORT
workers = 4

[database]
# 统一数据库文件 quicktalk.sqlite (旧 database.sqlite 已废弃)
url = "sqlite:$INSTALL_DIR/data/quicktalk.sqlite"
max_connections = 100
timeout = 30

[static_files]
directory = "$INSTALL_DIR/static"
cache_max_age = 86400
enable_compression = true

[uploads]
directory = "$INSTALL_DIR/uploads"
max_size = "100MB"
allowed_types = ["jpg", "jpeg", "png", "gif", "pdf", "txt"]

[security]
enable_cors = true
max_request_size = "10MB"
rate_limit = 1000

[logging]
level = "info"
directory = "$INSTALL_DIR/logs"
max_files = 10
max_size = "10MB"
EOF

    sudo chown $SERVICE_USER:$SERVICE_USER $INSTALL_DIR/rust-config.toml
    echo "✅ Rust配置优化完成"
}

# 启动服务
start_service() {
    echo "🚀 启动QuickTalk服务..."
    
    # 重载systemd
    sudo systemctl daemon-reload
    
    # 启用并启动服务
    sudo systemctl enable quicktalk
    sudo systemctl start quicktalk
    
    # 等待启动
    sleep 5
    
    # 检查服务状态
    if sudo systemctl is-active --quiet quicktalk; then
        echo "✅ QuickTalk服务启动成功"
        sudo systemctl status quicktalk --no-pager -l
    else
        echo "❌ QuickTalk服务启动失败"
        sudo journalctl -u quicktalk -n 50 --no-pager
        exit 1
    fi
}

# 设置防火墙（如果需要）
setup_firewall() {
    if command -v ufw &> /dev/null; then
        echo "🔥 配置防火墙..."
        sudo ufw allow $PORT/tcp
        echo "✅ 防火墙规则已添加"
    elif command -v firewall-cmd &> /dev/null; then
        echo "🔥 配置firewalld..."
        sudo firewall-cmd --permanent --add-port=$PORT/tcp
        sudo firewall-cmd --reload
        echo "✅ 防火墙规则已添加"
    fi
}

# 创建管理脚本
create_management_scripts() {
    echo "🛠️  创建管理脚本..."
    
    # 创建管理脚本目录
    sudo mkdir -p /usr/local/bin/quicktalk
    
    # 重启脚本
    sudo tee /usr/local/bin/quicktalk/restart > /dev/null <<'EOF'
#!/bin/bash
echo "🔄 重启QuickTalk服务..."
sudo systemctl restart quicktalk
sudo systemctl status quicktalk --no-pager
EOF
    
    # 查看日志脚本
    sudo tee /usr/local/bin/quicktalk/logs > /dev/null <<'EOF'
#!/bin/bash
echo "📋 QuickTalk服务日志："
sudo journalctl -u quicktalk -f
EOF
    
    # 状态检查脚本
    sudo tee /usr/local/bin/quicktalk/status > /dev/null <<'EOF'
#!/bin/bash
echo "📊 QuickTalk服务状态："
sudo systemctl status quicktalk --no-pager -l
echo ""
echo "🌐 端口监听状态："
sudo netstat -tlnp | grep :3030 || echo "端口未监听"
echo ""
echo "💾 磁盘使用情况："
du -sh /opt/quicktalk/*
EOF
    
    # 备份脚本
    sudo tee /usr/local/bin/quicktalk/backup > /dev/null <<EOF
#!/bin/bash
BACKUP_DIR="/opt/quicktalk/backups/\$(date +%Y%m%d_%H%M%S)"
mkdir -p "\$BACKUP_DIR"
cp -r /opt/quicktalk/data "\$BACKUP_DIR/"
cp -r /opt/quicktalk/uploads "\$BACKUP_DIR/"
cp /etc/quicktalk/config.env "\$BACKUP_DIR/"
echo "✅ 备份完成: \$BACKUP_DIR"
EOF
    
    # 设置执行权限
    sudo chmod +x /usr/local/bin/quicktalk/*
    
    echo "✅ 管理脚本创建完成"
}

# 显示部署结果
show_result() {
    echo ""
    echo "🎉 QuickTalk 纯Rust架构部署完成！"
    echo "===================================="
    echo ""
    echo "📱 访问地址："
    echo "  主页: http://$DOMAIN:$PORT/"
    echo "  管理后台: http://$DOMAIN:$PORT/admin"
    echo "  API状态: http://$DOMAIN:$PORT/api/health"
    echo "  WebSocket: ws://$DOMAIN:$PORT/ws"
    echo ""
    echo "🔧 管理命令："
    echo "  重启服务: /usr/local/bin/quicktalk/restart"
    echo "  查看日志: /usr/local/bin/quicktalk/logs"
    echo "  检查状态: /usr/local/bin/quicktalk/status"
    echo "  创建备份: /usr/local/bin/quicktalk/backup"
    echo ""
    echo "📁 重要目录："
    echo "  应用: $INSTALL_DIR/bin/quicktalk-rust"
    echo "  数据: $INSTALL_DIR/data/"
    echo "  上传: $INSTALL_DIR/uploads/"
    echo "  日志: $INSTALL_DIR/logs/"
    echo "  配置: /etc/quicktalk/config.env"
    echo ""
    echo "🦀 架构特点："
    echo "  ✅ 纯Rust实现，无外部依赖"
    echo "  ✅ 内置静态文件服务"
    echo "  ✅ 内置WebSocket支持"
    echo "  ✅ SQLite数据库（内嵌）"
    echo "  ✅ 高性能、低资源占用"
    echo ""
    echo "📊 性能监控："
    echo "  CPU使用: htop | grep quicktalk"
    echo "  内存使用: ps aux | grep quicktalk"
    echo "  网络连接: sudo netstat -tlnp | grep :$PORT"
}

# 主执行流程
main() {
    check_rust
    setup_system
    build_rust_app
    deploy_files
    create_config
    optimize_rust_config
    create_service
    create_management_scripts
    setup_firewall
    start_service
    show_result
}

# 执行部署
echo "⚡ 开始部署纯Rust架构..."
main "$@"