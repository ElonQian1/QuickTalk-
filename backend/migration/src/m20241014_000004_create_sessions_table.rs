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
                    .col(
                        ColumnDef::new(Sessions::SessionId)
                            .string_len(100)
                            .not_null()
                            .unique_key(),
                    )
                    .col(ColumnDef::new(Sessions::ShopId).integer().not_null())
                    .col(ColumnDef::new(Sessions::CustomerId).integer().not_null())
                    .col(ColumnDef::new(Sessions::StaffId).integer())
                    .col(
                        ColumnDef::new(Sessions::Status)
                            .string_len(20)
                            .not_null()
                            .default("active"),
                    )
                    .col(
                        ColumnDef::new(Sessions::Priority)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .col(ColumnDef::new(Sessions::Source).string_len(50))
                    .col(ColumnDef::new(Sessions::Title).string_len(200))
                    .col(ColumnDef::new(Sessions::Summary).text())
                    .col(ColumnDef::new(Sessions::Tags).text())
                    .col(ColumnDef::new(Sessions::Rating).integer())
                    .col(ColumnDef::new(Sessions::Feedback).text())
                    .col(
                        ColumnDef::new(Sessions::StartedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(ColumnDef::new(Sessions::EndedAt).timestamp())
                    .col(ColumnDef::new(Sessions::LastMessageAt).timestamp())
                    .col(
                        ColumnDef::new(Sessions::CreatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(Sessions::UpdatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
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

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_sessions_status")
                    .table(Sessions::Table)
                    .col(Sessions::Status)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_sessions_started")
                    .table(Sessions::Table)
                    .col(Sessions::StartedAt)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_sessions_last_message")
                    .table(Sessions::Table)
                    .col(Sessions::LastMessageAt)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Sessions::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum Sessions {
    Table,
    Id,
    SessionId,
    ShopId,
    CustomerId,
    StaffId,
    Status,
    Priority,
    Source,
    Title,
    Summary,
    Tags,
    Rating,
    Feedback,
    StartedAt,
    EndedAt,
    LastMessageAt,
    CreatedAt,
    UpdatedAt,
}

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
