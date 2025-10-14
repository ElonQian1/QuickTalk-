use sea_orm_migration::prelude::*;

// 完全匹配实际 SQLite customers 表结构
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
                    .col(ColumnDef::new(Customers::Id).integer().not_null().auto_increment().primary_key())
                    .col(ColumnDef::new(Customers::ShopId).integer().not_null())
                    .col(ColumnDef::new(Customers::CustomerId).string_len(100).not_null())
                    .col(ColumnDef::new(Customers::CustomerName).string_len(100))
                    .col(ColumnDef::new(Customers::CustomerEmail).string_len(100))
                    .col(ColumnDef::new(Customers::CustomerAvatar).string_len(255))
                    .col(ColumnDef::new(Customers::IpAddress).string_len(45))
                    .col(ColumnDef::new(Customers::UserAgent).text())
                    .col(ColumnDef::new(Customers::FirstVisitAt).timestamp().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(Customers::LastActiveAt).timestamp().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(Customers::Status).integer().not_null().default(1))
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

        // 唯一约束 (shop_id, customer_id)
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

        // 索引：shop_id
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_customers_shop_id")
                    .table(Customers::Table)
                    .col(Customers::ShopId)
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
    CustomerName,
    CustomerEmail,
    CustomerAvatar,
    IpAddress,
    UserAgent,
    FirstVisitAt,
    LastActiveAt,
    Status,
}

#[derive(Iden)]
enum Shops { Table, Id }
