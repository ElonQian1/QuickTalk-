#!/bin/bash

# HTTPS 启动脚本 - 专门用于启动 HTTPS 模式的客服系统
# 包含完整的端口检查、证书验证和故障排除功能

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
BACKEND_DIR="$PROJECT_ROOT/backend"
CERTS_DIR="$PROJECT_ROOT/certs"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查端口是否被占用
check_port() {
    local port=$1
    local service_name=$2
    
    if netstat -ln 2>/dev/null | grep -q ":$port "; then
        log_error "端口 $port 已被占用！"
        echo "正在使用端口 $port 的进程:"
        netstat -lnp 2>/dev/null | grep ":$port " || ss -lnp | grep ":$port "
        
        read -p "是否要终止占用端口 $port 的进程? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            local pids=$(netstat -lnp 2>/dev/null | grep ":$port " | awk '{print $NF}' | cut -d'/' -f1 | grep -v '-' || true)
            if [ -n "$pids" ]; then
                for pid in $pids; do
                    log_info "终止进程 PID: $pid"
                    kill -TERM "$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
                done
                sleep 2
                if netstat -ln 2>/dev/null | grep -q ":$port "; then
                    log_error "无法释放端口 $port，请手动处理"
                    return 1
                else
                    log_success "端口 $port 已释放"
                fi
            fi
        else
            log_error "无法启动 $service_name，端口 $port 被占用"
            return 1
        fi
    else
        log_success "端口 $port 可用"
    fi
    return 0
}

# 验证SSL证书
verify_ssl_cert() {
    log_info "验证SSL证书..."
    
    local cert_file="$CERTS_DIR/server.crt"
    local key_file="$CERTS_DIR/server.key"
    
    if [ ! -f "$cert_file" ]; then
        log_error "SSL证书文件不存在: $cert_file"
        return 1
    fi
    
    if [ ! -f "$key_file" ]; then
        log_error "SSL密钥文件不存在: $key_file"
        return 1
    fi
    
    # 检查证书有效性
    if openssl x509 -in "$cert_file" -noout -checkend 86400 2>/dev/null; then
        log_success "SSL证书有效（未过期）"
    else
        log_warning "SSL证书可能已过期或无效"
        openssl x509 -in "$cert_file" -noout -dates 2>/dev/null || log_error "无法读取证书日期"
    fi
    
    # 检查证书和密钥是否匹配
    local cert_hash=$(openssl x509 -noout -modulus -in "$cert_file" 2>/dev/null | openssl md5)
    local key_hash=$(openssl rsa -noout -modulus -in "$key_file" 2>/dev/null | openssl md5)
    
    if [ "$cert_hash" = "$key_hash" ]; then
        log_success "SSL证书和密钥匹配"
    else
        log_error "SSL证书和密钥不匹配！"
        return 1
    fi
    
    # 显示证书信息
    log_info "证书详细信息:"
    openssl x509 -in "$cert_file" -noout -subject -issuer -dates 2>/dev/null || log_warning "无法读取证书详细信息"
    
    return 0
}

# 生成SSL证书（如果不存在）
generate_ssl_cert() {
    log_info "生成自签名SSL证书..."
    
    mkdir -p "$CERTS_DIR"
    
    # 生成私钥
    openssl genrsa -out "$CERTS_DIR/server.key" 2048
    
    # 生成证书
    openssl req -new -x509 -key "$CERTS_DIR/server.key" -out "$CERTS_DIR/server.crt" -days 365 \
        -subj "/C=CN/ST=State/L=City/O=Organization/OU=OrgUnit/CN=localhost"
    
    log_success "SSL证书已生成"
}

# 设置环境变量
setup_https_env() {
    log_info "设置HTTPS环境变量..."
    
    export TLS_MODE="https"
    export HTTPS_PORT="8443"
    export TLS_CERT_PATH="$CERTS_DIR/server.crt"
    export TLS_KEY_PATH="$CERTS_DIR/server.key"
    export ENABLE_HTTP_REDIRECT="true"
    
    log_success "HTTPS环境变量已设置"
    echo "  TLS_MODE: $TLS_MODE"
    echo "  HTTPS_PORT: $HTTPS_PORT"
    echo "  TLS_CERT_PATH: $TLS_CERT_PATH"
    echo "  TLS_KEY_PATH: $TLS_KEY_PATH"
    echo "  ENABLE_HTTP_REDIRECT: $ENABLE_HTTP_REDIRECT"
}

