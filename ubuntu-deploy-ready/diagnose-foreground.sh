#!/bin/bash

# 前台运行诊断脚本
# 此脚本帮助诊断为什么程序在前台运行时立即退出

echo "========================================="
echo "🔍 前台运行诊断工具"
echo "========================================="
echo ""

cd /root/ubuntu-deploy-ready || exit 1

# 1. 检查可执行文件
echo "📋 1. 检查可执行文件信息"
echo "----------------------------------------"
if [ ! -f "./customer-service-backend" ]; then
    echo "❌ 错误: 找不到 customer-service-backend"
    exit 1
fi

echo "✅ 文件存在"
echo "📊 文件大小: $(du -h customer-service-backend | cut -f1)"
echo "🔧 文件权限: $(ls -lh customer-service-backend | awk '{print $1}')"
echo ""

# 2. 检查编译特性
echo "📋 2. 检查编译特性"
echo "----------------------------------------"
if strings customer-service-backend | grep -q "https"; then
    echo "✅ 包含 HTTPS 相关代码"
else
    echo "⚠️  警告: 可能未启用 HTTPS 特性"
fi

if strings customer-service-backend | grep -q "axum_server"; then
    echo "✅ 包含 axum_server"
else
    echo "⚠️  警告: 可能未包含 axum_server"
fi
echo ""

# 3. 检查依赖库
echo "📋 3. 检查动态链接库"
echo "----------------------------------------"
if ldd ./customer-service-backend | grep -i "not found"; then
    echo "❌ 发现缺失的依赖库!"
else
    echo "✅ 所有依赖库都已找到"
fi
echo ""

# 4. 检查环境变量
echo "📋 4. 检查环境变量"
echo "----------------------------------------"
if [ -f ".env" ]; then
    echo "✅ .env 文件存在"
    echo "关键配置:"
    grep -E "^(TLS_MODE|ACME_ENABLED|DATABASE_URL)" .env | while read line; do
        echo "  $line"
    done
else
    echo "❌ .env 文件不存在"
fi
echo ""

# 5. 检查证书
echo "📋 5. 检查证书文件"
echo "----------------------------------------"
if [ -f "certs/server.crt" ] && [ -f "certs/server.key" ]; then
    echo "✅ 证书文件存在"
    cert_expire=$(openssl x509 -in certs/server.crt -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -n "$cert_expire" ]; then
        echo "📅 证书到期时间: $cert_expire"
    fi
else
    echo "⚠️  证书文件缺失"
fi
echo ""

# 6. 测试运行（3秒超时）
echo "📋 6. 测试运行（3秒后自动终止）"
echo "----------------------------------------"
echo "🚀 启动程序..."
timeout 3 ./customer-service-backend > test-run.log 2>&1 &
TEST_PID=$!

sleep 1

if ps -p $TEST_PID > /dev/null 2>&1; then
    echo "✅ 程序运行中 (PID: $TEST_PID)"
    sleep 2
    
    if ps -p $TEST_PID > /dev/null 2>&1; then
        echo "✅ 程序持续运行"
        kill $TEST_PID 2>/dev/null
    else
        echo "❌ 程序在1秒后退出"
    fi
else
    echo "❌ 程序立即退出"
fi

echo ""
echo "📝 最后 30 行日志:"
echo "----------------------------------------"
tail -n 30 test-run.log
echo ""

# 7. 检查端口占用
echo "📋 7. 检查端口占用"
echo "----------------------------------------"
if command -v lsof &> /dev/null; then
    echo "端口 8443: $(lsof -ti:8443 2>/dev/null | wc -l) 个进程"
    echo "端口 8080: $(lsof -ti:8080 2>/dev/null | wc -l) 个进程"
else
    if command -v ss &> /dev/null; then
        echo "端口 8443: $(ss -tlnp | grep :8443 | wc -l) 个监听"
        echo "端口 8080: $(ss -tlnp | grep :8080 | wc -l) 个监听"
    fi
fi
echo ""

# 8. 给出建议
echo "========================================="
echo "💡 诊断建议"
echo "========================================="

if [ -s test-run.log ]; then
    if grep -q "Terminated" test-run.log; then
        echo "❌ 检测到 'Terminated' 信号"
        echo ""
        echo "可能原因:"
        echo "  1. 程序内部立即返回（未正确阻塞）"
        echo "  2. 编译时未启用 https 特性"
        echo "  3. axum_server 配置问题"
        echo ""
        echo "建议操作:"
        echo "  1. 重新编译: cd backend && cargo build --release --features https"
        echo "  2. 使用 strace 诊断: strace -f ./customer-service-backend 2>&1 | tee strace.log"
        echo "  3. 查看完整日志: cat test-run.log"
    elif grep -q "HTTPS服务器启动在" test-run.log; then
        echo "✅ 服务器成功启动"
        echo ""
        echo "如果程序仍然退出，可能是:"
        echo "  1. HTTP 重定向任务崩溃"
        echo "  2. 端口绑定失败"
        echo ""
        echo "建议: 使用 screen 或 nohup 运行"
    fi
else
    echo "❌ 程序没有产生任何输出"
    echo ""
    echo "建议:"
    echo "  1. 检查文件是否损坏"
    echo "  2. 重新上传并编译"
fi

echo ""
echo "========================================="
echo "🚀 如何前台运行"
echo "========================================="
echo ""
echo "方法 1: 使用 strace 诊断运行"
echo "  strace -f ./customer-service-backend 2>&1 | tee strace.log"
echo ""
echo "方法 2: 使用详细日志"
echo "  RUST_LOG=trace RUST_BACKTRACE=full ./customer-service-backend"
echo ""
echo "方法 3: 使用 screen（推荐）"
echo "  screen -S customer-service"
echo "  ./customer-service-backend"
echo "  # 按 Ctrl+A 然后 D 分离"
echo ""
echo "方法 4: 后台运行但查看日志"
echo "  nohup ./customer-service-backend > server.log 2>&1 &"
echo "  tail -f server.log"
echo ""

# 清理
rm -f test-run.log

echo "✅ 诊断完成"
