//! Customer Repository - 客户数据访问层

use anyhow::Result;
use sea_orm::*;
use crate::entities::{customers, sessions, messages, unread_counts, prelude::*};

pub struct CustomerRepository;

impl CustomerRepository {
    /// 根据 ID 查找客户
    pub async fn find_by_id(db: &DatabaseConnection, id: i32) -> Result<Option<customers::Model>> {
        let customer = Customers::find_by_id(id).one(db).await?;
        Ok(customer)
    }
    
    /// 根据店铺和客户ID查找
    pub async fn find_by_shop_and_customer_id(
        db: &DatabaseConnection,
        shop_id: i32,
        customer_id: &str,
    ) -> Result<Option<customers::Model>> {
        let customer = Customers::find()
            .filter(customers::Column::ShopId.eq(shop_id))
            .filter(customers::Column::CustomerId.eq(customer_id))
            .one(db)
            .await?;
        Ok(customer)
    }
    
    /// 创建或更新客户
    pub async fn create_or_update(
        db: &DatabaseConnection,
        shop_id: i32,
        customer_id: String,
        name: Option<String>,
        email: Option<String>,
        avatar_url: Option<String>,
    ) -> Result<customers::Model> {
        // 先查找是否存在
        if let Some(existing) = Self::find_by_shop_and_customer_id(db, shop_id, &customer_id).await? {
            // 更新
            let mut customer: customers::ActiveModel = existing.clone().into();
            
            if let Some(n) = name {
                customer.customer_name = Set(Some(n));
            }
            if let Some(e) = email {
                customer.customer_email = Set(Some(e));
            }
            if let Some(a) = avatar_url {
                customer.customer_avatar = Set(Some(a));
            }
            customer.last_active_at = Set(Some(chrono::Utc::now().naive_utc()));
            
            Ok(customer.update(db).await?)
        } else {
            // 创建新客户
            // 🔧 修复：新客户创建时不设置 last_active_at，避免"新客户永远排在最前面"
            // last_active_at 只在客户真正活跃（发送消息）时才更新
            let customer = customers::ActiveModel {
                shop_id: Set(shop_id),
                customer_id: Set(customer_id),
                customer_name: Set(name),
                customer_email: Set(email),
                customer_avatar: Set(avatar_url),
                first_visit_at: Set(Some(chrono::Utc::now().naive_utc())),
                last_active_at: Set(None), // 修改：新客户不设置活跃时间，等待首次消息
                status: Set(Some(1)), // 默认状态为1（活跃）
                ..Default::default()
            };
            
            Ok(customer.insert(db).await?)
        }
    }
    
    /// 获取店铺的所有客户
    pub async fn find_by_shop(db: &DatabaseConnection, shop_id: i32) -> Result<Vec<customers::Model>> {
        let customers = Customers::find()
            .filter(customers::Column::ShopId.eq(shop_id))
            .order_by_desc(customers::Column::LastActiveAt)
            .all(db)
            .await?;
        Ok(customers)
    }

    /// 获取店铺的客户列表，包含会话信息
    pub async fn get_customers_with_sessions(db: &DatabaseConnection, shop_id: i32) -> Result<Vec<(customers::Model, Option<sessions::Model>)>> {
        use crate::entities::{customers, sessions};
        use sea_orm::*;
        
        // 🔧 修复：使用 NULLS LAST 排序，将没有活跃时间的新客户排在最后
        let results = Customers::find()
            .find_also_related(Sessions)
            .filter(customers::Column::ShopId.eq(shop_id))
            .order_by_desc(customers::Column::LastActiveAt)
            .all(db)
            .await?;
        
        // 手动排序：NULL 值（未活跃客户）排在最后
        let mut results = results;
        results.sort_by(|a, b| {
            match (&a.0.last_active_at, &b.0.last_active_at) {
                (Some(a_time), Some(b_time)) => b_time.cmp(a_time), // 都有值：降序
                (Some(_), None) => std::cmp::Ordering::Less,         // a 有值，b 没有：a 在前
                (None, Some(_)) => std::cmp::Ordering::Greater,      // a 没有，b 有值：b 在前
                (None, None) => std::cmp::Ordering::Equal,           // 都没有：相等
            }
        });
        
        Ok(results)
    }
    
