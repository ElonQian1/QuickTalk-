use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(UnreadCounts::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(UnreadCounts::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(UnreadCounts::SessionId).integer().not_null())
                    .col(
                        ColumnDef::new(UnreadCounts::UserType)
                            .string_len(20)
                            .not_null(),
                    )
                    .col(ColumnDef::new(UnreadCounts::UserId).integer())
                    .col(
                        ColumnDef::new(UnreadCounts::Count)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .col(ColumnDef::new(UnreadCounts::LastMessageId).integer())
                    .col(
                        ColumnDef::new(UnreadCounts::UpdatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_unread_counts_session")
                            .from(UnreadCounts::Table, UnreadCounts::SessionId)
                            .to(Sessions::Table, Sessions::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // 创建唯一索引
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_unread_counts_unique")
                    .table(UnreadCounts::Table)
                    .col(UnreadCounts::SessionId)
                    .col(UnreadCounts::UserType)
                    .col(UnreadCounts::UserId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // 创建其他索引
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_unread_counts_session")
                    .table(UnreadCounts::Table)
                    .col(UnreadCounts::SessionId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(UnreadCounts::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum UnreadCounts {
    Table,
    Id,
    SessionId,
    UserType,
    UserId,
    Count,
    LastMessageId,
    UpdatedAt,
}

#[derive(Iden)]
enum Sessions {
    Table,
    Id,
}
