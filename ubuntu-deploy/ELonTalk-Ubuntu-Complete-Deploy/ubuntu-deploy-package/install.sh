#!/bin/bash

# ELonTalk 客服系统 - 一键安装脚本
# 自动配置和启动 ELonTalk 客服系统

echo "==========================================="
echo "    ELonTalk 客服系统 - 一键安装"
echo "==========================================="
echo ""

# 检查系统
if [[ ! -f /etc/os-release ]]; then
    echo "❌ 无法检测操作系统"
    exit 1
fi

source /etc/os-release
echo "🖥️  检测到系统: $PRETTY_NAME"

# 检查权限
if [[ $EUID -eq 0 ]]; then
    echo "⚠️  检测到 root 权限"
    RUN_AS_ROOT=true
else
    echo "👤 运行用户: $(whoami)"
    RUN_AS_ROOT=false
fi

echo ""

# 创建必要目录
echo "📁 创建目录结构..."
mkdir -p data logs certs

# 设置权限
echo "🔐 设置文件权限..."
chmod +x customer-service-backend
chmod +x start.sh
chmod +x start-https.sh
chmod +x setup-ssl.sh

# 检查并创建配置文件
if [[ ! -f .env ]]; then
    echo "⚙️  创建配置文件..."
    if [[ -f .env.example ]]; then
        cp .env.example .env
        echo "✅ 已从示例创建 .env 配置文件"
    else
        # 创建基础配置
        cat > .env << EOF
# ELonTalk 客服系统配置
DATABASE_URL=sqlite:./data/customer_service.db
JWT_SECRET=$(openssl rand -hex 32)
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
HTTPS_PORT=8443
STATIC_DIR=./static
RUST_LOG=info
EOF
        echo "✅ 已创建基础 .env 配置文件"
    fi
else
    echo "✅ 配置文件已存在"
fi

# 检查端口占用
echo ""
echo "🌐 检查端口状态..."

check_port() {
    local port=$1
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo "⚠️  端口 $port 已被占用"
        return 1
    else
        echo "✅ 端口 $port 可用"
        return 0
    fi
}

HTTP_PORT_OK=$(check_port 8080 && echo "true" || echo "false")
HTTPS_PORT_OK=$(check_port 8443 && echo "true" || echo "false")

# 询问部署模式
echo ""
echo "🚀 选择部署模式:"
echo "1) HTTP 模式 (端口 8080) - 适合内网测试"
echo "2) HTTPS 模式 (端口 8443) - 适合生产环境"
echo "3) 仅安装，稍后手动启动"

read -p "请选择 [1-3]: " DEPLOY_MODE

case $DEPLOY_MODE in
    1)
        if [[ $HTTP_PORT_OK == "true" ]]; then
            echo ""
            echo "🎯 启动 HTTP 服务..."
            echo "管理地址: http://$(hostname -I | awk '{print $1}'):8080"
            echo "按 Ctrl+C 可停止服务"
            echo ""
            ./start.sh
        else
            echo "❌ 端口 8080 被占用，无法启动 HTTP 服务"
            echo "💡 请使用 'netstat -tulpn | grep :8080' 查看占用进程"
        fi
        ;;
    
    2)
        echo ""
        echo "🔒 HTTPS 模式需要 SSL 证书"
        
        if [[ -f certs/server.crt && -f certs/server.key ]]; then
            echo "✅ 检测到现有 SSL 证书"
            USE_EXISTING_CERT=true
        else
            USE_EXISTING_CERT=false
        fi
        
        if [[ $USE_EXISTING_CERT == "false" ]]; then
            echo ""
            echo "📋 SSL 证书选项:"
            echo "1) 自动获取 Let's Encrypt 证书 (需要域名)"
            echo "2) 生成自签名证书 (仅用于测试)"
            echo "3) 稍后手动配置证书"
            
            read -p "请选择 [1-3]: " SSL_OPTION
            
            case $SSL_OPTION in
                1)
                    if [[ $RUN_AS_ROOT == "true" ]]; then
                        ./setup-ssl.sh
                    else
                        echo "❌ Let's Encrypt 证书需要 root 权限"
                        echo "💡 请使用: sudo ./setup-ssl.sh"
                        exit 1
                    fi
                    ;;
                2)
                    echo "🔧 生成自签名证书..."
                    openssl req -x509 -newkey rsa:2048 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj "/C=CN/ST=State/L=City/O=Organization/CN=localhost"
                    chmod 644 certs/server.crt
                    chmod 600 certs/server.key
                    echo "✅ 自签名证书生成完成"
                    ;;
                3)
                    echo "⏭️  跳过证书配置"
                    echo "💡 稍后请将证书文件放置到:"
                    echo "   - certs/server.crt (证书文件)"
                    echo "   - certs/server.key (私钥文件)"
                    exit 0
                    ;;
            esac
        fi
        
        if [[ -f certs/server.crt && -f certs/server.key ]]; then
            if [[ $HTTPS_PORT_OK == "true" ]]; then
                echo ""
                echo "🎯 启动 HTTPS 服务..."
                echo "管理地址: https://$(hostname -I | awk '{print $1}'):8443"
                echo "按 Ctrl+C 可停止服务"
                echo ""
                ./start-https.sh
            else
                echo "❌ 端口 8443 被占用，无法启动 HTTPS 服务"
            fi
        else
            echo "❌ SSL 证书配置失败"
        fi
        ;;
    
    3)
        echo ""
        echo "✅ 安装完成！"
        echo ""
        echo "📋 下一步操作:"
        echo "  HTTP 模式:  ./start.sh"
        echo "  HTTPS 模式: ./start-https.sh"
        echo "  SSL 配置:   sudo ./setup-ssl.sh"
        echo ""
        echo "📖 详细说明: cat README.md"
        ;;
    
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo "🎉 ELonTalk 客服系统安装完成！"