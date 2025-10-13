#!/bin/bash

# ==============================================
# ELonTalk 数据库强制初始化工具
# ==============================================

echo "🔧 ELonTalk 数据库强制初始化"
echo "=============================================="
echo "⏰ 执行时间: $(date '+%Y-%m-%d %H:%M:%S')"

DB_FILE="customer_service.db"

# 1. 停止所有相关服务
echo ""
echo "🛑 停止所有服务..."
pkill -f customer-service-backend 2>/dev/null || true
systemctl stop customer-service 2>/dev/null || true
sleep 3

# 强制停止
if pgrep -f customer-service-backend > /dev/null; then
    echo "⚠️  强制停止残余进程..."
    pkill -9 -f customer-service-backend 2>/dev/null || true
    sleep 2
fi

# 2. 清理现有数据库文件
echo ""
echo "🗑️  清理现有数据库..."
if [ -f "$DB_FILE" ]; then
    echo "   删除现有数据库文件: $DB_FILE"
    rm -f "$DB_FILE"
fi

# 清理可能的锁文件
rm -f "$DB_FILE-shm" "$DB_FILE-wal" "$DB_FILE-journal" 2>/dev/null || true

# 3. 检查配置文件
echo ""
echo "⚙️  检查配置..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "   复制配置文件..."
        cp .env.example .env
    else
        echo "   创建默认配置..."
        cat > .env << 'EOF'
DATABASE_URL=sqlite:./customer_service.db
RUST_LOG=info
SERVER_PORT=8080
TLS_PORT=8443
EOF
    fi
fi

# 读取配置
source .env

# 4. 设置环境变量
echo ""
echo "🌍 设置环境变量..."
export DATABASE_URL="sqlite:./customer_service.db"
export RUST_LOG="${RUST_LOG:-info}"
export RUST_BACKTRACE=1

echo "   DATABASE_URL: $DATABASE_URL"
echo "   RUST_LOG: $RUST_LOG"

# 5. 创建数据库文件并设置权限
echo ""
echo "📁 准备数据库文件..."

# 确保目录存在
mkdir -p "$(dirname "$DB_FILE")" 2>/dev/null || true

# 创建空数据库文件
touch "$DB_FILE"
chmod 666 "$DB_FILE"  # 给予读写权限

echo "   ✅ 数据库文件已创建: $DB_FILE"

# 6. 测试启动服务器进行初始化
echo ""
echo "🚀 启动服务器进行数据库初始化..."

# 使用超时启动，避免永久等待
timeout 30s ./customer-service-backend &
init_pid=$!

echo "   📋 服务器PID: $init_pid"

# 等待初始化完成
echo ""
echo "⏳ 等待数据库初始化完成..."
for i in {1..30}; do
    if [ ! -f "$DB_FILE" ]; then
        echo "   ❌ 数据库文件消失，初始化失败"
        break
    fi
    
    db_size=$(stat -c%s "$DB_FILE" 2>/dev/null || stat -f%z "$DB_FILE" 2>/dev/null || echo "0")
    
    if [ "$db_size" -gt 1024 ]; then
        echo "   ✅ 数据库初始化完成 (大小: $db_size bytes)"
        
        # 验证表结构
        if command -v sqlite3 >/dev/null 2>&1; then
            table_count=$(sqlite3 "$DB_FILE" ".tables" 2>/dev/null | wc -w || echo "0")
            echo "   📊 创建表数量: $table_count"
            
            if [ "$table_count" -gt 0 ]; then
                echo "   ✅ 表结构创建成功"
                break
            fi
        else
            echo "   ✅ 数据库文件大小正常"
            break
        fi
    fi
    
    sleep 1
    printf "."
done
printf "\n"

# 7. 停止初始化进程
echo ""
echo "🛑 停止初始化进程..."
if kill -0 $init_pid 2>/dev/null; then
    kill $init_pid 2>/dev/null || true
    sleep 2
    
    if kill -0 $init_pid 2>/dev/null; then
        kill -9 $init_pid 2>/dev/null || true
    fi
fi

# 8. 验证结果
echo ""
echo "🔍 验证初始化结果..."

if [ -f "$DB_FILE" ]; then
    final_size=$(stat -c%s "$DB_FILE" 2>/dev/null || stat -f%z "$DB_FILE" 2>/dev/null || echo "0")
    final_size_human=$(ls -lh "$DB_FILE" | awk '{print $5}')
    
    echo "   📊 最终数据库大小: $final_size_human ($final_size bytes)"
    
    if [ "$final_size" -gt 1024 ]; then
        echo "   ✅ 数据库初始化成功"
        
        # 检查表结构
        if command -v sqlite3 >/dev/null 2>&1; then
            echo ""
            echo "📋 数据库表结构:"
            sqlite3 "$DB_FILE" ".tables" 2>/dev/null | tr ' ' '\n' | while read table; do
                if [ -n "$table" ]; then
                    echo "   • $table"
                fi
            done
            
            # 完整性检查
            integrity=$(sqlite3 "$DB_FILE" "PRAGMA integrity_check;" 2>/dev/null || echo "ERROR")
            if [ "$integrity" = "ok" ]; then
                echo "   ✅ 数据库完整性验证通过"
            else
                echo "   ⚠️  数据库完整性验证失败: $integrity"
            fi
        fi
        
        echo ""
        echo "🎉 数据库初始化完全成功！"
        echo ""
        echo "💡 现在可以启动服务:"
        echo "   ./start.sh"
        
    else
        echo "   ❌ 数据库初始化失败 (文件过小)"
        echo ""
        echo "🔧 建议操作:"
        echo "   1. 检查可执行文件权限: ls -la customer-service-backend"
        echo "   2. 手动运行一次: ./customer-service-backend"
        echo "   3. 查看错误日志: cat *.log"
    fi
else
    echo "   ❌ 数据库文件不存在"
    echo ""
    echo "🔧 可能的问题:"
    echo "   1. 可执行文件损坏或不兼容"
    echo "   2. 权限不足"
    echo "   3. 磁盘空间不足"
fi

echo ""
echo "🔧 数据库强制初始化完成!"