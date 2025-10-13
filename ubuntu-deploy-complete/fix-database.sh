#!/bin/bash

# ==============================================
# ELonTalk 数据库修复工具 v2.0
# ==============================================

echo "🔧 ELonTalk 数据库修复工具"
echo "=============================================="
echo "⏰ 执行时间: $(date '+%Y-%m-%d %H:%M:%S')"

DB_FILE="customer_service.db"
BACKUP_DIR="backups"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 检查当前数据库状态
echo ""
echo "📊 数据库状态检查..."
if [ -f "$DB_FILE" ]; then
    db_size=$(stat -c%s "$DB_FILE" 2>/dev/null || stat -f%z "$DB_FILE" 2>/dev/null || echo "0")
    db_size_human=$(ls -lh "$DB_FILE" 2>/dev/null | awk '{print $5}' || echo "未知")
    
    echo "   文件存在: ✅"
    echo "   文件大小: $db_size_human ($db_size bytes)"
    
    if [ "$db_size" -eq 0 ]; then
        echo "   状态: ❌ 空文件 (需要修复)"
    elif [ "$db_size" -lt 1024 ]; then
        echo "   状态: ⚠️  文件过小 (可能损坏)"
    else
        echo "   状态: ✅ 文件正常"
        
        # 检查表结构
        if command -v sqlite3 >/dev/null 2>&1; then
            table_count=$(sqlite3 "$DB_FILE" ".tables" 2>/dev/null | wc -w || echo "0")
            echo "   表数量: $table_count"
            
            if [ "$table_count" -gt 0 ]; then
                echo "   数据库: ✅ 表结构存在"
                
                # 测试数据库完整性
                integrity_check=$(sqlite3 "$DB_FILE" "PRAGMA integrity_check;" 2>/dev/null || echo "ERROR")
                if [ "$integrity_check" = "ok" ]; then
                    echo "   完整性: ✅ 通过验证"
                else
                    echo "   完整性: ❌ 验证失败"
                fi
            else
                echo "   数据库: ❌ 无表结构"
            fi
        fi
    fi
else
    echo "   文件存在: ❌ 不存在"
    echo "   状态: 需要创建"
fi

# 备份现有数据库（如果存在且有效）
if [ -f "$DB_FILE" ] && [ -s "$DB_FILE" ]; then
    backup_name="$BACKUP_DIR/customer_service.db.backup.$(date +%Y%m%d_%H%M%S)"
    echo ""
    echo "💾 备份现有数据库..."
    if cp "$DB_FILE" "$backup_name"; then
        echo "✅ 备份完成: $backup_name"
    else
        echo "❌ 备份失败"
        exit 1
    fi
fi

# 停止服务
echo ""
echo "⏹️  停止服务..."
pkill -f customer-service-backend 2>/dev/null || true
systemctl stop customer-service 2>/dev/null || true
sleep 2

# 检查服务是否完全停止
if pgrep -f customer-service-backend > /dev/null; then
    echo "⚠️  强制停止服务..."
    pkill -9 -f customer-service-backend 2>/dev/null || true
    sleep 2
fi

# 删除问题数据库文件
if [ -f "$DB_FILE" ]; then
    file_size=$(stat -c%s "$DB_FILE" 2>/dev/null || stat -f%z "$DB_FILE" 2>/dev/null || echo "0")
    if [ "$file_size" -eq 0 ] || [ "$file_size" -lt 1024 ]; then
        echo "🗑️  删除问题数据库文件..."
        rm -f "$DB_FILE"
        echo "✅ 已删除"
    fi
fi

# 重启服务，让它重新创建数据库
echo ""
echo "🚀 重启服务并初始化数据库..."

# 设置必要的环境变量
export DATABASE_URL="sqlite:./customer_service.db"
export RUST_LOG="${RUST_LOG:-info}"

# 确保文件权限正确
touch "$DB_FILE" 2>/dev/null || true
chmod 644 "$DB_FILE" 2>/dev/null || true

