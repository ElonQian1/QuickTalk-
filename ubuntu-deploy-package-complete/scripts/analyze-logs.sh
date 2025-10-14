#!/bin/bash

# ELonTalk 日志分析脚本
# 功能：分析系统日志，诊断 HTTPS 问题

LOG_DIR="logs"
REPORT_FILE="$LOG_DIR/log-analysis-$(date +%Y%m%d-%H%M%S).txt"

echo "📊 ELonTalk 日志分析报告"
echo "========================================"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 生成报告
{
    echo "ELonTalk 客服系统 - 日志分析报告"
    echo "生成时间: $(date)"
    echo "分析用户: $(whoami)"
    echo "系统信息: $(uname -a)"
    echo "========================================"
    echo
    
    # 系统状态
    echo "📊 系统状态："
    echo "CPU 使用率: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
    echo "内存使用: $(free -h | awk 'NR==2{printf "%.1f%%", $3*100/$2}')"
    echo "磁盘使用: $(df -h . | awk 'NR==2{print $5}')"
    echo
    
    # 进程状态
    echo "🔍 进程状态："
    if pgrep -f "customer-service-backend" > /dev/null; then
        echo "✅ 应用程序正在运行"
        echo "进程信息:"
        ps aux | grep customer-service-backend | grep -v grep
    else
        echo "❌ 应用程序未运行"
    fi
    echo
    
    # 端口状态
    echo "🌐 端口状态："
    netstat -tlnp 2>/dev/null | grep -E ":(8080|8443)" || echo "未发现监听端口"
    echo
    
    # HTTPS 证书状态
    echo "🔐 SSL 证书状态："
    if [[ -f "certs/server.crt" ]]; then
        echo "证书文件存在"
        CERT_INFO=$(openssl x509 -in certs/server.crt -noout -dates 2>/dev/null)
        if [[ $? -eq 0 ]]; then
            echo "证书有效性: ✅ 有效"
            echo "$CERT_INFO"
        else
            echo "证书有效性: ❌ 无效"
        fi
    else
        echo "❌ 证书文件不存在"
    fi
    echo
    
    # 日志文件分析
    echo "📝 日志文件分析："
    for log_file in startup.log error.log access.log https-debug.log; do
        if [[ -f "$LOG_DIR/$log_file" ]]; then
            echo "--- $log_file (最近20行) ---"
            tail -20 "$LOG_DIR/$log_file"
            echo
        fi
    done
    
    # 错误统计
    echo "❌ 错误统计："
    if [[ -f "$LOG_DIR/error.log" ]]; then
        echo "错误总数: $(wc -l < "$LOG_DIR/error.log")"
        echo "最近的错误:"
        grep -i error "$LOG_DIR/error.log" | tail -10 || echo "未发现错误"
    else
        echo "未发现错误日志文件"
    fi
    echo
    
    # HTTPS 特定问题
    echo "🔒 HTTPS 问题诊断："
    if [[ -f "$LOG_DIR/https-debug.log" ]]; then
        echo "HTTPS 调试信息:"
        tail -20 "$LOG_DIR/https-debug.log"
    fi
    
    # TLS 相关错误
    echo "TLS 相关错误:"
    find "$LOG_DIR" -name "*.log" -exec grep -l -i "tls\|ssl\|certificate\|handshake" {} \; | while read file; do
        echo "在 $file 中发现:"
        grep -i "tls\|ssl\|certificate\|handshake" "$file" | tail -5
    done
    echo
    
    # 网络连接测试
    echo "🌐 网络连接测试："
    if command -v curl >/dev/null 2>&1; then
        echo "HTTP 测试:"
        curl -s -o /dev/null -w "状态码: %{http_code}, 响应时间: %{time_total}s\n" http://localhost:8080/health || echo "HTTP 连接失败"
        
        echo "HTTPS 测试:"
        curl -k -s -o /dev/null -w "状态码: %{http_code}, 响应时间: %{time_total}s\n" https://localhost:8443/health || echo "HTTPS 连接失败"
    else
        echo "curl 未安装，跳过网络测试"
    fi
    echo
    
    # 建议解决方案
    echo "💡 建议解决方案："
    echo "1. 如果端口未监听，检查应用程序是否正常启动"
    echo "2. 如果证书问题，运行: ./scripts/generate-cert.sh"
    echo "3. 如果权限问题，运行: chmod +x customer-service-backend"
    echo "4. 如果防火墙问题，运行: ufw allow 8443/tcp"
    echo "5. 查看详细日志: tail -f logs/*.log"
    echo
    
} > "$REPORT_FILE"

# 显示报告
cat "$REPORT_FILE"

echo "📄 完整报告已保存到: $REPORT_FILE"
echo
echo "🔧 快速诊断命令："
echo "  查看进程: ps aux | grep customer-service"
echo "  查看端口: netstat -tlnp | grep -E ':(8080|8443)'"
echo "  查看日志: tail -f $LOG_DIR/*.log"
echo "  测试连接: curl -k https://localhost:8443/health"