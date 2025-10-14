use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    
    #[sea_orm(unique)]
    pub username: String,
    
    #[sea_orm(unique)]
    pub email: Option<String>,
    
    pub phone: Option<String>,
    
    pub password_hash: String,
    pub display_name: Option<String>,
    
    #[sea_orm(column_type = "String(Some(20))")]
    pub role: String,
    
    pub avatar_url: Option<String>,
    pub is_active: bool,
    pub last_login: Option<DateTime>,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::shops::Entity")]
    Shops,
    
    #[sea_orm(has_many = "super::shop_staffs::Entity")]
    ShopStaffs,
    
    #[sea_orm(has_many = "super::sessions::Entity")]
    Sessions,
}

impl Related<super::shops::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Shops.def()
    }
}

impl Related<super::shop_staffs::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ShopStaffs.def()
    }
}

impl Related<super::sessions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Sessions.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
