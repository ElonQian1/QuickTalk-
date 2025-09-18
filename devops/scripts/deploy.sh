#!/bin/bash

# QuickTalk 一键部署脚本 (Linux)
# 支持纯Rust架构和混合架构

set -e

echo "🚀 QuickTalk 客服系统部署脚本"
echo "=================================="

# 配置选项
DEPLOY_MODE=${1:-"hybrid"}  # rust-only 或 hybrid
DOMAIN=${2:-"localhost"}
PORT=${3:-"3030"}

echo "📋 部署配置："
echo "  模式: $DEPLOY_MODE"
echo "  域名: $DOMAIN"
echo "  端口: $PORT"
echo ""

# 检查系统依赖
check_dependencies() {
    echo "🔍 检查系统依赖..."
    
    # 检查Rust
    if ! command -v cargo &> /dev/null; then
        echo "❌ Rust未安装，正在安装..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source ~/.cargo/env
    else
        echo "✅ Rust已安装: $(rustc --version)"
    fi
    
    if [ "$DEPLOY_MODE" = "hybrid" ]; then
        # 检查Node.js
        if ! command -v node &> /dev/null; then
            echo "❌ Node.js未安装，正在安装..."
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        else
            echo "✅ Node.js已安装: $(node --version)"
        fi
    fi
    
    # 检查SQLite
    if ! command -v sqlite3 &> /dev/null; then
        echo "📦 安装SQLite..."
        sudo apt-get update
        sudo apt-get install -y sqlite3
    fi
}

# 创建系统用户和目录
setup_system() {
    echo "🔧 设置系统环境..."
    
    # 创建应用用户
    if ! id "quicktalk" &>/dev/null; then
        sudo useradd -r -s /bin/false quicktalk
        echo "✅ 创建用户 quicktalk"
    fi
    
    # 创建应用目录
    sudo mkdir -p /opt/quicktalk/{data,logs,uploads,backups}
    sudo chown -R quicktalk:quicktalk /opt/quicktalk
    
    # 创建配置目录
    sudo mkdir -p /etc/quicktalk
}

# 构建应用
build_application() {
    echo "🔨 构建应用..."
    
    # 构建前端
    echo "📱 构建前端..."
    cd frontend
    npm install
    npm run build
    cd ..
    
    # 构建Rust后端
    echo "🦀 构建Rust后端..."
    cd backend
    cargo build --release
    cd ..
    
    if [ "$DEPLOY_MODE" = "hybrid" ]; then
        # 安装Node.js微服务依赖
        echo "🟢 设置Node.js微服务..."
        cd services/nodejs
        npm install --production
        cd ../..
    fi
}

# 部署文件
deploy_files() {
    echo "📦 部署文件..."
    
    # 复制应用文件
    sudo cp -r . /opt/quicktalk/app/
    
    # 复制前端构建文件
    sudo cp -r frontend/dist /opt/quicktalk/static/
    
    # 复制Rust可执行文件
    sudo cp backend/target/release/quicktalk-rust /opt/quicktalk/bin/
    
    # 设置权限
    sudo chown -R quicktalk:quicktalk /opt/quicktalk/
    sudo chmod +x /opt/quicktalk/bin/quicktalk-rust
}

# 创建环境配置
create_config() {
    echo "⚙️  创建配置文件..."
    
    # 创建环境变量文件
    sudo tee /etc/quicktalk/env > /dev/null <<EOF
# QuickTalk 环境配置
NODE_ENV=production
DATABASE_URL=sqlite:/opt/quicktalk/data/database.sqlite
PORT=$PORT
DOMAIN=$DOMAIN
RUST_LOG=info
EOF
    
    # 创建数据库
    sudo -u quicktalk sqlite3 /opt/quicktalk/data/database.sqlite "CREATE TABLE IF NOT EXISTS _placeholder (id INTEGER);"
}

# 创建systemd服务
create_systemd_services() {
    echo "🔧 创建系统服务..."
    
    # Rust主服务
    sudo tee /etc/systemd/system/quicktalk-rust.service > /dev/null <<EOF
[Unit]
Description=QuickTalk Rust Web Server
After=network.target

[Service]
Type=simple
User=quicktalk
WorkingDirectory=/opt/quicktalk/app
EnvironmentFile=/etc/quicktalk/env
ExecStart=/opt/quicktalk/bin/quicktalk-rust
Restart=always
RestartSec=3

# 日志配置
StandardOutput=journal
StandardError=journal

# 安全配置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/quicktalk

[Install]
WantedBy=multi-user.target
EOF

    if [ "$DEPLOY_MODE" = "hybrid" ]; then
        # Node.js微服务
        sudo tee /etc/systemd/system/quicktalk-nodejs.service > /dev/null <<EOF
[Unit]
Description=QuickTalk Node.js Microservice
After=network.target

[Service]
Type=simple
User=quicktalk
WorkingDirectory=/opt/quicktalk/app/services/nodejs
EnvironmentFile=/etc/quicktalk/env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3

# 日志配置
StandardOutput=journal
StandardError=journal

# 安全配置
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
    fi
}

# 配置反向代理 (可选)
setup_nginx() {
    if command -v nginx &> /dev/null; then
        echo "🌐 配置Nginx反向代理..."
        
        sudo tee /etc/nginx/sites-available/quicktalk > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # 静态文件
    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # WebSocket支持
    location /ws {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
        
        sudo ln -sf /etc/nginx/sites-available/quicktalk /etc/nginx/sites-enabled/
        sudo nginx -t && sudo systemctl reload nginx
    fi
}

# 启动服务
start_services() {
    echo "🚀 启动服务..."
    
    # 重载systemd
    sudo systemctl daemon-reload
    
    # 启动并启用服务
    sudo systemctl enable quicktalk-rust
    sudo systemctl start quicktalk-rust
    
    if [ "$DEPLOY_MODE" = "hybrid" ]; then
        sudo systemctl enable quicktalk-nodejs
        sudo systemctl start quicktalk-nodejs
    fi
    
    # 检查服务状态
    sleep 3
    sudo systemctl status quicktalk-rust --no-pager -l
    
    if [ "$DEPLOY_MODE" = "hybrid" ]; then
        sudo systemctl status quicktalk-nodejs --no-pager -l
    fi
}

# 显示部署结果
show_result() {
    echo ""
    echo "🎉 QuickTalk 部署完成！"
    echo "======================="
    echo ""
    echo "📱 访问地址："
    echo "  主页: http://$DOMAIN:$PORT/"
    echo "  管理后台: http://$DOMAIN:$PORT/admin"
    echo "  API状态: http://$DOMAIN:$PORT/api/health"
    echo "  WebSocket: ws://$DOMAIN:$PORT/ws"
    echo ""
    echo "🔧 管理命令："
    echo "  查看状态: sudo systemctl status quicktalk-rust"
    echo "  重启服务: sudo systemctl restart quicktalk-rust"
    echo "  查看日志: sudo journalctl -u quicktalk-rust -f"
    echo ""
    if [ "$DEPLOY_MODE" = "hybrid" ]; then
        echo "🟢 Node.js微服务："
        echo "  查看状态: sudo systemctl status quicktalk-nodejs"
        echo "  重启服务: sudo systemctl restart quicktalk-nodejs"
        echo "  查看日志: sudo journalctl -u quicktalk-nodejs -f"
        echo ""
    fi
    echo "📁 重要目录："
    echo "  应用: /opt/quicktalk/app"
    echo "  数据: /opt/quicktalk/data"
    echo "  日志: /opt/quicktalk/logs"
    echo "  配置: /etc/quicktalk"
}

# 主执行流程
main() {
    check_dependencies
    setup_system
    build_application
    deploy_files
    create_config
    create_systemd_services
    setup_nginx
    start_services
    show_result
}

# 执行部署
main "$@"