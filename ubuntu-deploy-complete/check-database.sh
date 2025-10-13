#!/bin/bash

# ==============================================
# ELonTalk 数据库状态检查工具
# ==============================================

echo "📊 ELonTalk 数据库状态检查"
echo "=============================================="
echo "⏰ 检查时间: $(date '+%Y-%m-%d %H:%M:%S')"

DB_FILE="customer_service.db"

# 基本文件检查
echo ""
echo "🗃️  文件基本信息:"
if [ -f "$DB_FILE" ]; then
    file_size=$(stat -c%s "$DB_FILE" 2>/dev/null || stat -f%z "$DB_FILE" 2>/dev/null || echo "0")
    file_size_human=$(ls -lh "$DB_FILE" 2>/dev/null | awk '{print $5}' || echo "未知")
    file_perm=$(ls -l "$DB_FILE" 2>/dev/null | awk '{print $1}' || echo "未知")
    file_owner=$(ls -l "$DB_FILE" 2>/dev/null | awk '{print $3":"$4}' || echo "未知")
    file_mtime=$(ls -l "$DB_FILE" 2>/dev/null | awk '{print $6" "$7" "$8}' || echo "未知")
    
    echo "   ✅ 文件存在: $DB_FILE"
    echo "   📏 大小: $file_size_human ($file_size bytes)"
    echo "   🔐 权限: $file_perm"
    echo "   👤 所有者: $file_owner"  
    echo "   📅 修改时间: $file_mtime"
    
    # 文件状态评估
    if [ "$file_size" -eq 0 ]; then
        echo "   🚨 状态: 空文件 - 需要修复"
        file_status="empty"
    elif [ "$file_size" -lt 1024 ]; then
        echo "   ⚠️  状态: 文件过小 - 可能损坏"  
        file_status="small"
    else
        echo "   ✅ 状态: 文件大小正常"
        file_status="normal"
    fi
else
    echo "   ❌ 文件不存在: $DB_FILE"
    file_status="missing"
fi

# SQLite检查 (如果文件存在且有内容)
if [ "$file_status" = "normal" ] || [ "$file_status" = "small" ]; then
    echo ""
    echo "🔍 数据库内容检查:"
    
    if command -v sqlite3 >/dev/null 2>&1; then
        # 测试数据库可读性
        if sqlite3 "$DB_FILE" ".databases" >/dev/null 2>&1; then
            echo "   ✅ 数据库可读"
            
            # 完整性检查
            integrity_result=$(sqlite3 "$DB_FILE" "PRAGMA integrity_check;" 2>/dev/null || echo "ERROR")
            if [ "$integrity_result" = "ok" ]; then
                echo "   ✅ 完整性验证通过"
            else
                echo "   ❌ 完整性验证失败: $integrity_result"
            fi
            
            # 表结构检查
            tables=$(sqlite3 "$DB_FILE" ".tables" 2>/dev/null || echo "")
            table_count=$(echo "$tables" | wc -w)
            
            echo "   📋 表数量: $table_count"
            
            if [ "$table_count" -gt 0 ]; then
                echo "   📚 表列表:"
                for table in $tables; do
                    row_count=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "ERROR")
                    echo "     - $table ($row_count 行)"
                done
                
                # 检查关键表是否存在
                echo ""
                echo "   🔑 关键表检查:"
                required_tables="users shops customers sessions messages"
                for req_table in $required_tables; do
                    if echo "$tables" | grep -q "$req_table"; then
                        row_count=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM $req_table;" 2>/dev/null || echo "ERROR")
                        echo "     ✅ $req_table: $row_count 行"
                    else
                        echo "     ❌ $req_table: 缺失"
                    fi
                done
            else
                echo "   ❌ 无表结构 - 数据库未初始化"
            fi
            
            # 版本信息
            schema_version=$(sqlite3 "$DB_FILE" "PRAGMA schema_version;" 2>/dev/null || echo "未知")
            user_version=$(sqlite3 "$DB_FILE" "PRAGMA user_version;" 2>/dev/null || echo "未知")
            echo ""
            echo "   📝 数据库版本:"
            echo "     Schema版本: $schema_version"
            echo "     用户版本: $user_version"
            
        else
            echo "   ❌ 数据库不可读 - 文件可能损坏"
        fi
    else
        echo "   ⚠️  sqlite3 未安装，跳过内容检查"
    fi
