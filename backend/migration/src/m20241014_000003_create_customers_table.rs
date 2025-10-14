use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Customers::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Customers::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Customers::ShopId).integer().not_null())
                    .col(
                        ColumnDef::new(Customers::CustomerId)
                            .string_len(100)
                            .not_null(),
                    )
                    .col(ColumnDef::new(Customers::Name).string_len(100))
                    .col(ColumnDef::new(Customers::Email).string_len(100))
                    .col(ColumnDef::new(Customers::Phone).string_len(20))
                    .col(ColumnDef::new(Customers::AvatarUrl).text())
                    .col(ColumnDef::new(Customers::Metadata).json())
                    .col(ColumnDef::new(Customers::FirstVisit).timestamp())
                    .col(ColumnDef::new(Customers::LastVisit).timestamp())
                    .col(ColumnDef::new(Customers::LastActiveAt).timestamp())
                    .col(
                        ColumnDef::new(Customers::VisitCount)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(Customers::IsBlocked)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(ColumnDef::new(Customers::Notes).text())
                    .col(
                        ColumnDef::new(Customers::CreatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(Customers::UpdatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_customers_shop")
                            .from(Customers::Table, Customers::ShopId)
                            .to(Shops::Table, Shops::Id)
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
                    .name("idx_customers_shop_customer")
                    .table(Customers::Table)
                    .col(Customers::ShopId)
                    .col(Customers::CustomerId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // 创建其他索引
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_customers_shop")
                    .table(Customers::Table)
                    .col(Customers::ShopId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_customers_email")
                    .table(Customers::Table)
                    .col(Customers::Email)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_customers_visit")
                    .table(Customers::Table)
                    .col(Customers::LastVisit)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_customers_active")
                    .table(Customers::Table)
                    .col(Customers::LastActiveAt)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Customers::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum Customers {
    Table,
    Id,
    ShopId,
    CustomerId,
    Name,
    Email,
    Phone,
    AvatarUrl,
    Metadata,
    FirstVisit,
    LastVisit,
    LastActiveAt,
    VisitCount,
    IsBlocked,
    Notes,
    CreatedAt,
    UpdatedAt,
}

#[derive(Iden)]
enum Shops {
    Table,
    Id,
}
