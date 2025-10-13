#!/bin/bash

# ==============================================
# ELonTalk 部署后验证脚本 v2.0
# ==============================================

echo "🔍 ELonTalk 部署后验证"
echo "=============================================="
echo "⏰ 验证时间: $(date '+%Y-%m-%d %H:%M:%S')"

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEPLOY_DIR"

# 验证结果统计
total_checks=0
passed_checks=0
warnings=0
errors=0

# 检查函数
check_result() {
    local status=$1
    local message=$2
    local is_critical=${3:-true}
    
    ((total_checks++))
    
    case $status in
        "pass")
            echo "✅ $message"
            ((passed_checks++))
            ;;
        "warn")
            echo "⚠️  $message"
            ((warnings++))
            ;;
        "fail")
            echo "❌ $message"
            if [ "$is_critical" = true ]; then
                ((errors++))
            else
                ((warnings++))
            fi
            ;;
    esac
}

# ============================================
# 1. 核心文件验证
# ============================================

echo ""
echo "📁 1. 核心文件验证"
echo "----------------------------------------------"

# 可执行文件
if [ -f "customer-service-backend" ] && [ -x "customer-service-backend" ]; then
    file_size=$(ls -lh customer-service-backend | awk '{print $5}')
    check_result "pass" "可执行文件存在且可执行 ($file_size)"
else
    check_result "fail" "可执行文件缺失或不可执行"
fi

# 配置文件
if [ -f ".env" ]; then
    check_result "pass" "配置文件 .env 存在"
    
    # 检查关键配置项
    required_configs=("DATABASE_URL" "RUST_LOG")
    for config in "${required_configs[@]}"; do
        if grep -q "^$config=" ".env"; then
            check_result "pass" "配置项 $config 已设置"
        else
            check_result "warn" "配置项 $config 未设置，将使用默认值"
        fi
    done
else
    if [ -f ".env.example" ]; then
        check_result "warn" "配置文件缺失，但存在示例文件"
    else
        check_result "fail" "配置文件和示例文件都缺失"
    fi
fi

# 数据库架构文件
if [ -f "database_schema.sql" ]; then
    schema_size=$(ls -lh database_schema.sql | awk '{print $5}')
    check_result "pass" "数据库架构文件存在 ($schema_size)"
else
    check_result "warn" "数据库架构文件缺失" false
fi

# 前端静态文件
if [ -d "static" ] && [ -f "static/index.html" ]; then
    static_files=$(find static -type f | wc -l)
    check_result "pass" "前端静态文件存在 ($static_files 个文件)"
else
    check_result "fail" "前端静态文件缺失"
fi

# ============================================
# 2. 启动脚本验证
# ============================================

echo ""
echo "🚀 2. 启动脚本验证"
echo "----------------------------------------------"

startup_scripts=("start.sh" "start-https.sh" "start-http.sh" "restart.sh")
for script in "${startup_scripts[@]}"; do
    if [ -f "$script" ] && [ -x "$script" ]; then
        check_result "pass" "$script 存在且可执行"
    else
        check_result "fail" "$script 缺失或不可执行"
    fi
done

# ============================================
# 3. 管理工具验证
# ============================================

echo ""
echo "🔧 3. 管理工具验证"
echo "----------------------------------------------"

management_scripts=(
    "diagnose.sh:系统诊断"
    "check-database.sh:数据库检查"
    "fix-database.sh:数据库修复"
    "generate-cert.sh:证书生成"
    "setup-ssl.sh:SSL配置"
    "install-service.sh:服务安装"
)

for script_info in "${management_scripts[@]}"; do
    script=$(echo "$script_info" | cut -d':' -f1)
    desc=$(echo "$script_info" | cut -d':' -f2)
    
    if [ -f "$script" ] && [ -x "$script" ]; then
        check_result "pass" "$desc脚本 ($script)"
    else
        check_result "warn" "$desc脚本 ($script) 缺失" false
    fi
done

# ============================================
# 4. 数据库状态验证
# ============================================

echo ""
echo "🗃️  4. 数据库状态验证"
echo "----------------------------------------------"

