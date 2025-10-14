#!/bin/bash

# Git Pre-commit Hook
# 检查数据库schema文件是否同步

SOURCE="backend/src/schema.sql"
TARGET="ubuntu-deploy-complete/database_schema.sql"

# 颜色
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# 检查两个文件是否都在本次提交中
SOURCE_STAGED=$(git diff --cached --name-only | grep -c "^$SOURCE$" || echo "0")
TARGET_STAGED=$(git diff --cached --name-only | grep -c "^$TARGET$" || echo "0")

# 如果源文件被修改但目标文件没有
if [ "$SOURCE_STAGED" -gt 0 ] && [ "$TARGET_STAGED" -eq 0 ]; then
    echo -e "${RED}❌ 错误: backend/src/schema.sql 已修改，但未同步到部署包${NC}"
    echo -e "${YELLOW}请运行: ./scripts/sync-schema.sh${NC}"
    exit 1
fi

# 如果两个文件都存在，检查内容是否一致
if [ -f "$SOURCE" ] && [ -f "$TARGET" ]; then
    if ! diff -q "$SOURCE" "$TARGET" > /dev/null 2>&1; then
        echo -e "${RED}❌ 错误: Schema文件不同步${NC}"
        echo -e "${YELLOW}请运行: ./scripts/sync-schema.sh${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Schema文件同步检查通过${NC}"
exit 0
