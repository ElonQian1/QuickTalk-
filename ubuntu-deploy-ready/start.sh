#!/bin/bash

# ELonTalk 客服系统 - Ubuntu 智能启动脚本
# 支持 HTTP/HTTPS 自动检测与切换
# 适配 Sea-ORM 自动数据库迁移

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================${NC}"
echo -e "${BLUE}  ELonTalk 客服系统启动脚本     ${NC}"
echo -e "${BLUE}  Sea-ORM + Rustls HTTPS 支持   ${NC}"
echo -e "${BLUE}==================================${NC}"

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}警告: 建议使用 root 用户运行以避免权限问题${NC}"
fi

# 设置工作目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}当前工作目录: $SCRIPT_DIR${NC}"

# 检查二进制文件
if [ ! -f "./customer-service-backend" ]; then
    echo -e "${RED}错误: 未找到 customer-service-backend 二进制文件${NC}"
    exit 1
fi

# 设置可执行权限
chmod +x ./customer-service-backend

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}警告: 未找到 .env 文件，使用默认配置${NC}"
    cat > .env << 'EOF'
DATABASE_URL=sqlite:customer_service.db
JWT_SECRET=elontalk-prod-secret-change-me
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
HTTPS_ENABLED=false
TLS_PORT=8443
RUST_LOG=info
EOF
fi

# 加载环境变量
source .env

# 检查证书文件 (HTTPS模式)
check_https_certificates() {
    if [ "$HTTPS_ENABLED" = "true" ] || [ "$TLS_MODE" = "https" ]; then
        if [ ! -f "${TLS_CERT_PATH:-certs/server.crt}" ] || [ ! -f "${TLS_KEY_PATH:-certs/server.key}" ]; then
            echo -e "${YELLOW}警告: HTTPS 模式需要有效的证书文件${NC}"
            echo -e "${YELLOW}证书路径: ${TLS_CERT_PATH:-certs/server.crt}${NC}"
            echo -e "${YELLOW}私钥路径: ${TLS_KEY_PATH:-certs/server.key}${NC}"
            echo -e "${YELLOW}切换到 HTTP 模式...${NC}"
            export HTTPS_ENABLED=false
            export TLS_MODE=http
        else
            echo -e "${GREEN}✓ HTTPS 证书文件检查通过${NC}"
        fi
    fi
}

# 检查端口占用
check_port() {
    local port=$1
    local service_name=$2
    
    if ss -tlnp | grep -q ":$port "; then
        echo -e "${YELLOW}警告: 端口 $port ($service_name) 已被占用${NC}"
        echo -e "${YELLOW}尝试停止现有服务...${NC}"
        
        # 尝试停止可能的 systemd 服务
        systemctl stop customer-service 2>/dev/null || true
        
        # 强制杀死占用端口的进程
        local pid=$(ss -tlnp | grep ":$port " | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)
        if [ -n "$pid" ]; then
            echo -e "${YELLOW}强制停止进程 PID: $pid${NC}"
            kill -9 "$pid" 2>/dev/null || true
            sleep 2
        fi
    fi
}

# 防火墙配置
configure_firewall() {
    echo -e "${BLUE}配置防火墙规则...${NC}"
    
    # 检查 ufw 状态
    if command -v ufw > /dev/null; then
        # 允许 SSH
        ufw allow 22/tcp >/dev/null 2>&1 || true
        
        # 允许 HTTP
        ufw allow ${SERVER_PORT:-8080}/tcp >/dev/null 2>&1 || true
        echo -e "${GREEN}✓ 已开放 HTTP 端口: ${SERVER_PORT:-8080}${NC}"
        
        # 如果启用 HTTPS，开放 HTTPS 端口
        if [ "$HTTPS_ENABLED" = "true" ] || [ "$TLS_MODE" = "https" ]; then
            ufw allow ${TLS_PORT:-8443}/tcp >/dev/null 2>&1 || true
            echo -e "${GREEN}✓ 已开放 HTTPS 端口: ${TLS_PORT:-8443}${NC}"
        fi
        
        # 启用防火墙 (如果未启用)
        echo "y" | ufw enable >/dev/null 2>&1 || true
        echo -e "${GREEN}✓ 防火墙已启用${NC}"
    else
        echo -e "${YELLOW}警告: 未安装 ufw，跳过防火墙配置${NC}"
    fi
}

# 数据库准备 (Sea-ORM 自动处理)
prepare_database() {
    echo -e "${BLUE}准备 SQLite 数据库 (Sea-ORM 自动迁移)...${NC}"
    
    # 确保数据库文件目录存在和权限正确
    touch customer_service.db
    chmod 644 customer_service.db
    chmod 755 .
    
    echo -e "${GREEN}✓ 数据库准备完成 (Sea-ORM 将自动创建表结构)${NC}"
}

# 系统信息显示
show_system_info() {
    echo -e "${BLUE}系统信息:${NC}"
    echo -e "  操作系统: $(uname -a | cut -d' ' -f1-3)"
    echo -e "  当前用户: $(whoami)"
    echo -e "  工作目录: $PWD"
    echo -e "  二进制文件: $(ls -lh customer-service-backend | awk '{print $5}')"
    echo
}

# 启动前检查
pre_start_checks() {
    echo -e "${BLUE}启动前检查...${NC}"
    
    show_system_info
    check_https_certificates
    check_port ${SERVER_PORT:-8080} "HTTP"
    
    if [ "$HTTPS_ENABLED" = "true" ] || [ "$TLS_MODE" = "https" ]; then
        check_port ${TLS_PORT:-8443} "HTTPS"
    fi
    
    configure_firewall
    prepare_database
}

# 显示启动信息
show_startup_info() {
    echo -e "${GREEN}==================================${NC}"
    echo -e "${GREEN}  🚀 ELonTalk 客服系统启动中...  ${NC}"
    echo -e "${GREEN}==================================${NC}"
    
    local server_ip="43.139.82.12"
    local domain="elontalk.duckdns.org"
    
    echo -e "${GREEN}HTTP 访问地址:${NC}"
    echo -e "  🌐 http://$server_ip:${SERVER_PORT:-8080}"
    echo -e "  🌐 http://$domain:${SERVER_PORT:-8080}"
    
    if [ "$HTTPS_ENABLED" = "true" ] || [ "$TLS_MODE" = "https" ]; then
        echo -e "${GREEN}HTTPS 访问地址:${NC}"
        echo -e "  🔒 https://$server_ip:${TLS_PORT:-8443}"
        echo -e "  🔒 https://$domain:${TLS_PORT:-8443}"
    fi
    
    echo
    echo -e "${BLUE}功能特性:${NC}"
    echo -e "  ✅ Sea-ORM 自动数据库迁移"
    echo -e "  ✅ Rustls 纯 Rust TLS 实现"
    echo -e "  ✅ 零依赖静态编译部署"
    echo -e "  ✅ React 管理后台界面"
    echo -e "  ✅ WebSocket 实时通信"
    echo
    echo -e "${YELLOW}按 Ctrl+C 停止服务${NC}"
    echo -e "${GREEN}==================================${NC}"
}

# 主启动函数
main() {
    # 捕获中断信号
    trap 'echo -e "\n${YELLOW}正在停止服务...${NC}"; exit 0' INT TERM
    
    pre_start_checks
    show_startup_info
    
    # 启动服务
    echo -e "${BLUE}启动 ELonTalk 客服系统...${NC}"
    exec ./customer-service-backend
}

# 如果直接运行此脚本
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi