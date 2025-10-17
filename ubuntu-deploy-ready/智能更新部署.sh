#!/bin/bash

# ELonTalk 客服系统 - 智能更新部署脚本
# 保护服务器现有证书和配置，仅更新必要文件

set -e

echo "🚀 ELonTalk 智能更新部署开始..."
echo "==============================="

DEPLOY_DIR="/root/ubuntu-deploy-ready"
BACKUP_DIR="/root/backup-$(date +%Y%m%d_%H%M%S)"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查权限
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ 错误: 请以root用户运行此脚本${NC}"
   exit 1
fi

echo -e "${BLUE}📂 当前部署目录: ${DEPLOY_DIR}${NC}"

# 创建备份目录
mkdir -p "$BACKUP_DIR"
echo -e "${YELLOW}💾 创建备份目录: ${BACKUP_DIR}${NC}"

# 停止服务（如果运行中）
if systemctl is-active --quiet customer-service 2>/dev/null; then
    echo -e "${YELLOW}⏸️  停止现有服务...${NC}"
    systemctl stop customer-service
    sleep 2
fi

# 备份关键配置和数据（如果存在）
if [ -f "$DEPLOY_DIR/.env" ]; then
    cp "$DEPLOY_DIR/.env" "$BACKUP_DIR/.env.backup"
    echo -e "${GREEN}✅ 备份配置文件: .env${NC}"
fi

if [ -f "$DEPLOY_DIR/customer_service.db" ]; then
    cp "$DEPLOY_DIR/customer_service.db" "$BACKUP_DIR/customer_service.db.backup"
    echo -e "${GREEN}✅ 备份数据库文件${NC}"
fi

if [ -d "$DEPLOY_DIR/certs" ] && [ -f "$DEPLOY_DIR/certs/server.crt" ]; then
    cp -r "$DEPLOY_DIR/certs" "$BACKUP_DIR/"
    echo -e "${GREEN}✅ 备份SSL证书${NC}"
fi

# 更新二进制文件（总是更新）
echo -e "${BLUE}🔄 更新后端程序...${NC}"
chmod +x "$DEPLOY_DIR/customer-service-backend"

# 更新前端文件（总是更新）
echo -e "${BLUE}🔄 更新前端文件...${NC}"
# 前端文件已经通过上传更新

# 恢复配置文件（如果有备份）
if [ -f "$BACKUP_DIR/.env.backup" ]; then
    echo -e "${YELLOW}🔧 检测到现有配置，是否保留？ (y/n/merge)${NC}"
    echo -e "  ${GREEN}y${NC} - 保留现有配置"
    echo -e "  ${GREEN}n${NC} - 使用新配置"
    echo -e "  ${GREEN}merge${NC} - 智能合并（推荐）"
    
    read -p "请选择 [merge]: " config_choice
    config_choice=${config_choice:-merge}
    
    case $config_choice in
        y|Y)
            cp "$BACKUP_DIR/.env.backup" "$DEPLOY_DIR/.env"
            echo -e "${GREEN}✅ 恢复现有配置${NC}"
            ;;
        n|N)
            echo -e "${GREEN}✅ 使用新配置${NC}"
            ;;
        merge|M|m)
            echo -e "${BLUE}🔄 智能合并配置...${NC}"
            # 合并逻辑：保留关键生产设置
            if [ -f "$DEPLOY_DIR/.env" ]; then
                # 从备份中提取关键设置
                ACME_ENABLED=$(grep "^ACME_ENABLED=" "$BACKUP_DIR/.env.backup" 2>/dev/null || echo "")
                ACME_DIRECTORY_URL=$(grep "^ACME_DIRECTORY_URL=" "$BACKUP_DIR/.env.backup" 2>/dev/null || echo "")
                JWT_SECRET=$(grep "^JWT_SECRET=" "$BACKUP_DIR/.env.backup" 2>/dev/null || echo "")
                
                # 如果有生产证书配置，保留它们
                if [[ "$ACME_ENABLED" == "ACME_ENABLED=true" ]] && [[ -n "$ACME_DIRECTORY_URL" ]]; then
                    # 使用备份的 .env
                    cp "$BACKUP_DIR/.env.backup" "$DEPLOY_DIR/.env"
                    echo -e "${GREEN}✅ 保留生产ACME配置${NC}"
                else
                    echo -e "${GREEN}✅ 使用新配置（首次部署）${NC}"
                fi
            fi
            ;;
    esac
fi

# 恢复数据库（如果有备份且文件不存在）
if [ -f "$BACKUP_DIR/customer_service.db.backup" ] && [ ! -f "$DEPLOY_DIR/customer_service.db" ]; then
    cp "$BACKUP_DIR/customer_service.db.backup" "$DEPLOY_DIR/customer_service.db"
    echo -e "${GREEN}✅ 恢复数据库文件${NC}"
fi

# 恢复证书（如果有备份且证书存在）
if [ -d "$BACKUP_DIR/certs" ] && [ -f "$BACKUP_DIR/certs/server.crt" ]; then
    cp -r "$BACKUP_DIR/certs" "$DEPLOY_DIR/"
    echo -e "${GREEN}✅ 恢复SSL证书${NC}"
fi

# 设置权限
chmod 755 "$DEPLOY_DIR"
chmod 644 "$DEPLOY_DIR/customer_service.db" 2>/dev/null || true
chmod 600 "$DEPLOY_DIR/certs/server.key" 2>/dev/null || true
chmod 644 "$DEPLOY_DIR/certs/server.crt" 2>/dev/null || true
chmod +x "$DEPLOY_DIR"/*.sh 2>/dev/null || true

echo -e "${GREEN}✅ 权限设置完成${NC}"

# 启动服务
echo -e "${BLUE}🚀 启动服务...${NC}"
cd "$DEPLOY_DIR"

# 检查配置
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ 配置文件存在${NC}"
    # 显示关键配置
    TLS_MODE=$(grep "^TLS_MODE=" .env 2>/dev/null | cut -d'=' -f2 || echo "auto")
    ACME_ENABLED=$(grep "^ACME_ENABLED=" .env 2>/dev/null | cut -d'=' -f2 || echo "false")
    echo -e "${BLUE}📋 TLS模式: ${TLS_MODE}${NC}"
    echo -e "${BLUE}📋 ACME自动证书: ${ACME_ENABLED}${NC}"
fi

# 启动服务
if [ -f "start.sh" ]; then
    ./start.sh
else
    # 直接启动
    ./customer-service-backend
fi

echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${BLUE}📋 备份位置: ${BACKUP_DIR}${NC}"
echo -e "${BLUE}🌐 访问地址:${NC}"
echo -e "  HTTP:  http://43.139.82.12:8080"
echo -e "  HTTPS: https://elontalk.duckdns.org:8443"

# 显示服务状态
sleep 3
echo -e "\n${BLUE}📊 服务状态:${NC}"
systemctl status customer-service --no-pager -l || true