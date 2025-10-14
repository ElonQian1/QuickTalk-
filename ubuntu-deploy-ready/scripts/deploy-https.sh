#!/bin/bash
# ELonTalk 客服系统 - Ubuntu HTTPS 部署脚本
# 版本: 2.0
# 更新时间: 2025年10月14日
# 特别适配: /root/ubuntu-deploy-ready + HTTPS + Sea-ORM

set -e

# 彩色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置变量
DEPLOY_DIR="/root/ubuntu-deploy-ready"
SERVICE_NAME="customer-service-backend"
LOG_DIR="${DEPLOY_DIR}/logs"
ENV_FILE="${DEPLOY_DIR}/.env"

# 域名和证书配置
DOMAIN="elontalk.duckdns.org"
DUCKDNS_TOKEN="400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca"
SERVER_IP="43.139.82.12"
EMAIL="siwmm@163.com"

# 函数: 打印彩色信息
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${CYAN}$1${NC}"; }

# 显示欢迎信息
show_welcome() {
    clear
    print_header "========================================="
    print_header "  ELonTalk 客服系统 - HTTPS 部署工具"
    print_header "========================================="
    echo ""
    echo "📍 部署路径: $DEPLOY_DIR"
    echo "🌐 域名: $DOMAIN"
    echo "🖥️  服务器IP: $SERVER_IP"
    echo "📧 邮箱: $EMAIL"
    echo ""
}

# 函数: 检查环境
check_environment() {
    print_info "检查部署环境..."
    
    # 检查是否为 root 用户
    if [ "$EUID" -ne 0 ]; then
        print_error "请使用 root 用户运行此脚本"
        exit 1
    fi
    
    # 检查部署目录
    if [ ! -d "$DEPLOY_DIR" ]; then
        print_error "部署目录不存在: $DEPLOY_DIR"
        exit 1
    fi
    
    # 检查关键文件
    cd "$DEPLOY_DIR"
    if [ ! -f "customer-service-backend" ]; then
        print_error "未找到应用程序: customer-service-backend"
        exit 1
    fi
    
    print_success "环境检查通过"
}

# 函数: 修复所有权限
fix_all_permissions() {
    print_info "修复文件和目录权限..."
    
    cd "$DEPLOY_DIR"
    
    # 修复主目录权限
    chmod 755 "$DEPLOY_DIR"
    
    # 修复可执行文件
    chmod +x customer-service-backend
    
    # 修复脚本权限
    if [ -d "scripts" ]; then
        find scripts -name "*.sh" -exec chmod +x {} \;
    fi
    
    # 修复子目录权限
    for dir in logs certs static; do
        if [ -d "$dir" ]; then
            chmod 755 "$dir"
        else
            mkdir -p "$dir"
            chmod 755 "$dir"
        fi
    done
    
    # 修复静态文件权限
    if [ -d "static" ]; then
        find static -type f -exec chmod 644 {} \;
        find static -type d -exec chmod 755 {} \;
    fi
    
    print_success "权限修复完成"
}

# 函数: 初始化Sea-ORM数据库
init_seaorm_database() {
    print_info "初始化 Sea-ORM 数据库..."
    
    cd "$DEPLOY_DIR"
    
    # 创建数据库文件
    if [ ! -f "customer_service.db" ]; then
        touch "customer_service.db"
        print_success "创建数据库文件"
    fi
    
    # 设置数据库权限
    chmod 644 "customer_service.db"
    chown root:root "customer_service.db"
    
    # 执行智能迁移
    print_info "执行数据库迁移..."
    if [ -f "scripts/migrate-database.sh" ]; then
        chmod +x "scripts/migrate-database.sh"
        ./scripts/migrate-database.sh migrate
    else
        print_warning "迁移脚本不存在，使用基础初始化"
    fi
    
    # 测试数据库访问
    if command -v sqlite3 >/dev/null 2>&1; then
        if sqlite3 "customer_service.db" "SELECT 1;" >/dev/null 2>&1; then
            print_success "数据库访问测试通过"
        else
            print_warning "数据库访问测试失败，但Sea-ORM会自动处理"
        fi
    else
        print_info "sqlite3未安装，Sea-ORM会自动处理数据库"
    fi
    
    print_success "Sea-ORM 数据库初始化完成"
}