if [ -f "customer_service.db" ]; then
    db_size=$(stat -c%s "customer_service.db" 2>/dev/null || stat -f%z "customer_service.db" 2>/dev/null || echo "0")
    db_size_human=$(ls -lh "customer_service.db" | awk '{print $5}')
    
    if [ "$db_size" -eq 0 ]; then
        check_result "fail" "数据库文件为空 ($db_size_human)"
    elif [ "$db_size" -lt 1024 ]; then
        check_result "warn" "数据库文件过小 ($db_size_human)"
    else
        check_result "pass" "数据库文件大小正常 ($db_size_human)"
        
        # 检查数据库完整性
        if command -v sqlite3 >/dev/null 2>&1; then
            if sqlite3 "customer_service.db" "PRAGMA integrity_check;" 2>/dev/null | grep -q "ok"; then
                check_result "pass" "数据库完整性验证通过"
            else
                check_result "fail" "数据库完整性验证失败"
            fi
            
            # 检查表结构
            table_count=$(sqlite3 "customer_service.db" ".tables" 2>/dev/null | wc -w || echo "0")
            if [ "$table_count" -gt 0 ]; then
                check_result "pass" "数据库包含 $table_count 个表"
                
                # 检查关键表
                required_tables=("users" "shops" "customers" "sessions" "messages")
                for table in "${required_tables[@]}"; do
                    if sqlite3 "customer_service.db" ".tables" 2>/dev/null | grep -q "$table"; then
                        row_count=$(sqlite3 "customer_service.db" "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "ERROR")
                        if [ "$row_count" != "ERROR" ]; then
                            check_result "pass" "表 $table 存在 ($row_count 行)"
                        else
                            check_result "fail" "表 $table 查询失败"
                        fi
                    else
                        check_result "fail" "关键表 $table 缺失"
                    fi
                done
            else
                check_result "fail" "数据库无表结构"
            fi
        else
            check_result "warn" "sqlite3 未安装，跳过数据库内容检查" false
        fi
    fi
else
    check_result "warn" "数据库文件不存在 (将在首次启动时创建)" false
fi

# ============================================
# 5. SSL证书验证
# ============================================

echo ""
echo "🔐 5. SSL证书验证"
echo "----------------------------------------------"

if [ -d "certs" ]; then
    check_result "pass" "证书目录存在"
    
    if [ -f "certs/server.crt" ] && [ -f "certs/server.key" ]; then
        cert_size=$(ls -lh certs/server.crt | awk '{print $5}')
        key_size=$(ls -lh certs/server.key | awk '{print $5}')
        check_result "pass" "SSL证书文件存在 (crt: $cert_size, key: $key_size)"
        
        # 检查文件权限
        cert_perm=$(ls -l certs/server.crt | awk '{print $1}')
        key_perm=$(ls -l certs/server.key | awk '{print $1}')
        
        if [[ "$key_perm" =~ ^-rw------- ]]; then
            check_result "pass" "私钥文件权限正确 ($key_perm)"
        else
            check_result "warn" "私钥文件权限不安全 ($key_perm)"
        fi
        
        # 验证证书格式
        if command -v openssl >/dev/null 2>&1; then
            if openssl x509 -in certs/server.crt -noout 2>/dev/null; then
                check_result "pass" "证书格式验证通过"
                
                # 检查证书有效期
                not_after=$(openssl x509 -in certs/server.crt -noout -enddate 2>/dev/null | cut -d= -f2)
                if [ -n "$not_after" ]; then
                    exp_date=$(date -d "$not_after" +%s 2>/dev/null)
                    current_date=$(date +%s)
                    days_left=$(( (exp_date - current_date) / 86400 ))
                    
                    if [ "$days_left" -gt 30 ]; then
                        check_result "pass" "证书有效期充足 ($days_left 天)"
                    elif [ "$days_left" -gt 0 ]; then
                        check_result "warn" "证书即将过期 ($days_left 天)"
                    else
                        check_result "fail" "证书已过期"
                    fi
                fi
            else
                check_result "fail" "证书格式验证失败"
            fi
        else
            check_result "warn" "openssl 未安装，跳过证书验证" false
        fi
    else
        check_result "warn" "SSL证书文件缺失 (可使用 ./generate-cert.sh 生成)" false
    fi
else
    check_result "warn" "证书目录不存在 (可使用 ./generate-cert.sh 创建)" false
fi

# ============================================
# 6. 服务运行验证
# ============================================

echo ""
echo "🔄 6. 服务运行验证"
echo "----------------------------------------------"

# 检查进程
backend_pids=$(pgrep -f customer-service-backend || echo "")
if [ -n "$backend_pids" ]; then
    pid_count=$(echo "$backend_pids" | wc -w)
    check_result "pass" "ELonTalk服务运行中 ($pid_count 个进程)"
    
    # 检查进程状态
    for pid in $backend_pids; do
        if kill -0 "$pid" 2>/dev/null; then
            start_time=$(ps -p "$pid" -o lstart= 2>/dev/null | xargs || echo "未知")
            check_result "pass" "进程 $pid 正常 (启动: $start_time)"
        else
            check_result "warn" "进程 $pid 状态异常"
        fi
    done
else
    check_result "warn" "ELonTalk服务未运行" false
fi

# 检查systemd服务
service_names=("elontalk-customer-service" "customer-service")
systemd_found=false

for service in "${service_names[@]}"; do
    if systemctl list-unit-files 2>/dev/null | grep -q "^$service"; then
        systemd_found=true
        status=$(systemctl is-active "$service" 2>/dev/null)
        enabled=$(systemctl is-enabled "$service" 2>/dev/null)
        
        if [ "$status" = "active" ]; then
            check_result "pass" "systemd服务 $service 运行中 ($enabled)"
        else
            check_result "warn" "systemd服务 $service 未运行 ($status, $enabled)" false
        fi
    fi
done

if [ "$systemd_found" = false ]; then
    check_result "warn" "未找到systemd服务配置 (可运行 sudo ./install-service.sh)" false
fi

# ============================================
# 7. 网络连接验证
# ============================================

echo ""
echo "🌐 7. 网络连接验证"
echo "----------------------------------------------"

# 读取端口配置
if [ -f ".env" ]; then
    source .env 2>/dev/null
fi

http_port=${SERVER_PORT:-8080}
https_port=${TLS_PORT:-8443}

# 端口监听检查
check_port_listening() {
    local port=$1
    local name=$2
    
    if command -v netstat >/dev/null 2>&1; then
        if netstat -ln 2>/dev/null | grep -q ":$port "; then
            check_result "pass" "$name 端口 $port 正在监听"
            return 0
        fi
    elif command -v ss >/dev/null 2>&1; then
        if ss -ln 2>/dev/null | grep -q ":$port "; then
            check_result "pass" "$name 端口 $port 正在监听"
            return 0
        fi
    fi
    
    check_result "fail" "$name 端口 $port 未监听"
    return 1
}

http_listening=false
https_listening=false

if check_port_listening "$http_port" "HTTP"; then
    http_listening=true
fi

if [ -f "certs/server.crt" ]; then
    if check_port_listening "$https_port" "HTTPS"; then
        https_listening=true
    fi
else
    check_result "warn" "HTTPS 端口 $https_port 未配置 (无证书)" false
fi

# API连接测试
if [ "$http_listening" = true ] && command -v curl >/dev/null 2>&1; then
    echo ""
    echo "🔗 API连接测试:"
    
    # 测试静态文件
    static_response=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:$http_port/" 2>/dev/null || echo "000")
    if [ "$static_response" = "200" ]; then
        check_result "pass" "静态文件访问正常 (HTTP $static_response)"
    else
        check_result "warn" "静态文件访问异常 (HTTP $static_response)"
    fi
    
    # 测试API端点
    auth_response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" \
        -d '{"username":"test","password":"test"}' \
        -o /dev/null "http://localhost:$http_port/api/auth/login" 2>/dev/null || echo "000")
    
    case $auth_response in
        "401"|"400")
            check_result "pass" "API端点正常 (HTTP $auth_response - 认证错误预期)"
            ;;
        "500")
            check_result "fail" "API内部错误 (HTTP $auth_response - 可能是数据库问题)"
            ;;
        "000")
            check_result "fail" "API连接失败"
            ;;
        *)
            check_result "warn" "API响应异常 (HTTP $auth_response)"
            ;;
    esac
    
    # HTTPS测试
    if [ "$https_listening" = true ]; then
        https_response=$(curl -s -k -w "%{http_code}" -o /dev/null "https://localhost:$https_port/" 2>/dev/null || echo "000")
        if [ "$https_response" = "200" ]; then
            check_result "pass" "HTTPS访问正常 (HTTP $https_response)"
        else
            check_result "warn" "HTTPS访问异常 (HTTP $https_response)"
        fi
    fi
