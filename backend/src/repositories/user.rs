//! User Repository - 用户数据访问层
//! 
//! 职责：
//! - 用户的创建、查询、更新、删除
//! - 认证相关查询

use anyhow::Result;
use sea_orm::*;
use crate::entities::{users, prelude::*};

pub struct UserRepository;

impl UserRepository {
    /// 根据用户名查找用户
    pub async fn find_by_username(db: &DatabaseConnection, username: &str) -> Result<Option<users::Model>> {
        let user = Users::find()
            .filter(users::Column::Username.eq(username))
            .one(db)
            .await?;
        Ok(user)
    }
    
    /// 根据 ID 查找用户
    pub async fn find_by_id(db: &DatabaseConnection, id: i32) -> Result<Option<users::Model>> {
        let user = Users::find_by_id(id).one(db).await?;
        Ok(user)
    }
    
    /// 根据邮箱查找用户
    pub async fn find_by_email(db: &DatabaseConnection, email: &str) -> Result<Option<users::Model>> {
        let user = Users::find()
            .filter(users::Column::Email.eq(email))
            .one(db)
            .await?;
        Ok(user)
    }
    
    /// 创建新用户
    pub async fn create(
        db: &DatabaseConnection,
        username: String,
        password_hash: String,
        email: Option<String>,
        phone: Option<String>,
        _role: Option<String>, // 暂时忽略role参数，因为数据库表中没有这个字段
    ) -> Result<users::Model> {
        println!("UserRepository::create - 创建用户: {}", username);
        
        let user = users::ActiveModel {
            username: Set(username),
            password_hash: Set(password_hash),
            email: Set(email),
            phone: Set(phone),
            avatar_url: Set(None),
            status: Set(1), // 1表示活跃状态
            created_at: Set(chrono::Utc::now().naive_utc()),
            updated_at: Set(chrono::Utc::now().naive_utc()),
            ..Default::default()
        };
        
        println!("UserRepository::create - 插入用户到数据库");
        let result = user.insert(db).await.map_err(|e| {
            println!("UserRepository::create - 数据库插入失败: {:?}", e);
            e
        })?;
        
        println!("UserRepository::create - 用户创建成功: {:?}", result);
        Ok(result)
    }
    
    /// 更新用户最后登录时间
    pub async fn update_last_login(db: &DatabaseConnection, user_id: i32) -> Result<()> {
        let mut user: users::ActiveModel = Users::find_by_id(user_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("User not found"))?
            .into();

        user.updated_at = Set(chrono::Utc::now().naive_utc());
        user.update(db).await?;

        Ok(())
    }    /// 更新用户信息
    pub async fn update(
        db: &DatabaseConnection,
        user_id: i32,
        display_name: Option<String>,
        email: Option<String>,
        avatar_url: Option<String>,
    ) -> Result<users::Model> {
        let mut user: users::ActiveModel = Users::find_by_id(user_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("User not found"))?
            .into();
        
        if let Some(_name) = display_name {
            // 暂时忽略display_name，因为数据库表中没有这个字段
        }
        if let Some(email_val) = email {
            user.email = Set(Some(email_val));
        }
        if let Some(avatar) = avatar_url {
            user.avatar_url = Set(Some(avatar));
        }
        user.updated_at = Set(chrono::Utc::now().naive_utc());
        
        let result = user.update(db).await?;
        Ok(result)
    }
    
    /// 列出所有活跃用户
    pub async fn list_active(db: &DatabaseConnection) -> Result<Vec<users::Model>> {
        let users = Users::find()
            .filter(users::Column::Status.eq(1)) // 1表示活跃状态
            .order_by_asc(users::Column::Username)
            .all(db)
            .await?;
        Ok(users)
    }
    
    /// 根据角色查找用户
    pub async fn find_by_role(db: &DatabaseConnection, _role: &str) -> Result<Vec<users::Model>> {
        // 暂时忽略role过滤，因为数据库表中没有role字段
        let users = Users::find()
            .filter(users::Column::Status.eq(1)) // 只返回活跃用户
            .all(db)
            .await?;
        Ok(users)
    }
    
    /// 检查用户名是否存在
    pub async fn username_exists(db: &DatabaseConnection, username: &str) -> Result<bool> {
        let count = Users::find()
            .filter(users::Column::Username.eq(username))
            .count(db)
            .await?;
        Ok(count > 0)
    }
    
    /// 检查邮箱是否存在
    pub async fn email_exists(db: &DatabaseConnection, email: &str) -> Result<bool> {
        let count = Users::find()
            .filter(users::Column::Email.eq(email))
            .count(db)
            .await?;
        Ok(count > 0)
    }
    
    /// 更新用户个人资料
    /// 
    /// 对应 database.rs 中的 update_user_profile 方法
    pub async fn update_profile(
        db: &DatabaseConnection,
        user_id: i32,
        email: Option<String>,
        phone: Option<String>,
        avatar_url: Option<String>,
    ) -> Result<users::Model> {
        let mut user: users::ActiveModel = Users::find_by_id(user_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("User not found"))?
            .into();
        
        // 只更新提供的字段（COALESCE 逻辑）
        if let Some(email_val) = email {
            user.email = Set(Some(email_val));
        }
        if let Some(phone_val) = phone {
            user.phone = Set(Some(phone_val));
        }
        if let Some(avatar_val) = avatar_url {
            user.avatar_url = Set(Some(avatar_val));
        }
        user.updated_at = Set(chrono::Utc::now().naive_utc());
        
        let result = user.update(db).await?;
        Ok(result)
    }
    
    /// 修改用户密码
    /// 
    /// 对应 database.rs 中的 change_user_password 方法
    pub async fn change_password(
        db: &DatabaseConnection,
        user_id: i32,
        new_password_hash: String,
    ) -> Result<()> {
        let mut user: users::ActiveModel = Users::find_by_id(user_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("User not found"))?
            .into();
        
        user.password_hash = Set(new_password_hash);
        user.updated_at = Set(chrono::Utc::now().naive_utc());
        user.update(db).await?;
        
        Ok(())
    }
    
    /// 软删除用户（设置为不活跃）
    pub async fn soft_delete(db: &DatabaseConnection, user_id: i32) -> Result<()> {
        let mut user: users::ActiveModel = Users::find_by_id(user_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("User not found"))?
            .into();
        
        user.status = Set(0); // 0表示不活跃
        user.updated_at = Set(chrono::Utc::now().naive_utc());
        user.update(db).await?;
        
        Ok(())
    }
    
    /// 重新激活用户
    pub async fn reactivate(db: &DatabaseConnection, user_id: i32) -> Result<()> {
        let mut user: users::ActiveModel = Users::find_by_id(user_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("User not found"))?
            .into();
        
        user.status = Set(1); // 1表示活跃
        user.updated_at = Set(chrono::Utc::now().naive_utc());
        user.update(db).await?;
        
        Ok(())
    }
}
