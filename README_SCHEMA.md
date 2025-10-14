# 数据库基线 Schema 与迁移规范

> 架构版本: v1 基线（与当前实际 `backend/customer_service.db` 完全对齐）  
> 不改变现有 SQLite 物理结构，只通过新增迁移实现未来演进。

## 1. 基线表结构（物理表）

### 1.1 users
```
id                INTEGER PK AUTOINCREMENT
username          VARCHAR(50) UNIQUE NOT NULL
password_hash     VARCHAR(255) NOT NULL
email             VARCHAR(100) UNIQUE NULL
phone             VARCHAR(20) NULL
avatar_url        VARCHAR(255) NULL
status            INTEGER DEFAULT 1        -- 1=active 0=disabled
created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
```

### 1.2 shops
```
id                INTEGER PK AUTOINCREMENT
owner_id          INTEGER NULL (FK users.id, 可为空)
shop_name         VARCHAR(100) NOT NULL
shop_url          VARCHAR(255) NULL
api_key           VARCHAR(64) UNIQUE NOT NULL
status            INTEGER DEFAULT 1
created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
```

### 1.3 customers
```
id                INTEGER PK AUTOINCREMENT
shop_id           INTEGER NOT NULL (FK shops.id)
customer_id       VARCHAR(100) NOT NULL            -- 外部访客/终端标识
customer_name     VARCHAR(100) NULL
customer_email    VARCHAR(100) NULL
customer_avatar   VARCHAR(255) NULL
ip_address        VARCHAR(45) NULL
user_agent        TEXT NULL
first_visit_at    DATETIME DEFAULT CURRENT_TIMESTAMP
last_active_at    DATETIME DEFAULT CURRENT_TIMESTAMP
status            INTEGER DEFAULT 1                -- 1=active 0=blocked
UNIQUE(shop_id, customer_id)
```

### 1.4 sessions
```
id                INTEGER PK AUTOINCREMENT
shop_id           INTEGER NOT NULL (FK shops.id)
customer_id       INTEGER NOT NULL (FK customers.id)
staff_id          INTEGER NULL (FK users.id)
session_status    VARCHAR(20) DEFAULT 'active'  -- active / closed
created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
closed_at         DATETIME NULL
last_message_at   DATETIME DEFAULT CURRENT_TIMESTAMP
```

### 1.5 messages
```
id                INTEGER PK AUTOINCREMENT
session_id        INTEGER NOT NULL (FK sessions.id)
sender_type       VARCHAR(10) NOT NULL           -- staff/customer/system
sender_id         INTEGER NULL                   -- 对应 staff 或 customer 主键
content           TEXT NOT NULL
message_type      VARCHAR(20) DEFAULT 'text'
file_url          VARCHAR(255) NULL
status            VARCHAR(20) DEFAULT 'sent'     -- sent / deleted / ...
created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
```

### 1.6 unread_counts
```
id                    INTEGER PK AUTOINCREMENT
shop_id               INTEGER NOT NULL (FK shops.id)
customer_id           INTEGER NOT NULL (FK customers.id)
unread_count          INTEGER DEFAULT 0
last_read_message_id  INTEGER NULL (FK messages.id)
updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
UNIQUE(shop_id, customer_id)
```
> 设计说明：采用 (shop_id, customer_id) 粒度聚合全量未读。未来若需“按客服”维度，需要新增扩展表，而不是修改该表结构。

### 1.7 shop_staffs
```
id            INTEGER PK AUTOINCREMENT
shop_id       INTEGER NOT NULL (FK shops.id)
user_id       INTEGER NOT NULL (FK users.id)
role          VARCHAR(20) DEFAULT 'staff'
created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
UNIQUE(shop_id, user_id)
```
> 历史代码里引用的 permissions / is_active / joined_at / updated_at 等列在物理表中不存在——已移除对应写入逻辑。

### 1.8 online_status
```
id            INTEGER PK AUTOINCREMENT
user_type     VARCHAR(10) NOT NULL      -- staff / customer
user_id       INTEGER NOT NULL
shop_id       INTEGER NULL (FK shops.id)
websocket_id  VARCHAR(100) NULL         -- 当前连接ID（可选）
last_ping_at  DATETIME DEFAULT CURRENT_TIMESTAMP
status        VARCHAR(20) DEFAULT 'online'
```

## 2. Sea-ORM 迁移策略

### 2.1 基线锁定
当前 `migration/src` 下的 20241014_* 系列迁移文件已经与现存 SQLite 实际表结构对齐，视为“基线”。  
后续任何结构演进：只能新增新的迁移文件，禁止向后修改、重写或删除既有迁移。  

### 2.2 新增字段 / 表流程
1. 评估是否能通过派生表或派生视图实现（尽量避免写扩展列污染主交易表）。
2. 必须新增 `mYYYYMMDD_HHMMSS_<action>_<table>.rs` 迁移文件：
   - 新增列：使用 `ALTER TABLE ... ADD COLUMN`（SQLite 限制：不能直接 DROP 列或改类型）。
   - 新增关联/索引：使用 `create_index`。
3. 更新对应 `entities/<table>.rs` 模型文件，字段添加 `#[sea_orm(column_name = ...)]` 保持命名一致。
4. 如果 API 层 / repository 使用新列，添加最小回退保护（例如：`if column exists` 的兼容查询，直到大多数节点升级完成）。
5. 运行：`cargo run --bin customer-service-backend`（启动自动执行迁移 & 健康检查）。