# 编译后端（如果需要）
build_backend() {
    log_info "检查后端编译状态..."
    
    cd "$BACKEND_DIR"
    
    local binary_path="target/release/customer-service-backend"
    if [ ! -f "$binary_path" ] || [ "$BACKEND_DIR/src" -nt "$binary_path" ]; then
        log_info "编译后端（Release模式，包含HTTPS支持）..."
        cargo build --release --features https
        log_success "后端编译完成"
    else
        log_success "后端已是最新版本"
    fi
    
    cd "$PROJECT_ROOT"
}

# 启动HTTPS服务器
start_https_server() {
    log_info "启动HTTPS服务器..."
    
    cd "$BACKEND_DIR"
    
    # 显示启动信息
    echo
    echo "=========================================="
    echo "🚀 启动HTTPS客服系统"
    echo "=========================================="
    echo "HTTPS地址: https://localhost:8443"
    echo "HTTP重定向: http://localhost:8080 -> https://localhost:8443"
    echo "证书路径: $TLS_CERT_PATH"
    echo "密钥路径: $TLS_KEY_PATH"
    echo "=========================================="
    echo
    
    # 启动服务器
    exec ./target/release/customer-service-backend
}

# 显示帮助信息
show_help() {
    echo "HTTPS启动脚本使用指南"
    echo
    echo "用法:"
    echo "  $0 [选项]"
    echo
    echo "选项:"
    echo "  --help, -h          显示此帮助信息"
    echo "  --generate-cert     仅生成SSL证书"
    echo "  --verify-cert       仅验证SSL证书"
    echo "  --force-build       强制重新编译后端"
    echo "  --port PORT         指定HTTPS端口（默认：8443）"
    echo
    echo "环境变量:"
    echo "  HTTPS_PORT          HTTPS端口号（默认：8443）"
    echo "  TLS_CERT_PATH       SSL证书路径"
    echo "  TLS_KEY_PATH        SSL密钥路径"
    echo
    echo "示例:"
    echo "  $0                  # 启动HTTPS服务器"
    echo "  $0 --port 9443      # 使用端口9443启动"
    echo "  $0 --generate-cert  # 仅生成证书"
    echo
}

# 主函数
main() {
    local force_build=false
    local generate_cert_only=false
    local verify_cert_only=false
    local custom_port=""
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --generate-cert)
                generate_cert_only=true
                shift
                ;;
            --verify-cert)
                verify_cert_only=true
                shift
                ;;
            --force-build)
                force_build=true
                shift
                ;;
            --port)
                custom_port="$2"
                shift 2
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    echo "🔒 HTTPS 客服系统启动脚本"
    echo "=================================="
    
    # 设置自定义端口
    if [ -n "$custom_port" ]; then
        export HTTPS_PORT="$custom_port"
        log_info "使用自定义HTTPS端口: $custom_port"
    fi
    
    # 仅生成证书
    if [ "$generate_cert_only" = true ]; then
        generate_ssl_cert
        exit 0
    fi
    
    # 仅验证证书
    if [ "$verify_cert_only" = true ]; then
        if verify_ssl_cert; then
            log_success "SSL证书验证通过"
            exit 0
        else
            log_error "SSL证书验证失败"
            exit 1
        fi
    fi
    
    # 检查并生成SSL证书
    if ! verify_ssl_cert; then
        log_warning "SSL证书验证失败，尝试生成新证书..."
        generate_ssl_cert
        if ! verify_ssl_cert; then
            log_error "SSL证书生成或验证失败"
            exit 1
        fi
    fi
    
    # 设置环境变量
    setup_https_env
    
    # 检查端口
    local https_port="${HTTPS_PORT:-8443}"
    if ! check_port "$https_port" "HTTPS服务器"; then
        exit 1
    fi
    
    # 检查HTTP重定向端口
    if ! check_port "8080" "HTTP重定向服务器"; then
        log_warning "HTTP重定向端口8080被占用，将禁用重定向功能"
        export ENABLE_HTTP_REDIRECT="false"
    fi
    
    # 编译后端
    if [ "$force_build" = true ]; then
        log_info "强制重新编译后端..."
        cd "$BACKEND_DIR"
        cargo clean
        cd "$PROJECT_ROOT"
    fi
    build_backend
    
    # 启动HTTPS服务器
    start_https_server
}

# 捕获退出信号
trap 'log_info "正在关闭HTTPS服务器..."; exit 0' INT TERM

# 执行主函数
main "$@"