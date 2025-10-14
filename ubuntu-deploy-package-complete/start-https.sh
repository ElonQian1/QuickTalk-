#!/bin/bash

# ELonTalk 客服系统 - Ubuntu HTTPS 启动脚本
# 功能：自动结束旧程序、详细日志记录、HTTPS 错误诊断
# 作者：System Admin
# 版本：v2.0
# 更新时间：2025-10-14

set -e  # 遇到错误立即退出

# ==========================================
# 配置变量
# ==========================================
APP_NAME="customer-service-backend"
LOG_DIR="logs"
LOG_FILE="$LOG_DIR/startup.log"
ERROR_LOG="$LOG_DIR/error.log"
ACCESS_LOG="$LOG_DIR/access.log"
HTTPS_LOG="$LOG_DIR/https-debug.log"
PID_FILE="/tmp/customer-service.pid"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==========================================
# 日志函数
# ==========================================
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE" "$ERROR_LOG"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

# ==========================================
# 初始化函数
# ==========================================
init_environment() {
    log_info "=== ELonTalk 客服系统启动 ==="
    
    # 创建日志目录
    mkdir -p "$LOG_DIR"
    
    # 设置权限
    chmod 755 "$LOG_DIR"
    chmod +x "$APP_NAME" 2>/dev/null || log_warn "无法设置执行权限，可能已经设置"
    
    # 检查环境文件
    if [[ -f ".env" ]]; then
        log_info "发现环境配置文件 .env"
        chmod 600 .env  # 安全权限
    else
        log_error "未发现 .env 配置文件"
        exit 1
    fi
    
    log_info "环境初始化完成"
}

# ==========================================
# 结束旧程序
# ==========================================
kill_old_processes() {
    log_info "检查并结束旧的服务进程..."
    
    # 方法1: 通过进程名结束
    OLD_PIDS=$(pgrep -f "$APP_NAME" 2>/dev/null || true)
    if [[ -n "$OLD_PIDS" ]]; then
        log_warn "发现运行中的进程: $OLD_PIDS"
        echo "$OLD_PIDS" | xargs kill -TERM 2>/dev/null || true
        sleep 3
        
        # 强制结束仍在运行的进程
        REMAINING_PIDS=$(pgrep -f "$APP_NAME" 2>/dev/null || true)
        if [[ -n "$REMAINING_PIDS" ]]; then
            log_warn "强制结束残留进程: $REMAINING_PIDS"
            echo "$REMAINING_PIDS" | xargs kill -9 2>/dev/null || true
        fi
    fi
    
    # 方法2: 通过端口结束
    for port in 8080 8443; do
        PORT_PID=$(lsof -ti:$port 2>/dev/null || true)
        if [[ -n "$PORT_PID" ]]; then
            log_warn "端口 $port 被进程 $PORT_PID 占用，正在结束..."
            kill -TERM "$PORT_PID" 2>/dev/null || true
            sleep 2
            
            # 检查是否还在运行
            if kill -0 "$PORT_PID" 2>/dev/null; then
                log_warn "强制结束端口 $port 的进程"
                kill -9 "$PORT_PID" 2>/dev/null || true
            fi
        fi
    done
    
    # 清理PID文件
    [[ -f "$PID_FILE" ]] && rm -f "$PID_FILE"
    
    log_info "旧进程清理完成"
}