else
    check_result "warn" "跳过API连接测试 (服务未运行或curl未安装)" false
fi

# ============================================
# 8. 验证总结
# ============================================

echo ""
echo "📊 验证总结"
echo "=============================================="
echo "总检查项: $total_checks"
echo "通过: $passed_checks"
echo "警告: $warnings" 
echo "错误: $errors"

success_rate=$(( (passed_checks * 100) / total_checks ))
echo "成功率: $success_rate%"

echo ""

if [ "$errors" -eq 0 ] && [ "$warnings" -eq 0 ]; then
    echo "🎉 完美！所有验证项都通过了"
    validation_status="perfect"
elif [ "$errors" -eq 0 ]; then
    echo "✅ 验证通过！有一些可选的改进建议"
    validation_status="good"
elif [ "$errors" -le 2 ]; then
    echo "⚠️  验证基本通过，但有一些需要修复的问题"
    validation_status="acceptable"
else
    echo "❌ 验证失败，发现多个严重问题需要修复"
    validation_status="failed"
fi

# ============================================
# 9. 修复建议
# ============================================

if [ "$errors" -gt 0 ] || [ "$warnings" -gt 0 ]; then
    echo ""
    echo "🔧 修复建议"
    echo "=============================================="
    
    if [ "$errors" -gt 0 ]; then
        echo "🚨 需要立即修复的问题:"
        echo "   1. 运行完整诊断: ./diagnose.sh"
        echo "   2. 修复数据库问题: ./fix-database.sh"
        echo "   3. 重新启动服务: ./restart.sh"
    fi
    
    if [ "$warnings" -gt 0 ]; then
        echo ""
        echo "💡 可选的改进建议:"
        echo "   • 生成SSL证书: ./generate-cert.sh"
        echo "   • 安装系统服务: sudo ./install-service.sh"
        echo "   • 配置Let's Encrypt: sudo ./setup-ssl.sh"
    fi