# 函数: 更新DuckDNS
update_duckdns() {
    print_info "更新 DuckDNS 域名解析..."
    
    local response=$(curl -s "https://www.duckdns.org/update?domains=elontalk&token=${DUCKDNS_TOKEN}&ip=${SERVER_IP}")
    
    if [ "$response" = "OK" ]; then
        print_success "DuckDNS 更新成功: $DOMAIN -> $SERVER_IP"
        
        # 等待DNS传播
        print_info "等待 DNS 传播 (30秒)..."
        sleep 30
        
    else
        print_warning "DuckDNS 更新响应: $response"
    fi
}

# 函数: 申请Let's Encrypt证书
request_letsencrypt_cert() {
    print_info "申请 Let's Encrypt SSL 证书..."
    
    # 安装certbot
    if ! command -v certbot >/dev/null 2>&1; then
        print_info "安装 Certbot..."
        apt update
        apt install -y certbot
    fi
    
    # 停止可能占用端口的服务
    systemctl stop nginx 2>/dev/null || true
    systemctl stop apache2 2>/dev/null || true
    pkill -f customer-service-backend || true
    sleep 3
    
    # 申请证书
    certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        --domains "$DOMAIN" \
        --preferred-challenges http \
        >/dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "Let's Encrypt 证书申请成功"
        
        # 复制证书到项目目录
        cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "certs/server.crt"
        cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "certs/server.key"
        
        # 设置证书权限
        chmod 644 "certs/server.crt"
        chmod 600 "certs/server.key"
        
        return 0
    else
        print_warning "Let's Encrypt 申请失败，将生成自签名证书"
        return 1
    fi
}

# 函数: 生成自签名证书
generate_selfsigned_cert() {
    print_info "生成自签名证书..."
    
    openssl req -x509 -newkey rsa:4096 \
        -keyout "certs/server.key" \
        -out "certs/server.crt" \
        -days 365 -nodes \
        -subj "/C=CN/ST=Beijing/L=Beijing/O=ELonTalk/OU=IT/CN=${DOMAIN}" \
        >/dev/null 2>&1
    
    # 设置权限
    chmod 644 "certs/server.crt"
    chmod 600 "certs/server.key"
    
    print_success "自签名证书生成完成"
    print_warning "注意: 自签名证书会显示安全警告"
}

# 函数: 配置防火墙
setup_firewall() {
    print_info "配置防火墙..."
    
    if command -v ufw >/dev/null 2>&1; then
        ufw allow 22/tcp >/dev/null 2>&1    # SSH
        ufw allow 80/tcp >/dev/null 2>&1    # HTTP (用于证书验证)
        ufw allow 8080/tcp >/dev/null 2>&1  # HTTP
        ufw allow 8443/tcp >/dev/null 2>&1  # HTTPS
        ufw --force enable >/dev/null 2>&1
        
        print_success "防火墙配置完成"
    else
        print_warning "ufw 未安装，请手动配置防火墙"
    fi
}

