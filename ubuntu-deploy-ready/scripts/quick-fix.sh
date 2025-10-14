#!/bin/bash#!/bin/bash

# 快速修复脚本 - 解决常见部署问题# ELonTalk 客服系统 - 快速修复脚本

# 版本: 2.0# 版本: 1.0

# 适用: ELonTalk 客服系统 Ubuntu HTTPS 部署# 更新时间: 2025年10月14日



set -eset -e



# 彩色输出# 彩色输出

RED='\033[0;31m'RED='\033[0;31m'

GREEN='\033[0;32m'GREEN='\033[0;32m'

YELLOW='\033[1;33m'YELLOW='\033[1;33m'

BLUE='\033[0;34m'BLUE='\033[0;34m'

NC='\033[0m'NC='\033[0m' # No Color



DEPLOY_DIR="/root/ubuntu-deploy-ready"# 配置变量

LOG_DIR="${DEPLOY_DIR}/logs"DEPLOY_DIR="/root/ubuntu-deploy-ready"



print_info() { echo -e "${BLUE}[修复]${NC} $1"; }# 函数: 打印彩色信息

print_success() { echo -e "${GREEN}[完成]${NC} $1"; }print_info() {

print_error() { echo -e "${RED}[错误]${NC} $1"; }    echo -e "${BLUE}[INFO]${NC} $1"

}

echo "🔧 ELonTalk 快速修复工具"

echo "========================"print_success() {

    echo -e "${GREEN}[SUCCESS]${NC} $1"

cd "$DEPLOY_DIR"}



# 1. 停止所有相关进程print_warning() {

print_info "停止现有服务..."    echo -e "${YELLOW}[WARNING]${NC} $1"

pkill -f customer-service-backend || true}

sleep 2

print_error() {

# 2. 修复权限    echo -e "${RED}[ERROR]${NC} $1"

print_info "修复文件权限..."}

chmod +x customer-service-backend