    /// 更新客户最后活跃时间
    pub async fn update_last_active(db: &DatabaseConnection, customer_id: i32) -> Result<()> {
        let mut customer: customers::ActiveModel = Customers::find_by_id(customer_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Customer not found"))?
            .into();
        
        customer.last_active_at = Set(Some(chrono::Utc::now().naive_utc()));
        customer.update(db).await?;
        
        Ok(())
    }
    
    /// 获取客户概览（包含会话和最后消息）
    /// 
    /// 对应 database.rs 中的 get_customers_overview_by_shop 方法
    /// 这是一个复杂的聚合查询，返回客户列表及其相关数据
    /// 
    /// 注意：由于 Sea-ORM 的限制，复杂聚合查询可能需要使用原生 SQL
    /// 这里提供一个简化版本，实际使用时可能需要优化
    pub async fn find_with_overview_by_shop(
        db: &DatabaseConnection,
        shop_id: i32,
    ) -> Result<Vec<(customers::Model, Option<sessions::Model>, Option<messages::Model>, i64)>> {
        // 1. 获取店铺的所有客户
        let mut customers_list = Customers::find()
            .filter(customers::Column::ShopId.eq(shop_id))
            .order_by_desc(customers::Column::LastActiveAt)
            .all(db)
            .await?;
        
        // 🔧 修复：手动排序，将 NULL 值（未活跃客户）排在最后
        customers_list.sort_by(|a, b| {
            match (&a.last_active_at, &b.last_active_at) {
                (Some(a_time), Some(b_time)) => b_time.cmp(a_time),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => std::cmp::Ordering::Equal,
            }
        });
        
        let mut result = Vec::new();
        
        // 2. 为每个客户查找最新的活跃会话
        for customer in customers_list {
            // 查找最新活跃会话
            let session = Sessions::find()
                .filter(sessions::Column::ShopId.eq(shop_id))
                .filter(sessions::Column::CustomerId.eq(customer.id))
                .filter(sessions::Column::SessionStatus.eq("active"))
                .order_by_desc(sessions::Column::CreatedAt)
                .one(db)
                .await?;
            
            // 如果有会话，查找最后一条消息
            let last_message = if let Some(ref sess) = session {
                Messages::find()
                    .filter(messages::Column::SessionId.eq(sess.id))
                    .filter(messages::Column::IsDeleted.eq(false))
                    .order_by_desc(messages::Column::CreatedAt)
                    .one(db)
                    .await?
            } else {
                None
            };
            
            // 查找未读数
            let unread_count = UnreadCounts::find()
                .filter(unread_counts::Column::ShopId.eq(shop_id))
                .filter(unread_counts::Column::CustomerId.eq(customer.id))
                .one(db)
                .await?
                .map(|uc| uc.unread_count as i64)
                .unwrap_or(0);
            
            result.push((customer, session, last_message, unread_count));
        }
        
        Ok(result)
    }

    /// 统计店铺下的客户总数
    pub async fn count_by_shop(db: &DatabaseConnection, shop_id: i32, keyword: Option<&str>) -> Result<i64> {
        let mut query = Customers::find()
            .filter(customers::Column::ShopId.eq(shop_id));

        if let Some(kw) = keyword.and_then(|s| if s.trim().is_empty() { None } else { Some(s) }) {
            query = query.filter(
                Condition::any()
                    .add(customers::Column::CustomerName.contains(kw))
                    .add(customers::Column::CustomerEmail.contains(kw))
                    .add(customers::Column::CustomerId.contains(kw))
            );
        }

        let count = query.count(db).await?;
        Ok(count as i64)
    }

    /// 获取客户概览（分页）
    pub async fn find_with_overview_by_shop_paged(
        db: &DatabaseConnection,
        shop_id: i32,
        limit: i64,
        offset: i64,
        keyword: Option<&str>,
        sort: Option<&str>,
    ) -> Result<Vec<(customers::Model, Option<sessions::Model>, Option<messages::Model>, i64)>> {
        // 1. 分页获取客户列表（可选关键字过滤 + 排序）
        let mut query = Customers::find()
            .filter(customers::Column::ShopId.eq(shop_id));

        if let Some(kw) = keyword.and_then(|s| if s.trim().is_empty() { None } else { Some(s) }) {
            query = query.filter(
                Condition::any()
                    .add(customers::Column::CustomerName.contains(kw))
                    .add(customers::Column::CustomerEmail.contains(kw))
                    .add(customers::Column::CustomerId.contains(kw))
            );
        }

        // 排序：last_active_desc(默认) | name_asc | name_desc
        match sort.unwrap_or("last_active_desc").to_lowercase().as_str() {
            "name_asc" => {
                query = query.order_by_asc(customers::Column::CustomerName);
            }
            "name_desc" => {
                query = query.order_by_desc(customers::Column::CustomerName);
            }
            _ => {
                query = query.order_by_desc(customers::Column::LastActiveAt);
            }
        }

        let customers_list = query
            .limit(limit as u64)
            .offset(offset as u64)
            .all(db)
            .await?;

        let mut result = Vec::with_capacity(customers_list.len());

        for customer in customers_list {
            // 最新活跃会话
            let session = Sessions::find()
                .filter(sessions::Column::ShopId.eq(shop_id))
                .filter(sessions::Column::CustomerId.eq(customer.id))
                .filter(sessions::Column::SessionStatus.eq("active"))
                .order_by_desc(sessions::Column::CreatedAt)
                .one(db)
                .await?;

            // 最后一条消息
            let last_message = if let Some(ref sess) = session {
                Messages::find()
                    .filter(messages::Column::SessionId.eq(sess.id))
                    .filter(messages::Column::IsDeleted.eq(false))
                    .order_by_desc(messages::Column::CreatedAt)
                    .one(db)
                    .await?
            } else {
                None
            };

            // 未读数
            let unread_count = UnreadCounts::find()
                .filter(unread_counts::Column::ShopId.eq(shop_id))
                .filter(unread_counts::Column::CustomerId.eq(customer.id))
                .one(db)
                .await?
                .map(|uc| uc.unread_count as i64)
                .unwrap_or(0);

            result.push((customer, session, last_message, unread_count));
        }

        Ok(result)
    }
    
    /// 阻止客户
    pub async fn block(db: &DatabaseConnection, customer_id: i32) -> Result<()> {
        let mut customer: customers::ActiveModel = Customers::find_by_id(customer_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Customer not found"))?
            .into();
        
        // 数据库使用 status 字段，1=活跃，0=禁用
        customer.status = Set(Some(0)); // 设置为禁用
        customer.last_active_at = Set(Some(chrono::Utc::now().naive_utc()));
        customer.update(db).await?;
        
        Ok(())
    }
    
    /// 解除阻止
    pub async fn unblock(db: &DatabaseConnection, customer_id: i32) -> Result<()> {
        let mut customer: customers::ActiveModel = Customers::find_by_id(customer_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Customer not found"))?
            .into();
        
        // 数据库使用 status 字段，1=活跃，0=禁用
        customer.status = Set(Some(1)); // 设置为活跃
        customer.last_active_at = Set(Some(chrono::Utc::now().naive_utc()));
        customer.update(db).await?;
        
        Ok(())
    }
    
    /// 统计店铺的活跃客户数（最近7天）
    pub async fn count_active_by_shop(db: &DatabaseConnection, shop_id: i32, days: i64) -> Result<u64> {
        let since = chrono::Utc::now() - chrono::Duration::days(days);
        
        let count = Customers::find()
            .filter(customers::Column::ShopId.eq(shop_id))
            .filter(customers::Column::LastActiveAt.gte(since.naive_utc()))
            .count(db)
            .await?;
        
        Ok(count)
    }
    
    /// 搜索客户
    pub async fn search(
        db: &DatabaseConnection,
        shop_id: i32,
        keyword: &str,
    ) -> Result<Vec<customers::Model>> {
        let customers = Customers::find()
            .filter(customers::Column::ShopId.eq(shop_id))
            .filter(
                Condition::any()
                    .add(customers::Column::CustomerName.contains(keyword))
                    .add(customers::Column::CustomerEmail.contains(keyword))
                    .add(customers::Column::CustomerId.contains(keyword))
            )
            .order_by_desc(customers::Column::LastActiveAt)
            .all(db)
            .await?;
        
        Ok(customers)
    }
}
