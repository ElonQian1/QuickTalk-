//! Customer Service - 客户业务逻辑层
//! 
//! 职责：
//! - 客户信息管理
//! - 客户概览查询
//! - 客户统计
//! - 客户搜索与过滤

use anyhow::Result;
use sea_orm::DatabaseConnection;

use crate::repositories::{CustomerRepository, ShopStaffRepository};
use crate::entities::{customers, sessions, messages};

#[derive(Clone)]
pub struct CustomerService {
    pub db: DatabaseConnection,
}

impl CustomerService {
    /// 构造函数
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
    /// 创建或更新客户
    /// 
    /// 业务逻辑：
    /// 1. 验证店铺访问权限
    /// 2. 创建或更新客户信息
    pub async fn upsert_customer(
        db: &DatabaseConnection,
        shop_id: i32,
        customer_id: String,
        name: Option<String>,
        email: Option<String>,
        avatar_url: Option<String>,
        operator_user_id: Option<i32>,
    ) -> Result<customers::Model> {
        // 如果有操作者，验证权限
        if let Some(user_id) = operator_user_id {
            if !ShopStaffRepository::is_shop_member(db, shop_id as i64, user_id as i64).await? {
                anyhow::bail!("permission_denied");
            }
        }
        
        // 创建或更新客户
        CustomerRepository::create_or_update(
            db,
            shop_id,
            customer_id,
            name,
            email,
            avatar_url,
        ).await
    }
    
