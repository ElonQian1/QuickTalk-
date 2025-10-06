use sqlx::{SqlitePool, Row};
use crate::api::errors::{ApiError, db_helpers};

/// 通用查询助手函数
pub struct QueryHelpers;

impl QueryHelpers {
    /// 获取管理员基本信息 (username, email)
    pub async fn get_admin_info(db: &SqlitePool, admin_id: &str) -> Result<(String, String), ApiError> {
        let admin_row = sqlx::query("SELECT username, email FROM admins WHERE id = ?")
            .bind(admin_id)
            .fetch_one(db)
            .await
            .map_err(|e| db_helpers::handle_fetch_error(e, "admin info"))?;
        
        let username: String = admin_row.try_get("username").unwrap_or_else(|_| String::new());
        let email: String = admin_row.try_get("email").unwrap_or_else(|_| String::new());
        
        Ok((username, email))
    }

    /// 获取管理员角色和用户名
    pub async fn get_admin_role_and_username(db: &SqlitePool, admin_id: &str) -> Result<(String, String), ApiError> {
        let row = sqlx::query("SELECT role, username FROM admins WHERE id = ?")
            .bind(admin_id)
            .fetch_one(db)
            .await
            .map_err(|e| db_helpers::handle_fetch_error(e, "admin role lookup"))?;
        
        let role: String = row.get("role");
        let username: String = row.get("username");
        
        Ok((role, username))
    }

    /// 检查用户名是否存在
    pub async fn check_username_exists(db: &SqlitePool, username: &str) -> Result<bool, ApiError> {
        let row = sqlx::query("SELECT username FROM admins WHERE username = ?")
            .bind(username)
            .fetch_optional(db)
            .await
            .map_err(|e| db_helpers::handle_fetch_error(e, "username check"))?;
        
        Ok(row.is_some())
    }

    /// 统计超级管理员数量
    pub async fn count_super_admins(db: &SqlitePool) -> Result<i64, ApiError> {
        let row = sqlx::query("SELECT COUNT(*) as count FROM admins WHERE role = 'super_admin'")
            .fetch_one(db)
            .await
            .map_err(|e| db_helpers::handle_count_error(e, "super_admin"))?;
        
        Ok(row.get("count"))
    }

    /// 获取系统统计信息 (管理员、商店、客户数量)
    pub async fn get_system_counts(db: &SqlitePool) -> Result<(i64, i64, i64), ApiError> {
        let admin_count = sqlx::query("SELECT COUNT(*) as c FROM admins")
            .fetch_one(db)
            .await
            .map_err(|e| db_helpers::handle_count_error(e, "admins"))?
            .get::<i64, _>("c");

        let shop_count = Self::count_shops(db).await?;

        let customer_count = sqlx::query("SELECT COUNT(*) as c FROM customers")
            .fetch_one(db)
            .await
            .map_err(|e| db_helpers::handle_count_error(e, "customers"))?
            .get::<i64, _>("c");

        Ok((admin_count, shop_count, customer_count))
    }

    /// 获取所有管理员列表 (用于超级管理员查看)
    pub async fn get_all_admins(db: &SqlitePool) -> Result<Vec<sqlx::sqlite::SqliteRow>, ApiError> {
        sqlx::query("SELECT id, username, role, created_at FROM admins ORDER BY created_at")
            .fetch_all(db)
            .await
            .map_err(|e| db_helpers::handle_list_error(e, "admins"))
    }

    /// 获取所有商店列表 (用于超级管理员查看)  
    pub async fn get_all_shops(db: &SqlitePool) -> Result<Vec<sqlx::sqlite::SqliteRow>, ApiError> {
        sqlx::query("SELECT id, name, owner_id, status, created_at FROM shops ORDER BY created_at")
            .fetch_all(db)
            .await
            .map_err(|e| db_helpers::handle_list_error(e, "shops"))
    }

    /// 获取用户拥有的商店列表
    pub async fn get_owned_shops(db: &SqlitePool, owner_id: &str) -> Result<Vec<sqlx::sqlite::SqliteRow>, ApiError> {
        sqlx::query("SELECT id, name, status, created_at FROM shops WHERE owner_id = ? ORDER BY created_at DESC")
            .bind(owner_id)
            .fetch_all(db)
            .await
            .map_err(|e| db_helpers::handle_fetch_error(e, "owned shops"))
    }

    /// 获取商店总数
    pub async fn count_shops(db: &SqlitePool) -> Result<i64, ApiError> {
        let row = sqlx::query("SELECT COUNT(*) as c FROM shops")
            .fetch_one(db)
            .await
            .map_err(|e| db_helpers::handle_count_error(e, "shops"))?;
        
        Ok(row.get("c"))
    }

    /// 检查域名是否可用
    pub async fn check_domain_availability(db: &SqlitePool, domain: &str) -> Result<bool, ApiError> {
        let row = sqlx::query("SELECT COUNT(*) as c FROM shops WHERE domain = ?")
            .bind(domain)
            .fetch_one(db)
            .await
            .map_err(|e| db_helpers::handle_domain_check_error(e))?;
        
        let cnt: i64 = row.get("c");
        Ok(cnt == 0)
    }
}