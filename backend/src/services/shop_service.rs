//! Shop Service - 店铺业务逻辑层
//! 
//! 职责：
//! - 店铺创建与管理
//! - 访问权限控制
//! - 店铺员工管理
//! - API Key 管理

use anyhow::Result;
use sea_orm::DatabaseConnection;

use crate::repositories::{ShopRepository, ShopStaffRepository, UserRepository};
use crate::entities::{shops, users};

#[derive(Clone)]
pub struct ShopService {
    pub db: DatabaseConnection,
}

impl ShopService {
    /// 构造函数
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// 获取用户拥有的店铺列表
    pub async fn get_shops_by_owner(&self, owner_id: i64) -> Result<Vec<shops::Model>> {
        ShopRepository::find_by_owner(&self.db, owner_id as i32).await
    }

    /// 获取用户作为员工的店铺列表
    pub async fn get_shops_by_staff(&self, user_id: i64) -> Result<Vec<shops::Model>> {
        ShopRepository::find_by_staff(&self.db, user_id as i32).await
    }

    /// 根据ID获取店铺
    pub async fn get_shop_by_id(&self, shop_id: i32) -> Result<Option<shops::Model>> {
        ShopRepository::find_by_id(&self.db, shop_id).await
    }
    /// 创建店铺
    /// 
    /// 业务逻辑：
    /// 1. 验证用户是否存在
    /// 2. 验证 slug 是否唯一
    /// 3. 生成 API Key
    /// 4. 创建店铺
    pub async fn create_shop(
        &self,
        owner_id: i32,
        name: String,
        slug: String,
        description: Option<String>,
    ) -> Result<shops::Model> {
        // 1. 验证用户是否存在
        UserRepository::find_by_id(&self.db, owner_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("owner_not_found"))?;
        
        // 2. 生成唯一的 slug
        let unique_slug = self.generate_unique_slug(&slug).await?;
        
        // 3. 生成 API Key
        let api_key = ShopRepository::generate_api_key();
        
        // 4. 创建店铺（注意：需要修改 ShopRepository::create 支持 api_key）
        let shop = ShopRepository::create(
            &self.db,
            name,
            unique_slug,
            description,
            owner_id, // 直接传递i32而不是Some(owner_id)
        ).await?;
        
        Ok(shop)
    }
    
    /// 生成唯一的slug
    /// 
    /// 如果原始slug已存在，则添加数字后缀 (如: "测试店铺" -> "测试店铺-2")
    async fn generate_unique_slug(&self, base_slug: &str) -> Result<String> {
        let mut candidate_slug = base_slug.to_string();
        let mut counter = 1;
        
        while ShopRepository::slug_exists(&self.db, &candidate_slug).await? {
            counter += 1;
            candidate_slug = format!("{}-{}", base_slug, counter);
        }
        
        Ok(candidate_slug)
    }
    
    /// 获取用户可访问的所有店铺
    /// 
    /// 业务逻辑：
    /// 1. 获取用户拥有的店铺（作为所有者）
    /// 2. 获取用户加入的店铺（作为员工）
    /// 3. 合并并返回
    pub async fn get_accessible_shops(
        db: &DatabaseConnection,
        user_id: i32,
    ) -> Result<Vec<shops::Model>> {
        ShopRepository::find_accessible_by_user(db, user_id).await
    }
    
    /// 检查用户是否有权限访问店铺
    /// 
    /// 业务逻辑：
    /// 1. 检查是否是店主
    /// 2. 检查是否是员工
    pub async fn can_access_shop(
        db: &DatabaseConnection,
        user_id: i32,
        shop_id: i32,
    ) -> Result<bool> {
        ShopStaffRepository::is_shop_member(db, shop_id as i64, user_id as i64).await
    }
    
    /// 检查用户是否是店主
    pub async fn is_shop_owner(
        db: &DatabaseConnection,
        user_id: i32,
        shop_id: i32,
    ) -> Result<bool> {
        ShopStaffRepository::is_shop_owner(db, shop_id as i64, user_id as i64).await
    }
    
    /// 更新店铺信息
    /// 
    /// 业务逻辑：
    /// 1. 验证用户是否是店主
    /// 2. 更新店铺信息
    pub async fn update_shop(
        db: &DatabaseConnection,
        shop_id: i32,
        operator_user_id: i32,
        name: Option<String>,
        description: Option<String>,
        logo_url: Option<String>,
        website_url: Option<String>,
        contact_email: Option<String>,
        contact_phone: Option<String>,
    ) -> Result<shops::Model> {
        // 1. 验证权限（只有店主可以更新）
        if !Self::is_shop_owner(db, operator_user_id, shop_id).await? {
            anyhow::bail!("permission_denied");
        }
        
        // 2. 更新店铺
        ShopRepository::update(
            db,
            shop_id,
            name,
            description,
            logo_url,
            website_url,
            contact_email,
            contact_phone,
        ).await
    }
    
