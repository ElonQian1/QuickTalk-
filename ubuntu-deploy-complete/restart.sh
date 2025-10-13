#!/bin/bash

# ==============================================
# ELonTalk 服务重启脚本
# ==============================================

echo "🔄 ELonTalk 服务重启"
echo "=============================================="
echo "⏰ 重启时间: $(date '+%Y-%m-%d %H:%M:%S')"

# 读取配置
if [ -f ".env" ]; then
    source .env
fi
port=${SERVER_PORT:-8080}
tls_port=${TLS_PORT:-8443}

# 1. 停止现有服务
echo ""
echo "🛑 停止现有服务..."

# 查找并停止后端进程
backend_pids=$(pgrep -f customer-service-backend || echo "")
if [ -n "$backend_pids" ]; then
    echo "🔍 发现运行中的后端进程: $backend_pids"
    
    # 优雅停止
    echo "📤 发送停止信号..."
    kill $backend_pids 2>/dev/null
    
    # 等待进程停止
    echo "⏳ 等待进程停止..."
    for i in {1..10}; do
        remaining_pids=$(pgrep -f customer-service-backend || echo "")
        if [ -z "$remaining_pids" ]; then
            echo "✅ 服务已正常停止"
            break
        fi
        sleep 1
        printf "."
    done
    printf "\n"
    
    # 强制停止仍在运行的进程
    remaining_pids=$(pgrep -f customer-service-backend || echo "")
    if [ -n "$remaining_pids" ]; then
        echo "⚠️  强制停止剩余进程: $remaining_pids"
        kill -9 $remaining_pids 2>/dev/null
        sleep 2
        
        final_check=$(pgrep -f customer-service-backend || echo "")
        if [ -z "$final_check" ]; then
            echo "✅ 所有进程已停止"
        else
            echo "❌ 无法停止某些进程: $final_check"
        fi
    fi
else
    echo "ℹ️  没有运行中的后端进程"
fi

# 检查端口占用
echo ""
echo "🔍 检查端口占用..."

check_port() {
    local port_num=$1
    local port_name=$2
    
    if command -v netstat >/dev/null 2>&1; then
        port_proc=$(netstat -tlnp 2>/dev/null | grep ":$port_num ")
    elif command -v ss >/dev/null 2>&1; then
        port_proc=$(ss -tlnp 2>/dev/null | grep ":$port_num ")
    else
        port_proc=""
    fi
    
    if [ -n "$port_proc" ]; then
        echo "⚠️  $port_name端口 $port_num 仍被占用:"
        echo "   $port_proc"
        
        # 尝试释放端口
        if command -v fuser >/dev/null 2>&1; then
            echo "🔧 尝试释放端口..."
            fuser -k "$port_num/tcp" 2>/dev/null || true
            sleep 2
        fi
    else
        echo "✅ $port_name端口 $port_num 已释放"
    fi
}

check_port $port "HTTP"
check_port $tls_port "HTTPS"

# 2. 清理临时文件
echo ""
echo "🧹 清理临时文件..."

# 清理日志文件 (保留最新的)
if ls *.log >/dev/null 2>&1; then
    log_count=$(ls -1 *.log | wc -l)
    echo "📋 发现 $log_count 个日志文件"
    
    if [ "$log_count" -gt 5 ]; then
        echo "🧹 清理旧日志文件..."
        ls -t *.log | tail -n +6 | xargs rm -f
        echo "✅ 已清理旧日志文件"
    fi
else
    echo "ℹ️  没有日志文件需要清理"
fi

# 清理临时文件
temp_files=("/tmp/api_*.txt" "/tmp/elontalk_*.tmp" "nohup.out")
for pattern in "${temp_files[@]}"; do
    if ls $pattern >/dev/null 2>&1; then
        rm -f $pattern
        echo "🗑️  已清理: $pattern"
    fi
done

