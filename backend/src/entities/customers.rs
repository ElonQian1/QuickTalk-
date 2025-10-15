use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "customers")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    
    pub shop_id: i32,
    pub customer_id: String,
    
    // 生产数据库列名是 "name"，不是 "customer_name"
    pub name: Option<String>,
    
    // 生产数据库列名是 "email"，不是 "customer_email"
    pub email: Option<String>,
    
    // 生产数据库有phone列
    pub phone: Option<String>,
    
    // 生产数据库列名是 "avatar_url"，不是 "customer_avatar"
    pub avatar_url: Option<String>,
    
    // 生产数据库有metadata列（JSON字符串）
    pub metadata: Option<String>,
    
    // 生产数据库有is_online列
    pub is_online: Option<bool>,
    
    // 生产数据库有last_seen列
    pub last_seen: Option<DateTime>,
    
    // 生产数据库有created_at列
    pub created_at: Option<DateTime>,
    
    // 生产数据库有updated_at列
    pub updated_at: Option<DateTime>,
    
    // 生产数据库有last_active_at列
    pub last_active_at: Option<DateTime>,
    
    // 生产数据库没有这些字段，标记为ignore
    #[sea_orm(ignore)]
    pub ip_address: Option<String>,
    
    #[sea_orm(ignore)]
    pub user_agent: Option<String>,
    
    #[sea_orm(ignore)]
    pub first_visit_at: Option<DateTime>,
    
    #[sea_orm(ignore)]
    pub status: Option<i32>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::shops::Entity",
        from = "Column::ShopId",
        to = "super::shops::Column::Id"
    )]
    Shop,
    
    #[sea_orm(has_many = "super::sessions::Entity")]
    Sessions,
}

impl Related<super::shops::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Shop.def()
    }
}

impl Related<super::sessions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Sessions.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
