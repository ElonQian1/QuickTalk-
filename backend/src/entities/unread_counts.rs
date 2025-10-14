use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "unread_counts")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    
    pub session_id: i32,
    pub shop_id: i32,
    pub customer_id: i32,
    
    #[sea_orm(column_type = "String(Some(20))")]
    pub user_type: String,
    
    pub user_id: Option<i32>,
    pub count: i32,
    pub last_message_id: Option<i32>,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::sessions::Entity",
        from = "Column::SessionId",
        to = "super::sessions::Column::Id"
    )]
    Session,
}

impl Related<super::sessions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Session.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
