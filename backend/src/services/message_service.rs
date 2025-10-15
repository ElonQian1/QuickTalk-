//! Message Service - 消息业务逻辑层
//! 
//! 职责：
//! - 消息发送与接收
//! - 消息已读状态管理
//! - 消息历史查询
//! - 消息搜索

use anyhow::Result;
use sea_orm::DatabaseConnection;

use crate::repositories::{MessageRepository, SessionRepository, ShopStaffRepository};
use crate::entities::messages;

#[derive(Clone)]
pub struct MessageService {
    pub db: DatabaseConnection,
}

impl MessageService {
    /// 构造函数
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
    /// 获取会话消息列表
    pub async fn get_messages_by_session(
        &self,
        user_id: i64,
        session_id: i64,
        limit: Option<u64>,
        offset: Option<u64>,
    ) -> Result<Vec<messages::Model>> {
        // 使用分页方法如果存在offset，否则使用简单的limit方法
        if let (Some(limit), Some(offset)) = (limit, offset) {
            let (messages, _total) = MessageRepository::find_by_session_paginated(
                &self.db, 
                session_id as i32, 
                offset / limit + 1, // page number  
                limit
            ).await?;
            Ok(messages)
        } else {
            MessageRepository::find_by_session(&self.db, session_id as i32, limit).await
        }
    }

    /// 发送客服消息
    pub async fn send_staff_message(
        &self,
        user_id: i32,
        session_id: i64,
        content: &str,
    ) -> Result<messages::Model> {
        // 验证权限和创建消息的逻辑
        let message = MessageRepository::create(
            &self.db,
            session_id as i32,
            "staff".to_string(),
            Some(user_id.to_string()),  // 转换为String
            None, // sender_name
            "text".to_string(),
            content.to_string(),
        ).await?;

        Ok(message)
    }

    /// 发送消息
    /// 
    /// 业务逻辑：
    /// 1. 验证会话存在
    /// 2. 验证发送者权限
    /// 3. 创建消息
    /// 4. 更新会话最后消息时间
    pub async fn send_message(
        db: &DatabaseConnection,
        session_id: i32,
        sender_type: &str,
        sender_id: Option<String>,  // 修改为String类型
        content: &str,
        message_type: &str,
        file_url: Option<&str>,
    ) -> Result<messages::Model> {
        // 1. 验证会话存在
        let session = SessionRepository::find_by_id(db, session_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("session_not_found"))?;
        
        // 2. 如果是客服发送，验证权限
        if sender_type == "staff" {
            if let Some(ref staff_id_str) = sender_id {
                if let Ok(staff_id) = staff_id_str.parse::<i64>() {
                    if !ShopStaffRepository::is_shop_member(db, session.shop_id as i64, staff_id).await? {
                        anyhow::bail!("permission_denied");
                    }
                }
            }
        }
        
        // 3. 验证消息内容
        Self::validate_message_content(content)?;
        
        // 4. 创建消息
        let message = MessageRepository::create_full(
            db,
            session_id,
            sender_type,
            sender_id,
            content,
            message_type,
            file_url,
        ).await?;
        
        // 5. 更新会话最后消息时间
        SessionRepository::update_last_message_time(db, session_id).await?;
        
        Ok(message)
    }
    
