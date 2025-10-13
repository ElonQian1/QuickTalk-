#!/bin/bash

# ==============================================
# 重新编译并更新后端可执行文件
# ==============================================

echo "🔄 重新编译并更新后端"
echo "=============================================="

# 检查是否在正确的目录
if [ ! -f "customer-service-backend" ]; then
    echo "❌ 错误: 不在部署目录中"
    echo "   当前目录: $(pwd)"
    echo "   请在包含 customer-service-backend 的目录中运行"
    exit 1
fi

# 1. 停止现有服务
echo ""
echo "🛑 停止现有服务..."
pkill -f customer-service-backend 2>/dev/null || true
sleep 2

# 2. 找到源码目录
echo ""
echo "🔍 查找源码目录..."

# 可能的源码路径
POSSIBLE_PATHS=(
    "../backend"
    "../../backend" 
    "../customer-service-system/backend"
    "../../customer-service-system/backend"
    "/root/customer-service-system/backend"
    "$HOME/customer-service-system/backend"
)

BACKEND_PATH=""
for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -f "$path/Cargo.toml" ]; then
        BACKEND_PATH="$path"
        echo "✅ 找到源码目录: $BACKEND_PATH"
        break
    fi
done

if [ -z "$BACKEND_PATH" ]; then
    echo "❌ 错误: 找不到后端源码目录"
    echo "   请确保源码目录存在且包含 Cargo.toml"
    echo ""
    echo "🔧 手动指定源码路径:"
    echo "   export BACKEND_PATH=/path/to/backend"
    echo "   $0"
    exit 1
fi

# 3. 备份现有可执行文件
echo ""
echo "💾 备份现有可执行文件..."
if [ -f "customer-service-backend" ]; then
    cp customer-service-backend "customer-service-backend.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ 备份完成"
fi

# 4. 编译后端
echo ""
echo "🔨 编译后端..."
cd "$BACKEND_PATH"

echo "   当前编译目录: $(pwd)"
echo "   编译模式: release"

if cargo build --release; then
    echo "✅ 编译成功"
    
    # 检查可执行文件
    EXECUTABLE_PATH="target/release/customer-service-backend"
    if [ -f "$EXECUTABLE_PATH" ]; then
        executable_size=$(ls -lh "$EXECUTABLE_PATH" | awk '{print $5}')
        echo "📊 可执行文件大小: $executable_size"
        
        # 5. 复制到部署目录
        echo ""
        echo "📋 复制到部署目录..."
        cd - > /dev/null
        
        cp "$BACKEND_PATH/$EXECUTABLE_PATH" ./customer-service-backend
        chmod +x ./customer-service-backend
        
        echo "✅ 可执行文件已更新"
        
        # 6. 验证新版本
        echo ""
        echo "🔍 验证新版本..."
        
        # 设置环境变量
        export DATABASE_URL="sqlite:./customer_service.db"
        export RUST_LOG="info"
        
        # 清理旧数据库以测试迁移
        echo "   清理测试数据库..."
        rm -f test_customer_service.db
        
        # 测试新可执行文件
        echo "   测试数据库迁移..."
        export DATABASE_URL="sqlite:./test_customer_service.db"
        
        timeout 10s ./customer-service-backend > compile-test.log 2>&1 &
        test_pid=$!
        
        sleep 5
        
        if [ -f "test_customer_service.db" ]; then
            db_size=$(stat -c%s "test_customer_service.db" 2>/dev/null || echo "0")
            if [ "$db_size" -gt 1024 ]; then
                echo "✅ 新版本数据库迁移正常"
                
                # 检查表结构
                if command -v sqlite3 >/dev/null 2>&1; then
                    table_count=$(sqlite3 test_customer_service.db ".tables" | wc -w)
                    echo "✅ 创建了 $table_count 个表"
                fi
                
                compile_success=true
            else
                echo "⚠️  数据库迁移可能有问题"
                compile_success=false
            fi
        else
            echo "❌ 数据库未创建"
            compile_success=false
        fi
        
        # 停止测试进程
        if kill -0 $test_pid 2>/dev/null; then
            kill $test_pid 2>/dev/null || true
        fi
        
        # 清理测试文件
        rm -f test_customer_service.db
        
        if [ "$compile_success" = true ]; then
            echo ""
            echo "🎉 后端更新成功！"
            echo ""
            echo "📋 现在可以："
            echo "   1. 强制修复数据库: ./force-fix-database.sh"
            echo "   2. 启动服务: ./start.sh"
            echo "   3. 验证部署: ./diagnose.sh"
        else
            echo ""
            echo "⚠️  后端编译完成但可能存在问题"
            echo "   查看编译测试日志: cat compile-test.log"
        fi
        
    else
        echo "❌ 错误: 编译后找不到可执行文件"
        echo "   预期路径: $BACKEND_PATH/$EXECUTABLE_PATH"
    fi
    
else
    echo "❌ 编译失败"
    echo ""
    echo "🔧 可能的问题:"
    echo "   1. 依赖缺失: cargo update"
    echo "   2. 源码错误: 检查编译错误信息"
    echo "   3. 环境问题: 检查 Rust 工具链"
    
    cd - > /dev/null
    exit 1
fi

echo ""
echo "🔄 后端更新完成!"