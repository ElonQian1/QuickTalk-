use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Users::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Users::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(Users::Username)
                            .string_len(50)
                            .not_null()
                            .unique_key(),
                    )
                    .col(ColumnDef::new(Users::Email).string_len(100).unique_key())
                    .col(
                        ColumnDef::new(Users::PasswordHash)
                            .string_len(255)
                            .not_null(),
                    )
                    .col(ColumnDef::new(Users::DisplayName).string_len(100))
                    .col(
                        ColumnDef::new(Users::Role)
                            .string_len(20)
                            .not_null()
                            .default("staff"),
                    )
                    .col(ColumnDef::new(Users::AvatarUrl).text())
                    .col(
                        ColumnDef::new(Users::IsActive)
                            .boolean()
                            .not_null()
                            .default(true),
                    )
                    .col(ColumnDef::new(Users::LastLogin).timestamp())
                    .col(
                        ColumnDef::new(Users::CreatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(Users::UpdatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // 创建索引
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_users_username")
                    .table(Users::Table)
                    .col(Users::Username)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_users_email")
                    .table(Users::Table)
                    .col(Users::Email)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_users_role")
                    .table(Users::Table)
                    .col(Users::Role)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_users_active")
                    .table(Users::Table)
                    .col(Users::IsActive)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Users::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum Users {
    Table,
    Id,
    Username,
    Email,
    PasswordHash,
    DisplayName,
    Role,
    AvatarUrl,
    IsActive,
    LastLogin,
    CreatedAt,
    UpdatedAt,
}
