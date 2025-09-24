use sqlx::SqlitePool;
use tracing::{info, warn};

pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

// TODO: 后续引入 sqlx::migrate! 宏和 migrations 目录。
pub async fn run_migrations(db: &SqlitePool) -> Result<(), sqlx::Error> {
    info!("运行内嵌迁移（临时实现）");

    // 性能 / 一致性 PRAGMA 设置
    // WAL 改善并发读，foreign_keys 确保约束，synchronous NORMAL 在性能与安全间折中
    for pragma in [
        "PRAGMA journal_mode=WAL;",
        "PRAGMA synchronous=NORMAL;",
        "PRAGMA foreign_keys=ON;",
        "PRAGMA temp_store=MEMORY;",
        "PRAGMA busy_timeout=5000;",
    ] {
        if let Err(e) = sqlx::query(pragma).execute(db).await { warn!(pragma, error=%e, "PRAGMA 执行失败"); }
    }

    // 执行版本化迁移 + seed（seed 放在第二个 SQL 文件）
    MIGRATOR.run(db).await?;

    let downgraded = sqlx::query(
        "UPDATE admins SET role = 'user' WHERE role = 'super_admin' AND username != 'admin'"
    ).execute(db).await?;
    if downgraded.rows_affected() > 0 { warn!(count = downgraded.rows_affected(), "降级非法超级管理员"); }

    info!("迁移完成");
    Ok(())
}