    /// 删除店铺（软删除）
    /// 
    /// 业务逻辑：
    /// 1. 验证用户是否是店主
    /// 2. 软删除店铺
    pub async fn delete_shop(
        db: &DatabaseConnection,
        shop_id: i32,
        operator_user_id: i32,
    ) -> Result<()> {
        // 1. 验证权限
        if !Self::is_shop_owner(db, operator_user_id, shop_id).await? {
            anyhow::bail!("permission_denied");
        }
        
        // 2. 软删除
        ShopRepository::soft_delete(db, shop_id).await
    }
    
    /// 重新生成 API Key
    /// 
    /// 业务逻辑：
    /// 1. 验证用户是否是店主
    /// 2. 重新生成 API Key
    pub async fn regenerate_api_key(
        db: &DatabaseConnection,
        shop_id: i32,
        operator_user_id: i32,
    ) -> Result<String> {
        // 1. 验证权限
        if !Self::is_shop_owner(db, operator_user_id, shop_id).await? {
            anyhow::bail!("permission_denied");
        }
        
        // 2. 重新生成
        ShopRepository::regenerate_api_key(db, shop_id).await
    }
    
    /// 添加员工到店铺
    /// 
    /// 业务逻辑：
    /// 1. 验证操作者是否是店主
    /// 2. 根据用户名查找用户
    /// 3. 添加员工
    pub async fn add_staff(
        db: &DatabaseConnection,
        shop_id: i32,
        operator_user_id: i32,
        username: &str,
        role: Option<&str>,
    ) -> Result<()> {
        // 1. 验证权限
        if !Self::is_shop_owner(db, operator_user_id, shop_id).await? {
            anyhow::bail!("permission_denied");
        }
        
        // 2. 添加员工
        ShopStaffRepository::add_staff_by_username(db, shop_id, username, role).await?;
        
        Ok(())
    }
    
    /// 移除员工
    /// 
    /// 业务逻辑：
    /// 1. 验证操作者是否是店主
    /// 2. 验证不能移除店主自己
    /// 3. 移除员工
    pub async fn remove_staff(
        db: &DatabaseConnection,
        shop_id: i32,
        operator_user_id: i32,
        target_user_id: i32,
    ) -> Result<()> {
        // 1. 验证权限
        if !Self::is_shop_owner(db, operator_user_id, shop_id).await? {
            anyhow::bail!("permission_denied");
        }
        
        // 2. 验证不能移除店主
        if ShopStaffRepository::is_shop_owner(db, shop_id as i64, target_user_id as i64).await? {
            anyhow::bail!("cannot_remove_owner");
        }
        
        // 3. 移除员工
        ShopStaffRepository::remove_staff(db, shop_id, target_user_id).await
    }
    
    /// 列出店铺的所有成员（包括店主和员工）
    pub async fn list_shop_members(
        db: &DatabaseConnection,
        shop_id: i32,
        requester_user_id: i32,
    ) -> Result<Vec<(users::Model, String)>> {
        // 验证访问权限
        if !Self::can_access_shop(db, requester_user_id, shop_id).await? {
            anyhow::bail!("permission_denied");
        }
        
        ShopStaffRepository::list_shop_staff(db, shop_id as i64).await
    }
    
    /// 更新员工角色
    /// 
    /// 业务逻辑：
    /// 1. 验证操作者是否是店主
    /// 2. 验证不能修改店主角色
    /// 3. 更新角色
    pub async fn update_staff_role(
        db: &DatabaseConnection,
        shop_id: i32,
        operator_user_id: i32,
        target_user_id: i32,
        new_role: String,
    ) -> Result<()> {
        // 1. 验证权限
        if !Self::is_shop_owner(db, operator_user_id, shop_id).await? {
            anyhow::bail!("permission_denied");
        }
        
        // 2. 验证不能修改店主
        if ShopStaffRepository::is_shop_owner(db, shop_id as i64, target_user_id as i64).await? {
            anyhow::bail!("cannot_modify_owner");
        }
        
        // 3. 更新角色
        ShopStaffRepository::update_role(db, shop_id, target_user_id, new_role).await
    }
    
    /// 验证 slug 格式
    pub fn validate_slug(slug: &str) -> Result<()> {
        if slug.len() < 3 {
            anyhow::bail!("slug_too_short");
        }
        if slug.len() > 50 {
            anyhow::bail!("slug_too_long");
        }
        if !slug.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
            anyhow::bail!("slug_invalid_characters");
        }
        if slug.starts_with('-') || slug.ends_with('-') {
            anyhow::bail!("slug_invalid_format");
        }
        Ok(())
    }
    
    /// 验证店铺名称
    pub fn validate_shop_name(name: &str) -> Result<()> {
        if name.trim().is_empty() {
            anyhow::bail!("shop_name_empty");
        }
        if name.len() > 100 {
            anyhow::bail!("shop_name_too_long");
        }
        Ok(())
    }
}
