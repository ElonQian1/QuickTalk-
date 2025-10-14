use anyhow::Result;
use sqlx::{sqlite::SqlitePoolOptions, Row, SqlitePool};
use tracing::info;

use crate::models::*;

#[derive(Clone)]
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .connect(database_url)
            .await?;

        Ok(Database { pool })
    }

    pub(crate) fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub async fn migrate(&self) -> Result<()> {
        info!("Running database migrations...");

        // 读取并执行 schema
        let schema = include_str!("schema.sql");

        // 先创建所有表，然后创建索引
        let statements: Vec<&str> = schema.split(';').collect();
        
        // 第一轮：只执行 CREATE TABLE 语句
        for statement in &statements {
            let statement = statement.trim();
            if !statement.is_empty() && !statement.starts_with("--") && statement.to_uppercase().contains("CREATE TABLE") {
                tracing::info!("Creating table: {}", statement.lines().nth(0).unwrap_or(""));
                match sqlx::query(statement).execute(&self.pool).await {
                    Ok(_) => {
                        tracing::debug!("Table created successfully");
                    }
                    Err(e) => {
                        let error_msg = e.to_string().to_lowercase();
                        if error_msg.contains("already exists") {
                            tracing::debug!("Table already exists, skipping");
                        } else {
                            tracing::error!("Failed to create table: {} for statement: {}", e, statement);
                            return Err(e.into());
                        }
                    }
                }
            }
        }
        
        // 第二轮：执行 CREATE INDEX 语句
        for statement in &statements {
            let statement = statement.trim();
            if !statement.is_empty() && !statement.starts_with("--") && statement.to_uppercase().contains("CREATE INDEX") {
                tracing::info!("Creating index: {}", statement.lines().nth(0).unwrap_or(""));
                match sqlx::query(statement).execute(&self.pool).await {
                    Ok(_) => {
                        tracing::debug!("Index created successfully");
                    }
                    Err(e) => {
                        let error_msg = e.to_string().to_lowercase();
                        if error_msg.contains("already exists") {
                            tracing::debug!("Index already exists, skipping");
                        } else {
                            tracing::error!("Failed to create index: {} for statement: {}", e, statement);
                            return Err(e.into());
                        }
                    }
                }
            }
        }

        // 验证关键表是否存在
        self.verify_tables().await?;

        info!("Database migrations completed");
        Ok(())
    }

    async fn verify_tables(&self) -> Result<()> {
        let required_tables = vec![
            "users", "shops", "customers", "sessions", 
            "messages", "unread_counts", "online_status", "shop_staffs"
        ];

        for table in required_tables {
            let exists: bool = sqlx::query_scalar(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name=?"
            )
            .bind(table)
            .fetch_one(&self.pool)
            .await?;

            if !exists {
                tracing::error!("Required table '{}' does not exist after migration", table);
                anyhow::bail!("Missing required table: {}", table);
            } else {
                tracing::debug!("✅ Table '{}' exists", table);
            }
        }

        tracing::info!("All required tables verified");
        Ok(())
    }

    // 用户相关操作
    pub async fn create_user(
        &self,
        username: &str,
        password_hash: &str,
        email: Option<&str>,
        phone: Option<&str>,
    ) -> Result<User> {
        let user = sqlx::query_as::<_, User>(
            "INSERT INTO users (username, password_hash, email, phone) VALUES (?, ?, ?, ?) RETURNING *"
        )
        .bind(username)
        .bind(password_hash)
        .bind(email)
        .bind(phone)
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn get_user_by_username(&self, username: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = ?")
            .bind(username)
            .fetch_optional(&self.pool)
            .await?;

        Ok(user)
    }

    pub async fn get_user_by_id(&self, id: i64) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(user)
    }

    pub async fn update_user_profile(
        &self,
        user_id: i64,
        req: &crate::models::UpdateProfileRequest,
    ) -> Result<User> {
        let user = sqlx::query_as::<_, User>(
            r#"UPDATE users
               SET email      = COALESCE(?, email),
                   phone      = COALESCE(?, phone),
                   avatar_url = COALESCE(?, avatar_url),
                   updated_at = CURRENT_TIMESTAMP
             WHERE id = ?
          RETURNING *"#,
        )
        .bind(req.email.as_deref())
        .bind(req.phone.as_deref())
        .bind(req.avatar_url.as_deref())
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn change_user_password(&self, user_id: i64, new_password_hash: &str) -> Result<()> {
        sqlx::query(
            r#"UPDATE users
               SET password_hash = ?,
                   updated_at    = CURRENT_TIMESTAMP
             WHERE id = ?"#,
        )
        .bind(new_password_hash)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // 店铺相关操作
    pub async fn create_shop(
        &self,
        owner_id: i64,
        shop_name: &str,
        shop_url: Option<&str>,
    ) -> Result<Shop> {
        let api_key = uuid::Uuid::new_v4().to_string();

        let shop = sqlx::query_as::<_, Shop>(
            "INSERT INTO shops (owner_id, shop_name, shop_url, api_key) VALUES (?, ?, ?, ?) RETURNING *"
        )
        .bind(owner_id)
        .bind(shop_name)
        .bind(shop_url)
        .bind(&api_key)
        .fetch_one(&self.pool)
        .await?;

        Ok(shop)
    }

    pub async fn get_shops_by_owner(&self, owner_id: i64) -> Result<Vec<Shop>> {
        let shops = sqlx::query_as::<_, Shop>(
            "SELECT * FROM shops WHERE owner_id = ? ORDER BY created_at DESC",
        )
        .bind(owner_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(shops)
    }

    pub async fn get_shop_by_api_key(&self, api_key: &str) -> Result<Option<Shop>> {
        let shop = sqlx::query_as::<_, Shop>("SELECT * FROM shops WHERE api_key = ?")
            .bind(api_key)
            .fetch_optional(&self.pool)
            .await?;

        Ok(shop)
    }

    pub async fn get_shop_by_id(&self, id: i64) -> Result<Option<Shop>> {
        let shop = sqlx::query_as::<_, Shop>("SELECT * FROM shops WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(shop)
    }

    // 客户相关操作
    pub async fn create_or_update_customer(
        &self,
        shop_id: i64,
        customer_id: &str,
        upsert: CustomerUpsert<'_>,
    ) -> Result<Customer> {
        // 先尝试更新
        let updated = sqlx::query(
            "UPDATE customers SET customer_name = ?, customer_email = ?, customer_avatar = ?, ip_address = ?, user_agent = ?, last_active_at = CURRENT_TIMESTAMP WHERE shop_id = ? AND customer_id = ?"
        )
    .bind(upsert.name)
    .bind(upsert.email)
    .bind(upsert.avatar)
    .bind(upsert.ip)
    .bind(upsert.user_agent)
        .bind(shop_id)
        .bind(customer_id)
        .execute(&self.pool)
        .await?;

        if updated.rows_affected() > 0 {
            // 如果更新成功，返回更新后的客户
            let customer = sqlx::query_as::<_, Customer>(
                "SELECT * FROM customers WHERE shop_id = ? AND customer_id = ?",
            )
            .bind(shop_id)
            .bind(customer_id)
            .fetch_one(&self.pool)
            .await?;

            Ok(customer)
        } else {
            // 如果没有更新任何行，说明客户不存在，创建新客户
            let customer = sqlx::query_as::<_, Customer>(
                "INSERT INTO customers (shop_id, customer_id, customer_name, customer_email, customer_avatar, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *"
            )
            .bind(shop_id)
            .bind(customer_id)
            .bind(upsert.name)
            .bind(upsert.email)
            .bind(upsert.avatar)
            .bind(upsert.ip)
            .bind(upsert.user_agent)
            .fetch_one(&self.pool)
            .await?;

            Ok(customer)
        }
    }

    pub async fn get_customers_by_shop(&self, shop_id: i64) -> Result<Vec<Customer>> {
        let customers = sqlx::query_as::<_, Customer>(
            "SELECT * FROM customers WHERE shop_id = ? ORDER BY last_active_at DESC",
        )
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(customers)
    }

    /// 聚合查询：返回某店铺下客户 + 其最近活跃会话 + 会话最近一条消息 + 未读数
    pub async fn get_customers_overview_by_shop(
        &self,
        shop_id: i64,
    ) -> Result<Vec<CustomerWithSession>> {
        // 说明：
        // - 选取每个客户最近的 active 会话（按 created_at 降序取 1 条）
        // - 再选取该会话最近一条消息（按 created_at 降序取 1 条）
        // - 连接未读计数表（没有则为 0）
        // - 返回顺序按客户 last_active_at 降序
        let rows = sqlx::query(
            r#"
            SELECT
              c.*, 
              s.id              AS s_id,
              s.shop_id         AS s_shop_id,
              s.customer_id     AS s_customer_id,
              s.staff_id        AS s_staff_id,
              s.session_status  AS s_session_status,
              s.created_at      AS s_created_at,
              s.closed_at       AS s_closed_at,
              s.last_message_at AS s_last_message_at,
              m.id              AS m_id,
              m.session_id      AS m_session_id,
              m.sender_type     AS m_sender_type,
              m.sender_id       AS m_sender_id,
              m.content         AS m_content,
              m.message_type    AS m_message_type,
              m.file_url        AS m_file_url,
              m.status          AS m_status,
              m.created_at      AS m_created_at,
              COALESCE(uc.unread_count, 0) AS unread_count
            FROM customers c
            LEFT JOIN sessions s
              ON s.id = (
                SELECT id FROM sessions
                 WHERE shop_id = c.shop_id AND customer_id = c.id AND session_status = 'active'
                 ORDER BY created_at DESC LIMIT 1
              )
            LEFT JOIN messages m
              ON m.id = (
                SELECT id FROM messages
                 WHERE session_id = s.id
                 ORDER BY created_at DESC LIMIT 1
              )
            LEFT JOIN unread_counts uc
              ON uc.shop_id = c.shop_id AND uc.customer_id = c.id
            WHERE c.shop_id = ?
            ORDER BY c.last_active_at DESC
            "#,
        )
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            // 映射 Customer
            let customer = Customer {
                id: row.try_get("id")?,
                shop_id: row.try_get("shop_id")?,
                customer_id: row.try_get("customer_id")?,
                customer_name: row.try_get("customer_name")?,
                customer_email: row.try_get("customer_email")?,
                customer_avatar: row.try_get("customer_avatar")?,
                ip_address: row.try_get("ip_address")?,
                user_agent: row.try_get("user_agent")?,
                first_visit_at: row.try_get("first_visit_at")?,
                last_active_at: row.try_get("last_active_at")?,
                status: row.try_get("status")?,
            };

            // 映射 Session（可空）
            let session: Option<Session> = match row.try_get::<Option<i64>, _>("s_id")? {
                Some(sid) => Some(Session {
                    id: sid,
                    shop_id: row.try_get("s_shop_id")?,
                    customer_id: row.try_get("s_customer_id")?,
                    staff_id: row.try_get("s_staff_id")?,
                    session_status: row.try_get("s_session_status")?,
                    created_at: row.try_get("s_created_at")?,
                    closed_at: row.try_get("s_closed_at")?,
                    last_message_at: row.try_get("s_last_message_at")?,
                }),
                None => None,
            };

            // 映射 Message（可空）
            let last_message: Option<Message> = match row.try_get::<Option<i64>, _>("m_id")? {
                Some(mid) => Some(Message {
                    id: mid,
                    session_id: row.try_get("m_session_id")?,
                    sender_type: row.try_get("m_sender_type")?,
                    sender_id: row.try_get("m_sender_id")?,
                    content: row.try_get("m_content")?,
                    message_type: row.try_get("m_message_type")?,
                    file_url: row.try_get("m_file_url")?,
                    status: row.try_get("m_status")?,
                    created_at: row.try_get("m_created_at")?,
                }),
                None => None,
            };

            let unread_count: i32 = row.try_get("unread_count")?;

            result.push(CustomerWithSession {
                customer,
                session,
                last_message,
                unread_count,
            });
        }

        Ok(result)
    }

    // 会话相关操作
    pub async fn create_session(&self, shop_id: i64, customer_id: i64) -> Result<Session> {
        let session = sqlx::query_as::<_, Session>(
            "INSERT INTO sessions (shop_id, customer_id) VALUES (?, ?) RETURNING *",
        )
        .bind(shop_id)
        .bind(customer_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(session)
    }

    pub async fn get_session_by_shop_customer(
        &self,
        shop_id: i64,
        customer_id: i64,
    ) -> Result<Option<Session>> {
        let session = sqlx::query_as::<_, Session>(
            "SELECT * FROM sessions WHERE shop_id = ? AND customer_id = ? AND session_status = 'active' ORDER BY created_at DESC LIMIT 1"
        )
        .bind(shop_id)
        .bind(customer_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(session)
    }

    // 消息相关操作
    pub async fn create_message(
        &self,
        session_id: i64,
        sender_type: &str,
        sender_id: Option<i64>,
        content: &str,
        message_type: &str,
        file_url: Option<&str>,
    ) -> Result<Message> {
        let message = sqlx::query_as::<_, Message>(
            "INSERT INTO messages (session_id, sender_type, sender_id, content, message_type, file_url) VALUES (?, ?, ?, ?, ?, ?) RETURNING *"
        )
        .bind(session_id)
        .bind(sender_type)
        .bind(sender_id)
        .bind(content)
        .bind(message_type)
        .bind(file_url)
        .fetch_one(&self.pool)
        .await?;

        // 更新会话的最后消息时间
        sqlx::query("UPDATE sessions SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(session_id)
            .execute(&self.pool)
            .await?;

        Ok(message)
    }

    pub async fn get_session_by_id(&self, session_id: i64) -> Result<Option<Session>> {
        let session = sqlx::query_as::<_, Session>("SELECT * FROM sessions WHERE id = ?")
            .bind(session_id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(session)
    }

    pub async fn get_customer_by_id(&self, customer_id: i64) -> Result<Option<Customer>> {
        let customer = sqlx::query_as::<_, Customer>("SELECT * FROM customers WHERE id = ?")
            .bind(customer_id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(customer)
    }

    // 店铺员工管理
    pub async fn list_shop_staff(&self, shop_id: i64) -> Result<Vec<(UserPublic, String)>> {
        // 返回 (用户公开信息, 角色)，包含店主与员工：店主用 owner 角色
        let mut staff: Vec<(UserPublic, String)> = Vec::new();

        // 店主
        if let Some(owner) = sqlx::query_as::<_, User>("SELECT u.* FROM users u JOIN shops s ON s.owner_id = u.id WHERE s.id = ?")
            .bind(shop_id)
            .fetch_optional(&self.pool)
            .await? {
            staff.push((owner.into(), "owner".to_string()));
        }

        // 员工
        let rows = match sqlx::query(
            r#"SELECT u.id, u.username, u.email, u.phone, u.avatar_url, ss.role
               FROM shop_staffs ss JOIN users u ON ss.user_id = u.id
               WHERE ss.shop_id = ? ORDER BY ss.created_at DESC"#
        )
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await {
            Ok(rows) => rows,
            Err(e) => {
                let msg = e.to_string().to_lowercase();
                if msg.contains("no such table") && msg.contains("shop_staffs") {
                    // 旧库尚未包含表：返回仅包含店主的列表
                    return Ok(staff);
                } else {
                    return Err(e.into());
                }
            }
        };

        for row in rows {
            let user_pub = UserPublic {
                id: row.try_get("id")?,
                username: row.try_get("username")?,
                email: row.try_get("email")?,
                phone: row.try_get("phone")?,
                avatar_url: row.try_get("avatar_url")?,
            };
            let role: Option<String> = row.try_get("role").ok();
            staff.push((user_pub, role.unwrap_or_else(|| "staff".to_string())));
        }

        Ok(staff)
    }

    pub async fn add_shop_staff_by_username(&self, shop_id: i64, username: &str, role: Option<&str>) -> Result<()> {
        tracing::info!(target: "database", "add_shop_staff_by_username: shop_id={}, username={}", shop_id, username);
        
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = ?")
            .bind(username)
            .fetch_optional(&self.pool)
            .await?;
        let Some(user) = user else { 
            tracing::error!(target: "database", "user_not_found: username={}", username);
            anyhow::bail!("user_not_found"); 
        };
        
        tracing::info!(target: "database", "found user: id={}, username={}", user.id, user.username);

        // 防止把店主重复加入员工表
        let owner_id: Option<i64> = sqlx::query_scalar("SELECT owner_id FROM shops WHERE id = ?")
            .bind(shop_id)
            .fetch_optional(&self.pool)
            .await?;
        if let Some(oid) = owner_id {
            if oid == user.id {
                tracing::info!(target: "database", "user {} is already owner of shop {}, skipping", user.id, shop_id);
                // 店主天然拥有权限，无需加入员工表
                return Ok(());
            }
        } else {
            tracing::error!(target: "database", "shop {} not found", shop_id);
            anyhow::bail!("shop_not_found");
        }

        // 若已是成员，则返回明确错误，前端可友好提示（容错：表缺失时尝试迁移）
        let exists: Option<i64> = match sqlx::query_scalar(
            "SELECT id FROM shop_staffs WHERE shop_id = ? AND user_id = ? LIMIT 1",
        )
        .bind(shop_id)
        .bind(user.id)
        .fetch_optional(&self.pool)
        .await {
            Ok(v) => v,
            Err(e) => {
                let msg = e.to_string().to_lowercase();
                if msg.contains("no such table") && msg.contains("shop_staffs") {
                    tracing::warn!(target: "database", "shop_staffs table missing, creating it");
                    // 表缺失：直接创建表
                    let create_table_sql = r#"
                        CREATE TABLE IF NOT EXISTS shop_staffs (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            shop_id INTEGER NOT NULL,
                            user_id INTEGER NOT NULL,
                            role VARCHAR(20) NOT NULL DEFAULT 'staff',
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(shop_id, user_id),
                            FOREIGN KEY (shop_id) REFERENCES shops(id),
                            FOREIGN KEY (user_id) REFERENCES users(id)
                        )
                    "#;
                    sqlx::query(create_table_sql).execute(&self.pool).await?;
                    tracing::info!(target: "database", "shop_staffs table created successfully");
                    None
                } else {
                    return Err(e.into());
                }
            }
        };
        if exists.is_some() {
            anyhow::bail!("already_member");
        }

        let the_role = role.unwrap_or("staff");
        // 插入或忽略（若已存在），容错：表缺失时迁移后重试
        let insert_res = sqlx::query(
            "INSERT OR IGNORE INTO shop_staffs (shop_id, user_id, role) VALUES (?, ?, ?)"
        )
        .bind(shop_id)
        .bind(user.id)
        .bind(the_role)
        .execute(&self.pool)
        .await;

        if let Err(e) = insert_res {
            let msg = e.to_string().to_lowercase();
            if msg.contains("no such table") && msg.contains("shop_staffs") {
                self.migrate().await?;
                sqlx::query(
                    "INSERT OR IGNORE INTO shop_staffs (shop_id, user_id, role) VALUES (?, ?, ?)"
                )
                .bind(shop_id)
                .bind(user.id)
                .bind(the_role)
                .execute(&self.pool)
                .await?;
            } else {
                return Err(e.into());
            }
        }

        Ok(())
    }

    pub async fn is_shop_owner(&self, shop_id: i64, user_id: i64) -> Result<bool> {
        let owner_id: Option<i64> = sqlx::query_scalar("SELECT owner_id FROM shops WHERE id = ?")
            .bind(shop_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(owner_id.map(|oid| oid == user_id).unwrap_or(false))
    }

    pub async fn is_shop_member(&self, shop_id: i64, user_id: i64) -> Result<bool> {
        if self.is_shop_owner(shop_id, user_id).await? {
            return Ok(true);
        }
        let exists: Option<i64> = match sqlx::query_scalar(
            "SELECT id FROM shop_staffs WHERE shop_id = ? AND user_id = ? LIMIT 1",
        )
        .bind(shop_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await {
            Ok(v) => v,
            Err(e) => {
                let msg = e.to_string().to_lowercase();
                if msg.contains("no such table") && msg.contains("shop_staffs") {
                    // 表不存在 => 视为非成员
                    None
                } else {
                    return Err(e.into());
                }
            }
        };
        Ok(exists.is_some())
    }

    pub async fn remove_shop_staff(&self, shop_id: i64, user_id: i64) -> Result<u64> {
        let result = match sqlx::query("DELETE FROM shop_staffs WHERE shop_id = ? AND user_id = ?")
            .bind(shop_id)
            .bind(user_id)
            .execute(&self.pool)
            .await {
                Ok(res) => res,
                Err(e) => {
                    let msg = e.to_string().to_lowercase();
                    if msg.contains("no such table") && msg.contains("shop_staffs") {
                        // 表不存在 => 视为未删除任何行
                        return Ok(0);
                    } else {
                        return Err(e.into());
                    }
                }
            };
        Ok(result.rows_affected())
    }

    pub async fn get_messages_by_session(
        &self,
        session_id: i64,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<Message>> {
        let messages = sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(session_id)
        .bind(limit.unwrap_or(50))
        .bind(offset.unwrap_or(0))
        .fetch_all(&self.pool)
        .await?;

        Ok(messages)
    }

    // 未读消息统计
    pub async fn update_unread_count(
        &self,
        shop_id: i64,
        customer_id: i64,
        increment: i32,
    ) -> Result<()> {
        sqlx::query(
            "INSERT INTO unread_counts (shop_id, customer_id, unread_count) VALUES (?, ?, ?) 
             ON CONFLICT(shop_id, customer_id) DO UPDATE SET 
             unread_count = unread_count + ?, updated_at = CURRENT_TIMESTAMP",
        )
        .bind(shop_id)
        .bind(customer_id)
        .bind(increment)
        .bind(increment)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn reset_unread_count(&self, shop_id: i64, customer_id: i64) -> Result<()> {
        sqlx::query(
            "UPDATE unread_counts SET unread_count = 0, updated_at = CURRENT_TIMESTAMP 
             WHERE shop_id = ? AND customer_id = ?",
        )
        .bind(shop_id)
        .bind(customer_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn reset_unread_all_in_shop(&self, shop_id: i64) -> Result<()> {
        sqlx::query(
            "UPDATE unread_counts SET unread_count = 0, updated_at = CURRENT_TIMESTAMP \
             WHERE shop_id = ?",
        )
        .bind(shop_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_unread_count(&self, shop_id: i64, customer_id: i64) -> Result<i32> {
        let count: Option<i32> = sqlx::query_scalar(
            "SELECT unread_count FROM unread_counts WHERE shop_id = ? AND customer_id = ?",
        )
        .bind(shop_id)
        .bind(customer_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(count.unwrap_or(0))
    }
}