# ==========================================
# 检查系统依赖
# ==========================================
check_dependencies() {
    log_info "检查系统依赖..."
    
    # 检查二进制文件
    if [[ ! -f "$APP_NAME" ]]; then
        log_error "未找到应用程序: $APP_NAME"
        exit 1
    fi
    
    # 检查权限
    if [[ ! -x "$APP_NAME" ]]; then
        log_warn "应用程序没有执行权限，正在设置..."
        chmod +x "$APP_NAME"
    fi
    
    # 检查证书文件
    if [[ -f "certs/server.crt" && -f "certs/server.key" ]]; then
        log_info "发现 SSL 证书文件"
        
        # 检查证书有效性
        if openssl x509 -in certs/server.crt -text -noout > /dev/null 2>&1; then
            CERT_EXPIRY=$(openssl x509 -in certs/server.crt -noout -dates)
            log_info "证书信息: $CERT_EXPIRY"
        else
            log_warn "SSL 证书文件可能损坏"
        fi
    else
        log_warn "未发现 SSL 证书文件，HTTPS 可能无法启动"
    fi
    
    # 检查静态文件
    if [[ -d "static" ]]; then
        log_info "发现静态文件目录"
        STATIC_COUNT=$(find static -type f | wc -l)
        log_debug "静态文件数量: $STATIC_COUNT"
    else
        log_warn "未发现静态文件目录"
    fi
    
    log_info "依赖检查完成"
}

# ==========================================
# 防火墙配置
# ==========================================
setup_firewall() {
    log_info "配置防火墙规则..."
    
    # 检查防火墙状态
    UFW_STATUS=$(ufw status 2>/dev/null || echo "inactive")
    log_debug "当前防火墙状态: $UFW_STATUS"
    
    # 配置端口
    ufw allow 22/tcp    >/dev/null 2>&1 || log_warn "无法配置SSH端口"
    ufw allow 8080/tcp  >/dev/null 2>&1 || log_warn "无法配置HTTP端口"
    ufw allow 8443/tcp  >/dev/null 2>&1 || log_warn "无法配置HTTPS端口"
    
    # 启用防火墙（如果需要）
    if [[ "$UFW_STATUS" == *"inactive"* ]]; then
        echo "y" | ufw enable >/dev/null 2>&1 || log_warn "无法启用防火墙"
        log_info "防火墙已启用"
    fi
    
    log_info "防火墙配置完成"
}

# ==========================================
# 数据库初始化
# ==========================================
setup_database() {
    log_info "初始化数据库..."
    
    # 创建数据库文件（如果不存在）
    if [[ ! -f "customer_service.db" ]]; then
        log_info "创建新的数据库文件"
        touch customer_service.db
    fi
    
    # 设置数据库权限
    chmod 644 customer_service.db
    
    # 检查数据库完整性
    if command -v sqlite3 >/dev/null 2>&1; then
        if sqlite3 customer_service.db "PRAGMA integrity_check;" | grep -q "ok"; then
            log_info "数据库完整性检查通过"
        else
            log_warn "数据库完整性检查失败"
        fi
    fi
    
    log_info "数据库初始化完成"
}

# ==========================================
# HTTPS 问题诊断
# ==========================================
diagnose_https() {
    log_info "进行 HTTPS 诊断..." | tee -a "$HTTPS_LOG"
    
    # 检查端口占用
    log_debug "检查端口占用情况..." | tee -a "$HTTPS_LOG"
    netstat -tlnp 2>/dev/null | grep -E ":(8080|8443)" | tee -a "$HTTPS_LOG" || log_debug "未发现端口占用"
    
    # 检查证书文件详情
    if [[ -f "certs/server.crt" ]]; then
        log_debug "证书文件详细信息:" | tee -a "$HTTPS_LOG"
        openssl x509 -in certs/server.crt -text -noout | head -20 | tee -a "$HTTPS_LOG" 2>/dev/null || log_warn "无法读取证书信息"
    fi
    
    # 检查网络连接
    log_debug "检查网络连接..." | tee -a "$HTTPS_LOG"
    ss -tlnp | grep -E ":(8080|8443)" | tee -a "$HTTPS_LOG" || log_debug "未发现活动连接"
    
    # 检查环境变量
    log_debug "HTTPS 相关环境变量:" | tee -a "$HTTPS_LOG"
    env | grep -i -E "(https|tls|ssl)" | tee -a "$HTTPS_LOG" || log_debug "未发现HTTPS环境变量"
}

