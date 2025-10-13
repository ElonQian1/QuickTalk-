#!/bin/bash

# ==============================================
# ELonTalk 系统全面诊断工具 v2.0
# ==============================================

echo "🔍 ELonTalk 系统全面诊断"
echo "=============================================="
echo "⏰ 诊断时间: $(date '+%Y-%m-%d %H:%M:%S')"

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEPLOY_DIR"

# 创建诊断报告文件
REPORT_FILE="diagnostic-report-$(date +%Y%m%d_%H%M%S).txt"

# 记录诊断信息的函数
log_info() {
    echo "$1" | tee -a "$REPORT_FILE"
}

log_info "# ELonTalk 系统诊断报告"
log_info "# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')"
log_info "# 部署目录: $DEPLOY_DIR"
log_info ""

# ============================================
# 1. 系统环境检查
# ============================================

log_info "## 1. 系统环境"
log_info "=============================================="

# 操作系统信息
if [ -f /etc/os-release ]; then
    os_info=$(grep PRETTY_NAME /etc/os-release | cut -d'"' -f2)
    log_info "操作系统: $os_info"
else
    log_info "操作系统: $(uname -a)"
fi

# 系统资源
log_info "CPU核心数: $(nproc)"
if command -v free >/dev/null 2>&1; then
    memory_info=$(free -h | grep "Mem:" | awk '{print $2}')
    log_info "内存总量: $memory_info"
fi

if command -v df >/dev/null 2>&1; then
    disk_info=$(df -h . | tail -1 | awk '{print $4}')
    log_info "磁盘可用: $disk_info"
fi

# 网络配置
server_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "未知")
log_info "服务器IP: $server_ip"

local_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "未知")
log_info "本地IP: $local_ip"

log_info ""

# ============================================
# 2. 文件系统检查
# ============================================

log_info "## 2. 文件系统检查"
log_info "=============================================="

# 核心文件检查
files_to_check=(
    "customer-service-backend"
    ".env"
    "database_schema.sql"
    "start.sh"
    "static/index.html"
)

for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        file_size=$(ls -lh "$file" | awk '{print $5}')
        file_perm=$(ls -l "$file" | awk '{print $1}')
        log_info "✅ $file ($file_size, $file_perm)"
    else
        log_info "❌ $file (缺失)"
    fi
done

