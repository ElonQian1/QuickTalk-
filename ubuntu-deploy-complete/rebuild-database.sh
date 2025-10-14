#!/bin/bash

# ==============================================
# ELonTalk 数据库重建脚本
# 用途: 使用最新的schema文件重建数据库
# 警告: 此操作会清空现有数据！
# ==============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
DB_PATH="customer_service.db"
SCHEMA_FILE="database_schema.sql"
BACKUP_DIR="backups"

echo -e "${BLUE}==============================================\n"
echo -e "ELonTalk 数据库重建工具\n"
echo -e "==============================================${NC}\n"

# 检查schema文件是否存在
if [ ! -f "$SCHEMA_FILE" ]; then
    echo -e "${RED}❌ 错误: 找不到 $SCHEMA_FILE 文件${NC}"
    exit 1
fi

# 如果数据库文件存在，创建备份
if [ -f "$DB_PATH" ]; then
    echo -e "${YELLOW}⚠️  检测到现有数据库文件${NC}"
    echo -e "${YELLOW}是否要备份现有数据库? (y/n)${NC}"
    read -r response
    
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        # 创建备份目录
        mkdir -p "$BACKUP_DIR"
        
        # 生成备份文件名（带时间戳）
        BACKUP_FILE="${BACKUP_DIR}/customer_service_$(date +%Y%m%d_%H%M%S).db"
        
        echo -e "${BLUE}📦 正在备份数据库到: $BACKUP_FILE${NC}"
        cp "$DB_PATH" "$BACKUP_FILE"
        echo -e "${GREEN}✅ 备份完成${NC}\n"
    fi
    
    echo -e "${RED}⚠️  警告: 即将删除现有数据库并重建！${NC}"
    echo -e "${RED}所有数据将丢失（除非已备份）。是否继续? (yes/no)${NC}"
    read -r confirm
    
    if [[ ! "$confirm" == "yes" ]]; then
        echo -e "${YELLOW}❌ 操作已取消${NC}"
        exit 0
    fi
    
    echo -e "${BLUE}🗑️  删除现有数据库...${NC}"
    rm -f "$DB_PATH"
fi

# 创建新数据库
echo -e "${BLUE}🔨 正在创建新数据库...${NC}"
sqlite3 "$DB_PATH" < "$SCHEMA_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}\n✅ 数据库重建成功！${NC}\n"
    
    # 验证数据库
    echo -e "${BLUE}🔍 验证数据库表结构...${NC}"
    TABLE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
    echo -e "${GREEN}✅ 已创建 $TABLE_COUNT 个表${NC}"
    
    # 列出所有表
    echo -e "\n${BLUE}📋 数据库表列表:${NC}"
    sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" | while read -r table; do
        echo -e "  ${GREEN}•${NC} $table"
    done
    
    echo -e "\n${GREEN}🎉 数据库已准备就绪！${NC}"
    echo -e "${BLUE}数据库位置: $DB_PATH${NC}\n"
else
    echo -e "${RED}\n❌ 数据库创建失败${NC}"
    exit 1
fi
