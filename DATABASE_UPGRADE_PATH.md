# 数据库升级路径

## 🎯 数据库方案对比

| 数据库类型 | 内存消耗 | 磁盘空间 | 并发能力 | 适用场景 |
|-----------|---------|---------|---------|---------|
| **SQLite** | 极低(10-50MB) | 很小(几MB起) | 低-中等 | 轻量服务器、小型应用 |
| **MySQL** | 中等(100-500MB) | 中等(几GB) | 高 | 中型应用 |
| **PostgreSQL** | 高(200MB+) | 大(几GB+) | 很高 | 大型应用、复杂查询 |

## 🚀 当前方案：SQLite（推荐）

### 优势
- ✅ **零配置**：文件型数据库，无需额外安装
- ✅ **极低资源**：适合1-2GB内存的轻量服务器  
- ✅ **快速部署**：直接复制数据库文件即可
- ✅ **ACID支持**：保证数据一致性
- ✅ **备份简单**：直接复制db文件

### 性能指标
- **并发连接**：适合100-500个并发用户
- **存储容量**：支持TB级数据存储
- **查询速度**：小型数据集查询速度快

### 适用场景
- 轻量云服务器（1-4核，1-8GB内存）
- 中小型客服系统（日活1000以下）
- 快速原型开发和部署

## 📈 升级路径

### 何时考虑升级

**升级到MySQL的指标：**
- 日并发用户 > 1000
- 数据库文件 > 10GB
- 需要多服务器部署
- 需要复杂的用户权限管理

**升级到PostgreSQL的指标：**
- 需要复杂的数据分析
- 要求高级SQL功能
- 需要全文搜索
- 大数据量统计报表

### 升级实施方案

#### 方案A：SQLite → MySQL
```javascript
// 1. 创建MySQL适配器
class MySQLDatabase {
    constructor() {
        this.mysql = require('mysql2/promise');
        this.pool = this.mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'quicktalk',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'quicktalk',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }
    
    // 实现相同的接口方法...
}
```

#### 方案B：数据迁移脚本
```javascript
// migrate-to-mysql.js
const SQLiteDB = require('./database-sqlite');
const MySQLDB = require('./database-mysql');

async function migrate() {
    const sqlite = new SQLiteDB();
    const mysql = new MySQLDB();
    
    // 迁移用户数据
    const users = await sqlite.getAllUsers();
    for (const user of users) {
        await mysql.createUser(user);
    }
    
    // 迁移店铺数据
    const shops = await sqlite.getAllShops();
    for (const shop of shops) {
        await mysql.createShop(shop);
    }
    
    console.log('数据迁移完成');
}
```

## 🛠️ 实施建议

### 阶段1：当前方案（SQLite）
```bash
# 监控关键指标
- 数据库文件大小
- 并发连接数
- 响应时间
- 内存使用率
```

### 阶段2：优化SQLite
```javascript
// 数据库优化配置
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);

// 性能优化
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA synchronous = NORMAL");  
db.run("PRAGMA cache_size = 1000");
db.run("PRAGMA temp_store = memory");
```

### 阶段3：扩展准备
```bash
# 准备升级到MySQL的环境变量
NODE_ENV=production
DB_TYPE=sqlite  # 或 mysql
DB_HOST=localhost
DB_USER=quicktalk
DB_PASSWORD=your_secure_password
DB_NAME=quicktalk_prod
```

## 📊 监控指标

### SQLite监控
```bash
# 数据库大小
ls -lh data/customer_service.db

# 查看表统计
sqlite3 data/customer_service.db "SELECT name, COUNT(*) FROM sqlite_master WHERE type='table';"

# 查看数据量
sqlite3 data/customer_service.db "SELECT 'users', COUNT(*) FROM users UNION SELECT 'shops', COUNT(*) FROM shops;"
```

### 性能监控脚本
```javascript
// monitor.js - 放在项目根目录
const fs = require('fs');
const path = require('path');

function getDbStats() {
    const dbPath = path.join(__dirname, 'data', 'customer_service.db');
    const stats = fs.statSync(dbPath);
    
    console.log('数据库监控报告:');
    console.log('- 文件大小:', Math.round(stats.size / 1024 / 1024 * 100) / 100, 'MB');
    console.log('- 最后修改:', stats.mtime.toLocaleString());
    
    // 可以添加更多监控指标
}

// 每小时运行一次
setInterval(getDbStats, 3600000);
```

## 🔄 版本控制建议

### Git管理
```bash
# 忽略数据库文件（生产环境）
echo "data/*.db" >> .gitignore
echo "data/backup_*.db" >> .gitignore

# 保留数据库结构文件
git add database-sqlite.js
git add DATABASE_CONFIG.md
```

### 部署脚本
```bash
#!/bin/bash
# deploy.sh
echo "开始部署QuickTalk客服系统..."

# 1. 备份现有数据
if [ -f "data/customer_service.db" ]; then
    cp data/customer_service.db data/backup_$(date +%Y%m%d_%H%M%S).db
    echo "数据已备份"
fi

# 2. 更新代码
git pull origin master

# 3. 安装依赖
npm install

# 4. 重启服务
sudo systemctl restart quicktalk

echo "部署完成！"
```

这个方案为你的轻量云服务器提供了完整的数据库解决方案，既满足当前需求，又为未来扩展留有余地。
