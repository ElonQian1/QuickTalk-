//! Message Repository - 消息数据访问层

use anyhow::Result;
use sea_orm::{*, sea_query::Expr};
use crate::entities::{messages, prelude::*};

pub struct MessageRepository;

impl MessageRepository {
    /// 创建新消息
    pub async fn create(
        db: &DatabaseConnection,
        session_id: i32,
        sender_type: String,
        sender_id: Option<String>,  // 修改为String类型
        sender_name: Option<String>,
        message_type: String,
        content: String,
        file_url: Option<String>,
        file_name: Option<String>,
    ) -> Result<messages::Model> {
        eprintln!("🔍 MessageRepository::create - session_id: {}, sender_type: {}, message_type: {}, content: {}", 
                  session_id, sender_type, message_type, &content[..content.len().min(50)]);
        
        let now = chrono::Utc::now().naive_utc();
        
        // 构建 metadata，包含文件信息
        let metadata = if file_url.is_some() || file_name.is_some() {
            Some(serde_json::json!({
                "file_url": file_url,
                "file_name": file_name,
            }))
        } else {
            None
        };
        
        let message = messages::ActiveModel {
            session_id: Set(session_id),
            sender_type: Set(sender_type),
            sender_id: Set(sender_id),
            sender_name: Set(sender_name),
            message_type: Set(message_type),
            content: Set(content),
            metadata: Set(metadata),
            is_read: Set(false),
            is_deleted: Set(false),
            created_at: Set(now),
            updated_at: Set(Some(now)),
            ..Default::default()
        };
        
        match message.insert(db).await {
            Ok(inserted) => {
                eprintln!("✅ 消息创建成功: id={}", inserted.id);
                Ok(inserted)
            }
            Err(e) => {
                eprintln!("❌ 消息创建失败: {:?}", e);
                Err(e.into())
            }
        }
    }
    
    /// 获取会话的所有消息
    pub async fn find_by_session(
        db: &DatabaseConnection,
        session_id: i32,
        limit: Option<u64>,
    ) -> Result<Vec<messages::Model>> {
        eprintln!("🔍 MessageRepository::find_by_session - session_id: {}, limit: {:?}", session_id, limit);
        
        let mut query = Messages::find()
            .filter(messages::Column::SessionId.eq(session_id))
            .filter(messages::Column::IsDeleted.eq(false))
            .order_by_asc(messages::Column::CreatedAt);
        
        if let Some(l) = limit {
            query = query.limit(l);
        }
        
        match query.all(db).await {
            Ok(results) => {
                eprintln!("✅ 查询成功，找到 {} 条消息", results.len());
                Ok(results)
            }
            Err(e) => {
                eprintln!("❌ 查询失败: {:?}", e);
                Err(e.into())
            }
        }
    }
    
    /// 标记消息为已读
    pub async fn mark_as_read(db: &DatabaseConnection, message_ids: Vec<i32>) -> Result<()> {
        if message_ids.is_empty() {
            return Ok(());
        }
        
        Messages::update_many()
            .filter(messages::Column::Id.is_in(message_ids))
            .col_expr(messages::Column::IsRead, Expr::value(true))
            .col_expr(messages::Column::ReadAt, Expr::value(chrono::Utc::now().naive_utc()))
            .exec(db)
            .await?;
        
        Ok(())
    }
    
    /// 获取未读消息数量
    pub async fn count_unread(db: &DatabaseConnection, session_id: i32, user_type: &str) -> Result<u64> {
        let count = Messages::find()
            .filter(messages::Column::SessionId.eq(session_id))
            .filter(messages::Column::IsRead.eq(false))
            .filter(messages::Column::IsDeleted.eq(false))
            .filter(messages::Column::SenderType.ne(user_type)) // 不包括自己发的消息
            .count(db)
            .await?;
        
        Ok(count)
    }
    