# ==========================================
# 启动应用程序
# ==========================================
start_application() {
    log_info "启动应用程序..."
    
    # 进行预启动诊断
    diagnose_https
    
    # 设置环境变量
    export RUST_LOG="debug,sqlx=info,sea_orm=info"
    export RUST_BACKTRACE="full"
    
    # 启动应用程序
    log_info "正在启动 $APP_NAME (HTTPS模式)..."
    
    # 后台启动并记录PID
    nohup ./"$APP_NAME" \
        > >(tee -a "$ACCESS_LOG") \
        2> >(tee -a "$ERROR_LOG" "$HTTPS_LOG" >&2) &
    
    APP_PID=$!
    echo "$APP_PID" > "$PID_FILE"
    
    log_info "应用程序已启动，PID: $APP_PID"
    
    # 等待启动
    log_info "等待服务启动..."
    sleep 5
    
    # 检查进程状态
    if kill -0 "$APP_PID" 2>/dev/null; then
        log_info "✅ 服务启动成功"
        
        # 检查端口监听
        sleep 2
        for port in 8080 8443; do
            if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
                log_info "✅ 端口 $port 监听正常"
            else
                log_warn "⚠️  端口 $port 未在监听"
            fi
        done
        
    else
        log_error "❌ 服务启动失败"
        return 1
    fi
}

# ==========================================
# 健康检查
# ==========================================
health_check() {
    log_info "进行健康检查..."
    
    # 检查HTTP端点
    if command -v curl >/dev/null 2>&1; then
        # HTTP 检查
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null | grep -q "200"; then
            log_info "✅ HTTP 健康检查通过"
        else
            log_warn "⚠️  HTTP 健康检查失败"
        fi
        
        # HTTPS 检查
        if curl -k -s -o /dev/null -w "%{http_code}" https://localhost:8443/health 2>/dev/null | grep -q "200"; then
            log_info "✅ HTTPS 健康检查通过"
        else
            log_warn "⚠️  HTTPS 健康检查失败"
        fi
    else
        log_warn "curl 未安装，跳过HTTP健康检查"
    fi
    
    # 输出访问信息
    echo
    log_info "🌐 服务访问地址："
    echo "   HTTP:  http://43.139.82.12:8080"
    echo "   HTTPS: https://43.139.82.12:8443"
    echo "   域名:  https://elontalk.duckdns.org:8443"
    echo
    log_info "📋 管理信息："
    echo "   PID文件: $PID_FILE"
    echo "   日志目录: $LOG_DIR"
    echo "   配置文件: .env"
    echo
}

# ==========================================
# 信号处理
# ==========================================
cleanup() {
    log_warn "收到退出信号，正在清理..."
    if [[ -f "$PID_FILE" ]]; then
        APP_PID=$(cat "$PID_FILE")
        if kill -0 "$APP_PID" 2>/dev/null; then
            kill -TERM "$APP_PID"
            log_info "应用程序已停止"
        fi
        rm -f "$PID_FILE"
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# ==========================================
# 主函数
# ==========================================
main() {
    echo "=== ELonTalk 客服系统 HTTPS 启动脚本 ==="
    echo "启动时间: $(date)"
    echo "运行用户: $(whoami)"
    echo "工作目录: $(pwd)"
    echo
    
    init_environment
    kill_old_processes
    check_dependencies
    setup_firewall
    setup_database
    
    if start_application; then
        health_check
        log_info "🎉 系统启动完成！"
        
        # 显示实时日志
        echo "按 Ctrl+C 停止服务"
        echo "实时日志输出："
        echo "=================="
        tail -f "$ACCESS_LOG" "$ERROR_LOG" "$HTTPS_LOG" 2>/dev/null
    else
        log_error "系统启动失败，请检查日志文件"
        exit 1
    fi
}

# 执行主函数
main "$@"