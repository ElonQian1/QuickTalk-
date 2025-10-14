use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "shop_staffs")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    
    pub shop_id: i32,
    pub user_id: i32,
    
    #[sea_orm(column_type = "String(Some(20))")]
    pub role: String,
    
    pub permissions: Option<Json>,
    pub is_active: bool,
    pub joined_at: DateTime,
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
    
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::UserId",
        to = "super::users::Column::Id"
    )]
    User,
}

impl Related<super::shops::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Shop.def()
    }
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::User.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
