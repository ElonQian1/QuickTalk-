use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "messages")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    
    pub session_id: i32,
    
    #[sea_orm(column_type = "String(Some(20))")]
    pub sender_type: String,
    
    pub sender_id: Option<i32>,
    pub sender_name: Option<String>,
    
    #[sea_orm(column_type = "String(Some(20))")]
    pub message_type: String,
    
    pub content: String,
    pub rich_content: Option<Json>,
    pub metadata: Option<Json>,
    pub reply_to: Option<i32>,
    pub is_read: bool,
    pub read_at: Option<DateTime>,
    pub is_deleted: bool,
    pub deleted_at: Option<DateTime>,
    pub created_at: DateTime,
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
    
    #[sea_orm(
        belongs_to = "Entity",
        from = "Column::ReplyTo",
        to = "Column::Id"
    )]
    ReplyToMessage,
}

impl Related<super::sessions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Session.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
