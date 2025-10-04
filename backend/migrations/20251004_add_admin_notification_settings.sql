-- Migration: create admin_notification_settings table
CREATE TABLE IF NOT EXISTS admin_notification_settings (
    admin_id TEXT PRIMARY KEY,
    new_message INTEGER NOT NULL DEFAULT 1,
    employee_joined INTEGER NOT NULL DEFAULT 1,
    shop_updated INTEGER NOT NULL DEFAULT 0,
    system_notice INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(admin_id) REFERENCES admins(id) ON DELETE CASCADE
);
-- index (primary key already covers lookups)