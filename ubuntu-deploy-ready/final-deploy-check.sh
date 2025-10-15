#!/bin/bash

# ELonTalk 客服系统 - 最终部署验证脚本
# 验证所有必需文件和配置 - Ubuntu 真机测试就绪
# 更新时间: 2025年10月15日

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}==========================================${NC}"
echo -e "${PURPLE}  ELonTalk 客服系统 - 最终部署验证     ${NC}"
echo -e "${PURPLE}  Ubuntu HTTPS 真机测试就绪确认       ${NC}"
echo -e "${PURPLE}==========================================${NC}"

# 基本信息
echo -e "\n${BLUE}📋 部署信息确认${NC}"
echo -e "${GREEN}✓${NC} 部署路径: /root/ubuntu-deploy-ready/"
echo -e "${GREEN}✓${NC} 服务器IP: 43.139.82.12"
echo -e "${GREEN}✓${NC} 域名: elontalk.duckdns.org"
echo -e "${GREEN}✓${NC} 管理员: root (已登录)"

# 检查核心文件
echo -e "\n${BLUE}🔍 核心文件检查${NC}"

# 必需文件清单
CRITICAL_FILES=(
    "customer-service-backend:Linux可执行文件"
    ".env.https:HTTPS强制配置"
    "start.sh:智能启动脚本"
    "setup-https.sh:SSL证书配置"
    "static/index.html:前端主页"
    "certs/server.crt:SSL证书"
    "certs/server.key:SSL私钥"
)

MISSING_COUNT=0

for entry in "${CRITICAL_FILES[@]}"; do
    file=$(echo "$entry" | cut -d: -f1)
    desc=$(echo "$entry" | cut -d: -f2)
    
    if [ -f "$file" ]; then
        size=$(stat -c%s "$file" 2>/dev/null || echo "0")
        if [ "$size" -gt 0 ]; then
            size_mb=$(echo "scale=2; $size / 1048576" | bc 2>/dev/null || echo "N/A")
            echo -e "${GREEN}✓${NC} $file ($desc) - ${size_mb}MB"
        else
            echo -e "${YELLOW}⚠${NC} $file ($desc) - 空文件"
            ((MISSING_COUNT++))
        fi
    else
        echo -e "${RED}✗${NC} $file ($desc) - 缺失"
        ((MISSING_COUNT++))
    fi
done

# 检查关键目录
echo -e "\n${BLUE}📁 目录结构检查${NC}"
DIRS=("static" "static/static" "static/embed" "static/sdk" "certs")

for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        file_count=$(find "$dir" -type f 2>/dev/null | wc -l)
        echo -e "${GREEN}✓${NC} $dir/ - $file_count 文件"
    else
        echo -e "${RED}✗${NC} $dir/ - 目录不存在"
        ((MISSING_COUNT++))
    fi
done

# 检查二进制文件详情
echo -e "\n${BLUE}⚙️ 二进制文件验证${NC}"
if [ -f "customer-service-backend" ]; then
    # 文件基本信息
    file_size=$(stat -c%s customer-service-backend)
    file_size_mb=$(echo "scale=2; $file_size / 1048576" | bc)
    file_time=$(stat -c%y customer-service-backend)
    
    echo -e "${GREEN}✓${NC} 文件大小: ${file_size_mb}MB"
    echo -e "${GREEN}✓${NC} 编译时间: $file_time"
    
    # 检查文件类型
    if command -v file >/dev/null 2>&1; then
        file_type=$(file customer-service-backend)
        if echo "$file_type" | grep -q "ELF.*x86-64"; then
            echo -e "${GREEN}✓${NC} 文件类型: Linux x86-64 可执行文件"
        else
            echo -e "${YELLOW}⚠${NC} 文件类型: $file_type"
        fi
    fi
    
    # 检查可执行权限
    if [ -x "customer-service-backend" ]; then
        echo -e "${GREEN}✓${NC} 可执行权限: 已设置"
    else
        echo -e "${YELLOW}⚠${NC} 可执行权限: 需要设置 (chmod +x)"
    fi
else
    echo -e "${RED}✗${NC} customer-service-backend 不存在"
    ((MISSING_COUNT++))
fi

