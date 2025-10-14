use sea_orm::{DatabaseConnection, EntityTrait, Set, ActiveModelTrait, ColumnTrait, QueryFilter, QuerySelect};
use anyhow::Result;
use crate::entities::{unread_counts, customers, sessions};

pub struct UnreadCountRepository;

impl UnreadCountRepository {
    /// 更新未读消息计数
    pub async fn update_unread_count(
        db: &DatabaseConnection,
        shop_id: i64,
        customer_id: i64,
        increment: i32,
    ) -> Result<()> {
        // 查找现有记录
        let existing = unread_counts::Entity::find()
            .filter(unread_counts::Column::ShopId.eq(shop_id as i32))
            .filter(unread_counts::Column::CustomerId.eq(customer_id as i32))
            .one(db)
            .await?;

        if let Some(record) = existing {
            // 更新现有记录
            let mut active_model: unread_counts::ActiveModel = record.into();
            active_model.count = Set(active_model.count.unwrap() + increment);
            active_model.update(db).await?;
        } else {
            // 创建新记录
            let new_record = unread_counts::ActiveModel {
                shop_id: Set(shop_id as i32),
                customer_id: Set(customer_id as i32),
                count: Set(increment),
                ..Default::default()
            };
            new_record.insert(db).await?;
        }

        Ok(())
    }

    /// 重置未读消息计数
    pub async fn reset_unread_count(
        db: &DatabaseConnection,
        shop_id: i64,
        customer_id: i64,
    ) -> Result<()> {
        // 查找现有记录
        let existing = unread_counts::Entity::find()
            .filter(unread_counts::Column::ShopId.eq(shop_id as i32))
            .filter(unread_counts::Column::CustomerId.eq(customer_id as i32))
            .one(db)
            .await?;

        if let Some(record) = existing {
            // 重置为0
            let mut active_model: unread_counts::ActiveModel = record.into();
            active_model.count = Set(0);
            active_model.update(db).await?;
        }

        Ok(())
    }
}