# 数据库文件特殊检查
if [ -f "customer_service.db" ]; then
    db_size=$(stat -c%s "customer_service.db" 2>/dev/null || stat -f%z "customer_service.db" 2>/dev/null || echo "0")
    db_size_human=$(ls -lh "customer_service.db" | awk '{print $5}')
    
    if [ "$db_size" -eq 0 ]; then
        log_info "🚨 customer_service.db ($db_size_human) - 空文件"
    elif [ "$db_size" -lt 1024 ]; then
        log_info "⚠️  customer_service.db ($db_size_human) - 文件过小"
    else
        log_info "✅ customer_service.db ($db_size_human) - 正常"
        
        # 数据库内容检查
        if command -v sqlite3 >/dev/null 2>&1; then
            table_count=$(sqlite3 "customer_service.db" ".tables" 2>/dev/null | wc -w || echo "0")
            log_info "   📋 数据库表数量: $table_count"
            
            if [ "$table_count" -gt 0 ]; then
                # 检查关键表
                tables=$(sqlite3 "customer_service.db" ".tables" 2>/dev/null)
                for table in users shops customers sessions messages; do
                    if echo "$tables" | grep -q "$table"; then
                        row_count=$(sqlite3 "customer_service.db" "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "ERROR")
                        log_info "   📊 $table: $row_count 行"
                    else
                        log_info "   ❌ $table: 缺失"
                    fi
                done
            fi
        fi
    fi
else
    log_info "❌ customer_service.db (不存在)"
fi

# 证书文件检查
if [ -d "certs" ]; then
    if [ -f "certs/server.crt" ] && [ -f "certs/server.key" ]; then
        cert_size=$(ls -lh certs/server.crt | awk '{print $5}')
        key_size=$(ls -lh certs/server.key | awk '{print $5}')
        log_info "✅ SSL证书 (crt: $cert_size, key: $key_size)"
        
        if command -v openssl >/dev/null 2>&1; then
            cert_dates=$(openssl x509 -in certs/server.crt -noout -dates 2>/dev/null | tr '\n' ' ')
            log_info "   📅 $cert_dates"
        fi
    else
        log_info "❌ SSL证书 (缺失)"
    fi
else
    log_info "❌ certs/ 目录 (不存在)"
fi

log_info ""

# ============================================
# 3. 服务进程检查
# ============================================

log_info "## 3. 服务进程检查"
log_info "=============================================="

# 检查ELonTalk进程
backend_pids=$(pgrep -f customer-service-backend || echo "")
if [ -n "$backend_pids" ]; then
    log_info "✅ ELonTalk服务运行中"
    for pid in $backend_pids; do
        if command -v ps >/dev/null 2>&1; then
            start_time=$(ps -p "$pid" -o lstart= 2>/dev/null | xargs || echo "未知")
            cpu_mem=$(ps -p "$pid" -o %cpu,%mem --no-headers 2>/dev/null || echo "未知")
            log_info "   PID $pid: 启动于 $start_time, CPU/MEM: $cpu_mem"
        fi
    done
else
    log_info "❌ ELonTalk服务未运行"
fi

# 检查systemd服务状态
service_names=("elontalk-customer-service" "customer-service")
for service in "${service_names[@]}"; do
    if systemctl list-unit-files | grep -q "$service"; then
        status=$(systemctl is-active "$service" 2>/dev/null || echo "inactive")
        enabled=$(systemctl is-enabled "$service" 2>/dev/null || echo "disabled")
        log_info "📋 systemd $service: $status, $enabled"
    fi
done

log_info ""

# ============================================
# 4. 网络端口检查
# ============================================

log_info "## 4. 网络端口检查"
log_info "=============================================="

# 读取配置文件获取端口
if [ -f ".env" ]; then
    source .env 2>/dev/null
fi

http_port=${SERVER_PORT:-8080}
https_port=${TLS_PORT:-8443}

check_port_status() {
    local port=$1
    local name=$2
    
    if command -v netstat >/dev/null 2>&1; then
        port_info=$(netstat -ln 2>/dev/null | grep ":$port " | head -1)
    elif command -v ss >/dev/null 2>&1; then
        port_info=$(ss -ln 2>/dev/null | grep ":$port " | head -1)
    else
        port_info=""
    fi
    
    if [ -n "$port_info" ]; then
        log_info "✅ $name 端口 $port: 监听中"
        log_info "   $port_info"
    else
        log_info "❌ $name 端口 $port: 未监听"
    fi
}

check_port_status "$http_port" "HTTP"
check_port_status "$https_port" "HTTPS"

# 检查防火墙状态
if command -v ufw >/dev/null 2>&1; then
    ufw_status=$(ufw status 2>/dev/null | head -1)
    log_info "🔥 UFW: $ufw_status"
elif command -v firewall-cmd >/dev/null 2>&1; then
    if systemctl is-active --quiet firewalld; then
        log_info "🔥 Firewalld: 活动"
    else
        log_info "🔥 Firewalld: 非活动"
    fi
else
    log_info "🔥 防火墙: 未检测到"
fi

log_info ""

# ============================================
# 5. API连接测试
# ============================================

log_info "## 5. API连接测试"
log_info "=============================================="

if command -v curl >/dev/null 2>&1 && [ -n "$backend_pids" ]; then
    # 测试健康检查
    health_response=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:$http_port/health" 2>/dev/null || echo "000")
    log_info "🔗 Health检查: HTTP $health_response"
    
    # 测试静态文件
    static_response=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:$http_port/" 2>/dev/null || echo "000")
    log_info "🔗 静态文件: HTTP $static_response"
    
    # 测试API端点
    auth_response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" \
        -d '{"username":"test","password":"test"}' \
        -o /dev/null "http://localhost:$http_port/api/auth/login" 2>/dev/null || echo "000")
    log_info "🔗 登录API: HTTP $auth_response"
    
    case $auth_response in
        "401"|"400")
            log_info "   ✅ API正常 (认证错误是预期的)"
            ;;
        "500")
            log_info "   ❌ API内部错误 - 可能是数据库问题"
            ;;
        "000")
            log_info "   ❌ 无法连接API"
            ;;
        *)
            log_info "   ⚠️  API响应异常"
            ;;
    esac
    
    # HTTPS测试 (如果有证书)
    if [ -f "certs/server.crt" ]; then
        https_response=$(curl -s -k -w "%{http_code}" -o /dev/null "https://localhost:$https_port/" 2>/dev/null || echo "000")
        log_info "🔐 HTTPS测试: HTTP $https_response"
    fi
    
else
    if [ -z "$backend_pids" ]; then
        log_info "⏸️  服务未运行，跳过API测试"
    else
        log_info "⚠️  curl未安装，跳过API测试"
    fi
fi

log_info ""

# ============================================
# 6. 配置文件检查
# ============================================

log_info "## 6. 配置文件检查"
log_info "=============================================="