chmod +x scripts/*.sh# 函数: 修复权限

chmod 755 logs certs staticfix_permissions() {

chmod 644 customer_service.db 2>/dev/null || true    print_info "修复文件权限..."

chmod 644 certs/server.crt 2>/dev/null || true    

chmod 600 certs/server.key 2>/dev/null || true    cd "$DEPLOY_DIR"

    

# 3. 修复数据库    # 修复目录权限

print_info "修复数据库..."    chmod 755 .

if [ ! -f "customer_service.db" ]; then    chmod 755 logs certs static scripts 2>/dev/null || true

    touch "customer_service.db"    

fi    # 修复可执行文件权限

chmod 644 "customer_service.db"    if [ -f "customer-service-backend" ]; then

chown root:root "customer_service.db"        chmod +x customer-service-backend

        print_success "可执行文件权限已修复"

# 4. 检查端口    fi

print_info "检查端口占用..."    

if netstat -tlpn 2>/dev/null | grep -E ":80(80|43)" >/dev/null; then    # 修复脚本权限

    print_info "发现端口占用，清理中..."    if [ -d "scripts" ]; then

    fuser -k 8080/tcp 2>/dev/null || true        chmod +x scripts/*.sh 2>/dev/null || true

    fuser -k 8443/tcp 2>/dev/null || true        print_success "脚本权限已修复"

    sleep 2    fi

fi    

    # 修复证书权限

# 5. 重启服务    if [ -f "certs/server.crt" ]; then

print_info "重启服务..."        chmod 644 certs/server.crt

export TLS_MODE=auto    fi

export HTTPS_ENABLED=true    if [ -f "certs/server.key" ]; then

nohup "./customer-service-backend" > "${LOG_DIR}/service.log" 2>&1 &        chmod 600 certs/server.key

sleep 5    fi

    

if pgrep -f customer-service-backend >/dev/null; then    print_success "权限修复完成"

    print_success "服务启动成功!"}

    echo "访问: https://elontalk.duckdns.org:8443"

    echo "日志: tail -f ${LOG_DIR}/service.log"# 函数: 修复数据库

elsefix_database() {

    print_error "启动失败，请查看日志"    print_info "修复数据库..."

    tail -20 "${LOG_DIR}/service.log" 2>/dev/null || true    

fi    cd "$DEPLOY_DIR"
    
    # 创建数据库文件
    if [ ! -f "customer_service.db" ]; then
        touch "customer_service.db"
        chmod 644 "customer_service.db"
        print_success "数据库文件已创建"
    else
        print_success "数据库文件已存在"
    fi
    
    # 确保权限正确
    chmod 644 "customer_service.db"
    chown root:root "customer_service.db"
}

# 函数: 创建自签名证书
create_selfsigned_cert() {
    print_info "创建自签名证书 (用于测试)..."
    
    cd "$DEPLOY_DIR"
    mkdir -p certs
    
    # 生成自签名证书
    openssl req -x509 -newkey rsa:4096 \
        -keyout certs/server.key \
        -out certs/server.crt \
        -days 365 -nodes \
        -subj "/C=CN/ST=Beijing/L=Beijing/O=ELonTalk/OU=IT/CN=elontalk.duckdns.org" \
        >/dev/null 2>&1
    
    # 设置权限
    chmod 644 certs/server.crt
    chmod 600 certs/server.key
    
    print_success "自签名证书已创建"
    print_warning "注意: 自签名证书可能会显示安全警告"
}

# 函数: 修复配置
fix_config() {
    print_info "修复配置..."
    
    cd "$DEPLOY_DIR"
    
    # 确保.env文件存在
    if [ ! -f ".env" ]; then
        print_info "创建默认配置文件..."
        cat > .env << 'EOF'
# ELonTalk 客服系统 - Ubuntu 生产环境配置
DATABASE_URL=sqlite:customer_service.db
JWT_SECRET=elontalk-prod-secret-2025-change-in-production
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
TLS_MODE=auto
TLS_PORT=8443
TLS_DOMAIN=elontalk.duckdns.org
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key
REDIRECT_HTTP=true
SERVER_NAME=ELonTalk客服系统
ADMIN_EMAIL=siwmm@163.com
RUST_LOG=info
LOG_LEVEL=info
EOF
        print_success "配置文件已创建"
    else
        print_success "配置文件已存在"
    fi
    
    chmod 644 .env
}

# 函数: 测试启动
test_startup() {
    print_info "测试应用启动..."
    
    cd "$DEPLOY_DIR"
    
    # 设置环境变量
    export DATABASE_URL="sqlite:customer_service.db"
    export RUST_LOG=info
    export TLS_MODE=http  # 先测试HTTP模式
    
    print_info "启动HTTP模式测试 (5秒)..."
    timeout 5s ./customer-service-backend 2>&1 | head -20 || true
    
    print_info "测试完成"
}

# 函数: 显示启动命令
show_startup_commands() {
    print_info "显示启动命令..."
    
    echo ""
    echo "========================================="
    echo "  启动命令"
    echo "========================================="
    echo ""
    
    echo "🔧 HTTP模式启动 (推荐先测试):"
    echo "   cd /root/ubuntu-deploy-ready"
    echo "   TLS_MODE=http ./customer-service-backend"
    echo ""
    
    echo "🔒 HTTPS模式启动:"
    echo "   cd /root/ubuntu-deploy-ready"
    echo "   TLS_MODE=https ./customer-service-backend"
    echo ""
    
    echo "🚀 自动模式启动 (智能选择):"
    echo "   cd /root/ubuntu-deploy-ready"
    echo "   ./customer-service-backend"
    echo ""
    
    echo "📝 调试模式启动:"
    echo "   cd /root/ubuntu-deploy-ready"
    echo "   RUST_LOG=debug TLS_MODE=http ./customer-service-backend"
    echo ""
    
    echo "🌐 访问地址:"
    echo "   HTTP:  http://43.139.82.12:8080"
    echo "   HTTPS: https://43.139.82.12:8443"
    echo ""
    
    echo "🔍 如果仍有问题，运行诊断脚本:"
    echo "   ./scripts/diagnose.sh"
    echo ""
    
    echo "========================================="
}

# 主函数
main() {
    echo "ELonTalk 客服系统 - 快速修复脚本"
    echo "==============================="
    echo ""
    
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
    
    # 执行修复步骤
    fix_permissions
    echo ""
    
    fix_database
    echo ""
    
    fix_config
    echo ""
    
    # 检查是否需要证书
    if [ ! -f "$DEPLOY_DIR/certs/server.crt" ]; then
        if command -v openssl >/dev/null 2>&1; then
            create_selfsigned_cert
            echo ""
        else
            print_warning "OpenSSL 未安装，跳过证书创建"
            print_info "可以稍后运行: ./scripts/cert-manager.sh selfsigned"
            echo ""
        fi
    else
        print_success "证书文件已存在"
        echo ""
    fi
    
    test_startup
    echo ""
    
    show_startup_commands
    
    print_success "快速修复完成！现在可以尝试启动应用。"
}

# 运行主函数
main "$@"