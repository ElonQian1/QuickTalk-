use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "sessions")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    
    pub shop_id: i32,
    pub customer_id: i32,
    
    // 生产数据库有session_id列（字符串类型）
    pub session_id: Option<String>,
    
    // 生产数据库列名是 "assigned_staff_id"，映射到staff_id字段
    #[sea_orm(column_name = "assigned_staff_id")]
    pub staff_id: Option<i32>,
    
    // 生产数据库列名是 "status"，不是 "session_status"
    pub status: String,
    
    pub created_at: DateTime,
    
    // 生产数据库有updated_at列
    pub updated_at: Option<DateTime>,
    
    pub closed_at: Option<DateTime>,
    
    // 生产数据库没有last_message_at列，标记为ignore
    #[sea_orm(ignore)]
    pub last_message_at: Option<DateTime>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::shops::Entity",
        from = "Column::ShopId",
        to = "super::shops::Column::Id"
    )]
    Shop,
    
    #[sea_orm(
        belongs_to = "super::customers::Entity",
        from = "Column::CustomerId",
        to = "super::customers::Column::Id"
    )]
    Customer,
    
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::StaffId",
        to = "super::users::Column::Id"
    )]
    Staff,
    
    #[sea_orm(has_many = "super::messages::Entity")]
    Messages,
}

impl Related<super::shops::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Shop.def()
    }
}

impl Related<super::customers::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Customer.def()
    }
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Staff.def()
    }
}

impl Related<super::messages::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Messages.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