# 3. 验证数据库状态
echo ""
echo "🗄️  验证数据库状态..."

if [ -f "customer_service.db" ]; then
    db_size=$(stat -c%s "customer_service.db" 2>/dev/null || stat -f%z "customer_service.db" 2>/dev/null || echo "0")
    db_size_human=$(ls -lh "customer_service.db" | awk '{print $5}')
    
    echo "📊 数据库大小: $db_size_human"
    
    if [ "$db_size" -eq 0 ]; then
        echo "🚨 数据库文件为空，将重新创建"
        rm -f "customer_service.db"
    elif [ "$db_size" -lt 1024 ]; then
        echo "⚠️  数据库文件过小，可能需要修复"
    else
        echo "✅ 数据库文件大小正常"
        
        # 检查数据库完整性
        if command -v sqlite3 >/dev/null 2>&1; then
            echo "🔍 检查数据库完整性..."
            integrity=$(sqlite3 "customer_service.db" "PRAGMA integrity_check;" 2>/dev/null || echo "ERROR")
            if [ "$integrity" = "ok" ]; then
                echo "✅ 数据库完整性验证通过"
            else
                echo "⚠️  数据库完整性验证失败: $integrity"
                echo "💡 重启后会尝试修复数据库"
            fi
        fi
    fi
else
    echo "ℹ️  数据库文件不存在，启动时会自动创建"
fi

# 4. 检查可执行文件
echo ""
echo "🔍 检查可执行文件..."

if [ -f "customer-service-backend" ]; then
    if [ -x "customer-service-backend" ]; then
        file_size=$(ls -lh "customer-service-backend" | awk '{print $5}')
        echo "✅ 可执行文件存在且有执行权限 (大小: $file_size)"
    else
        echo "🔧 设置可执行权限..."
        chmod +x "customer-service-backend"
        echo "✅ 执行权限已设置"
    fi
else
    echo "❌ 可执行文件不存在！"
    echo "💡 请确保已正确部署 customer-service-backend"
    exit 1
fi

# 5. 准备启动环境
echo ""
echo "⚙️  准备启动环境..."

# 检查环境变量
if [ ! -f ".env" ]; then
    echo "⚠️  配置文件不存在，创建默认配置..."
    cat > .env << 'EOF'
# ELonTalk Configuration
DATABASE_URL=sqlite:customer_service.db
RUST_LOG=info
SERVER_PORT=8080
TLS_PORT=8443
EOF
    echo "✅ 默认配置已创建"
fi

# 创建日志目录
if [ ! -d "logs" ]; then
    mkdir -p logs
    echo "📁 创建日志目录"
fi

# 6. 启动服务
echo ""
echo "🚀 启动服务..."

# 生成启动日志文件名
log_file="restart-$(date +%Y%m%d-%H%M%S).log"

echo "📋 启动配置:"
echo "   • HTTP端口: $port"
echo "   • HTTPS端口: $tls_port"
echo "   • 日志文件: $log_file"
echo "   • 数据库: customer_service.db"

# 启动后端服务
echo "⏳ 启动后端服务..."
nohup ./customer-service-backend > "$log_file" 2>&1 &
backend_pid=$!

echo "🆔 服务进程ID: $backend_pid"

# 等待服务启动
echo "⏳ 等待服务启动..."
startup_success=false

for i in {1..30}; do
    sleep 1
    
    # 检查进程是否还在运行
    if ! kill -0 $backend_pid 2>/dev/null; then
        echo "❌ 服务进程意外退出"
        echo "📋 查看启动日志:"
        tail -20 "$log_file" 2>/dev/null
        break
    fi
    
    # 检查端口是否开始监听
    if command -v netstat >/dev/null 2>&1; then
        port_status=$(netstat -ln 2>/dev/null | grep ":$port " || echo "")
    elif command -v ss >/dev/null 2>&1; then
        port_status=$(ss -ln 2>/dev/null | grep ":$port " || echo "")
    else
        port_status=""
    fi
    
    if [ -n "$port_status" ]; then
        echo "✅ 端口 $port 开始监听"
        startup_success=true
        break
    fi
    
    printf "."
