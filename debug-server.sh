#!/bin/bash

echo "=== 服务器500错误排查脚本 ==="
echo "请在服务器上执行以下命令来排查问题："
echo ""

echo "1. 检查服务状态："
echo "systemctl status customer-service"
echo ""

echo "2. 查看最近的错误日志："
echo "journalctl -u customer-service -n 50 --no-pager"
echo ""

echo "3. 检查数据库文件是否存在："
echo "ls -la /root/ubuntu-deploy-ready/customer_service.db"
echo ""

echo "4. 测试数据库连接："
echo "sqlite3 /root/ubuntu-deploy-ready/customer_service.db '.tables'"
echo ""

echo "5. 检查进程是否运行："
echo "ps aux | grep customer-service"
echo ""

echo "6. 检查端口占用："
echo "netstat -tlnp | grep 8443"
echo ""

echo "7. 手动启动服务查看详细错误："
echo "cd /root/ubuntu-deploy-ready"
echo "./customer-service-backend"
echo ""

echo "8. 检查文件权限："
echo "ls -la /root/ubuntu-deploy-ready/"
echo ""

echo "9. 查看环境变量："
echo "cat /root/ubuntu-deploy-ready/.env"
echo ""

echo "10. 测试简单API（如果服务正在运行）："
echo "curl -k https://localhost:8443/health || curl http://localhost:8080/health"