use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "customers")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    
    pub shop_id: i32,
    pub customer_id: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    pub metadata: Option<Json>,
    pub first_visit: Option<DateTime>,
    pub last_visit: Option<DateTime>,
    pub last_active_at: Option<DateTime>,
    pub visit_count: i32,
    pub is_blocked: bool,
    pub notes: Option<String>,
    pub created_at: DateTime,
    pub updated_at: DateTime,
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
