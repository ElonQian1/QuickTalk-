# 数据库迁移开发规范

## 🎯 目标
确保代码与数据库始终保持同步，避免生产环境部署问题。

## 📋 开发流程

### 1. 修改数据库结构时
```bash
# 步骤1: 创建迁移文件
./scripts/migrate-database.sh init

# 步骤2: 编辑迁移文件
# 文件路径: migrations/XXX_description.sql

# 步骤3: 测试迁移
./scripts/migrate-database.sh migrate

# 步骤4: 验证结构
./scripts/migrate-database.sh validate
```

### 2. 部署前检查
```bash
# 验证本地环境
./scripts/migrate-database.sh validate

# 检查版本一致性
./scripts/migrate-database.sh info
```

### 3. 生产环境部署
```bash
# 自动执行迁移
./scripts/deploy-https.sh

# 或手动迁移
./scripts/migrate-database.sh migrate
```

## 🔧 字段变更示例

### 添加新字段
```sql
-- migrations/XXX_add_field.sql
ALTER TABLE table_name ADD COLUMN new_field TYPE DEFAULT value;
```

### 修改字段类型
```sql
-- migrations/XXX_modify_field.sql
-- SQLite 需要重建表
CREATE TABLE table_name_new AS SELECT *, NULL as new_field FROM table_name;
DROP TABLE table_name;
ALTER TABLE table_name_new RENAME TO table_name;
```

### 删除字段
```sql
-- migrations/XXX_remove_field.sql
CREATE TABLE table_name_new AS SELECT field1, field2 FROM table_name;
DROP TABLE table_name;
ALTER TABLE table_name_new RENAME TO table_name;
```

## 📊 版本控制

### 迁移文件命名
```
001_initial_schema.sql
002_add_customer_fields.sql
003_fix_field_types.sql
```

### 版本号管理
- 每次迁移 +1
- 记录在 `.db_version` 文件
- 自动检测需要执行的迁移

## ⚠️ 注意事项

### 1. 备份策略
- 迁移前自动备份
- 保留最近5个备份
- 重要变更手动备份

### 2. 测试要求
- 本地环境测试
- 模拟生产数据测试
- 回滚测试

### 3. 安全检查
- 禁止DROP操作（除非明确）
- 大表变更分步执行
- 锁定超时设置

## 🚀 最佳实践

### 1. 代码与迁移同步
```rust
// 代码变更后立即创建对应迁移
#[sea_orm(table_name = "customers")]
pub struct Customer {
    pub last_active_at: Option<DateTime>, // 新字段
}
```

### 2. 环境变量配置
```properties
AUTO_MIGRATE=true           # 自动迁移
VALIDATE_SCHEMA=true        # 启动时验证
BACKUP_BEFORE_MIGRATE=true  # 迁移前备份
```

### 3. 监控和告警
- 迁移失败告警
- 结构验证失败告警
- 备份空间监控

## 📞 故障处理

### 迁移失败
```bash
# 查看错误日志
tail -f logs/migration.log

# 回滚到备份
cp customer_service.db.backup.* customer_service.db

# 强制重新迁移
./scripts/migrate-database.sh force-migrate
```

### 结构不匹配
```bash
# 详细验证
./scripts/migrate-database.sh validate

# 查看当前结构
sqlite3 customer_service.db ".schema"

# 手动修复
sqlite3 customer_service.db "ALTER TABLE ..."
```

---
**更新**: 2025年10月14日  
**版本**: v2.0  
**维护**: ELonTalk 团队