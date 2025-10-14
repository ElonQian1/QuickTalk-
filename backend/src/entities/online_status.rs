use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "online_status")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    
    #[sea_orm(column_type = "String(Some(20))")]
    pub user_type: String,
    
    pub user_id: i32,
    pub shop_id: Option<i32>,
    pub is_online: bool,
    pub last_seen: Option<DateTime>,
    pub connection_id: Option<String>,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
