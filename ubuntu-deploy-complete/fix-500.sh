#!/bin/bash

# ==============================================
# ELonTalk 500错误专项修复工具
# ==============================================

echo "🔧 ELonTalk 500错误专项修复"
echo "=============================================="
echo "⏰ 修复时间: $(date '+%Y-%m-%d %H:%M:%S')"

# 读取配置
if [ -f ".env" ]; then
    source .env
fi
port=${SERVER_PORT:-8080}

echo ""
echo "🔍 检测500错误..."

# 测试API是否返回500
if command -v curl >/dev/null 2>&1; then
    echo "📡 测试API端点..."
    
    # 测试登录API
    auth_response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" \
        -d '{"username":"test","password":"test"}' \
        -o /tmp/api_response.txt "http://localhost:$port/api/auth/login" 2>/dev/null || echo "000")
    
    echo "   登录API响应: $auth_response"
    
    if [ "$auth_response" = "500" ]; then
        echo "🚨 确认API返回500错误"
        
        # 显示错误详情
        if [ -f "/tmp/api_response.txt" ]; then
            echo "📋 错误详情:"
            cat /tmp/api_response.txt 2>/dev/null | head -5
        fi
        
        echo ""
        echo "🔧 开始500错误修复流程..."
    elif [ "$auth_response" = "401" ] || [ "$auth_response" = "400" ]; then
        echo "✅ API正常工作 (认证错误是预期的)"
        echo "💡 如果仍有问题，请检查其他API端点"
        exit 0
    elif [ "$auth_response" = "000" ]; then
        echo "❌ 无法连接到服务器"
        echo "💡 请先启动服务: ./start.sh"
        exit 1
    else
        echo "⚠️  API返回异常状态码: $auth_response"
    fi
else
    echo "⚠️  curl未安装，将直接执行修复流程"
fi

# 清理临时文件
rm -f /tmp/api_response.txt

echo ""
echo "🔧 500错误常见原因修复:"

# 1. 数据库问题修复
echo ""
echo "1️⃣  数据库问题诊断与修复"
echo "----------------------------------------------"

