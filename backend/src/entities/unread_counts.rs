use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "unread_counts")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    /// 归属店铺
    pub shop_id: i32,
    /// 客户（customers.id）
    pub customer_id: i32,
    /// 未读消息数量（历史实现列名为 unread_count）
    pub unread_count: i32,
    /// 最后已读消息 id（历史实现列名 last_read_message_id）
    pub last_read_message_id: Option<i32>,
    pub updated_at: DateTime,
}

// 无外键关系（当前物理表未声明 FK），占位枚举以满足 SeaORM 要求
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
// 注意：原设计包含 session_id / user_type / user_id / count / last_message_id 等列，
// 实际数据库采用 (shop_id, customer_id, unread_count, last_read_message_id) 聚合粒度。
// 本实体已与现行物理表对齐，若未来需要区分多客服未读，需要新建扩展表或执行数据迁移。
