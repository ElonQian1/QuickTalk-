use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(OnlineStatus::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(OnlineStatus::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(OnlineStatus::UserType)
                            .string_len(20)
                            .not_null(),
                    )
                    .col(ColumnDef::new(OnlineStatus::UserId).integer().not_null())
                    .col(ColumnDef::new(OnlineStatus::ShopId).integer())
                    .col(
                        ColumnDef::new(OnlineStatus::IsOnline)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(ColumnDef::new(OnlineStatus::LastSeen).timestamp())
                    .col(ColumnDef::new(OnlineStatus::ConnectionId).string_len(100))
                    .col(
                        ColumnDef::new(OnlineStatus::UpdatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // 创建唯一索引
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_online_status_unique")
                    .table(OnlineStatus::Table)
                    .col(OnlineStatus::UserType)
                    .col(OnlineStatus::UserId)
                    .col(OnlineStatus::ShopId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // 创建其他索引
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_online_status_user")
                    .table(OnlineStatus::Table)
                    .col(OnlineStatus::UserType)
                    .col(OnlineStatus::UserId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_online_status_shop")
                    .table(OnlineStatus::Table)
                    .col(OnlineStatus::ShopId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(OnlineStatus::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum OnlineStatus {
    Table,
    Id,
    UserType,
    UserId,
    ShopId,
    IsOnline,
    LastSeen,
    ConnectionId,
    UpdatedAt,
}
