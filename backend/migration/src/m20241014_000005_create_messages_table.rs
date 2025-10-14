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
                    .col(ColumnDef::new(Messages::Id).integer().not_null().auto_increment().primary_key())
                    .col(ColumnDef::new(Messages::SessionId).integer().not_null())
                    .col(ColumnDef::new(Messages::SenderType).string_len(10).not_null())
                    .col(ColumnDef::new(Messages::SenderId).integer())
                    .col(ColumnDef::new(Messages::Content).text().not_null())
                    .col(ColumnDef::new(Messages::MessageType).string_len(20).default("text"))
                    .col(ColumnDef::new(Messages::FileUrl).string_len(255))
                    .col(ColumnDef::new(Messages::Status).string_len(20).default("sent"))
                    .col(ColumnDef::new(Messages::CreatedAt).timestamp().default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_messages_session")
                            .from(Messages::Table, Messages::SessionId)
                            .to(Sessions::Table, Sessions::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_messages_session_id")
                    .table(Messages::Table)
                    .col(Messages::SessionId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_messages_created_at")
                    .table(Messages::Table)
                    .col(Messages::CreatedAt)
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
enum Messages { Table, Id, SessionId, SenderType, SenderId, Content, MessageType, FileUrl, Status, CreatedAt }

#[derive(Iden)]
enum Sessions { Table, Id }