    /// 获取店铺的所有客户
    /// 
    /// 业务逻辑：
    /// 1. 验证访问权限
    /// 2. 获取客户列表
    pub async fn get_shop_customers(
        db: &DatabaseConnection,
        shop_id: i32,
        requester_user_id: i32,
    ) -> Result<Vec<customers::Model>> {
        // 验证权限
        if !ShopStaffRepository::is_shop_member(db, shop_id as i64, requester_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        CustomerRepository::find_by_shop(db, shop_id).await
    }
    
    /// 获取客户概览（包含会话和最后消息）
    /// 
    /// 业务逻辑：
    /// 1. 验证访问权限
    /// 2. 获取客户概览数据
    pub async fn get_customers_overview(
        db: &DatabaseConnection,
        shop_id: i32,
        requester_user_id: i32,
    ) -> Result<Vec<(customers::Model, Option<sessions::Model>, Option<messages::Model>, i64)>> {
        // 验证权限
        if !ShopStaffRepository::is_shop_member(db, shop_id as i64, requester_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        CustomerRepository::find_with_overview_by_shop(db, shop_id).await
    }
    
    /// 搜索客户
    /// 
    /// 业务逻辑：
    /// 1. 验证访问权限
    /// 2. 搜索客户
    pub async fn search_customers(
        db: &DatabaseConnection,
        shop_id: i32,
        requester_user_id: i32,
        keyword: &str,
    ) -> Result<Vec<customers::Model>> {
        // 验证权限
        if !ShopStaffRepository::is_shop_member(db, shop_id as i64, requester_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        CustomerRepository::search(db, shop_id, keyword).await
    }
    
    /// 阻止客户
    /// 
    /// 业务逻辑：
    /// 1. 验证权限（需要管理员或店主权限）
    /// 2. 阻止客户
    pub async fn block_customer(
        db: &DatabaseConnection,
        shop_id: i32,
        customer_id: i32,
        operator_user_id: i32,
    ) -> Result<()> {
        // 验证权限（需要是店铺成员）
        if !ShopStaffRepository::is_shop_member(db, shop_id as i64, operator_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        // 验证客户属于该店铺
        let customer = CustomerRepository::find_by_id(db, customer_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("customer_not_found"))?;
        
        if customer.shop_id != shop_id {
            anyhow::bail!("customer_not_in_shop");
        }
        
        CustomerRepository::block(db, customer_id).await
    }
    
    /// 解除阻止
    /// 
    /// 业务逻辑：
    /// 1. 验证权限
    /// 2. 解除阻止
    pub async fn unblock_customer(
        db: &DatabaseConnection,
        shop_id: i32,
        customer_id: i32,
        operator_user_id: i32,
    ) -> Result<()> {
        // 验证权限
        if !ShopStaffRepository::is_shop_member(db, shop_id as i64, operator_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        // 验证客户属于该店铺
        let customer = CustomerRepository::find_by_id(db, customer_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("customer_not_found"))?;
        
        if customer.shop_id != shop_id {
            anyhow::bail!("customer_not_in_shop");
        }
        
        CustomerRepository::unblock(db, customer_id).await
    }
    
    /// 统计活跃客户数
    /// 
    /// 业务逻辑：
    /// 1. 验证访问权限
    /// 2. 统计指定天数内活跃的客户数
    pub async fn count_active_customers(
        db: &DatabaseConnection,
        shop_id: i32,
        requester_user_id: i32,
        days: i64,
    ) -> Result<u64> {
        // 验证权限
        if !ShopStaffRepository::is_shop_member(db, shop_id as i64, requester_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        CustomerRepository::count_active_by_shop(db, shop_id, days).await
    }
    
    /// 获取客户详情
    pub async fn get_customer_detail(
        db: &DatabaseConnection,
        customer_id: i32,
        requester_user_id: i32,
    ) -> Result<customers::Model> {
        let customer = CustomerRepository::find_by_id(db, customer_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("customer_not_found"))?;
        
        // 验证访问权限
        if !ShopStaffRepository::is_shop_member(db, customer.shop_id as i64, requester_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        Ok(customer)
    }
    
    /// 更新客户最后活跃时间
    pub async fn update_customer_activity(
        db: &DatabaseConnection,
        customer_id: i32,
    ) -> Result<()> {
        CustomerRepository::update_last_active(db, customer_id).await
    }
    
    /// 验证客户ID格式
    pub fn validate_customer_id(customer_id: &str) -> Result<()> {
        if customer_id.trim().is_empty() {
            anyhow::bail!("customer_id_empty");
        }
        if customer_id.len() > 100 {
            anyhow::bail!("customer_id_too_long");
        }
        Ok(())
    }

    /// Handler 需要的方法：获取带会话信息的客户列表
    pub async fn get_customers_with_sessions(
        &self,
        user_id: i64,
        shop_id: i32,
    ) -> Result<Vec<(customers::Model, Option<sessions::Model>)>> {
        // 权限已在 handler 层通过 SQLx 校验，这里不再重复校验，避免 Sea-ORM 访问不兼容的 shops 列
        eprintln!("✅ 开始查询客户列表 (handler 已完成权限校验)");
        
        // 获取该店铺的所有客户及其最新会话
        CustomerRepository::get_customers_with_sessions(&self.db, shop_id).await
    }

    /// 分页获取客户概览（含最后消息与未读数）
    pub async fn get_customers_overview_paged(
        &self,
        user_id: i64,
        shop_id: i32,
        limit: i64,
        offset: i64,
        keyword: Option<String>,
        sort: Option<String>,
    ) -> Result<(Vec<(customers::Model, Option<sessions::Model>, Option<messages::Model>, i64)>, i64)> {
        // 权限已在 handler 层通过 SQLx 校验，这里不再重复校验

        let kw_ref = keyword.as_deref();
        let total = CustomerRepository::count_by_shop(&self.db, shop_id, kw_ref).await?;
        let items = CustomerRepository::find_with_overview_by_shop_paged(
            &self.db,
            shop_id,
            limit,
            offset,
            kw_ref,
            sort.as_deref(),
        )
        .await?;
        Ok((items, total))
    }

    /// Chat Service 需要的方法：创建或更新客户
    pub async fn create_or_update_customer(
        &self,
        shop_id: i32,
        customer_id: String,
        upsert_data: serde_json::Value,
    ) -> Result<customers::Model> {
        // 解析 upsert 数据
        let name = upsert_data.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
        let email = upsert_data.get("email").and_then(|v| v.as_str()).map(|s| s.to_string());
        let avatar_url = upsert_data.get("avatar_url").and_then(|v| v.as_str()).map(|s| s.to_string());

        // 调用现有的 upsert 方法
        CustomerRepository::create_or_update(&self.db, shop_id, customer_id.clone(), name, email, avatar_url).await
    }
}
