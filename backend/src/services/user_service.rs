//! User Service - 用户业务逻辑层
//! 
//! 职责：
//! - 用户认证（登录、注册）
//! - 用户信息管理
//! - 密码管理
//! - 用户验证

use anyhow::Result;
use sea_orm::DatabaseConnection;
use bcrypt::{hash, verify, DEFAULT_COST};

use crate::repositories::UserRepository;
use crate::entities::users;

#[derive(Clone)]
pub struct UserService {
    pub db: DatabaseConnection,
}

impl UserService {
    /// 构造函数
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
    /// 用户注册
    /// 
    /// 业务逻辑：
    /// 1. 检查用户名是否已存在
    /// 2. 检查邮箱是否已存在（如果提供）
    /// 3. 加密密码
    /// 4. 创建用户
    pub async fn register(
        &self,
        username: String,
        password: String,
        email: Option<String>,
        phone: Option<String>,
    ) -> Result<users::Model> {
        println!("UserService::register - 开始注册用户: {}", username);
        
        // 1. 验证用户名是否已存在
        println!("UserService::register - 检查用户名是否存在");
        if UserRepository::username_exists(&self.db, &username).await? {
            anyhow::bail!("用户名已存在");
        }
        
        // 2. 验证邮箱是否已存在（如果提供）
        if let Some(ref email_val) = email {
            println!("UserService::register - 检查邮箱是否存在: {}", email_val);
            if UserRepository::email_exists(&self.db, email_val).await? {
                anyhow::bail!("邮箱已存在");
            }
        }
        
        // 3. 加密密码
        println!("UserService::register - 加密密码");
        let password_hash = hash(password, DEFAULT_COST)?;
        
        // 4. 创建用户
        println!("UserService::register - 创建用户记录");
        let user = UserRepository::create(
            &self.db,
            username,
            password_hash,
            email,
            phone,
            Some("staff".to_string()), // 默认角色
        ).await?;
        
        println!("UserService::register - 用户创建成功: {:?}", user);
        Ok(user)
    }
    
    /// 用户登录验证
    /// 
    /// 业务逻辑：
    /// 1. 根据用户名查找用户
    /// 2. 验证密码
    /// 3. 检查用户是否活跃
    /// 4. 更新最后登录时间
    pub async fn authenticate(
        &self,
        username: &str,
        password: &str,
    ) -> Result<users::Model> {
        // 1. 查找用户
        let user = UserRepository::find_by_username(&self.db, username)
            .await?
            .ok_or_else(|| anyhow::anyhow!("invalid_credentials"))?;
        
        // 2. 检查用户是否活跃
        if user.status != 1 {
            anyhow::bail!("user_inactive");
        }
        
        // 3. 验证密码
        if !verify(password, &user.password_hash)? {
            anyhow::bail!("invalid_credentials");
        }
        
        // 4. 更新最后登录时间
        UserRepository::update_last_login(&self.db, user.id).await?;
        
        Ok(user)
    }
    
    /// 修改密码
    /// 
    /// 业务逻辑：
    /// 1. 验证旧密码
    /// 2. 加密新密码
    /// 3. 更新密码
    pub async fn change_password(
        &self,
        user_id: i32,
        old_password: &str,
        new_password: &str,
    ) -> Result<()> {
        // 1. 获取用户
        let user = UserRepository::find_by_id(&self.db, user_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("user_not_found"))?;
        
        // 2. 验证旧密码
        if !verify(old_password, &user.password_hash)? {
            anyhow::bail!("invalid_old_password");
        }
        
        // 3. 加密新密码
        let new_password_hash = hash(new_password, DEFAULT_COST)?;
        
        // 4. 更新密码
        UserRepository::change_password(&self.db, user_id, new_password_hash).await?;
        
        Ok(())
    }
    
    /// 重置密码（管理员操作）
    pub async fn reset_password(
        &self,
        user_id: i32,
        new_password: &str,
    ) -> anyhow::Result<()> {
        // 3. 加密新密码
        let new_password_hash = hash(new_password, DEFAULT_COST)?;
        
        // 4. 更新密码
        UserRepository::change_password(&self.db, user_id, new_password_hash).await?;
        
        Ok(())
    }
    
    /// 更新用户个人资料
    /// 
    /// 业务逻辑：
    /// 1. 验证用户是否存在
    /// 2. 如果更新邮箱，检查邮箱是否被占用
    /// 3. 更新资料
    pub async fn update_profile(
        &self,
        user_id: i32,
        email: Option<String>,
        phone: Option<String>,
        avatar_url: Option<String>,
    ) -> Result<users::Model> {
        // 1. 验证用户是否存在
        let _user = UserRepository::find_by_id(&self.db, user_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("user_not_found"))?;
        
        // 2. 如果更新邮箱，检查是否被占用
        if let Some(ref new_email) = email {
            // 检查邮箱是否已被其他用户使用
            if let Some(existing_user) = UserRepository::find_by_email(&self.db, new_email).await? {
                if existing_user.id != user_id {
                    anyhow::bail!("email_already_in_use");
                }
            }
        }
        
        // 3. 更新资料
        let updated_user = UserRepository::update_profile(
            &self.db,
            user_id,
            email,
            phone,
            avatar_url,
        ).await?;
        
        Ok(updated_user)
    }
    
    /// 获取用户信息（安全版本，不返回密码）
    pub async fn get_user_info(
        &self,
        user_id: i32,
    ) -> Result<users::Model> {
        let user = UserRepository::find_by_id(&self.db, user_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("user_not_found"))?;
        
        Ok(user)
    }
    
    /// 禁用用户
    pub async fn deactivate_user(
        &self,
        user_id: i32,
    ) -> Result<()> {
        UserRepository::soft_delete(&self.db, user_id).await?;
        Ok(())
    }
    
    /// 激活用户
    pub async fn activate_user(
        &self,
        user_id: i32,
    ) -> Result<()> {
        UserRepository::reactivate(&self.db, user_id).await?;
        Ok(())
    }
    
    /// 列出所有活跃用户
    pub async fn list_active_users(
        &self,
    ) -> Result<Vec<users::Model>> {
        UserRepository::list_active(&self.db).await
    }
    
    /// 根据角色查找用户
    pub async fn find_users_by_role(
        &self,
        role: &str,
    ) -> Result<Vec<users::Model>> {
        UserRepository::find_by_role(&self.db, role).await
    }
    
    /// 验证用户名格式
    pub fn validate_username(username: &str) -> Result<()> {
        if username.len() < 3 {
            anyhow::bail!("username_too_short");
        }
        if username.len() > 50 {
            anyhow::bail!("username_too_long");
        }
        if !username.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
            anyhow::bail!("username_invalid_characters");
        }
        Ok(())
    }
    
    /// 验证密码强度
    pub fn validate_password(password: &str) -> Result<()> {
        if password.len() < 6 {
            anyhow::bail!("password_too_short");
        }
        if password.len() > 100 {
            anyhow::bail!("password_too_long");
        }
        Ok(())
    }
    
    /// 验证邮箱格式
    pub fn validate_email(email: &str) -> Result<()> {
        if !email.contains('@') {
            anyhow::bail!("invalid_email_format");
        }
        if email.len() > 100 {
            anyhow::bail!("email_too_long");
        }
        Ok(())
    }
}