nohup ./customer-service-backend > fix-db.log 2>&1 &
backend_pid=$!

echo "✅ 服务已启动 (PID: $backend_pid)"

# 等待数据库初始化
echo ""
echo "⏳ 等待数据库初始化..."
for i in {1..30}; do
    sleep 1
    if [ -f "$DB_FILE" ] && [ -s "$DB_FILE" ]; then
        break
    fi
    printf "."
done
printf "\n"

# 检查新数据库
if [ -f "$DB_FILE" ]; then
    new_db_size=$(stat -c%s "$DB_FILE" 2>/dev/null || stat -f%z "$DB_FILE" 2>/dev/null || echo "0")
    new_db_size_human=$(ls -lh "$DB_FILE" 2>/dev/null | awk '{print $5}' || echo "未知")
    
    echo "📊 新数据库状态:"
    echo "   大小: $new_db_size_human ($new_db_size bytes)"
    
    if [ "$new_db_size" -gt 0 ]; then
        echo "   状态: ✅ 初始化成功"
        
        # 检查表结构
        if command -v sqlite3 >/dev/null 2>&1; then
            table_count=$(sqlite3 "$DB_FILE" ".tables" 2>/dev/null | wc -w || echo "0")
            echo "   表数量: $table_count"
            
            if [ "$table_count" -gt 0 ]; then
                echo "   表结构: ✅ 创建完成"
                
                # 显示表列表
                echo "   表列表:"
                sqlite3 "$DB_FILE" ".tables" 2>/dev/null | tr ' ' '\n' | while read table; do
                    [ -n "$table" ] && echo "     - $table"
                done
            fi
        fi
    else
        echo "   状态: ❌ 数据库仍然为空"
        echo "📋 查看错误日志:"
        tail -20 fix-db.log
        exit 1
    fi
else
    echo "❌ 数据库文件未创建"
    echo "📋 查看错误日志:"
    tail -20 fix-db.log
    exit 1
fi

# 等待服务完全启动
echo ""
echo "⏳ 等待服务完全启动..."
sleep 5

# 测试数据库连接和API
echo ""
echo "🔗 测试API连接..."

# 读取配置获取端口
if [ -f ".env" ]; then
    source .env
fi
port=${SERVER_PORT:-8080}

# 测试登录API (应该返回401未授权，说明API正常)
if command -v curl >/dev/null 2>&1; then
    auth_response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" \
        -d '{"username":"test","password":"test"}' \
        -o /dev/null "http://localhost:$port/api/auth/login" 2>/dev/null || echo "000")
    
    echo "📡 API响应状态: $auth_response"
    
    case $auth_response in
        "401"|"400")
            echo "✅ API正常响应 (认证错误是预期的)"
            ;;
        "500")
            echo "❌ 仍然返回500错误"
            echo "📋 查看详细日志:"
            tail -20 fix-db.log
            exit 1
            ;;
        "000")
            echo "⚠️  无法连接到API (服务可能还未完全启动)"
            ;;
        *)
            echo "⚠️  意外的响应: $auth_response"
            ;;
    esac
else
    echo "⚠️  curl未安装，跳过API测试"
fi

# 显示服务状态
echo ""
echo "🎉 数据库修复完成！"
echo "=============================================="
echo "📊 最终状态:"

final_size=$(ls -lh "$DB_FILE" 2>/dev/null | awk '{print $5}' || echo "未知")
process_status=$(pgrep -f customer-service-backend > /dev/null && echo '运行中' || echo '未运行')
server_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")

echo "   数据库大小: $final_size"
echo "   进程状态: $process_status"
echo "   PID: $backend_pid"

echo ""
echo "🔗 访问地址:"
echo "   本地: http://localhost:$port"
echo "   远程: http://$server_ip:$port"

echo ""
echo "📋 管理命令:"
echo "   查看日志: tail -f fix-db.log"
echo "   检查状态: ./check-database.sh"
echo "   重启服务: ./restart.sh"
echo "   停止服务: pkill -f customer-service-backend"