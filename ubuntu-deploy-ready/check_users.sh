#!/bin/bash
# Ubuntu生产数据库用户检查脚本

echo "================================"
echo "🔍 检查Ubuntu生产数据库用户"
echo "================================"

DB_PATH="/root/ubuntu-deploy-ready/customer_service.db"

if [ ! -f "$DB_PATH" ]; then
    echo "❌ 数据库文件不存在: $DB_PATH"
    exit 1
fi

echo ""
echo "📊 所有用户列表:"
sqlite3 "$DB_PATH" "SELECT id, username, email, phone, status FROM users;"

echo ""
echo "🔐 用户密码哈希检查:"
sqlite3 "$DB_PATH" "SELECT id, username, SUBSTR(password_hash, 1, 20) || '...' as password_prefix FROM users;"

echo ""
echo "📈 用户统计:"
echo "总用户数: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;")"
echo "活跃用户: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE status = 1;")"

echo ""
echo "🏪 用户的店铺关系:"
sqlite3 "$DB_PATH" "SELECT u.id, u.username, s.id as shop_id, s.name as shop_name 
FROM users u 
LEFT JOIN shops s ON u.id = s.owner_id 
ORDER BY u.id;"

echo ""
echo "================================"
echo "💡 测试登录命令:"
echo "================================"
echo ""
echo "测试用户 'admin':"
echo 'curl -k -X POST https://43.139.82.12:8443/api/auth/login \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{"username":"admin","password":"admin123"}'"'"

echo ""
echo ""
echo "如果登录失败，可能需要创建新用户:"
echo "./create_test_user.sh"
