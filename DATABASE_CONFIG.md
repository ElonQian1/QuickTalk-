# 数据库配置说明

## 数据库类型切换

项目支持两种数据库类型：

### 1. 内存数据库（开发测试用）
- 文件：`database-memory.js`
- 特点：数据存储在内存中，重启后丢失
- 适用：本地开发和测试

### 2. SQLite数据库（生产环境推荐）
- 文件：`database-sqlite.js`
- 特点：数据持久化存储，轻量级
- 适用：生产环境部署

## 切换方法

在 `server.js` 中修改引入的数据库模块：

```javascript
// 使用内存数据库（开发）
const Database = require('./database-memory');

// 使用SQLite数据库（生产）
const Database = require('./database-sqlite');
```

## SQLite数据库特点

1. **零配置**：无需安装额外的数据库服务
2. **轻量级**：适合轻量云服务器
3. **持久化**：数据保存在文件中，重启不丢失
4. **ACID支持**：支持事务和数据一致性
5. **文件位置**：`./data/customer_service.db`

## 部署建议

- 开发环境：使用内存数据库快速调试
- 生产环境：使用SQLite数据库确保数据安全
- 大型项目：可考虑升级到PostgreSQL或MySQL

## 数据迁移

如需从内存数据库迁移到SQLite，可以：
1. 导出现有数据（如果有）
2. 切换到SQLite版本
3. 导入数据（系统会自动创建测试数据）
