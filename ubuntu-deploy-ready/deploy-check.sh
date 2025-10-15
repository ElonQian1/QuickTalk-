#!/bin/bash

# ELonTalk 客服系统 - 部署前检查脚本
# 检查所有必要文件和配置

set -e

echo "🔍 ELonTalk 部署前检查"
echo "===================="

# 检查运行环境
if [[ $EUID -ne 0 ]]; then
   echo "❌ 错误: 请以root用户运行此脚本"
   exit 1
fi

# 检查工作目录
if [[ ! -d "/root/ubuntu-deploy-ready" ]]; then
    echo "❌ 错误: 工作目录不存在 /root/ubuntu-deploy-ready"
    exit 1
fi

cd /root/ubuntu-deploy-ready

echo "📂 工作目录: $(pwd)"
echo ""

# 检查文件列表
echo "📋 检查必要文件..."
echo "=================="

required_files=(
    "customer-service-backend:可执行文件"
    ".env:环境配置"
    "customer-service.service:系统服务"
    "start.sh:启动脚本"
    "deploy.sh:部署脚本"
    "setup-https.sh:HTTPS配置脚本"
    "certs/server.crt:SSL证书"
    "certs/server.key:SSL私钥"
    "static/index.html:前端文件"
)

all_ok=true

for item in "${required_files[@]}"; do
    file=$(echo "$item" | cut -d: -f1)
    desc=$(echo "$item" | cut -d: -f2)
    
    if [[ -f "$file" ]]; then
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        if [[ $size -gt 0 ]]; then
            echo "✅ $file ($desc) - ${size} bytes"
        else
            echo "⚠️  $file ($desc) - 文件为空"
            all_ok=false
        fi
    else
        echo "❌ $file ($desc) - 文件不存在"
        all_ok=false
    fi
done

echo ""

# 检查权限
echo "🔧 检查文件权限..."
echo "=================="

if [[ -x "customer-service-backend" ]]; then
    echo "✅ customer-service-backend - 可执行"
else
    echo "❌ customer-service-backend - 不可执行"
    all_ok=false
fi

if [[ -r ".env" ]]; then
    echo "✅ .env - 可读"
else
    echo "❌ .env - 不可读"
    all_ok=false
fi

if [[ -r "certs/server.crt" && -r "certs/server.key" ]]; then
    echo "✅ SSL证书 - 可读"
    
    # 检查私钥权限
    key_perms=$(stat -f%Sp "certs/server.key" 2>/dev/null || stat -c%A "certs/server.key" 2>/dev/null)
    if [[ "$key_perms" == *"rw-------"* ]] || [[ "$key_perms" == "-rw-------" ]]; then
        echo "✅ 私钥权限 - 安全 ($key_perms)"
    else
        echo "⚠️  私钥权限 - 不够安全 ($key_perms)"
        echo "   建议: chmod 600 certs/server.key"
    fi
else
    echo "❌ SSL证书 - 不可读"
    all_ok=false
fi

echo ""

# 检查证书有效性
echo "🔐 检查SSL证书..."
echo "================="

if openssl x509 -in "certs/server.crt" -text -noout > /dev/null 2>&1; then
    echo "✅ SSL证书格式有效"
    
    # 显示证书信息
    subject=$(openssl x509 -in "certs/server.crt" -noout -subject | sed 's/subject=//')
    issuer=$(openssl x509 -in "certs/server.crt" -noout -issuer | sed 's/issuer=//')
    not_after=$(openssl x509 -in "certs/server.crt" -noout -dates | grep "notAfter" | sed 's/notAfter=//')
    
    echo "   主题: $subject"
    echo "   颁发者: $issuer"
    echo "   过期时间: $not_after"
    
    # 检查是否即将过期（30天内）
    exp_epoch=$(date -d "$not_after" +%s 2>/dev/null || echo "0")
    now_epoch=$(date +%s)
    days_left=$(( (exp_epoch - now_epoch) / 86400 ))
    
    if [[ $days_left -gt 30 ]]; then
        echo "✅ 证书有效期充足 ($days_left 天)"
    elif [[ $days_left -gt 0 ]]; then
        echo "⚠️  证书即将过期 ($days_left 天)"
    else
        echo "❌ 证书已过期"
        all_ok=false
    fi
