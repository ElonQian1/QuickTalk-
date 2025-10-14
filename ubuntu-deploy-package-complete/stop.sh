#!/bin/bash

# ELonTalk 客服系统 - 停止服务脚本
# 功能：安全停止所有服务进程

APP_NAME="customer-service-backend"
PID_FILE="/tmp/customer-service.pid"
LOG_DIR="logs"

echo "🛑 停止 ELonTalk 客服系统..."

# 创建日志目录
mkdir -p "$LOG_DIR"

# 从PID文件停止
if [[ -f "$PID_FILE" ]]; then
    PID=$(cat "$PID_FILE")
    echo "发现PID文件: $PID"
    
    if kill -0 "$PID" 2>/dev/null; then
        echo "正在停止进程 $PID..."
        kill -TERM "$PID"
        
        # 等待进程结束
        for i in {1..10}; do
            if ! kill -0 "$PID" 2>/dev/null; then
                echo "✅ 进程已正常停止"
                break
            fi
            sleep 1
            echo "等待进程结束... ($i/10)"
        done
        
        # 强制结束
        if kill -0 "$PID" 2>/dev/null; then
            echo "⚠️  强制结束进程"
            kill -9 "$PID"
        fi
    fi
    
    rm -f "$PID_FILE"
fi

# 通过进程名停止
echo "检查其他运行中的进程..."
PIDS=$(pgrep -f "$APP_NAME" 2>/dev/null || true)
if [[ -n "$PIDS" ]]; then
    echo "发现其他进程: $PIDS"
    echo "$PIDS" | xargs kill -TERM 2>/dev/null || true
    sleep 3
    
    # 强制结束残留进程
    REMAINING=$(pgrep -f "$APP_NAME" 2>/dev/null || true)
    if [[ -n "$REMAINING" ]]; then
        echo "强制结束残留进程: $REMAINING"
        echo "$REMAINING" | xargs kill -9 2>/dev/null || true
    fi
fi

# 检查端口占用
echo "检查端口占用..."
for port in 8080 8443; do
    PORT_PID=$(lsof -ti:$port 2>/dev/null || true)
    if [[ -n "$PORT_PID" ]]; then
        echo "端口 $port 仍被进程 $PORT_PID 占用，正在结束..."
        kill -9 "$PORT_PID" 2>/dev/null || true
    fi
done

# 清理临时文件
echo "清理临时文件..."
rm -f /tmp/customer-service.*
rm -f nohup.out

echo "✅ 服务已完全停止"

# 显示当前状态
echo
echo "当前状态检查："
echo "进程状态: $(pgrep -f "$APP_NAME" || echo '无运行进程')"
echo "端口占用: $(lsof -ti:8080,8443 2>/dev/null || echo '端口已释放')"
echo "日志位置: $LOG_DIR/"