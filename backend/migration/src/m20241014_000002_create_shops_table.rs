use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Shops::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Shops::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Shops::Name).string_len(100).not_null())
                    .col(
                        ColumnDef::new(Shops::Slug)
                            .string_len(50)
                            .not_null()
                            .unique_key(),
                    )
                    .col(ColumnDef::new(Shops::Description).text())
                    .col(ColumnDef::new(Shops::LogoUrl).text())
                    .col(ColumnDef::new(Shops::WebsiteUrl).text())
                    .col(ColumnDef::new(Shops::ContactEmail).string_len(100))
                    .col(ColumnDef::new(Shops::ContactPhone).string_len(20))
                    .col(ColumnDef::new(Shops::Settings).json())
                    .col(
                        ColumnDef::new(Shops::IsActive)
                            .boolean()
                            .not_null()
                            .default(true),
                    )
                    .col(ColumnDef::new(Shops::OwnerId).integer())
                    .col(
                        ColumnDef::new(Shops::CreatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(Shops::UpdatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_shops_owner")
                            .from(Shops::Table, Shops::OwnerId)
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
                    .name("idx_shops_slug")
                    .table(Shops::Table)
                    .col(Shops::Slug)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_shops_active")
                    .table(Shops::Table)
                    .col(Shops::IsActive)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_shops_owner")
                    .table(Shops::Table)
                    .col(Shops::OwnerId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Shops::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum Shops {
    Table,
    Id,
    Name,
    Slug,
    Description,
    LogoUrl,
    WebsiteUrl,
    ContactEmail,
    ContactPhone,
    Settings,
    IsActive,
    OwnerId,
    CreatedAt,
    UpdatedAt,
}

#[derive(Iden)]
enum Users {
    Table,
    Id,
}
