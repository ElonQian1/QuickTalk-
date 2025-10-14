use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Sessions::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Sessions::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Sessions::ShopId).integer().not_null())
                    .col(ColumnDef::new(Sessions::CustomerId).integer().not_null())
                    .col(ColumnDef::new(Sessions::StaffId).integer())
                    .col(ColumnDef::new(Sessions::SessionStatus).string_len(20).default("active"))
                    .col(ColumnDef::new(Sessions::CreatedAt).timestamp().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(Sessions::ClosedAt).timestamp())
                    .col(ColumnDef::new(Sessions::LastMessageAt).timestamp().default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_sessions_shop")
                            .from(Sessions::Table, Sessions::ShopId)
                            .to(Shops::Table, Shops::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_sessions_customer")
                            .from(Sessions::Table, Sessions::CustomerId)
                            .to(Customers::Table, Customers::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_sessions_staff")
                            .from(Sessions::Table, Sessions::StaffId)
                            .to(Users::Table, Users::Id)
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
                    .name("idx_sessions_shop")
                    .table(Sessions::Table)
                    .col(Sessions::ShopId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_sessions_customer")
                    .table(Sessions::Table)
                    .col(Sessions::CustomerId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_sessions_staff")
                    .table(Sessions::Table)
                    .col(Sessions::StaffId)
                    .to_owned(),
            )
            .await?;

        // 索引保留 shop+customer / staff / last_message_at

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Sessions::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum Sessions { Table, Id, ShopId, CustomerId, StaffId, SessionStatus, CreatedAt, ClosedAt, LastMessageAt }

#[derive(Iden)]
enum Shops {
    Table,
    Id,
}

#[derive(Iden)]
enum Customers {
    Table,
    Id,
}

#[derive(Iden)]
enum Users {
    Table,
    Id,
}
