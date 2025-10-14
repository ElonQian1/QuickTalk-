#!/bin/bash

# ==============================================
# ELonTalk 数据库验证脚本
# 用途: 验证数据库架构完整性
# ==============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DB_PATH="${1:-customer_service.db}"

echo -e "${BLUE}==============================================\n"
echo -e "ELonTalk 数据库验证工具\n"
echo -e "==============================================${NC}\n"

# 检查数据库文件是否存在
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}❌ 错误: 数据库文件不存在: $DB_PATH${NC}"
    exit 1
fi

echo -e "${BLUE}📂 数据库文件: $DB_PATH${NC}\n"

# 必需的表列表
REQUIRED_TABLES=(
    "users"
    "shops"
    "shop_staffs"
    "customers"
    "sessions"
    "messages"
    "files"
    "statistics"
    "unread_counts"
    "system_config"
)

# 验证表是否存在
echo -e "${BLUE}🔍 验证必需的表...${NC}"
MISSING_TABLES=()

for table in "${REQUIRED_TABLES[@]}"; do
    EXISTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='$table';")
    if [ "$EXISTS" -eq 1 ]; then
        echo -e "${GREEN}✅${NC} $table"
    else
        echo -e "${RED}❌${NC} $table ${RED}(缺失)${NC}"
        MISSING_TABLES+=("$table")
    fi
done

echo ""

# 检查customers表的last_active_at字段
echo -e "${BLUE}🔍 验证关键字段...${NC}"
HAS_LAST_ACTIVE=$(sqlite3 "$DB_PATH" "PRAGMA table_info(customers);" | grep -c "last_active_at" || echo "0")
if [ "$HAS_LAST_ACTIVE" -gt 0 ]; then
    echo -e "${GREEN}✅${NC} customers.last_active_at"
else
    echo -e "${RED}❌${NC} customers.last_active_at ${RED}(缺失)${NC}"
    MISSING_TABLES+=("customers.last_active_at")
fi

# 检查索引
echo -e "\n${BLUE}🔍 验证索引...${NC}"
INDEX_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%';")
echo -e "${GREEN}✅${NC} 发现 $INDEX_COUNT 个索引"

# 检查触发器
echo -e "\n${BLUE}🔍 验证触发器...${NC}"
TRIGGER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger';")
echo -e "${GREEN}✅${NC} 发现 $TRIGGER_COUNT 个触发器"

# 检查视图
echo -e "\n${BLUE}🔍 验证视图...${NC}"
VIEW_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='view';")
echo -e "${GREEN}✅${NC} 发现 $VIEW_COUNT 个视图"

# 统计结果
echo -e "\n${BLUE}==============================================\n"
if [ ${#MISSING_TABLES[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ 数据库验证通过！所有必需的表和字段都存在。${NC}\n"
    
    # 显示统计信息
    echo -e "${BLUE}📊 数据库统计:${NC}"
    for table in "${REQUIRED_TABLES[@]}"; do
        COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
        echo -e "  ${GREEN}•${NC} $table: $COUNT 条记录"
    done
    echo ""
    
    exit 0
else
    echo -e "${RED}❌ 数据库验证失败！${NC}"
    echo -e "${RED}缺失以下表或字段:${NC}"
    for missing in "${MISSING_TABLES[@]}"; do
        echo -e "  ${RED}•${NC} $missing"
    done
    echo -e "\n${YELLOW}💡 建议: 运行 rebuild-database.sh 重建数据库${NC}\n"
    exit 1
fi