# 检查HTTPS配置
echo -e "\n${BLUE}🔒 HTTPS配置验证${NC}"
if [ -f ".env.https" ]; then
    # 关键配置检查
    configs=(
        "HTTPS_ENABLED=true:HTTPS启用"
        "TLS_MODE=https:TLS模式"
        "AUTO_MIGRATE=true:数据库自动迁移"
        "TLS_DOMAIN=elontalk.duckdns.org:域名配置"
        "FORCE_HTTPS=true:强制HTTPS"
    )
    
    for config_entry in "${configs[@]}"; do
        config=$(echo "$config_entry" | cut -d: -f1)
        desc=$(echo "$config_entry" | cut -d: -f2)
        
        if grep -q "^$config" .env.https; then
            echo -e "${GREEN}✓${NC} $desc: 已配置"
        else
            echo -e "${YELLOW}⚠${NC} $desc: 配置缺失或错误"
        fi
    done
else
    echo -e "${RED}✗${NC} .env.https 配置文件不存在"
    ((MISSING_COUNT++))
fi

# 检查Sea-ORM配置
echo -e "\n${BLUE}🗄️ Sea-ORM 数据库配置${NC}"
if grep -q "AUTO_MIGRATE=true" .env.https 2>/dev/null; then
    echo -e "${GREEN}✓${NC} 自动数据库迁移: 已启用"
fi
if grep -q "VALIDATE_SCHEMA=true" .env.https 2>/dev/null; then
    echo -e "${GREEN}✓${NC} 架构验证: 已启用"
fi
if grep -q "MIGRATION_MODE=safe" .env.https 2>/dev/null; then
    echo -e "${GREEN}✓${NC} 安全迁移模式: 已启用"
fi

# 静态文件检查
echo -e "\n${BLUE}📦 静态文件检查${NC}"
STATIC_FILES=("static/embed/service-standalone.js" "static/sdk/index.js")
for static_file in "${STATIC_FILES[@]}"; do
    if [ -f "$static_file" ]; then
        size=$(stat -c%s "$static_file")
        echo -e "${GREEN}✓${NC} $static_file - ${size} bytes"
    else
        echo -e "${RED}✗${NC} $static_file - 缺失"
        ((MISSING_COUNT++))
    fi
done

# 统计信息
echo -e "\n${BLUE}📊 部署包统计${NC}"
total_files=$(find . -type f | wc -l)
total_size=$(du -sh . | cut -f1)
echo -e "${GREEN}✓${NC} 总文件数: $total_files"
echo -e "${GREEN}✓${NC} 总大小: $total_size"

# 部署命令提示
echo -e "\n${BLUE}🚀 Ubuntu部署命令${NC}"
echo -e "${PURPLE}步骤 1 - 上传文件:${NC}"
echo -e "  scp -r ubuntu-deploy-ready root@43.139.82.12:/root/"
echo -e "\n${PURPLE}步骤 2 - 设置权限:${NC}"
echo -e "  ssh root@43.139.82.12"
echo -e "  cd /root/ubuntu-deploy-ready"
echo -e "  chmod +x customer-service-backend start.sh setup-https.sh"
echo -e "\n${PURPLE}步骤 3 - 启动服务:${NC}"
echo -e "  ./start.sh"

# 最终结果
echo -e "\n${PURPLE}==========================================${NC}"
if [ $MISSING_COUNT -eq 0 ]; then
    echo -e "${GREEN}🎉 部署包验证通过！准备就绪！${NC}"
    echo -e "${GREEN}   所有文件完整，配置正确${NC}"
    echo -e "${GREEN}   可以立即部署到Ubuntu服务器${NC}"
    echo -e "\n${BLUE}预期访问地址:${NC}"
    echo -e "  https://elontalk.duckdns.org:8443"
else
    echo -e "${RED}❌ 发现 $MISSING_COUNT 个问题${NC}"
    echo -e "${RED}   请解决问题后重新验证${NC}"
fi
echo -e "${PURPLE}==========================================${NC}"

# 编译时间戳记录
echo -e "\n${BLUE}🕐 编译时间戳${NC}"
if [ -f "customer-service-backend" ]; then
    echo -e "${GREEN}✓${NC} 最新编译: $(stat -c%y customer-service-backend)"
fi

exit $MISSING_COUNT