fi

# 进程检查
echo ""
echo "🔄 服务进程检查:"
backend_pids=$(pgrep -f customer-service-backend || echo "")
if [ -n "$backend_pids" ]; then
    echo "   ✅ 服务运行中"
    for pid in $backend_pids; do
        cmd=$(ps -p "$pid" -o cmd= 2>/dev/null || echo "未知")
        start_time=$(ps -p "$pid" -o lstart= 2>/dev/null || echo "未知")
        echo "     PID $pid: $start_time"
        echo "     命令: $cmd"
    done
else
    echo "   ❌ 服务未运行"
fi

# 端口检查
echo ""
echo "🌐 端口状态检查:"
if [ -f ".env" ]; then
    source .env
fi

check_port() {
    local port=$1
    local name=$2
    
    if command -v netstat >/dev/null 2>&1; then
        port_info=$(netstat -ln 2>/dev/null | grep ":$port ")
    elif command -v ss >/dev/null 2>&1; then
        port_info=$(ss -ln 2>/dev/null | grep ":$port ")
    else
        port_info=""
    fi
    
    if [ -n "$port_info" ]; then
        echo "   ✅ $name 端口 $port: 监听中"
        echo "     $port_info"
    else
        echo "   ❌ $name 端口 $port: 未监听"
    fi
}

http_port=${SERVER_PORT:-8080}
https_port=${TLS_PORT:-8443}

check_port "$http_port" "HTTP"
check_port "$https_port" "HTTPS"

# API健康检查
echo ""
echo "🔗 API连接测试:"
if command -v curl >/dev/null 2>&1 && [ -n "$backend_pids" ]; then
    # 测试健康检查端点 (如果存在)
    health_response=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:$http_port/health" 2>/dev/null || echo "000")
    
    # 测试登录端点
    auth_response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" \
        -d '{"username":"test","password":"test"}' \
        -o /dev/null "http://localhost:$http_port/api/auth/login" 2>/dev/null || echo "000")
    
    echo "   Health检查: $health_response"
    echo "   登录API: $auth_response"
    
    if [ "$auth_response" = "401" ] || [ "$auth_response" = "400" ]; then
        echo "   ✅ API正常 (认证错误是预期的)"
    elif [ "$auth_response" = "500" ]; then
        echo "   ❌ API错误 - 可能是数据库问题"
    elif [ "$auth_response" = "000" ]; then
        echo "   ❌ 无法连接API"
    else
        echo "   ⚠️  API响应异常: $auth_response"
    fi
else
    if [ -z "$backend_pids" ]; then
        echo "   ⏸️  服务未运行，跳过API测试"
    else
        echo "   ⚠️  curl未安装，跳过API测试"
    fi
fi

# 总结和建议
echo ""
echo "💡 诊断总结和建议:"
echo "=============================================="

case $file_status in
    "missing")
        echo "🚨 数据库文件缺失"
        echo "建议: 运行 ./fix-database.sh 创建数据库"
        ;;
    "empty")
        echo "🚨 数据库文件为空"  
        echo "建议: 运行 ./fix-database.sh 重新初始化"
        ;;
    "small")
        echo "⚠️  数据库文件异常小"
        echo "建议: 运行 ./fix-database.sh 修复数据库"
        ;;
    "normal")
        if [ -z "$backend_pids" ]; then
            echo "⚠️  数据库正常但服务未运行"
            echo "建议: 运行 ./start.sh 启动服务"
        elif [ "$auth_response" = "500" ]; then
            echo "⚠️  数据库和服务都在运行但API报错"
            echo "建议: 检查日志文件，或运行 ./fix-database.sh"
        else
            echo "✅ 数据库和服务状态正常"
        fi
        ;;
esac

echo ""
echo "🔧 常用修复命令:"
echo "   修复数据库: ./fix-database.sh"
echo "   重启服务: ./restart.sh"  
echo "   查看日志: tail -f *.log"
echo "   完整诊断: ./diagnose.sh"