### 2.3 不允许的做法
- 修改或重排历史迁移（造成历史节点回放失败）
- 使用手工 SQL 直接改物理表而不写迁移文件
- 在前端假设尚未部署的字段存在

## 3. Schema 健康检查
启动时 `database_orm::run_migrations` 最后执行：
- PRAGMA `table_info(table)` 收集列集合
- 与硬编码 expected map 比较
- 打印缺失 / 额外列警告（`schema_health` target）

### 3.1 使用方式
查看启动日志：
```
schema health: 所有表列集合符合基线
# 或
WARN schema_health: 表 sessions 差异 => 缺失列: ["last_message_at"] 额外列: ["foo_test"]
```

### 3.2 处理策略
- 缺失列：确认是否尚未运行最新迁移 → 补跑迁移
- 额外列：判断是否是临时测试 → 若需要正式纳入，新增迁移文件补全 entity；否则清理

## 4. 代码层与物理层差异清单（当前已修复）
| 范畴 | 历史代码错误引用 | 实际表 | 修复方式 |
|------|------------------|--------|----------|
| sessions | session_id(字符串), priority, ended_at, updated_at | 无这些列 | 删除引用，使用 id / closed_at / last_message_at |
| customers | created_at / updated_at / is_blocked 字段访问 | 列名为 first_visit_at / last_active_at / status | From 映射层改用现有列，移除 is_blocked 逻辑 |
| unread_counts | (session_id, staff_id) 维度 | (shop_id, customer_id) | 重写实体与仓库 |
| shop_staffs | permissions / is_active / updated_at / joined_at | 仅基本四列 | 删除写入引用（保留最小角色功能） |
| messages | rich_content / metadata / deleted_at / updated_at 等 | 精简结构 | 现实体仍包含更多字段（考虑后续迁移补齐或再裁剪） |

> 注意：messages 实体当前字段超出物理表（例如 rich_content / metadata / is_deleted / updated_at 等），其写入路径需保持与实际列兼容 —— 若要引入这些能力需添加迁移文件。

## 5. 未来演进建议
| 需求场景 | 建议策略 | 迁移示例 |
|----------|----------|----------|
| 消息软删除 / 富内容 | 为 messages 添加 is_deleted / updated_at / metadata / rich_content 列 | 新增迁移：`ADD COLUMN is_deleted INTEGER DEFAULT 0` 等 |
| 多客服分别未读数 | 新建 `unread_counts_staff` 表 (session_id, staff_id, unread_count, updated_at) | 创建新表迁移，不改现有 unread_counts |
| 客服接入优先级 | 在 sessions 添加 priority INTEGER DEFAULT 0 | ALTER TABLE + 更新 repository 恢复 set_priority 真功能 |
| 客户封禁扩展 | customers 增加 blocked_reason / blocked_at | 新增列，保留现有 status 语义 |
| Shop 权限粒度 | 新建 `shop_staff_permissions` 关联表 而非在 shop_staffs 内加 JSON | 独立表更清晰，可多行表示权限集合 |

## 6. 新增迁移文件模板（示例）
```
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Messages::Table)
                    .add_column(
                        ColumnDef::new(Messages::IsDeleted)
                            .integer()
                            .not_null()
                            .default(0)
                    )
                    .to_owned()
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // SQLite 不支持 DROP COLUMN（除非 rebuild），down 可选择 no-op 或 rebuild 逻辑
        Ok(())
    }
}

#[derive(Iden)]
enum Messages { Table, IsDeleted }
```
> SQLite 限制：复杂变更（删除列 / 修改类型）需要“重建表”方案（建临时表→拷贝数据→重命名），应谨慎执行。

## 7. 新字段与实体更新 Checklist
- [ ] 新迁移文件创建 & 通过编译
- [ ] 运行服务自动执行迁移（或 CI `Migrator::up`）
- [ ] 更新 `entities/<table>.rs` 字段
- [ ] 更新 repository / service 逻辑（保持向后兼容）
- [ ] 启动日志 schema health 无差异
- [ ] 编写最小回归测试（查询 / 插入新字段）
- [ ] 文档（README_SCHEMA.md）若新增通用规范需同步

## 8. 健康检查扩展方向
- 校验索引存在性（PRAGMA index_list + index_info）
- 校验外键（PRAGMA foreign_key_list）
- 统计漂移（额外临时表）
- 生成 JSON 报告供前端展示“迁移状态”

## 9. 常见问题 (FAQ)
| 问题 | 原因 | 解决 |
|------|------|------|
| 运行时报缺列 | 忘记添加迁移或 SQLite 文件是旧版本 | 备份旧 DB -> 运行最新服务执行迁移 |
| 需要删除列 | SQLite 不支持直接 drop | 新建临时表 + 复制数据 + 重命名；或保留列做软废弃 |
| 多人并行改 schema 冲突 | 重写同一历史迁移 | 使用新增迁移累加，禁止修改已有文件 |
| 未读数逻辑不满足多客服 | 模型粒度不足 | 新建扩展表，不破坏基线 |

## 10. 总结
该文档确立了“基线锁定 + 增量迁移”模式，结合启动健康检查可及时发现漂移。未来所有结构演进需遵循：
1. 不改历史，只加新迁移。
2. 兼容部署次序差异（新增列提供默认值）。
3. 优先扩展新表替代向核心交易表添加可选列。
4. 健康检查与代码审查双重把关。

---
维护者：项目团队  
更新时间：2025-10-15
