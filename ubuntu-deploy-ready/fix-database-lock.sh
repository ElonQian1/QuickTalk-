#!/bin/bash

# 快速诊断数据库卡住问题

echo "🔍 检查数据库状态..."

cd /root/ubuntu-deploy-ready || exit 1

echo ""
echo "1️⃣ 检查数据库文件"
echo "----------------------------------------"
ls -lh customer_service.db* 2>/dev/null || echo "❌ 数据库文件不存在"

echo ""
echo "2️⃣ 检查数据库文件锁"
echo "----------------------------------------"
if [ -f "customer_service.db" ]; then
    if lsof customer_service.db 2>/dev/null; then
        echo "⚠️  数据库文件被占用!"
    else
        echo "✅ 数据库文件未被占用"
    fi
else
    echo "⚠️  数据库文件不存在"
fi

echo ""
echo "3️⃣ 检查 SQLite 临时文件"
echo "----------------------------------------"
ls -lh customer_service.db-* 2>/dev/null || echo "✅ 没有临时文件"

echo ""
echo "4️⃣ 检查当前运行的进程"
echo "----------------------------------------"
if pgrep -f customer-service-backend > /dev/null; then
    echo "运行中的进程:"
    ps aux | grep customer-service-backend | grep -v grep
    
    echo ""
    echo "打开的文件:"
    for pid in $(pgrep -f customer-service-backend); do
        echo "PID $pid:"
        lsof -p $pid 2>/dev/null | grep -E "customer_service|sqlite" || echo "  无数据库文件"
    done
else
    echo "✅ 没有运行中的进程"
fi

echo ""
echo "5️⃣ 强制解决方案"
echo "----------------------------------------"

# 杀死所有旧进程
OLD_PIDS=$(pgrep -f customer-service-backend | grep -v $$)
if [ -n "$OLD_PIDS" ]; then
    echo "发现旧进程，正在终止: $OLD_PIDS"
    kill -9 $OLD_PIDS 2>/dev/null
    sleep 2
    echo "✅ 已终止旧进程"
else
    echo "✅ 没有旧进程需要终止"
fi

# 删除数据库锁文件
if [ -f "customer_service.db-shm" ] || [ -f "customer_service.db-wal" ]; then
    echo "⚠️  发现数据库锁文件，正在删除..."
    rm -f customer_service.db-shm customer_service.db-wal
    echo "✅ 已删除锁文件"
fi

echo ""
echo "6️⃣ 重新启动程序"
echo "----------------------------------------"
echo "执行以下命令重新启动:"
echo ""
echo "  nohup ./customer-service-backend > server.log 2>&1 &"
echo "  tail -f server.log"
echo ""