done
printf "\n"

# 7. 验证启动状态
echo ""
echo "🔍 验证启动状态..."

if [ "$startup_success" = true ]; then
    # API测试
    if command -v curl >/dev/null 2>&1; then
        echo "📡 测试API连接..."
        
        # 等待API完全就绪
        sleep 3
        
        api_response=$(curl -s -w "%{http_code}" -o /dev/null --max-time 10 "http://localhost:$port/health" 2>/dev/null || echo "000")
        
        case $api_response in
            "200"|"404"|"405")
                echo "✅ API服务正常响应 (状态码: $api_response)"
                restart_success=true
                ;;
            "000")
                echo "⚠️  API连接超时，服务可能仍在初始化"
                restart_success=false
                ;;
            *)
                echo "⚠️  API返回异常状态码: $api_response"
                restart_success=false
                ;;
        esac
    else
        echo "⚠️  curl未安装，跳过API测试"
        restart_success=true
    fi
    
    # 检查数据库是否正确创建
    if [ -f "customer_service.db" ] && [ -s "customer_service.db" ]; then
        new_db_size=$(ls -lh "customer_service.db" | awk '{print $5}')
        echo "✅ 数据库文件正常 (大小: $new_db_size)"
    else
        echo "⚠️  数据库文件异常，可能影响功能"
        restart_success=false
    fi
    
else
    echo "❌ 服务启动失败"
    restart_success=false
    
    echo ""
    echo "📋 启动失败诊断:"
    
    # 检查进程状态
    if kill -0 $backend_pid 2>/dev/null; then
        echo "   • 进程仍在运行，可能正在初始化"
    else
        echo "   • 进程已退出，检查错误日志"
    fi
    
    # 显示最近的日志
    if [ -f "$log_file" ]; then
        echo "   📋 最近的错误日志:"
        tail -10 "$log_file" | sed 's/^/      /'
    fi
fi

# 8. 重启总结
echo ""
echo "📊 重启总结"
echo "=============================================="

if [ "${restart_success:-false}" = true ]; then
    echo "🎉 服务重启成功！"
    echo ""
    echo "✅ 服务状态:"
    echo "   • 进程ID: $backend_pid"
    echo "   • HTTP端口: $port"
    echo "   • HTTPS端口: $tls_port"
    echo "   • 日志文件: $log_file"
    echo ""
    echo "🔗 访问地址:"
    server_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")
    echo "   本地: http://localhost:$port"
    echo "   远程: http://$server_ip:$port"
    
    if [ -f "server.crt" ] && [ -f "server.key" ]; then
        echo "   HTTPS: https://$server_ip:$tls_port"
    fi
    
else
    echo "⚠️  服务重启可能存在问题"
    echo ""
    echo "🔧 建议操作:"
    echo "   1. 查看详细日志: tail -f $log_file"
    echo "   2. 运行诊断工具: ./diagnose.sh"
    echo "   3. 修复500错误: ./fix-500.sh"
    echo "   4. 检查数据库: ./check-database.sh"
fi

echo ""
echo "📋 监控命令:"
echo "   • 查看实时日志: tail -f $log_file"
echo "   • 检查进程状态: ps aux | grep customer-service"
echo "   • 测试API: curl http://localhost:$port/health"
echo "   • 停止服务: kill $backend_pid"

echo ""
echo "🔄 服务重启完成!"

echo "✅ 服务已停止"

# 启动服务
echo ""
echo "🚀 重新启动服务..."
echo "=============================================="

# 使用智能启动脚本
if [ -f "./start.sh" ]; then
    ./start.sh
else
    echo "❌ 错误: 找不到启动脚本 start.sh"
    exit 1
fi