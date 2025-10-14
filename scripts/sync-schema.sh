#!/bin/bash

# ==============================================
# 数据库Schema同步脚本
# 用途: 同步 backend/src/schema.sql 到部署包
# ==============================================

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SOURCE="backend/src/schema.sql"
TARGET="ubuntu-deploy-complete/database_schema.sql"

echo -e "${BLUE}==============================================\n"
echo -e "数据库Schema同步工具\n"
echo -e "==============================================${NC}\n"

# 检查源文件是否存在
if [ ! -f "$SOURCE" ]; then
    echo -e "${RED}❌ 错误: 找不到源文件 $SOURCE${NC}"
    exit 1
fi

# 检查目标目录是否存在
TARGET_DIR=$(dirname "$TARGET")
if [ ! -d "$TARGET_DIR" ]; then
    echo -e "${YELLOW}⚠️  创建目标目录: $TARGET_DIR${NC}"
    mkdir -p "$TARGET_DIR"
fi

# 如果目标文件存在，检查是否有差异
if [ -f "$TARGET" ]; then
    if diff -q "$SOURCE" "$TARGET" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Schema文件已经是最新的，无需同步${NC}\n"
        exit 0
    else
        echo -e "${YELLOW}⚠️  检测到Schema文件差异${NC}\n"
        echo -e "${BLUE}差异内容:${NC}"
        diff "$SOURCE" "$TARGET" || true
        echo -e "\n${YELLOW}是否要同步? (y/n)${NC}"
        read -r response
        if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            echo -e "${YELLOW}❌ 取消同步${NC}"
            exit 0
        fi
    fi
fi

# 执行同步
echo -e "${BLUE}📋 正在同步...${NC}"
cp "$SOURCE" "$TARGET"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 同步成功！${NC}\n"
    echo -e "${BLUE}文件信息:${NC}"
    echo -e "  源文件: $SOURCE"
    echo -e "  目标文件: $TARGET"
    echo -e "  文件大小: $(wc -c < "$TARGET") bytes"
    echo -e "  行数: $(wc -l < "$TARGET") lines"
    
    # 提示Git操作
    if git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "\n${YELLOW}💡 建议执行:${NC}"
        echo -e "  git add $TARGET"
        echo -e "  git commit -m \"sync: 更新数据库架构文件\""
    fi
    
    echo ""
else
    echo -e "${RED}❌ 同步失败${NC}"
    exit 1
fi