if [ -f "customer_service.db" ]; then
    db_size=$(stat -c%s "customer_service.db" 2>/dev/null || stat -f%z "customer_service.db" 2>/dev/null || echo "0")
    db_size_human=$(ls -lh "customer_service.db" | awk '{print $5}')
    
    echo "📊 数据库文件: $db_size_human ($db_size bytes)"
    
    if [ "$db_size" -eq 0 ]; then
        echo "🚨 数据库文件为空 - 这是500错误的主要原因"
        echo "🔧 修复: 重新初始化数据库..."
        
        # 停止服务
        pkill -f customer-service-backend 2>/dev/null || true
        sleep 2
        
        # 删除空数据库
        rm -f "customer_service.db"
        
        # 重启服务让它重新创建
        echo "🚀 重启服务以重新创建数据库..."
        nohup ./customer-service-backend > fix-500.log 2>&1 &
        
        # 等待数据库创建
        echo "⏳ 等待数据库初始化..."
        for i in {1..30}; do
            if [ -f "customer_service.db" ] && [ -s "customer_service.db" ]; then
                new_size=$(ls -lh "customer_service.db" | awk '{print $5}')
                echo "✅ 数据库重新创建完成 (大小: $new_size)"
                break
            fi
            sleep 1
            printf "."
        done
        printf "\n"
        
    elif [ "$db_size" -lt 1024 ]; then
        echo "⚠️  数据库文件过小，可能损坏"
        echo "🔧 修复: 使用数据库修复工具..."
        ./fix-database.sh
        
    else
        echo "📊 数据库文件大小正常"
        
        # 检查数据库完整性
        if command -v sqlite3 >/dev/null 2>&1; then
            echo "🔍 检查数据库完整性..."
            
            integrity=$(sqlite3 "customer_service.db" "PRAGMA integrity_check;" 2>/dev/null || echo "ERROR")
            if [ "$integrity" = "ok" ]; then
                echo "✅ 数据库完整性正常"
                
                # 检查表结构
                tables=$(sqlite3 "customer_service.db" ".tables" 2>/dev/null)
                table_count=$(echo "$tables" | wc -w)
                
                if [ "$table_count" -eq 0 ]; then
                    echo "🚨 数据库无表结构 - 这会导致500错误"
                    echo "🔧 修复: 运行数据库迁移..."
                    ./fix-database.sh
                else
                    echo "✅ 数据库包含 $table_count 个表"
                    
                    # 检查关键表
                    required_tables=("users" "shops" "customers" "sessions" "messages")
                    missing_tables=()
                    
                    for table in "${required_tables[@]}"; do
                        if ! echo "$tables" | grep -q "$table"; then
                            missing_tables+=("$table")
                        fi
                    done
                    
                    if [ ${#missing_tables[@]} -gt 0 ]; then
                        echo "🚨 缺少关键表: ${missing_tables[*]}"
                        echo "🔧 修复: 重新创建表结构..."
                        ./fix-database.sh
                    else
                        echo "✅ 所有关键表都存在"
                    fi
                fi
                
            else
                echo "🚨 数据库完整性验证失败: $integrity"
                echo "🔧 修复: 重建数据库..."
                ./fix-database.sh
            fi
        else
            echo "⚠️  sqlite3 未安装，跳过数据库内容检查"
        fi
    fi
else
    echo "🚨 数据库文件不存在"
    echo "🔧 修复: 启动服务创建数据库..."
    
    # 启动服务
    nohup ./customer-service-backend > fix-500.log 2>&1 &
    
    echo "⏳ 等待数据库创建..."
    for i in {1..30}; do
        if [ -f "customer_service.db" ] && [ -s "customer_service.db" ]; then
            db_size=$(ls -lh "customer_service.db" | awk '{print $5}')
            echo "✅ 数据库创建完成 (大小: $db_size)"
            break
        fi
        sleep 1
        printf "."
    done
    printf "\n"
fi

# 2. 服务进程检查
echo ""
echo "2️⃣  服务进程检查"
echo "----------------------------------------------"

backend_pids=$(pgrep -f customer-service-backend || echo "")
if [ -n "$backend_pids" ]; then
    echo "✅ 服务进程运行中 (PID: $backend_pids)"
else
    echo "🚨 服务进程未运行"
    echo "🔧 修复: 启动服务..."
    nohup ./customer-service-backend > fix-500.log 2>&1 &
    sleep 3
    
    new_pids=$(pgrep -f customer-service-backend || echo "")
    if [ -n "$new_pids" ]; then
        echo "✅ 服务启动成功 (PID: $new_pids)"
    else
        echo "❌ 服务启动失败"
        echo "📋 查看启动日志:"
        tail -20 fix-500.log 2>/dev/null || echo "无日志文件"
    fi
fi

# 3. 端口监听检查
echo ""
echo "3️⃣  端口监听检查"  
echo "----------------------------------------------"

if command -v netstat >/dev/null 2>&1; then
    port_status=$(netstat -ln 2>/dev/null | grep ":$port ")
elif command -v ss >/dev/null 2>&1; then
    port_status=$(ss -ln 2>/dev/null | grep ":$port ")
else
    port_status=""
fi

if [ -n "$port_status" ]; then
    echo "✅ 端口 $port 正在监听"
    echo "   $port_status"
else
    echo "🚨 端口 $port 未监听"
    echo "⚠️  这可能导致连接失败"
fi

# 4. 配置文件检查
echo ""
echo "4️⃣  配置文件检查"
echo "----------------------------------------------"

if [ -f ".env" ]; then
    echo "✅ 配置文件 .env 存在"
    
    # 检查关键配置
    if grep -q "^DATABASE_URL=" ".env"; then
        db_url=$(grep "^DATABASE_URL=" ".env" | cut -d'=' -f2-)
        echo "✅ 数据库URL配置: $db_url"
    else
        echo "⚠️  DATABASE_URL 未配置，使用默认值"
    fi
    
    if grep -q "^RUST_LOG=" ".env"; then
        log_level=$(grep "^RUST_LOG=" ".env" | cut -d'=' -f2-)
        echo "✅ 日志级别配置: $log_level"
    else
        echo "⚠️  RUST_LOG 未配置，使用默认值"
    fi
    
else
    echo "⚠️  配置文件不存在"
    if [ -f ".env.example" ]; then
        echo "🔧 修复: 复制示例配置..."
        cp .env.example .env
        echo "✅ 配置文件已创建"
    else
        echo "🔧 修复: 创建基本配置..."
        cat > .env << 'EOF'
# ELonTalk Configuration
DATABASE_URL=sqlite:customer_service.db
RUST_LOG=info
SERVER_PORT=8080
TLS_PORT=8443
EOF
        echo "✅ 基本配置已创建"
    fi
fi

# 5. 权限检查
echo ""
echo "5️⃣  文件权限检查"
echo "----------------------------------------------"

# 检查可执行文件权限
if [ -x "customer-service-backend" ]; then
    echo "✅ 可执行文件权限正确"
else
    echo "🚨 可执行文件无执行权限"
    echo "🔧 修复: 设置执行权限..."
    chmod +x customer-service-backend
    echo "✅ 执行权限已设置"
fi

# 检查数据库文件权限
if [ -f "customer_service.db" ]; then
    db_perm=$(ls -l "customer_service.db" | awk '{print $1}')
    if [[ "$db_perm" =~ ^-rw-.*-.* ]]; then
        echo "✅ 数据库文件权限正确 ($db_perm)"
    else
        echo "⚠️  数据库文件权限异常 ($db_perm)"
        echo "🔧 修复: 设置数据库权限..."
        chmod 644 customer_service.db
        echo "✅ 数据库权限已修复"
    fi
fi

# 6. 最终API测试
echo ""
echo "6️⃣  修复后API测试"
echo "----------------------------------------------"

if command -v curl >/dev/null 2>&1; then
    echo "⏳ 等待服务完全启动..."
    sleep 5
    
    echo "📡 测试修复后的API..."
    
    # 重新测试API
    final_response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" \
        -d '{"username":"test","password":"test"}' \
        -o /dev/null "http://localhost:$port/api/auth/login" 2>/dev/null || echo "000")
    
    echo "   修复后API响应: $final_response"
    
    case $final_response in
        "401"|"400")
            echo "🎉 修复成功！API现在正常工作"
            echo "   (认证错误是预期的，说明API能正常处理请求)"
            repair_success=true
            ;;
        "500")
            echo "❌ 仍然返回500错误"
            echo "📋 可能需要更深入的诊断:"
            echo "   1. 查看详细日志: tail -f fix-500.log"
            echo "   2. 运行完整诊断: ./diagnose.sh"
            echo "   3. 检查数据库: ./check-database.sh"
            repair_success=false
            ;;
        "000")
            echo "❌ 仍然无法连接"
            echo "💡 检查服务是否真正启动"
            repair_success=false
            ;;
        *)
            echo "⚠️  API返回异常状态: $final_response"
            repair_success=false
            ;;
    esac
    
    # 测试其他端点
    if [ "$repair_success" = true ]; then
        echo ""
        echo "🔍 测试其他API端点..."
        
        # 测试静态文件
        static_response=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:$port/" 2>/dev/null || echo "000")
        echo "   静态文件: $static_response"
        
        # 测试健康检查 
        health_response=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:$port/health" 2>/dev/null || echo "000")
        echo "   健康检查: $health_response"
    fi
