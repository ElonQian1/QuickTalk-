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
                    .col(ColumnDef::new(UnreadCounts::Id).integer().not_null().auto_increment().primary_key())
                    .col(ColumnDef::new(UnreadCounts::ShopId).integer().not_null())
                    .col(ColumnDef::new(UnreadCounts::CustomerId).integer().not_null())
                    .col(ColumnDef::new(UnreadCounts::UnreadCount).integer().not_null().default(0))
                    .col(ColumnDef::new(UnreadCounts::LastReadMessageId).integer())
                    .col(ColumnDef::new(UnreadCounts::UpdatedAt).timestamp().default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_uc_shop")
                            .from(UnreadCounts::Table, UnreadCounts::ShopId)
                            .to(Shops::Table, Shops::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_uc_customer")
                            .from(UnreadCounts::Table, UnreadCounts::CustomerId)
                            .to(Customers::Table, Customers::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_unread_counts_shop_customer")
                    .table(UnreadCounts::Table)
                    .col(UnreadCounts::ShopId)
                    .col(UnreadCounts::CustomerId)
                    .unique()
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
enum UnreadCounts { Table, Id, ShopId, CustomerId, UnreadCount, LastReadMessageId, UpdatedAt }

#[derive(Iden)]
enum Shops { Table, Id }

#[derive(Iden)]
enum Customers { Table, Id }
