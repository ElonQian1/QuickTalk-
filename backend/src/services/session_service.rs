//! Session Service - 会话业务逻辑层
//! 
//! 职责：
//! - 会话创建与管理
//! - 客服分配
//! - 会话状态管理
//! - 会话查询与统计

use anyhow::Result;
use sea_orm::DatabaseConnection;

use crate::repositories::{SessionRepository, ShopStaffRepository, CustomerRepository};
use crate::entities::sessions;

#[derive(Clone)]
pub struct SessionService {
    pub db: DatabaseConnection,
}

impl SessionService {
    /// 构造函数
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
    /// 创建或获取会话
    /// 
    /// 业务逻辑：
    /// 1. 检查是否存在活跃会话
    /// 2. 如果存在则返回，否则创建新会话
    pub async fn get_or_create_session(
        db: &DatabaseConnection,
        shop_id: i32,
        customer_id: i32,
    ) -> Result<sessions::Model> {
        // 1. 尝试获取现有活跃会话
        if let Some(session) = SessionRepository::find_by_shop_and_customer(
            db,
            shop_id,
            customer_id,
        ).await? {
            return Ok(session);
        }
        
        // 2. 创建新会话
        SessionRepository::create_simple(db, shop_id, customer_id).await
    }
    
    /// 获取店铺的所有活跃会话
    /// 
    /// 业务逻辑：
    /// 1. 验证访问权限
    /// 2. 获取活跃会话列表
    pub async fn get_shop_active_sessions(
        db: &DatabaseConnection,
        shop_id: i32,
        requester_user_id: i32,
    ) -> Result<Vec<sessions::Model>> {
        // 验证权限
        if !ShopStaffRepository::is_shop_member(db, shop_id as i64, requester_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        SessionRepository::find_active_by_shop(db, shop_id).await
    }
    
    /// 获取客服的活跃会话
    /// 
    /// 业务逻辑：
    /// 1. 验证是否是有效的客服
    /// 2. 获取该客服的所有活跃会话
    pub async fn get_staff_active_sessions(
        db: &DatabaseConnection,
        staff_id: i32,
        shop_id: Option<i32>,
    ) -> Result<Vec<sessions::Model>> {
        // 如果指定了店铺，验证权限
        if let Some(sid) = shop_id {
            if !ShopStaffRepository::is_shop_member(db, sid as i64, staff_id as i64).await? {
                anyhow::bail!("permission_denied");
            }
        }
        
        SessionRepository::find_by_staff(db, staff_id).await
    }
    
    /// 分配客服到会话
    /// 
    /// 业务逻辑：
    /// 1. 验证会话存在
    /// 2. 验证客服有权限
    /// 3. 分配客服
    pub async fn assign_staff_to_session(
        db: &DatabaseConnection,
        session_id: i32,
        staff_id: i32,
        operator_user_id: i32,
    ) -> Result<()> {
        // 1. 获取会话
        let session = SessionRepository::find_by_id(db, session_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("session_not_found"))?;
        
        // 2. 验证操作者权限
        if !ShopStaffRepository::is_shop_member(db, session.shop_id as i64, operator_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        // 3. 验证目标客服权限
        if !ShopStaffRepository::is_shop_member(db, session.shop_id as i64, staff_id as i64).await? {
            anyhow::bail!("staff_not_in_shop");
        }
        
        // 4. 分配客服
        SessionRepository::assign_staff(db, session_id, staff_id).await
    }
    
    /// 自动分配客服
    /// 
    /// 业务逻辑：
    /// 1. 获取店铺的所有客服
    /// 2. 统计每个客服的当前会话数
    /// 3. 选择会话数最少的客服
    pub async fn auto_assign_staff(
        db: &DatabaseConnection,
        session_id: i32,
    ) -> Result<()> {
        // 获取会话
        let session = SessionRepository::find_by_id(db, session_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("session_not_found"))?;
        
        // 获取店铺的所有成员
        let staff_list = ShopStaffRepository::list_shop_staff(db, session.shop_id as i64).await?;
        
        if staff_list.is_empty() {
            anyhow::bail!("no_staff_available");
        }
        
        // 简单策略：选择第一个可用的客服
        // TODO: 实现更智能的分配策略（基于当前会话数、在线状态等）
        let (first_staff, _role) = &staff_list[0];
        
        SessionRepository::assign_staff(db, session_id, first_staff.id).await
    }
    
    /// 关闭会话
    /// 
    /// 业务逻辑：
    /// 1. 验证会话存在
    /// 2. 验证权限
    /// 3. 关闭会话
    pub async fn close_session(
        db: &DatabaseConnection,
        session_id: i32,
        operator_user_id: i32,
    ) -> Result<()> {
        // 1. 获取会话
        let session = SessionRepository::find_by_id(db, session_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("session_not_found"))?;
        
        // 2. 验证权限
        if !ShopStaffRepository::is_shop_member(db, session.shop_id as i64, operator_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        // 3. 关闭会话
        SessionRepository::close(db, session_id).await
    }
    
    /// 设置会话优先级
    /// 
    /// 业务逻辑：
    /// 1. 验证会话存在
    /// 2. 验证权限
    /// 3. 设置优先级
    pub async fn set_session_priority(
        db: &DatabaseConnection,
        session_id: i32,
        priority: i32,
        operator_user_id: i32,
    ) -> Result<()> {
        // 1. 获取会话
        let session = SessionRepository::find_by_id(db, session_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("session_not_found"))?;
        
        // 2. 验证权限
        if !ShopStaffRepository::is_shop_member(db, session.shop_id as i64, operator_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        // 3. 验证优先级范围
        if priority < 0 || priority > 10 {
            anyhow::bail!("invalid_priority");
        }
        
        // 4. 设置优先级
        SessionRepository::set_priority(db, session_id, priority).await
    }
    
    /// 获取未分配的会话
    /// 
    /// 业务逻辑：
    /// 1. 验证访问权限
    /// 2. 获取未分配的会话列表
    pub async fn get_unassigned_sessions(
        db: &DatabaseConnection,
        shop_id: i32,
        requester_user_id: i32,
    ) -> Result<Vec<sessions::Model>> {
        // 验证权限
        if !ShopStaffRepository::is_shop_member(db, shop_id as i64, requester_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        SessionRepository::find_unassigned_by_shop(db, shop_id).await
    }
    
    /// 更新会话的最后消息时间
    pub async fn update_session_message_time(
        db: &DatabaseConnection,
        session_id: i32,
    ) -> Result<()> {
        SessionRepository::update_last_message_time(db, session_id).await
    }
    
    /// 获取会话详情
    pub async fn get_session_detail(
        db: &DatabaseConnection,
        session_id: i32,
        requester_user_id: i32,
    ) -> Result<sessions::Model> {
        // 获取会话
        let session = SessionRepository::find_by_id(db, session_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("session_not_found"))?;
        
        // 验证权限
        if !ShopStaffRepository::is_shop_member(db, session.shop_id as i64, requester_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        Ok(session)
    }
    
    /// 转移会话到其他客服
    /// 
    /// 业务逻辑：
    /// 1. 验证权限
    /// 2. 验证目标客服权限
    /// 3. 重新分配
    pub async fn transfer_session(
        &self,
        session_id: i32,
        new_staff_id: i32,
        operator_user_id: i32,
    ) -> Result<()> {
        // 获取会话
        let session = SessionRepository::find_by_id(&self.db, session_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("session_not_found"))?;
        
        // 验证操作者权限
        if !ShopStaffRepository::is_shop_member(&self.db, session.shop_id as i64, operator_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        // 验证新客服权限
        if !ShopStaffRepository::is_shop_member(&self.db, session.shop_id as i64, new_staff_id as i64).await? {
            anyhow::bail!("target_staff_not_in_shop");
        }
        
        // 重新分配
        SessionRepository::assign_staff(&self.db, session_id, new_staff_id).await
    }

    /// Handler 需要的方法：重置客户未读计数
    pub async fn reset_unread_count(
        &self,
    _user_id: i64,
        shop_id: i32,
        customer_id: i32,
    ) -> Result<()> {
        // 权限已由 handler 层使用 SQLx 校验，这里不再重复检查，避免触发不兼容的 Sea-ORM 查询
        // 重置未读计数 (通过 SessionRepository)
        SessionRepository::reset_customer_unread_count(&self.db, shop_id, customer_id).await
    }

    /// Handler 需要的方法：重置店铺所有未读计数
    pub async fn reset_all_unread_in_shop(
        &self,
    _user_id: i64,
        shop_id: i32,
    ) -> Result<()> {
        // 权限已由 handler 层使用 SQLx 校验，这里不再重复检查
        // 重置店铺所有未读计数
        SessionRepository::reset_all_unread_in_shop(&self.db, shop_id).await
    }

    /// Chat Service 需要的方法：根据店铺和客户查找会话
    pub async fn get_session_by_shop_customer(
        &self,
        shop_id: i32,
        customer_id: i32,
    ) -> Result<Option<sessions::Model>> {
        SessionRepository::find_by_shop_and_customer(&self.db, shop_id, customer_id).await
    }

    /// Chat Service 需要的方法：创建新会话
    pub async fn create_session(
        &self,
        shop_id: i32,
        customer_id: i32,
    ) -> Result<sessions::Model> {
        // 生成唯一的session_id
        let session_id = format!("{}_{}", shop_id, customer_id);
        SessionRepository::create(&self.db, session_id, shop_id, customer_id).await
    }
}
