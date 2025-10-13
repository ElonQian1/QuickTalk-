#!/bin/bash

# ==============================================
# ELonTalk 数据库连接测试
# ==============================================

echo "🧪 ELonTalk 数据库连接测试"
echo "=============================================="

# 设置环境变量
export DATABASE_URL="sqlite:./customer_service.db"
export RUST_LOG=debug
export RUST_BACKTRACE=1

echo "📋 测试配置:"
echo "   DATABASE_URL: $DATABASE_URL"
echo "   RUST_LOG: $RUST_LOG"
echo "   当前目录: $(pwd)"

# 清理现有数据库
echo ""
echo "🧹 清理测试环境..."
pkill -f customer-service-backend 2>/dev/null || true
rm -f customer_service.db customer_service.db-* 2>/dev/null || true

echo "✅ 环境清理完成"

# 检查可执行文件
echo ""
echo "🔍 检查可执行文件..."
if [ ! -f "./customer-service-backend" ]; then
    echo "❌ 可执行文件不存在"
    exit 1
fi

if [ ! -x "./customer-service-backend" ]; then
    echo "🔧 设置执行权限..."
    chmod +x ./customer-service-backend
fi

file_size=$(ls -lh ./customer-service-backend | awk '{print $5}')
echo "✅ 可执行文件: $file_size"

# 测试数据库创建
echo ""
echo "🧪 测试数据库初始化..."

# 使用超时运行，避免挂起
echo "⏳ 启动服务器 (30秒超时)..."
timeout 30s ./customer-service-backend > test-db.log 2>&1 &
test_pid=$!

echo "📋 测试进程PID: $test_pid"

# 监控初始化过程
for i in {1..30}; do
    # 检查进程是否还在运行
    if ! kill -0 $test_pid 2>/dev/null; then
        echo ""
        echo "⚠️  进程已退出，检查日志..."
        break
    fi
    
    # 检查数据库文件
    if [ -f "customer_service.db" ]; then
        db_size=$(stat -c%s "customer_service.db" 2>/dev/null || stat -f%z "customer_service.db" 2>/dev/null || echo "0")
        
        if [ "$db_size" -gt 0 ]; then
            echo ""
            echo "✅ 数据库文件已创建 (大小: $db_size bytes)"
            
            # 等待几秒钟确保完全初始化
            sleep 3
            break
        fi
    fi
    
    sleep 1
    printf "."
done
printf "\n"

# 停止测试进程
if kill -0 $test_pid 2>/dev/null; then
    echo "🛑 停止测试进程..."
    kill $test_pid 2>/dev/null || true
    sleep 2
    
    if kill -0 $test_pid 2>/dev/null; then
        kill -9 $test_pid 2>/dev/null || true
    fi
fi

# 分析结果
echo ""
echo "📊 测试结果分析..."

if [ -f "customer_service.db" ]; then
    final_size=$(stat -c%s "customer_service.db" 2>/dev/null || stat -f%z "customer_service.db" 2>/dev/null || echo "0")
    final_size_human=$(ls -lh "customer_service.db" | awk '{print $5}')
    
    echo "✅ 数据库文件存在"
    echo "📊 文件大小: $final_size_human ($final_size bytes)"
    
    if [ "$final_size" -gt 1024 ]; then
        echo "✅ 数据库大小正常"
        
        # 验证数据库结构
        if command -v sqlite3 >/dev/null 2>&1; then
            echo ""
            echo "🔍 验证数据库结构..."
            
            table_count=$(sqlite3 "customer_service.db" ".tables" 2>/dev/null | wc -w || echo "0")
            echo "📋 表数量: $table_count"
            
            if [ "$table_count" -gt 0 ]; then
                echo "✅ 数据库表已创建"
                echo ""
                echo "📋 数据库表列表:"
                sqlite3 "customer_service.db" ".tables" 2>/dev/null | tr ' ' '\n' | while read table; do
                    if [ -n "$table" ]; then
                        echo "   • $table"
                    fi
                done
                
                # 完整性检查
                integrity=$(sqlite3 "customer_service.db" "PRAGMA integrity_check;" 2>/dev/null || echo "ERROR")
                if [ "$integrity" = "ok" ]; then
                    echo "✅ 数据库完整性验证通过"
                else
                    echo "⚠️  完整性验证失败: $integrity"
                fi
                
                echo ""
                echo "🎉 数据库连接测试成功！"
                test_result="success"
            else
                echo "❌ 数据库表未创建"
                test_result="partial"
            fi
        else
            echo "⚠️  sqlite3 未安装，无法验证表结构"
            test_result="partial"
        fi
        
    elif [ "$final_size" -eq 0 ]; then
        echo "❌ 数据库文件为空"
        test_result="failed"
    else
        echo "⚠️  数据库文件过小，可能未完全初始化"
        test_result="partial"
    fi
else
    echo "❌ 数据库文件未创建"
    test_result="failed"
fi

# 显示日志
echo ""
echo "📋 服务器日志 (最后20行):"
echo "----------------------------------------"
if [ -f "test-db.log" ]; then
    tail -20 test-db.log | sed 's/^/   /'
else
    echo "   (无日志文件)"
fi

# 测试总结
echo ""
echo "📊 测试总结"
echo "=============================================="

case $test_result in
    "success")
        echo "🎉 测试完全成功！"
        echo "✅ 数据库连接正常"
        echo "✅ 数据库初始化完成" 
        echo "✅ 表结构创建成功"
        echo ""
        echo "💡 现在可以正常启动服务:"
        echo "   ./start.sh"
        ;;
    "partial")
        echo "⚠️  测试部分成功"
        echo "✅ 数据库文件已创建"
        echo "⚠️  表结构可能不完整"
        echo ""
        echo "🔧 建议操作:"
        echo "   1. 运行强制初始化: ./init-database.sh"
        echo "   2. 检查错误日志: cat test-db.log"
        ;;
    "failed")
        echo "❌ 测试失败"
        echo "❌ 数据库连接有问题"
        echo ""
        echo "🔧 故障排除:"
        echo "   1. 检查错误日志: cat test-db.log"
        echo "   2. 检查文件权限: ls -la customer-service-backend"
        echo "   3. 手动运行: ./customer-service-backend"
        echo "   4. 检查环境变量: echo \$DATABASE_URL"
        ;;
esac

echo ""
echo "🧪 数据库连接测试完成!"