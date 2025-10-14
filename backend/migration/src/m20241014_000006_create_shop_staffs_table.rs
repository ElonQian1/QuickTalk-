use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(ShopStaffs::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ShopStaffs::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(ShopStaffs::ShopId).integer().not_null())
                    .col(ColumnDef::new(ShopStaffs::UserId).integer().not_null())
                    .col(ColumnDef::new(ShopStaffs::Role).string_len(20).not_null().default("staff"))
                    .col(ColumnDef::new(ShopStaffs::CreatedAt).timestamp().default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_shop_staffs_shop")
                            .from(ShopStaffs::Table, ShopStaffs::ShopId)
                            .to(Shops::Table, Shops::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_shop_staffs_user")
                            .from(ShopStaffs::Table, ShopStaffs::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // 创建唯一索引（每个员工在同一店铺只能有一个角色）
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_shop_staffs_unique")
                    .table(ShopStaffs::Table)
                    .col(ShopStaffs::ShopId)
                    .col(ShopStaffs::UserId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // 创建其他索引
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_shop_staffs_shop")
                    .table(ShopStaffs::Table)
                    .col(ShopStaffs::ShopId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_shop_staffs_user")
                    .table(ShopStaffs::Table)
                    .col(ShopStaffs::UserId)
                    .to_owned(),
            )
            .await?;

        // 移除 is_active / permissions / joined_at 索引（实际表不存在对应列）

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(ShopStaffs::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum ShopStaffs { Table, Id, ShopId, UserId, Role, CreatedAt }

#[derive(Iden)]
enum Shops {
    Table,
    Id,
}

#[derive(Iden)]
enum Users {
    Table,
    Id,
}
