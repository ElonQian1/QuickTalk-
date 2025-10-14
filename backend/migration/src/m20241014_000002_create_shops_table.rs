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
                    .col(ColumnDef::new(Shops::OwnerId).integer().not_null())
                    .col(ColumnDef::new(Shops::ShopName).string_len(100).not_null())
                    .col(ColumnDef::new(Shops::ShopUrl).string_len(255))
                    .col(ColumnDef::new(Shops::ApiKey).string_len(64).not_null().unique_key())
                    .col(
                        ColumnDef::new(Shops::Status)
                            .integer()
                            .not_null()
                            .default(1),
                    )
                    .col(ColumnDef::new(Shops::CreatedAt).timestamp().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(Shops::UpdatedAt).timestamp().default(Expr::current_timestamp()))
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
                    .name("idx_shops_owner_id")
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
enum Shops { Table, Id, OwnerId, ShopName, ShopUrl, ApiKey, Status, CreatedAt, UpdatedAt }

#[derive(Iden)]
enum Users {
    Table,
    Id,
}