else
    echo "❌ SSL证书格式无效"
    all_ok=false
fi

if openssl rsa -in "certs/server.key" -check -noout > /dev/null 2>&1; then
    echo "✅ SSL私钥有效"
else
    echo "❌ SSL私钥无效"
    all_ok=false
fi

echo ""

# 检查环境配置
echo "⚙️  检查环境配置..."
echo "=================="

if [[ -f ".env" ]]; then
    echo "📋 环境变量:"
    
    required_vars=(
        "DATABASE_URL"
        "JWT_SECRET"
        "SERVER_HOST"
        "SERVER_PORT"
        "HTTPS_ENABLED"
        "TLS_PORT"
        "TLS_DOMAIN"
        "TLS_CERT_PATH"
        "TLS_KEY_PATH"
    )
    
    for var in "${required_vars[@]}"; do
        if grep -q "^${var}=" ".env"; then
            value=$(grep "^${var}=" ".env" | cut -d= -f2 | head -1)
            if [[ -n "$value" ]]; then
                echo "✅ $var = $value"
            else
                echo "⚠️  $var = (空值)"
            fi
        else
            echo "❌ $var - 未设置"
            all_ok=false
        fi
    done
fi

echo ""

# 检查端口
echo "🌐 检查端口状态..."
echo "=================="

ports=("8080" "8443")
for port in "${ports[@]}"; do
    if netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
        process=$(netstat -tlnp 2>/dev/null | grep ":${port} " | awk '{print $7}' | head -1)
        echo "⚠️  端口 $port 被占用 ($process)"
    else
        echo "✅ 端口 $port 可用"
    fi
done

echo ""

# 检查系统服务
echo "🔧 检查系统配置..."
echo "=================="

if [[ -f "/etc/systemd/system/customer-service.service" ]]; then
    echo "✅ 系统服务已配置"
else
    echo "⚠️  系统服务未配置"
fi

if systemctl is-enabled customer-service > /dev/null 2>&1; then
    echo "✅ 服务已启用自启动"
else
    echo "⚠️  服务未启用自启动"
fi

if systemctl is-active customer-service > /dev/null 2>&1; then
    echo "⚠️  服务正在运行"
else
    echo "✅ 服务未运行 (准备启动)"
fi

echo ""

# 检查防火墙
echo "🔥 检查防火墙..."
echo "================"

if command -v ufw > /dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
        echo "✅ UFW防火墙已启用"
        
        required_ports=("22/tcp" "8080/tcp" "8443/tcp")
        for port in "${required_ports[@]}"; do
            if ufw status | grep -q "$port.*ALLOW"; then
                echo "✅ 端口 $port 已开放"
            else
                echo "⚠️  端口 $port 未开放"
            fi
        done
    else
        echo "⚠️  UFW防火墙未启用"
    fi
else
    echo "⚠️  UFW防火墙未安装"
fi

echo ""

# 总结
echo "📊 检查总结"
echo "==========="

if $all_ok; then
    echo "🎉 所有检查通过！系统准备就绪。"
    echo ""
    echo "🚀 下一步:"
    echo "1. 运行部署: bash deploy.sh"
    echo "2. 或手动启动: bash start.sh"
    echo ""
    exit 0
else
    echo "❌ 发现问题，请修复后重试。"
    echo ""
    echo "🛠️  常见修复方法:"
    echo "1. 设置权限: chmod +x customer-service-backend"
    echo "2. 修复证书权限: chmod 600 certs/server.key"
    echo "3. 检查配置: cat .env"
    echo ""
    exit 1
fi