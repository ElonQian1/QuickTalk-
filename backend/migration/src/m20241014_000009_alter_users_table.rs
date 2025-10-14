use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

// 基线结构已包含需要字段，此迁移为兼容保留（no-op）
#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, _manager: &SchemaManager) -> Result<(), DbErr> { Ok(()) }
    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> { Ok(()) }
}

// 保留空枚举以满足编译
#[derive(Iden)]
enum Users { Table }