fi

# ============================================
# 10. 访问信息
# ============================================

echo ""
echo "🔗 访问信息"
echo "=============================================="

# 获取服务器IP
server_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")

if [ "$http_listening" = true ] || [ "$https_listening" = true ]; then
    echo "🌐 服务访问地址:"
    
    if [ "$http_listening" = true ]; then
        echo "   HTTP:  http://$server_ip:$http_port"
        echo "   HTTP (本地): http://localhost:$http_port"
    fi
    
    if [ "$https_listening" = true ]; then
        domain=${TLS_DOMAIN:-$server_ip}
        echo "   HTTPS: https://$domain:$https_port"
        echo "   HTTPS (本地): https://localhost:$https_port"
    fi
else
    echo "⚠️  服务未运行，请先启动服务"
    echo "   启动命令: ./start.sh"
fi

echo ""
echo "📋 管理命令:"
echo "   状态检查: ./check-database.sh"
echo "   系统诊断: ./diagnose.sh"
echo "   服务重启: ./restart.sh"

# 设置退出代码
case $validation_status in
    "perfect"|"good")
        echo ""
        echo "✅ 部署验证完成 - 系统就绪！"
        exit 0
        ;;
    "acceptable")
        echo ""
        echo "⚠️  部署验证完成 - 需要一些修复"
        exit 1
        ;;
    "failed")
        echo ""
        echo "❌ 部署验证失败 - 需要重大修复"
        exit 2
        ;;
esac