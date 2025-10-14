# 📚 数据库管理指南

完整的数据库架构文件和管理工具。

## 📋 文件说明

- **database_schema.sql** - 完整的数据库架构定义文件
- **rebuild-database.sh** - Linux/Mac数据库重建脚本
- **rebuild-database.bat** - Windows数据库重建脚本
- **verify-database.sh** - 数据库验证脚本

## 🗄️ 数据库架构概览

### 核心表（10个）

1. **users** - 用户表（管理员、客服人员）
2. **shops** - 店铺表
3. **shop_staffs** - 店铺员工关联表 ⭐️
4. **customers** - 客户表
5. **sessions** - 会话表
6. **messages** - 消息表
7. **files** - 文件表
8. **statistics** - 统计表
9. **unread_counts** - 未读消息计数表 ⭐️
10. **system_config** - 系统配置表

### 关键字段

- **customers.last_active_at** - 客户最后活跃时间 ⭐️（用于dashboard统计）
- **unread_counts.unread_count** - 未读消息数 ⭐️
- **shop_staffs.user_id** - 员工与店铺关联 ⭐️

> ⭐️ 标记的表/字段是修复dashboard 500错误所必需的

## 🚀 使用方法

### 方法一：生成完整架构（推荐）

已经为你准备好了完整的 `database_schema.sql` 文件，包含：

- ✅ 所有10个核心表
- ✅ shop_staffs 员工关联表
- ✅ unread_counts 未读计数表
- ✅ customers.last_active_at 字段
- ✅ 30+ 个性能优化索引
- ✅ 自动更新触发器
- ✅ 便捷查询视图

### 方法二：重建数据库

#### Linux/Mac:

```bash
cd ubuntu-deploy-complete

# 添加执行权限
chmod +x rebuild-database.sh verify-database.sh

# 重建数据库（会自动备份）
./rebuild-database.sh

# 验证数据库
./verify-database.sh
```

#### Windows:

```powershell
cd ubuntu-deploy-complete

# 重建数据库
.\rebuild-database.bat

# 或者手动执行
sqlite3 customer_service.db < database_schema.sql
```

### 方法三：从现有数据库导出架构

如果你想从正在运行的数据库导出当前架构：

```bash
# 导出完整架构（包括数据）
sqlite3 customer_service.db .dump > database_backup_full.sql

# 仅导出架构（不含数据）
sqlite3 customer_service.db .schema > database_schema_only.sql

# 导出特定表
sqlite3 customer_service.db "SELECT sql FROM sqlite_master WHERE type='table' AND name='shop_staffs';"
```

## 🔧 修复Dashboard 500错误

你遇到的 `/api/dashboard/stats` 500错误是因为数据库缺少关键表：

### 问题诊断

```bash
# 运行验证脚本
./verify-database.sh

# 如果看到以下错误：
# ❌ shop_staffs (缺失)
# ❌ unread_counts (缺失)
# ❌ customers.last_active_at (缺失)
```

### 解决方案

**选项A：完全重建（推荐 - 适用于开发环境）**

```bash
./rebuild-database.sh
```

**选项B：增量更新（保留数据）**

```sql
-- 1. 添加shop_staffs表
CREATE TABLE IF NOT EXISTS shop_staffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'staff',
    permissions JSON,
    is_active BOOLEAN NOT NULL DEFAULT true,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(shop_id, user_id)
);

-- 2. 添加unread_counts表
CREATE TABLE IF NOT EXISTS unread_counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    session_id INTEGER,
    unread_count INTEGER NOT NULL DEFAULT 0,
    last_message_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    UNIQUE(shop_id, customer_id)
);

-- 3. 添加last_active_at字段
ALTER TABLE customers ADD COLUMN last_active_at DATETIME;

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_shop_staffs_shop ON shop_staffs(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_staffs_user ON shop_staffs(user_id);
CREATE INDEX IF NOT EXISTS idx_unread_counts_shop ON unread_counts(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(last_active_at);
```

执行增量更新：

```bash
# 保存上面的SQL到文件
cat > update_schema.sql << 'EOF'
-- 粘贴上面的SQL
EOF

# 应用更新
sqlite3 customer_service.db < update_schema.sql
```

## 🔍 验证修复

### 1. 检查表结构

```bash
./verify-database.sh
```

应该看到：

```
✅ shop_staffs
✅ unread_counts
✅ customers.last_active_at
```

### 2. 测试Dashboard API

```bash
# 登录获取token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')

# 测试dashboard stats
curl -X GET http://localhost:8080/api/dashboard/stats \
  -H "Authorization: Bearer $TOKEN"
```

应该返回：

```json
{
  "total_shops": 1,
  "active_customers": 0,
  "unread_messages": 0,
  "pending_chats": 0,
  "today_messages": 0,
  "week_messages": 0,
  "month_messages": 0,
  "today_customers": 0
}
```

## 📊 生产环境部署

### 部署到服务器

```bash
# 1. 上传schema文件
scp database_schema.sql rebuild-database.sh user@server:/opt/elontalk/

# 2. SSH到服务器
ssh user@server

# 3. 进入目录
cd /opt/elontalk

# 4. 备份现有数据库（重要！）
cp customer_service.db customer_service_backup_$(date +%Y%m%d).db

# 5. 停止服务
sudo systemctl stop elontalk

# 6. 重建数据库
chmod +x rebuild-database.sh
./rebuild-database.sh

# 7. 重启服务
sudo systemctl start elontalk

# 8. 检查日志
sudo journalctl -u elontalk -f
```

## 🎯 最佳实践

1. **开发环境**: 直接运行 `rebuild-database.sh` 重建
2. **生产环境**: 使用增量更新SQL保留现有数据
3. **定期备份**: 使用cron定期备份数据库
4. **版本控制**: 将 `database_schema.sql` 纳入Git管理

## 🆘 故障排除

### 问题1: "table already exists"

```bash
# 删除数据库重新创建
rm customer_service.db
./rebuild-database.sh
```

### 问题2: 权限错误

```bash
# Linux
chmod 666 customer_service.db

# 或改变所有者
sudo chown $USER:$USER customer_service.db
```

### 问题3: SQLite版本过低

```bash
# 检查版本
sqlite3 --version

# 需要 SQLite 3.35.0+ 以支持所有功能
```

## 📝 数据库架构版本

- **版本**: 2.0
- **更新日期**: 2025-10-14
- **关键改进**:
  - ✅ 添加 shop_staffs 员工管理
  - ✅ 添加 unread_counts 性能优化
  - ✅ 添加 customers.last_active_at 活跃追踪
  - ✅ 完善索引优化查询性能
  - ✅ 添加触发器自动维护时间戳

## 🔗 相关文档

- [部署指南](DEPLOYMENT.md)
- [API文档](../README.md)
- [架构说明](../.github/copilot-instructions.md)
