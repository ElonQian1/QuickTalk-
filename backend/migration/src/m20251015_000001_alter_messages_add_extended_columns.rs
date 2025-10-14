use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

// Purpose: 为 messages 表添加扩展列 (软删除/阅读/丰富内容/元数据/回复引用/更新时间)
// SQLite: 采用多次 ALTER TABLE ADD COLUMN，若列已存在则忽略错误继续。
// Down: SQLite 不支持 drop column，保持 no-op。

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let additions: Vec<(&str, ColumnDef)> = vec![
            ("sender_name", ColumnDef::new(Alias::new("sender_name")).string_len(100)),
            ("rich_content", ColumnDef::new(Alias::new("rich_content")).json()),
            ("metadata", ColumnDef::new(Alias::new("metadata")).json()),
            ("reply_to", ColumnDef::new(Alias::new("reply_to")).integer()),
            ("is_read", ColumnDef::new(Alias::new("is_read")).boolean().not_null().default(false)),
            ("read_at", ColumnDef::new(Alias::new("read_at")).timestamp()),
            ("is_deleted", ColumnDef::new(Alias::new("is_deleted")).boolean().not_null().default(false)),
            ("deleted_at", ColumnDef::new(Alias::new("deleted_at")).timestamp()),
            ("updated_at", ColumnDef::new(Alias::new("updated_at")).timestamp().not_null().default(Expr::current_timestamp())),
        ];

        for (_, col) in additions.into_iter() {
            let alter = Table::alter()
                .table(Alias::new("messages"))
                .add_column(col)
                .to_owned();
            if let Err(e) = manager.alter_table(alter).await {
                if !e.to_string().contains("duplicate column name") { return Err(e); }
            }
        }
        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}