# 函数: 启动HTTPS服务
start_https_service() {
    print_info "启动 HTTPS 服务..."
    
    cd "$DEPLOY_DIR"
    
    # 加载环境变量
    if [ -f "$ENV_FILE" ]; then
        export $(grep -v '^#' "$ENV_FILE" | xargs)
    fi
    
    # 设置HTTPS模式
    export TLS_MODE=auto
    export HTTPS_ENABLED=true
    
    # 创建启动日志
    mkdir -p "$LOG_DIR"
    
    print_info "启动应用程序..."
    print_info "日志文件: ${LOG_DIR}/service.log"
    
    # 启动服务
    nohup "./customer-service-backend" > "${LOG_DIR}/service.log" 2>&1 &
    local pid=$!
    
    # 等待启动
    sleep 5
    
    # 检查服务状态
    if kill -0 $pid 2>/dev/null; then
        echo $pid > "${LOG_DIR}/service.pid"
        print_success "服务启动成功! PID: $pid"
        
        # 显示访问信息
        echo ""
        print_header "========================================="
        print_header "  🎉 ELonTalk 客服系统部署成功!"
        print_header "========================================="
        echo ""
        echo "🌐 访问地址:"
        echo "   HTTPS: https://${DOMAIN}:8443"
        echo "   HTTP:  http://${SERVER_IP}:8080"
        echo ""
        echo "📋 服务信息:"
        echo "   PID: $pid"
        echo "   日志: ${LOG_DIR}/service.log"
        echo "   配置: ${ENV_FILE}"
        echo ""
        echo "🔧 管理命令:"
        echo "   查看日志: tail -f ${LOG_DIR}/service.log"
        echo "   停止服务: kill $pid"
        echo "   重启服务: ./scripts/deploy-https.sh"
        echo ""
        print_header "========================================="
        
        return 0
    else
        print_error "服务启动失败"
        print_error "请查看日志: ${LOG_DIR}/service.log"
        return 1
    fi
}

# 函数: 主部署流程
main_deploy() {
    show_welcome
    
    # 执行部署步骤
    check_environment
    echo ""
    
    fix_all_permissions
    echo ""
    
    init_seaorm_database
    echo ""
    
    setup_firewall
    echo ""
    
    update_duckdns
    echo ""
    
    # 尝试申请Let's Encrypt证书，失败则使用自签名
    if ! request_letsencrypt_cert; then
        generate_selfsigned_cert
    fi
    echo ""
    
    start_https_service
}

# 函数: 显示帮助
show_help() {
    echo "ELonTalk 客服系统 - HTTPS 部署脚本"
    echo "=================================="
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  deploy        执行完整HTTPS部署 (默认)"
    echo "  cert-only     仅申请SSL证书"
    echo "  start         仅启动服务"
    echo "  stop          停止服务"
    echo "  status        查看服务状态"
    echo "  logs          查看服务日志"
    echo "  help          显示此帮助"
    echo ""
    echo "配置信息:"
    echo "  部署目录: $DEPLOY_DIR"
    echo "  域名: $DOMAIN"
    echo "  服务器IP: $SERVER_IP"
    echo ""
}

# 函数: 停止服务
stop_service() {
    print_info "停止服务..."
    
    local pid_file="${LOG_DIR}/service.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            kill $pid
            print_success "服务已停止 (PID: $pid)"
        else
            print_warning "服务未运行"
        fi
        rm -f "$pid_file"
    else
        pkill -f customer-service-backend || print_warning "未找到运行中的服务"
    fi
}

# 函数: 查看服务状态
show_status() {
    print_info "检查服务状态..."
    
    local pid_file="${LOG_DIR}/service.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            print_success "服务正在运行 (PID: $pid)"
            
            # 显示端口监听
            if netstat -tlpn 2>/dev/null | grep -E ":80(80|43)" >/dev/null; then
                print_success "端口监听正常"
            else
                print_warning "端口监听异常"
            fi
            
        else
            print_warning "PID文件存在但服务未运行"
            rm -f "$pid_file"
        fi
    else
        if pgrep -f customer-service-backend >/dev/null; then
            print_warning "服务在运行但无PID文件"
        else
            print_warning "服务未运行"
        fi
    fi
}

# 函数: 查看日志
show_logs() {
    local log_file="${LOG_DIR}/service.log"
    
    if [ -f "$log_file" ]; then
        print_info "显示服务日志 (Ctrl+C 退出):"
        tail -f "$log_file"
    else
        print_error "日志文件不存在: $log_file"
    fi
}

# 主函数
case "${1:-deploy}" in
    "deploy")
        main_deploy
        ;;
    "cert-only")
        check_environment
        update_duckdns
        if ! request_letsencrypt_cert; then
            generate_selfsigned_cert
        fi
        ;;
    "start")
        check_environment
        start_https_service
        ;;
    "stop")
        stop_service
        ;;
    "status")
        show_status
        ;;
    "logs")
        show_logs
        ;;
    "help"|*)
        show_help
        ;;
esac