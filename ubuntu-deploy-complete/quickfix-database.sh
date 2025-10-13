#!/bin/bash

# ==============================================
# ELonTalk 数据库问题快速修复
# ==============================================

echo "🚑 ELonTalk 数据库问题快速修复"
echo "=============================================="
echo "针对错误: unable to open database file"

# 1. 停止所有服务
echo ""
echo "🛑 停止所有相关进程..."
pkill -f customer-service-backend 2>/dev/null || true
sleep 2

# 强制停止
pgrep -f customer-service-backend | while read pid; do
    echo "   强制停止进程: $pid"
    kill -9 "$pid" 2>/dev/null || true
done

# 2. 清理数据库文件和锁
echo ""
echo "🧹 清理数据库文件..."

# 删除空或损坏的数据库文件
if [ -f "customer_service.db" ]; then
    db_size=$(stat -c%s "customer_service.db" 2>/dev/null || echo "0")
    if [ "$db_size" -eq 0 ]; then
        echo "   删除空数据库文件"
        rm -f "customer_service.db"
    fi
fi

# 清理所有可能的锁文件
rm -f customer_service.db-shm 2>/dev/null || true
rm -f customer_service.db-wal 2>/dev/null || true  
rm -f customer_service.db-journal 2>/dev/null || true
rm -f .customer_service.db* 2>/dev/null || true

echo "   ✅ 数据库文件清理完成"

# 3. 修复配置文件
echo ""
echo "⚙️  修复配置文件..."

# 确保 .env 文件存在
if [ ! -f ".env" ]; then
    echo "   创建 .env 配置文件..."
    cat > .env << 'EOF'
DATABASE_URL=sqlite:./customer_service.db
RUST_LOG=info
SERVER_PORT=8080
TLS_PORT=8443
JWT_SECRET=your-super-secret-jwt-key-change-in-production
SERVER_HOST=0.0.0.0
EOF
fi

# 修复 DATABASE_URL 如果需要
if ! grep -q "DATABASE_URL=sqlite:\\./customer_service.db" .env; then
    echo "   修复 DATABASE_URL 配置..."
    sed -i 's|DATABASE_URL=sqlite:customer_service.db|DATABASE_URL=sqlite:./customer_service.db|g' .env
    sed -i 's|DATABASE_URL=sqlite://customer_service.db|DATABASE_URL=sqlite:./customer_service.db|g' .env
fi

echo "   ✅ 配置文件修复完成"

# 4. 设置权限
echo ""
echo "🔐 设置文件权限..."

# 确保可执行文件有执行权限
chmod +x customer-service-backend 2>/dev/null || true

# 确保目录权限正确
chmod 755 . 2>/dev/null || true

# 预创建数据库文件并设置权限
touch customer_service.db
chmod 666 customer_service.db

echo "   ✅ 权限设置完成"

# 5. 设置环境变量
echo ""
echo "🌍 设置环境变量..."

export DATABASE_URL="sqlite:./customer_service.db"
export RUST_LOG="info"
export RUST_BACKTRACE="1"

echo "   DATABASE_URL: $DATABASE_URL"
echo "   RUST_LOG: $RUST_LOG"

# 6. 测试启动
echo ""
echo "🧪 测试数据库初始化..."

# 启动服务器并等待数据库初始化
echo "   启动服务器进行初始化..."
./customer-service-backend > quickfix.log 2>&1 &
fix_pid=$!

# 等待初始化
echo "   等待数据库创建..."
for i in {1..20}; do
    if [ -f "customer_service.db" ]; then
        db_size=$(stat -c%s "customer_service.db" 2>/dev/null || echo "0")
        if [ "$db_size" -gt 1024 ]; then
            echo "   ✅ 数据库初始化成功 ($db_size bytes)"
            break
        fi
    fi
    sleep 1
    printf "."
done
printf "\n"

# 停止测试进程
if kill -0 $fix_pid 2>/dev/null; then
    kill $fix_pid 2>/dev/null || true
    sleep 2
fi

# 7. 验证修复结果
echo ""
echo "✅ 修复完成，验证结果..."

if [ -f "customer_service.db" ]; then
    final_size=$(stat -c%s "customer_service.db" 2>/dev/null || echo "0")
    
    if [ "$final_size" -gt 1024 ]; then
        echo "🎉 修复成功！"
        echo ""
        echo "📊 数据库状态:"
        echo "   文件大小: $(ls -lh customer_service.db | awk '{print $5}')"
        
        if command -v sqlite3 >/dev/null 2>&1; then
            table_count=$(sqlite3 customer_service.db ".tables" 2>/dev/null | wc -w)
            echo "   表数量: $table_count"
        fi
        
        echo ""
        echo "🚀 现在可以启动服务:"
        echo "   ./start.sh"
        
        echo ""
        echo "📋 如果还有问题，请查看日志:"
        echo "   tail -f quickfix.log"
        
    else
        echo "❌ 数据库仍然为空"
        show_troubleshooting
    fi
else
    echo "❌ 数据库文件未创建"  
    show_troubleshooting
fi

echo ""
echo "🚑 快速修复完成!"

# 故障排除函数
show_troubleshooting() {
    echo ""
    echo "🔧 进一步故障排除:"
    echo "   1. 检查错误日志: cat quickfix.log"
    echo "   2. 检查可执行文件: file customer-service-backend"
    echo "   3. 检查磁盘空间: df -h ."
    echo "   4. 手动测试: ./test-database.sh"
    echo "   5. 强制初始化: ./force-fix-database.sh"
}

echo ""
echo "🚑 快速修复完成!"