    /// 创建消息（完整版，对应 database.rs 中的 create_message）
    pub async fn create_full(
        db: &DatabaseConnection,
        session_id: i32,
        sender_type: &str,
        sender_id: Option<String>,  // 修改为String类型
        content: &str,
        message_type: &str,
        file_url: Option<&str>,
    ) -> Result<messages::Model> {
        // 将 file_url 存储在 metadata 中（因为实体中没有单独的 file_url 字段）
        let metadata = file_url.map(|url| {
            serde_json::json!({
                "file_url": url
            })
        });
        
        let message = messages::ActiveModel {
            session_id: Set(session_id),
            sender_type: Set(sender_type.to_string()),
            sender_id: Set(sender_id),
            content: Set(content.to_string()),
            message_type: Set(message_type.to_string()),
            metadata: Set(metadata),
            is_read: Set(false),
            is_deleted: Set(false),
            created_at: Set(chrono::Utc::now().naive_utc()),
            updated_at: Set(Some(chrono::Utc::now().naive_utc())),
            ..Default::default()
        };
        
        Ok(message.insert(db).await?)
    }
    
    /// 根据 ID 查找消息
    pub async fn find_by_id(db: &DatabaseConnection, id: i32) -> Result<Option<messages::Model>> {
        let message = Messages::find_by_id(id).one(db).await?;
        Ok(message)
    }
    
    /// 软删除消息
    pub async fn soft_delete(db: &DatabaseConnection, message_id: i32) -> Result<()> {
        let mut message: messages::ActiveModel = Messages::find_by_id(message_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Message not found"))?
            .into();
        
        message.is_deleted = Set(true);
        message.updated_at = Set(Some(chrono::Utc::now().naive_utc()));
        message.update(db).await?;
        
        Ok(())
    }
    
    /// 批量软删除消息
    pub async fn soft_delete_many(db: &DatabaseConnection, message_ids: Vec<i32>) -> Result<()> {
        if message_ids.is_empty() {
            return Ok(());
        }
        
        Messages::update_many()
            .filter(messages::Column::Id.is_in(message_ids))
            .col_expr(messages::Column::IsDeleted, Expr::value(true))
            .col_expr(messages::Column::UpdatedAt, Expr::value(chrono::Utc::now().naive_utc()))
            .exec(db)
            .await?;
        
        Ok(())
    }
    
    /// 获取会话的最后一条消息
    pub async fn find_last_by_session(db: &DatabaseConnection, session_id: i32) -> Result<Option<messages::Model>> {
        let message = Messages::find()
            .filter(messages::Column::SessionId.eq(session_id))
            .filter(messages::Column::IsDeleted.eq(false))
            .order_by_desc(messages::Column::CreatedAt)
            .one(db)
            .await?;
        
        Ok(message)
    }
    
    /// 获取会话的消息（分页）
    pub async fn find_by_session_paginated(
        db: &DatabaseConnection,
        session_id: i32,
        page: u64,
        page_size: u64,
    ) -> Result<(Vec<messages::Model>, u64)> {
        eprintln!("🔍 MessageRepository::find_by_session_paginated - session_id: {}, page: {}, page_size: {}", session_id, page, page_size);
        
        let paginator = Messages::find()
            .filter(messages::Column::SessionId.eq(session_id))
            .filter(messages::Column::IsDeleted.eq(false))
            .order_by_asc(messages::Column::CreatedAt)  // 改为升序：从旧到新
            .paginate(db, page_size);
        
        match paginator.num_items().await {
            Ok(total) => {
                eprintln!("✅ 总消息数: {}", total);
                match paginator.fetch_page(page).await {
                    Ok(messages) => {
                        eprintln!("✅ 获取到第{}页的{}条消息", page, messages.len());
                        Ok((messages, total))
                    }
                    Err(e) => {
                        eprintln!("❌ 获取消息页面失败: {:?}", e);
                        Err(e.into())
                    }
                }
            }
            Err(e) => {
                eprintln!("❌ 计算总数失败: {:?}", e);
                Err(e.into())
            }
        }
    }
    
    /// 搜索消息
    pub async fn search(
        db: &DatabaseConnection,
        shop_id: i32,
        keyword: &str,
        limit: Option<u64>,
    ) -> Result<Vec<messages::Model>> {
        let mut query = Messages::find()
            .filter(messages::Column::Content.contains(keyword))
            .filter(messages::Column::IsDeleted.eq(false))
            .order_by_desc(messages::Column::CreatedAt);
        
        if let Some(l) = limit {
            query = query.limit(l);
        }
        
        Ok(query.all(db).await?)
    }
}