if [ -f ".env" ]; then
    log_info "✅ .env 配置文件存在"
    
    # 检查关键配置项
    config_items=("SERVER_PORT" "TLS_PORT" "TLS_DOMAIN" "DATABASE_URL" "RUST_LOG")
    for item in "${config_items[@]}"; do
        if grep -q "^$item=" ".env" 2>/dev/null; then
            value=$(grep "^$item=" ".env" | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//')
            if [ ${#value} -gt 50 ]; then
                value="${value:0:47}..."
            fi
            log_info "   ✅ $item=$value"
        else
            log_info "   ⚠️  $item (未设置)"
        fi
    done
else
    log_info "❌ .env 配置文件缺失"
fi

log_info ""

# ============================================
# 7. 日志文件检查
# ============================================

log_info "## 7. 日志文件检查"
log_info "=============================================="

# 检查各种可能的日志文件
log_files=("*.log" "logs/*.log" "nohup.out")

found_logs=false
for pattern in "${log_files[@]}"; do
    for logfile in $pattern; do
        if [ -f "$logfile" ]; then
            file_size=$(ls -lh "$logfile" | awk '{print $5}')
            file_mtime=$(ls -l "$logfile" | awk '{print $6" "$7" "$8}')
            log_info "📋 $logfile ($file_size, 修改: $file_mtime)"
            
            # 显示最后几行日志
            if [ -s "$logfile" ]; then
                log_info "   最后几行内容:"
                tail -3 "$logfile" 2>/dev/null | while read line; do
                    log_info "   > $line"
                done
            fi
            found_logs=true
        fi
    done
done

if [ "$found_logs" = false ]; then
    log_info "📋 未找到日志文件"
fi

# systemd日志检查
for service in "elontalk-customer-service" "customer-service"; do
    if systemctl list-unit-files | grep -q "$service"; then
        log_info "📋 systemd $service 最近日志:"
        journalctl -u "$service" --no-pager -n 3 2>/dev/null | tail -3 | while read line; do
            log_info "   > $line"
        done
    fi
done

log_info ""

# ============================================
# 8. 性能和资源使用
# ============================================

log_info "## 8. 性能和资源使用"
log_info "=============================================="

# 系统负载
if command -v uptime >/dev/null 2>&1; then
    load_info=$(uptime | sed 's/.*load average: //')
    log_info "📊 系统负载: $load_info"
fi

# 磁盘使用
disk_usage=$(df -h . | tail -1 | awk '{print "使用 "$3"/"$2" ("$5")"}')
log_info "💾 磁盘使用: $disk_usage"

# 内存使用
if command -v free >/dev/null 2>&1; then
    mem_usage=$(free -m | grep "Mem:" | awk '{printf "使用 %dMB/%dMB (%.1f%%)", $3, $2, $3*100/$2}')
    log_info "🧠 内存使用: $mem_usage"
fi

# 进程资源使用
if [ -n "$backend_pids" ]; then
    for pid in $backend_pids; do
        if command -v ps >/dev/null 2>&1; then
            ps_info=$(ps -p "$pid" -o pid,pcpu,pmem,rss,vsz --no-headers 2>/dev/null)
            if [ -n "$ps_info" ]; then
                log_info "🎯 进程 $pid: $ps_info"
            fi
        fi
    done
fi

log_info ""

# ============================================
# 9. 诊断总结和建议
# ============================================

log_info "## 9. 诊断总结和建议"
log_info "=============================================="

# 收集问题
issues=()
recommendations=()

# 检查各种问题
if [ ! -f "customer-service-backend" ]; then
    issues+=("缺少可执行文件")
    recommendations+=("重新编译或复制可执行文件")
fi

if [ ! -f ".env" ]; then
    issues+=("缺少配置文件")
    recommendations+=("复制 .env.example 到 .env")
fi

if [ -f "customer_service.db" ]; then
    db_size=$(stat -c%s "customer_service.db" 2>/dev/null || stat -f%z "customer_service.db" 2>/dev/null || echo "0")
    if [ "$db_size" -eq 0 ]; then
        issues+=("数据库文件为空")
        recommendations+=("运行 ./fix-database.sh 修复数据库")
    fi
else
    issues+=("数据库文件不存在")
    recommendations+=("启动服务创建数据库或运行 ./fix-database.sh")
fi

if [ -z "$backend_pids" ]; then
    issues+=("服务未运行")
    recommendations+=("运行 ./start.sh 启动服务")
fi

# 输出诊断结果
if [ ${#issues[@]} -eq 0 ]; then
    log_info "🎉 系统状态良好，未发现明显问题"
else
    log_info "🚨 发现以下问题:"
    for i in "${!issues[@]}"; do
        log_info "   $((i+1)). ${issues[$i]}"
    done
    
    log_info ""
    log_info "💡 建议的解决方案:"
    for i in "${!recommendations[@]}"; do
        log_info "   $((i+1)). ${recommendations[$i]}"
    done
fi

log_info ""
log_info "🔧 常用修复命令:"
log_info "   数据库修复: ./fix-database.sh"
log_info "   服务重启: ./restart.sh"
log_info "   证书生成: ./generate-cert.sh"
log_info "   系统服务: sudo ./install-service.sh"
log_info "   SSL配置: sudo ./setup-ssl.sh"

log_info ""
log_info "📋 更多诊断:"
log_info "   数据库检查: ./check-database.sh"
log_info "   部署验证: ./verify-deployment.sh"

echo ""
echo "📄 诊断报告已保存到: $REPORT_FILE"
echo ""
echo "🔍 诊断完成！"

# 如果有严重问题，提示用户
if [ ${#issues[@}} -gt 0 ]; then
    echo "⚠️  发现 ${#issues[@]} 个问题，请查看报告并执行建议的修复操作"
    exit 1
else
    echo "✅ 系统状态良好"
    exit 0
fi