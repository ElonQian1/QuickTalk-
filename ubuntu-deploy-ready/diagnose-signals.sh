#!/bin/bash

# 🔍 终极诊断脚本 - 找出为什么程序被 Terminated

echo "========================================="
echo "🔍 程序 Terminated 问题诊断"
echo "========================================="
echo ""

cd /root/ubuntu-deploy-ready || exit 1

# 1. 检查是否有其他进程在杀死程序
echo "📋 1. 检查是否有监控脚本或 systemd 定时器"
echo "----------------------------------------"

# 检查 cron jobs
if crontab -l 2>/dev/null | grep -i "customer-service\|kill"; then
    echo "⚠️  发现 cron job 可能在终止程序:"
    crontab -l | grep -i "customer-service\|kill"
else
    echo "✅ 没有发现相关 cron job"
fi

echo ""

# 检查 systemd timers
if systemctl list-timers --all 2>/dev/null | grep -i customer; then
    echo "⚠️  发现 systemd timer:"
    systemctl list-timers --all | grep -i customer
else
    echo "✅ 没有发现相关 systemd timer"
fi

echo ""

# 2. 检查是否有进程监控
echo "📋 2. 检查进程监控工具"
echo "----------------------------------------"

if pgrep -f "monit\|supervisor\|pm2" > /dev/null; then
    echo "⚠️  发现进程监控工具:"
    ps aux | grep -E "monit|supervisor|pm2" | grep -v grep
else
    echo "✅ 没有发现进程监控工具"
fi

echo ""

# 3. 检查系统限制
echo "📋 3. 检查系统资源限制"
echo "----------------------------------------"

echo "进程数限制: $(ulimit -u)"
echo "文件描述符限制: $(ulimit -n)"
echo "虚拟内存限制: $(ulimit -v)"
echo "CPU时间限制: $(ulimit -t)"

if [ "$(ulimit -t)" != "unlimited" ]; then
    echo "⚠️  警告: CPU时间限制可能导致程序终止"
fi

echo ""

# 4. 检查 OOM Killer
echo "📋 4. 检查 OOM Killer 历史"
echo "----------------------------------------"

if dmesg | grep -i "out of memory\|kill" | tail -n 5; then
    echo "⚠️  发现 OOM Killer 记录"
else
    echo "✅ 没有发现 OOM Killer 记录"
fi

echo ""

# 5. 测试运行并监控信号
echo "📋 5. 测试运行程序（监控信号）"
echo "----------------------------------------"

echo "正在启动程序..."

# 使用 trap 捕获信号
(
    trap 'echo "🔴 收到 SIGHUP"; exit 129' HUP
    trap 'echo "🔴 收到 SIGINT"; exit 130' INT
    trap 'echo "🔴 收到 SIGQUIT"; exit 131' QUIT
    trap 'echo "🔴 收到 SIGTERM"; exit 143' TERM
    
    timeout 10s ./customer-service-backend &
    PID=$!
    
    echo "进程 PID: $PID"
    
    # 监控进程
    while kill -0 $PID 2>/dev/null; do
        sleep 0.5
    done
    
    wait $PID
    EXIT_CODE=$?
    
    echo ""
    echo "进程退出码: $EXIT_CODE"
    
    case $EXIT_CODE in
        0)   echo "✅ 正常退出" ;;
        1)   echo "❌ 一般错误" ;;
        2)   echo "❌ 误用Shell命令" ;;
        124) echo "⚠️  timeout 终止" ;;
        126) echo "❌ 无法执行" ;;
        127) echo "❌ 命令未找到" ;;
        128) echo "❌ 无效的退出参数" ;;
        129) echo "🔴 SIGHUP (终端断开)" ;;
        130) echo "🔴 SIGINT (Ctrl+C)" ;;
        131) echo "🔴 SIGQUIT" ;;
        137) echo "🔴 SIGKILL (强制终止)" ;;
        143) echo "🔴 SIGTERM (正常终止信号)" ;;
        *)   echo "❓ 未知退出码: $EXIT_CODE" ;;
    esac
) 2>&1 | tee test-signal.log

echo ""

# 6. 检查进程是否被某个父进程控制
echo "📋 6. 检查进程树"
echo "----------------------------------------"

if pgrep -f customer-service-backend > /dev/null; then
    echo "当前运行的进程:"
    pstree -p $(pgrep -f customer-service-backend | head -1)
else
    echo "当前没有运行的实例"
fi

echo ""

# 7. 检查环境变量
echo "📋 7. 检查可疑的环境变量"
echo "----------------------------------------"

if [ -n "$TIMEOUT" ]; then
    echo "⚠️  TIMEOUT=$TIMEOUT"
fi

if [ -n "$TMOUT" ]; then
    echo "⚠️  TMOUT=$TMOUT"
fi

echo ""

# 8. 建议的解决方案
echo "========================================="
echo "💡 诊断结果与建议"
echo "========================================="

if grep -q "SIGTERM\|143" test-signal.log; then
    echo ""
    echo "🎯 发现问题: 程序收到 SIGTERM 信号"
    echo ""
    echo "可能原因:"
    echo "  1. systemd 或其他进程管理器在终止程序"
    echo "  2. cron job 或定时任务在杀死进程"
    echo "  3. 监控工具认为程序需要重启"
    echo "  4. 资源限制导致系统终止进程"
    echo ""
    echo "解决方案:"
    echo "  1. 使用 nohup 运行: nohup ./customer-service-backend > server.log 2>&1 &"
    echo "  2. 使用 screen/tmux 会话"
    echo "  3. 配置为 systemd 服务"
    echo "  4. 检查并禁用相关的监控/清理脚本"
    echo ""
elif grep -q "SIGHUP\|129" test-signal.log; then
    echo ""
    echo "🎯 发现问题: 程序收到 SIGHUP 信号（终端断开）"
    echo ""
    echo "解决方案:"
    echo "  1. 使用 nohup: nohup ./customer-service-backend > server.log 2>&1 &"
    echo "  2. 使用 screen: screen -dmS customer-service ./customer-service-backend"
    echo "  3. 使用 tmux: tmux new -d -s customer-service './customer-service-backend'"
    echo ""
elif grep -q "SIGKILL\|137" test-signal.log; then
    echo ""
    echo "🎯 发现问题: 程序被 SIGKILL 强制杀死"
    echo ""
    echo "可能原因:"
    echo "  1. OOM Killer (内存不足)"
    echo "  2. 管理员或脚本使用 kill -9"
    echo "  3. 系统资源保护机制"
    echo ""
    echo "解决方案:"
    echo "  1. 检查内存使用: free -h"
    echo "  2. 检查 dmesg 日志: dmesg | tail -n 50"
    echo "  3. 增加系统资源或优化程序"
    echo ""
else
    echo ""
    echo "📝 程序运行正常，但可能立即退出"
    echo ""
    echo "建议:"
    echo "  1. 重新编译: cd backend && cargo build --release --features https"
    echo "  2. 使用详细日志: RUST_LOG=trace ./customer-service-backend"
    echo "  3. 使用 strace 诊断: strace -f ./customer-service-backend 2>&1 | tail -n 100"
    echo ""
fi

echo "========================================="
echo "✅ 诊断完成"
echo "========================================="
echo ""
echo "日志已保存到: test-signal.log"
echo "使用 'cat test-signal.log' 查看完整日志"
