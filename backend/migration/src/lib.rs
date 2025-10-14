pub use sea_orm_migration::prelude::*;

mod m20241014_000001_create_users_table;
mod m20241014_000002_create_shops_table;
mod m20241014_000003_create_customers_table;
mod m20241014_000004_create_sessions_table;
mod m20241014_000005_create_messages_table;
mod m20241014_000006_create_shop_staffs_table;
mod m20241014_000007_create_unread_counts_table;
mod m20241014_000008_create_online_status_table;
mod m20241014_000009_alter_users_table;
mod m20251015_000001_alter_messages_add_extended_columns;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20241014_000001_create_users_table::Migration),
            Box::new(m20241014_000002_create_shops_table::Migration),
            Box::new(m20241014_000003_create_customers_table::Migration),
            Box::new(m20241014_000004_create_sessions_table::Migration),
            Box::new(m20241014_000005_create_messages_table::Migration),
            Box::new(m20241014_000006_create_shop_staffs_table::Migration),
            Box::new(m20241014_000007_create_unread_counts_table::Migration),
            Box::new(m20241014_000008_create_online_status_table::Migration),
            Box::new(m20241014_000009_alter_users_table::Migration),
            // 2025-10-15 M1 扩展 messages 列 (阅读状态 / 软删除 / 富文本 / 引用 / 更新时间)
            Box::new(m20251015_000001_alter_messages_add_extended_columns::Migration),
        ]
    }
}
