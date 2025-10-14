use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Messages::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Messages::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Messages::SessionId).integer().not_null())
                    .col(
                        ColumnDef::new(Messages::SenderType)
                            .string_len(20)
                            .not_null(),
                    )
                    .col(ColumnDef::new(Messages::SenderId).integer())
                    .col(ColumnDef::new(Messages::SenderName).string_len(100))
                    .col(
                        ColumnDef::new(Messages::MessageType)
                            .string_len(20)
                            .not_null()
                            .default("text"),
                    )
                    .col(ColumnDef::new(Messages::Content).text().not_null())
                    .col(ColumnDef::new(Messages::RichContent).json())
                    .col(ColumnDef::new(Messages::Metadata).json())
                    .col(ColumnDef::new(Messages::ReplyTo).integer())
                    .col(
                        ColumnDef::new(Messages::IsRead)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(ColumnDef::new(Messages::ReadAt).timestamp())
                    .col(
                        ColumnDef::new(Messages::IsDeleted)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(ColumnDef::new(Messages::DeletedAt).timestamp())
                    .col(
                        ColumnDef::new(Messages::CreatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(Messages::UpdatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_messages_session")
                            .from(Messages::Table, Messages::SessionId)
                            .to(Sessions::Table, Sessions::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_messages_reply")
                            .from(Messages::Table, Messages::ReplyTo)
                            .to(Messages::Table, Messages::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await?;

        // 创建索引
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_messages_session")
                    .table(Messages::Table)
                    .col(Messages::SessionId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_messages_sender")
                    .table(Messages::Table)
                    .col(Messages::SenderType)
                    .col(Messages::SenderId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_messages_created")
                    .table(Messages::Table)
                    .col(Messages::CreatedAt)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_messages_type")
                    .table(Messages::Table)
                    .col(Messages::MessageType)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_messages_read")
                    .table(Messages::Table)
                    .col(Messages::IsRead)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Messages::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum Messages {
    Table,
    Id,
    SessionId,
    SenderType,
    SenderId,
    SenderName,
    MessageType,
    Content,
    RichContent,
    Metadata,
    ReplyTo,
    IsRead,
    ReadAt,
    IsDeleted,
    DeletedAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(Iden)]
enum Sessions {
    Table,
    Id,
}
