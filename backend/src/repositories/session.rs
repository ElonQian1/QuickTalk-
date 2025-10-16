//! Session Repository - 会话数据访问层

use anyhow::Result;
use sea_orm::*;
use crate::entities::{sessions, prelude::*};

pub struct SessionRepository;

impl SessionRepository {
    /// 根据 session_id 查找会话 (这里session_id实际是数据库的id)
    pub async fn find_by_session_id(db: &DatabaseConnection, session_id: &str) -> Result<Option<sessions::Model>> {
        // 尝试将session_id解析为整数ID
        if let Ok(id) = session_id.parse::<i32>() {
            let session = Sessions::find()
                .filter(sessions::Column::Id.eq(id))
                .one(db)
                .await?;
            Ok(session)
        } else {
            Ok(None) // 如果无法解析为整数，返回None
        }
    }
    
    /// 创建新会话
    pub async fn create(
        db: &DatabaseConnection,
        _session_id: String,  // 数据库没有这个字段，保留参数以兼容接口
        shop_id: i32,
        customer_id: i32,
    ) -> Result<sessions::Model> {
        let session = sessions::ActiveModel {
            shop_id: Set(shop_id),
            customer_id: Set(customer_id),
            session_status: Set(Some("active".to_string())),
            created_at: Set(Some(chrono::Utc::now().naive_utc())),
            last_message_at: Set(Some(chrono::Utc::now().naive_utc())),
            ..Default::default()
        };
        
        Ok(session.insert(db).await?)
    }
    
    /// 获取店铺的活跃会话
    pub async fn find_active_by_shop(db: &DatabaseConnection, shop_id: i32) -> Result<Vec<sessions::Model>> {
        let sessions = Sessions::find()
            .filter(sessions::Column::ShopId.eq(shop_id))
            .filter(sessions::Column::SessionStatus.eq("active"))
            .order_by_desc(sessions::Column::LastMessageAt)
            .all(db)
            .await?;
        Ok(sessions)
    }
    
    /// 分配客服
    pub async fn assign_staff(db: &DatabaseConnection, session_id: i32, staff_id: i32) -> Result<()> {
        let mut session: sessions::ActiveModel = Sessions::find_by_id(session_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Session not found"))?
            .into();
        
        session.staff_id = Set(Some(staff_id));
        session.last_message_at = Set(Some(chrono::Utc::now().naive_utc()));
        session.update(db).await?;
        
        Ok(())
    }
    
    /// 更新最后消息时间
    pub async fn update_last_message_time(db: &DatabaseConnection, session_id: i32) -> Result<()> {
        let mut session: sessions::ActiveModel = Sessions::find_by_id(session_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Session not found"))?
            .into();
        
        session.last_message_at = Set(Some(chrono::Utc::now().naive_utc()));
        session.update(db).await?;
        
        Ok(())
    }
    
    /// 根据 ID 查找会话
    /// 
    /// 对应 database.rs 中的 get_session_by_id 方法
    pub async fn find_by_id(db: &DatabaseConnection, id: i32) -> Result<Option<sessions::Model>> {
        let session = Sessions::find_by_id(id).one(db).await?;
        Ok(session)
    }
    
    /// 根据店铺和客户查找活跃会话
    /// 
    /// 对应 database.rs 中的 get_session_by_shop_customer 方法
    pub async fn find_by_shop_and_customer(
        db: &DatabaseConnection,
        shop_id: i32,
        customer_id: i32,
    ) -> Result<Option<sessions::Model>> {
        let session = Sessions::find()
            .filter(sessions::Column::ShopId.eq(shop_id))
            .filter(sessions::Column::CustomerId.eq(customer_id))
            .filter(sessions::Column::SessionStatus.eq("active"))
            .order_by_desc(sessions::Column::CreatedAt)
            .one(db)
            .await?;
        Ok(session)
    }
    
    /// 创建会话（简化版）
    /// 
    /// 对应 database.rs 中的 create_session 方法
    pub async fn create_simple(
        db: &DatabaseConnection,
        shop_id: i32,
        customer_id: i32,
    ) -> Result<sessions::Model> {
        let session_id = uuid::Uuid::new_v4().to_string();
        Self::create(db, session_id, shop_id, customer_id).await
    }
    
    /// 关闭会话
    pub async fn close(db: &DatabaseConnection, session_id: i32) -> Result<()> {
        let mut session: sessions::ActiveModel = Sessions::find_by_id(session_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Session not found"))?
            .into();
        
        session.session_status = Set(Some("closed".to_string()));
        session.closed_at = Set(Some(chrono::Utc::now().naive_utc()));
        session.update(db).await?;
        
        Ok(())
    }
    
    /// 设置会话优先级 (当前表结构不支持，仅更新时间)
    pub async fn set_priority(db: &DatabaseConnection, session_id: i32, _priority: i32) -> Result<()> {
        let mut session: sessions::ActiveModel = Sessions::find_by_id(session_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Session not found"))?
            .into();
        
        // 由于表结构不支持priority字段，仅更新时间
        session.last_message_at = Set(Some(chrono::Utc::now().naive_utc()));
        session.update(db).await?;
        
        Ok(())
    }
    
    /// 获取客服的活跃会话
    pub async fn find_by_staff(db: &DatabaseConnection, staff_id: i32) -> Result<Vec<sessions::Model>> {
        let sessions = Sessions::find()
            .filter(sessions::Column::StaffId.eq(staff_id))
            .filter(sessions::Column::SessionStatus.eq("active"))
            .order_by_desc(sessions::Column::LastMessageAt)
            .all(db)
            .await?;
        Ok(sessions)
    }
    
    /// 获取未分配的会话
    pub async fn find_unassigned_by_shop(db: &DatabaseConnection, shop_id: i32) -> Result<Vec<sessions::Model>> {
        let sessions = Sessions::find()
            .filter(sessions::Column::ShopId.eq(shop_id))
            .filter(sessions::Column::StaffId.is_null())
            .filter(sessions::Column::SessionStatus.eq("active"))
            .order_by_desc(sessions::Column::CreatedAt)
            .all(db)
            .await?;
        Ok(sessions)
    }

    /// 重置客户在店铺中的未读计数
    pub async fn reset_customer_unread_count(
        db: &DatabaseConnection,
        shop_id: i32,
        customer_id: i32,
    ) -> Result<()> {
        // TODO: 修复unread_counts表schema后启用
        // crate::repositories::UnreadCountRepository::reset_unread_count(
        //     db,
        //     shop_id as i64,
        //     customer_id as i64,
        // ).await
        let _ = (db, shop_id, customer_id); // 避免未使用变量警告
        Ok(())
    }

    /// 重置店铺所有未读计数
    pub async fn reset_all_unread_in_shop(
        db: &DatabaseConnection,
        shop_id: i32,
    ) -> Result<()> {
        // TODO: 修复unread_counts表schema后启用
        // use crate::entities::{unread_counts, prelude::*};
        
        // let update_result = UnreadCounts::update_many()
        //     .col_expr(unread_counts::Column::UnreadCount, sea_orm::sea_query::Expr::value(0))
        //     .filter(unread_counts::Column::ShopId.eq(shop_id))
        //     .exec(db)
        //     .await?;
        
        // tracing::info!("重置店铺 {} 的 {} 个未读计数", shop_id, update_result.rows_affected);
        let _ = (db, shop_id); // 避免未使用变量警告
        Ok(())
    }
}
