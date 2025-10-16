# SQLx 编译时检查配置指南

## 🎯 问题

SQLx 没有在编译时检查 SQL 查询，导致数据库列名错误（如 `s.name` vs `s.shop_name`）在运行时才发现。

## 🔍 为什么没有检查？

当前代码使用的是 `sqlx::query_as::<_, T>()` 运行时查询，而不是编译时检查的 `sqlx::query!` 宏。

**现有代码：**
```rust
// ❌ 运行时检查（不会在编译时发现错误）
let rows = sqlx::query_as::<_, ShopWithUnreadProjection>(sql)
    .bind(owner_id)
    .fetch_all(db.pool())
    .await?;
```

**应该改为：**
```rust
// ✅ 编译时检查（会在编译时发现SQL错误）
let rows = sqlx::query!("SELECT id, owner_id, shop_name ...")
    .fetch_all(db.pool())
    .await?;
```

## 📋 解决方案

### 方案 1：使用 `sqlx::query!` 宏（最佳 ✅）

#### 优点：
- ✅ 编译时完全验证 SQL
- ✅ 自动生成类型安全的结构体
- ✅ IDE 自动补全支持
- ✅ 编译时发现列名错误

#### 步骤：

1. **配置数据库 URL**

创建 `.env` 文件（backend 目录）：
```bash
# 使用服务器真实数据库
DATABASE_URL=sqlite:../服务器数据库/customer_service.db
```

2. **修改代码使用 query! 宏**

```rust
// 修改 backend/src/services/metrics.rs

pub async fn fetch_shops_with_unread_by_owner(
    db: &Database,
    owner_id: i64,
) -> Result<Vec<ShopWithUnreadCount>> {
    // ✅ 使用 query! 宏（编译时检查）
    let rows = sqlx::query!(
        r#"
        SELECT 
            s.id,
            s.owner_id,
            s.shop_name,
            s.shop_url,
            s.api_key,
            CASE WHEN s.is_active THEN 1 ELSE 0 END AS status,
            s.created_at,
            s.updated_at,
            0 AS unread_total
        FROM shops s
        WHERE s.owner_id = ?
        ORDER BY s.created_at DESC
        "#,
        owner_id
    )
    .fetch_all(db.pool())
    .await?;

    let result = rows
        .into_iter()
        .map(|row| ShopWithUnreadCount {
            shop: Shop {
                id: row.id,
                owner_id: row.owner_id,
                shop_name: row.shop_name,
                shop_url: row.shop_url,
                api_key: row.api_key,
                status: row.status,
                created_at: row.created_at,
                updated_at: row.updated_at,
            },
            unread_count: row.unread_total.unwrap_or(0) as i32,
        })
        .collect();

    Ok(result)
}
```

3. **编译时自动验证**

```bash
# 现在编译时会检查：
cargo build

# 如果SQL有错误，会看到：
error: no column named `name` in table `shops`
  --> src/services/metrics.rs:35:13
   |
35 |             s.name AS shop_name,
   |             ^^^^^^
```

### 方案 2：使用离线模式（可选 ⚠️）

如果不想每次编译都连接数据库：

```bash
# 1. 生成元数据
DATABASE_URL=sqlite:../服务器数据库/customer_service.db cargo sqlx prepare

# 2. 启用离线模式
export SQLX_OFFLINE=true

# 3. 编译（使用缓存的元数据）
cargo build
```

但这需要使用 `query!` 宏，而不是 `query_as`。

## 🔧 当前项目改进建议

### 短期方案（快速修复）

1. **添加数据库验证脚本**

创建 `backend/scripts/verify-sql.sh`：
```bash
#!/bin/bash
# 验证所有SQL查询
DATABASE_URL="sqlite:../服务器数据库/customer_service.db" cargo check
```

2. **添加 CI 检查**

在 `.github/workflows/ci.yml` 添加：
```yaml
- name: Verify SQL queries
  run: |
    DATABASE_URL=sqlite:服务器数据库/customer_service.db cargo check
```

### 长期方案（推荐重构）

将所有 `query_as` 改为 `query!` 宏：

**文件优先级：**
1. ✅ `services/metrics.rs` - 已修复列名
2. 🔄 改用 `query!` 宏（下一步）
3. 🔄 其他 repository 文件

## 📊 对比

| 方法 | 编译时检查 | 运行时性能 | 类型安全 | 推荐 |
|------|----------|----------|---------|------|
| `query_as` | ❌ 否 | ✅ 好 | ⚠️ 部分 | ❌ |
| `query!` | ✅ 是 | ✅ 好 | ✅ 完全 | ✅ |
| `query_as!` | ✅ 是 | ✅ 好 | ✅ 完全 | ✅ |

## 🎯 下一步行动

1. ✅ **已完成**: 修复 `metrics.rs` 中的列名错误
2. 🔄 **建议**: 将 `query_as` 改为 `query!` 宏
3. 🔄 **建议**: 添加 pre-commit hook 验证 SQL
4. 🔄 **建议**: 配置 CI 自动检查

## 📚 参考资料

- [SQLx 官方文档](https://github.com/launchbadge/sqlx)
- [Compile-time verification](https://github.com/launchbadge/sqlx#compile-time-verification)
- [Offline mode](https://github.com/launchbadge/sqlx/blob/main/sqlx-cli/README.md#enable-building-in-offline-mode-with-query)