else
    echo "⚠️  curl未安装，无法测试API"
    echo "💡 请手动在浏览器中访问: http://localhost:$port"
fi

# 7. 修复总结
echo ""
echo "📊 修复总结"
echo "=============================================="

if [ "${repair_success:-false}" = true ]; then
    echo "🎉 500错误修复成功！"
    echo ""
    echo "✅ 修复完成的项目:"
    echo "   • 数据库状态正常"
    echo "   • 服务进程运行"
    echo "   • API响应正常"
    echo ""
    echo "🔗 访问地址:"
    server_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")
    echo "   本地: http://localhost:$port"
    echo "   远程: http://$server_ip:$port"
    
else
    echo "⚠️  500错误可能仍然存在"
    echo ""
    echo "🔧 建议进一步操作:"
    echo "   1. 运行完整诊断: ./diagnose.sh"
    echo "   2. 查看详细日志: tail -f fix-500.log"
    echo "   3. 完全重建数据库: ./fix-database.sh"
    echo "   4. 重启服务: ./restart.sh"
    echo ""
    echo "📋 如果问题持续存在:"
    echo "   • 检查系统资源 (内存、磁盘空间)"
    echo "   • 查看系统日志: journalctl -f"
    echo "   • 验证可执行文件完整性"
fi

echo ""
echo "📋 后续维护建议:"
echo "   • 定期运行: ./verify-deployment.sh"
echo "   • 监控日志: tail -f *.log"
echo "   • 数据库备份: cp customer_service.db backup/"

echo ""
echo "🔧 500错误修复完成!"