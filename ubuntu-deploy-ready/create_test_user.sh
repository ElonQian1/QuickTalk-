#!/bin/bash
# 创建测试用户脚本

DB_PATH="/root/ubuntu-deploy-ready/customer_service.db"

echo "================================"
echo "👤 创建测试用户"
echo "================================"

# 检查数据库是否存在
if [ ! -f "$DB_PATH" ]; then
    echo "❌ 数据库文件不存在: $DB_PATH"
    exit 1
fi

# 使用Rust后端的bcrypt哈希创建用户
# 这里需要通过后端API创建，因为需要正确的bcrypt哈希

echo ""
echo "方法1: 使用注册API创建用户"
echo "================================"
echo ""
echo "curl -k -X POST https://43.139.82.12:8443/api/auth/register \\"
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{"username":"testuser","password":"Test123!","email":"test@example.com"}'"'"

echo ""
echo ""
echo "方法2: 检查现有用户并尝试登录"
echo "================================"

# 列出所有用户
echo "现有用户:"
sqlite3 "$DB_PATH" "SELECT id, username, email FROM users;"

echo ""
echo "💡 提示:"
echo "1. 如果有现有用户，尝试使用原密码登录"
echo "2. 如果不记得密码，使用注册API创建新用户"
echo "3. 或者直接在Ubuntu上运行服务器自带的用户管理命令"
