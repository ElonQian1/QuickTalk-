#!/bin/bash

# ELonTalk 客服系统 - 部署验证脚本
# 检查所有必需文件和配置

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==================================${NC}"
echo -e "${BLUE}  ELonTalk 部署包验证脚本       ${NC}"
echo -e "${BLUE}  检查部署到 /root/ubuntu-deploy-ready/${NC}"
echo -e "${BLUE}==================================${NC}"

# 检查核心文件
echo -e "${BLUE}检查核心文件...${NC}"

# 必需文件列表
REQUIRED_FILES=(
    "customer-service-backend"
    ".env.https"
    "start.sh"
    "setup-https.sh"
    "static/index.html"
    "static/manifest.json"
    "certs/server.crt"
    "certs/server.key"
)

MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        size=$(stat -c%s "$file" 2>/dev/null || echo "0")
        if [ "$size" -gt 0 ]; then
            echo -e "${GREEN}✓${NC} $file (${size} bytes)"
        else
            echo -e "${YELLOW}⚠${NC} $file (空文件)"
        fi
    else
        echo -e "${RED}✗${NC} $file (缺失)"
        MISSING_FILES+=("$file")
    fi
done

# 检查关键目录
echo -e "\n${BLUE}检查目录结构...${NC}"
REQUIRED_DIRS=("static" "static/static" "static/embed" "static/sdk" "certs")

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        file_count=$(find "$dir" -type f | wc -l)
        echo -e "${GREEN}✓${NC} $dir/ ($file_count 文件)"
    else
        echo -e "${RED}✗${NC} $dir/ (目录不存在)"
    fi
done

# 检查二进制文件
echo -e "\n${BLUE}检查二进制文件...${NC}"
if [ -f "customer-service-backend" ]; then
    file_info=$(file customer-service-backend 2>/dev/null || echo "无法获取文件信息")
    file_size=$(stat -c%s customer-service-backend)
    file_size_mb=$(echo "scale=2; $file_size / 1048576" | bc)
    
    echo -e "${GREEN}✓${NC} 二进制文件大小: ${file_size_mb}MB"
    echo -e "${GREEN}✓${NC} 文件类型: $file_info"
    
    # 检查是否为Linux可执行文件
    if echo "$file_info" | grep -q "ELF.*x86-64"; then
        echo -e "${GREEN}✓${NC} 确认为 Linux x86-64 可执行文件"
    else
        echo -e "${YELLOW}⚠${NC} 警告: 可能不是正确的Linux可执行文件"
    fi
else
    echo -e "${RED}✗${NC} customer-service-backend 不存在"
fi

# 检查配置文件
echo -e "\n${BLUE}检查HTTPS配置...${NC}"
if [ -f ".env.https" ]; then
    if grep -q "HTTPS_ENABLED=true" .env.https; then
        echo -e "${GREEN}✓${NC} HTTPS 已启用"
    fi
    if grep -q "AUTO_MIGRATE=true" .env.https; then
        echo -e "${GREEN}✓${NC} Sea-ORM 自动迁移已启用"
    fi
    if grep -q "TLS_DOMAIN=elontalk.duckdns.org" .env.https; then
        echo -e "${GREEN}✓${NC} 域名配置正确"
    fi
fi

# 统计信息
echo -e "\n${BLUE}部署包统计...${NC}"
total_files=$(find . -type f | wc -l)
total_size=$(du -sh . | cut -f1)
echo -e "${GREEN}✓${NC} 总文件数: $total_files"
echo -e "${GREEN}✓${NC} 总大小: $total_size"

# 结果总结
echo -e "\n${BLUE}==================================${NC}"
if [ ${#MISSING_FILES[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ 部署包验证通过！${NC}"
    echo -e "${GREEN}   可以安全部署到 /root/ubuntu-deploy-ready/${NC}"
    echo -e "${BLUE}部署步骤:${NC}"
    echo -e "   1. 上传整个文件夹到 Ubuntu: /root/ubuntu-deploy-ready/"
    echo -e "   2. chmod +x /root/ubuntu-deploy-ready/{customer-service-backend,start.sh,setup-https.sh}"
    echo -e "   3. cd /root/ubuntu-deploy-ready && ./start.sh"
else
    echo -e "${RED}❌ 部署包不完整，缺失文件:${NC}"
    for file in "${MISSING_FILES[@]}"; do
        echo -e "${RED}   - $file${NC}"
    done
fi
echo -e "${BLUE}==================================${NC}"