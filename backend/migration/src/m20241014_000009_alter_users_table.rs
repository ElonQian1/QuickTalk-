use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 添加缺失的列到现有的 users 表
        
        // 添加 phone 列
        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .add_column(ColumnDef::new(Users::Phone).string_len(20))
                    .to_owned(),
            )
            .await?;

        // 添加 display_name 列
        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .add_column(ColumnDef::new(Users::DisplayName).string_len(100))
                    .to_owned(),
            )
            .await?;

        // 添加 role 列
        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .add_column(
                        ColumnDef::new(Users::Role)
                            .string_len(20)
                            .not_null()
                            .default("staff")
                    )
                    .to_owned(),
            )
            .await?;

        // 添加 is_active 列
        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .add_column(
                        ColumnDef::new(Users::IsActive)
                            .boolean()
                            .not_null()
                            .default(true)
                    )
                    .to_owned(),
            )
            .await?;

        // 添加 last_login 列
        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .add_column(ColumnDef::new(Users::LastLogin).timestamp())
                    .to_owned(),
            )
            .await?;

        // 删除旧的 status 列（如果存在）
        // 注意：SQLite 不支持 DROP COLUMN，所以我们跳过这步

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // SQLite 不支持 DROP COLUMN，所以这里留空
        Ok(())
    }
}

#[derive(Iden)]
enum Users {
    Table,
    Phone,
    DisplayName,
    Role,
    IsActive,
    LastLogin,
}