    /// 获取会话的消息历史
    /// 
    /// 业务逻辑：
    /// 1. 验证会话存在
    /// 2. 验证访问权限
    /// 3. 获取消息列表
    pub async fn get_session_messages(
        db: &DatabaseConnection,
        session_id: i32,
        requester_user_id: i32,
        limit: Option<u64>,
    ) -> Result<Vec<messages::Model>> {
        // 1. 获取会话
        let session = SessionRepository::find_by_id(db, session_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("session_not_found"))?;
        
        // 2. 验证权限
        if !ShopStaffRepository::is_shop_member(db, session.shop_id as i64, requester_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        // 3. 获取消息
        MessageRepository::find_by_session(db, session_id, limit).await
    }
    
    /// 获取会话的消息（分页）
    /// 
    /// 业务逻辑：
    /// 1. 验证权限
    /// 2. 分页获取消息
    pub async fn get_session_messages_paginated(
        db: &DatabaseConnection,
        session_id: i32,
        requester_user_id: i32,
        page: u64,
        page_size: u64,
    ) -> Result<(Vec<messages::Model>, u64)> {
        // 1. 获取会话
        let session = SessionRepository::find_by_id(db, session_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("session_not_found"))?;
        
        // 2. 验证权限
        if !ShopStaffRepository::is_shop_member(db, session.shop_id as i64, requester_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        // 3. 分页获取
        MessageRepository::find_by_session_paginated(db, session_id, page, page_size).await
    }
    
    /// 标记消息为已读
    /// 
    /// 业务逻辑：
    /// 1. 验证消息存在
    /// 2. 验证权限
    /// 3. 标记为已读
    pub async fn mark_messages_as_read(
        db: &DatabaseConnection,
        message_ids: Vec<i32>,
        requester_user_id: i32,
    ) -> Result<()> {
        if message_ids.is_empty() {
            return Ok(());
        }
        
        // 验证第一条消息的权限（假设所有消息都在同一会话中）
        if let Some(first_id) = message_ids.first() {
            let message = MessageRepository::find_by_id(db, *first_id)
                .await?
                .ok_or_else(|| anyhow::anyhow!("message_not_found"))?;
            
            let session = SessionRepository::find_by_id(db, message.session_id)
                .await?
                .ok_or_else(|| anyhow::anyhow!("session_not_found"))?;
            
            if !ShopStaffRepository::is_shop_member(db, session.shop_id as i64, requester_user_id as i64).await? {
                anyhow::bail!("permission_denied");
            }
        }
        
        MessageRepository::mark_as_read(db, message_ids).await
    }
    
    /// 获取未读消息数量
    /// 
    /// 业务逻辑：
    /// 1. 验证权限
    /// 2. 统计未读数量
    pub async fn count_unread_messages(
        db: &DatabaseConnection,
        session_id: i32,
        user_type: &str,
        requester_user_id: i32,
    ) -> Result<u64> {
        // 获取会话
        let session = SessionRepository::find_by_id(db, session_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("session_not_found"))?;
        
        // 验证权限
        if !ShopStaffRepository::is_shop_member(db, session.shop_id as i64, requester_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        MessageRepository::count_unread(db, session_id, user_type).await
    }
    
    /// 搜索消息
    /// 
    /// 业务逻辑：
    /// 1. 验证权限
    /// 2. 搜索消息
    pub async fn search_messages(
        db: &DatabaseConnection,
        shop_id: i32,
        requester_user_id: i32,
        keyword: &str,
        limit: Option<u64>,
    ) -> Result<Vec<messages::Model>> {
        // 验证权限
        if !ShopStaffRepository::is_shop_member(db, shop_id as i64, requester_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        // 验证关键词
        if keyword.trim().is_empty() {
            anyhow::bail!("keyword_empty");
        }
        
        MessageRepository::search(db, shop_id, keyword, limit).await
    }
    
    /// 删除消息（软删除）
    /// 
    /// 业务逻辑：
    /// 1. 验证消息存在
    /// 2. 验证权限（只有发送者或店主可以删除）
    /// 3. 软删除消息
    pub async fn delete_message(
        db: &DatabaseConnection,
        message_id: i32,
        requester_user_id: i32,
    ) -> Result<()> {
        // 1. 获取消息
        let message = MessageRepository::find_by_id(db, message_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("message_not_found"))?;
        
        // 2. 获取会话
        let session = SessionRepository::find_by_id(db, message.session_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("session_not_found"))?;
        
        // 3. 验证权限（必须是店主或消息发送者）
        let is_owner = ShopStaffRepository::is_shop_owner(db, session.shop_id as i64, requester_user_id as i64).await?;
        let is_sender = message.sender_id
            .as_ref()
            .and_then(|s| s.parse::<i32>().ok())
            .map(|id| id == requester_user_id)
            .unwrap_or(false);
        
        if !is_owner && !is_sender {
            anyhow::bail!("permission_denied");
        }
        
        // 4. 软删除
        MessageRepository::soft_delete(db, message_id).await
    }
    
    /// 批量删除消息
    /// 
    /// 业务逻辑：
    /// 1. 验证权限（只有店主可以批量删除）
    /// 2. 批量软删除
    pub async fn delete_messages_batch(
        db: &DatabaseConnection,
        message_ids: Vec<i32>,
        requester_user_id: i32,
    ) -> Result<()> {
        if message_ids.is_empty() {
            return Ok(());
        }
        
        // 验证第一条消息的权限
        if let Some(first_id) = message_ids.first() {
            let message = MessageRepository::find_by_id(db, *first_id)
                .await?
                .ok_or_else(|| anyhow::anyhow!("message_not_found"))?;
            
            let session = SessionRepository::find_by_id(db, message.session_id)
                .await?
                .ok_or_else(|| anyhow::anyhow!("session_not_found"))?;
            
            // 必须是店主
            if !ShopStaffRepository::is_shop_owner(db, session.shop_id as i64, requester_user_id as i64).await? {
                anyhow::bail!("permission_denied");
            }
        }
        
        MessageRepository::soft_delete_many(db, message_ids).await
    }
    
    /// 获取会话的最后一条消息
    pub async fn get_last_message(
        db: &DatabaseConnection,
        session_id: i32,
        requester_user_id: i32,
    ) -> Result<Option<messages::Model>> {
        // 获取会话
        let session = SessionRepository::find_by_id(db, session_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("session_not_found"))?;
        
        // 验证权限
        if !ShopStaffRepository::is_shop_member(db, session.shop_id as i64, requester_user_id as i64).await? {
            anyhow::bail!("permission_denied");
        }
        
        MessageRepository::find_last_by_session(db, session_id).await
    }
    
    /// 验证消息内容
    fn validate_message_content(content: &str) -> Result<()> {
        if content.trim().is_empty() {
            anyhow::bail!("message_content_empty");
        }
        if content.len() > 10000 {
            anyhow::bail!("message_content_too_long");
        }
        Ok(())
    }
    
    /// 验证消息类型
    pub fn validate_message_type(message_type: &str) -> Result<()> {
        let valid_types = ["text", "image", "file", "audio", "video", "system"];
        if !valid_types.contains(&message_type) {
            anyhow::bail!("invalid_message_type");
        }
        Ok(())
    }
}
