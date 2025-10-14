#!/usr/bin/env rust-script
//! ```cargo
//! [dependencies]
//! serde = { version = "1.0", features = ["derive"] }
//! serde_json = "1.0"
//! chrono = { version = "0.4", features = ["serde"] }
//! ```

use std::collections::HashMap;
use std::fs;

/// 表示数据库字段的结构
#[derive(Debug, Clone)]
struct Field {
    name: String,
    field_type: String,
    nullable: bool,
    primary_key: bool,
    unique: bool,
    default_value: Option<String>,
    foreign_key: Option<(String, String)>, // (table, column)
}

/// 表示数据库表的结构
#[derive(Debug, Clone)]
struct Table {
    name: String,
    fields: Vec<Field>,
    indexes: Vec<String>,
    triggers: Vec<String>,
}

/// Schema生成器
struct SchemaGenerator {
    tables: Vec<Table>,
}

impl SchemaGenerator {
    fn new() -> Self {
        Self {
            tables: Vec::new(),
        }
    }

    /// 从项目模型定义生成表结构
    fn generate_from_models(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("🔍 分析Rust模型文件...");

        // 这里应该解析 backend/src/models.rs
        // 为了演示，我们手动定义表结构
        self.define_core_tables();
        
        Ok(())
    }

    /// 定义核心表（基于你的项目需求）
    fn define_core_tables(&mut self) {
        // Users表
        let users_table = Table {
            name: "users".to_string(),
            fields: vec![
                Field {
                    name: "id".to_string(),
                    field_type: "INTEGER".to_string(),
                    nullable: false,
                    primary_key: true,
                    unique: false,
                    default_value: None,
                    foreign_key: None,
                },
                Field {
                    name: "username".to_string(),
                    field_type: "VARCHAR(50)".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: true,
                    default_value: None,
                    foreign_key: None,
                },
                Field {
                    name: "password_hash".to_string(),
                    field_type: "VARCHAR(255)".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    default_value: None,
                    foreign_key: None,
                },
                Field {
                    name: "email".to_string(),
                    field_type: "VARCHAR(100)".to_string(),
                    nullable: true,
                    primary_key: false,
                    unique: true,
                    default_value: None,
                    foreign_key: None,
                },
                Field {
                    name: "display_name".to_string(),
                    field_type: "VARCHAR(100)".to_string(),
                    nullable: true,
                    primary_key: false,
                    unique: false,
                    default_value: None,
                    foreign_key: None,
                },
                Field {
                    name: "role".to_string(),
                    field_type: "VARCHAR(20)".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    default_value: Some("'staff'".to_string()),
                    foreign_key: None,
                },
                Field {
                    name: "avatar_url".to_string(),
                    field_type: "TEXT".to_string(),
                    nullable: true,
                    primary_key: false,
                    unique: false,
                    default_value: None,
                    foreign_key: None,
                },
                Field {
                    name: "is_active".to_string(),
                    field_type: "BOOLEAN".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    default_value: Some("true".to_string()),
                    foreign_key: None,
                },
                Field {
                    name: "created_at".to_string(),
                    field_type: "DATETIME".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    default_value: Some("CURRENT_TIMESTAMP".to_string()),
                    foreign_key: None,
                },
                Field {
                    name: "updated_at".to_string(),
                    field_type: "DATETIME".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    default_value: Some("CURRENT_TIMESTAMP".to_string()),
                    foreign_key: None,
                },
            ],
            indexes: vec![
                "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);".to_string(),
                "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);".to_string(),
                "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);".to_string(),
            ],
            triggers: vec![
                r#"CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
                   AFTER UPDATE ON users
                   FOR EACH ROW 
                   BEGIN
                       UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                   END;"#.to_string(),
            ],
        };
        self.tables.push(users_table);

        // Shops表
        let shops_table = Table {
            name: "shops".to_string(),
            fields: vec![
                Field {
                    name: "id".to_string(),
                    field_type: "INTEGER".to_string(),
                    nullable: false,
                    primary_key: true,
                    unique: false,
                    default_value: None,
                    foreign_key: None,
                },
                Field {
                    name: "name".to_string(),
                    field_type: "VARCHAR(100)".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    default_value: None,
                    foreign_key: None,
                },
                Field {
                    name: "slug".to_string(),
                    field_type: "VARCHAR(50)".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: true,
                    default_value: None,
                    foreign_key: None,
                },
                Field {
                    name: "description".to_string(),
                    field_type: "TEXT".to_string(),
                    nullable: true,
                    primary_key: false,
                    unique: false,
                    default_value: None,
                    foreign_key: None,
                },
                Field {
                    name: "owner_id".to_string(),
                    field_type: "INTEGER".to_string(),
                    nullable: true,
                    primary_key: false,
                    unique: false,
                    default_value: None,
                    foreign_key: Some(("users".to_string(), "id".to_string())),
                },
                Field {
                    name: "is_active".to_string(),
                    field_type: "BOOLEAN".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    default_value: Some("true".to_string()),
                    foreign_key: None,
                },
                Field {
                    name: "created_at".to_string(),
                    field_type: "DATETIME".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    default_value: Some("CURRENT_TIMESTAMP".to_string()),
                    foreign_key: None,
                },
                Field {
                    name: "updated_at".to_string(),
                    field_type: "DATETIME".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    default_value: Some("CURRENT_TIMESTAMP".to_string()),
                    foreign_key: None,
                },
            ],
            indexes: vec![
                "CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops(slug);".to_string(),
                "CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_id);".to_string(),
            ],
            triggers: vec![],
        };
        self.tables.push(shops_table);

        // shop_staffs表（重要！这个表之前缺失）
        let shop_staffs_table = Table {
            name: "shop_staffs".to_string(),
            fields: vec![
                Field {
                    name: "id".to_string(),
                    field_type: "INTEGER".to_string(),
                    nullable: false,
                    primary_key: true,
                    unique: false,
                    default_value: None,
                    foreign_key: None,
                },
                Field {
                    name: "shop_id".to_string(),
                    field_type: "INTEGER".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    default_value: None,
                    foreign_key: Some(("shops".to_string(), "id".to_string())),
                },
                Field {
                    name: "user_id".to_string(),
                    field_type: "INTEGER".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    default_value: None,
                    foreign_key: Some(("users".to_string(), "id".to_string())),
                },
                Field {
                    name: "role".to_string(),
                    field_type: "VARCHAR(20)".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    default_value: Some("'staff'".to_string()),
                    foreign_key: None,
                },
                Field {
                    name: "is_active".to_string(),
                    field_type: "BOOLEAN".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    default_value: Some("true".to_string()),
                    foreign_key: None,
                },
                Field {
                    name: "created_at".to_string(),
                    field_type: "DATETIME".to_string(),
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    default_value: Some("CURRENT_TIMESTAMP".to_string()),
                    foreign_key: None,
                },
            ],
            indexes: vec![
                "CREATE INDEX IF NOT EXISTS idx_shop_staffs_shop ON shop_staffs(shop_id);".to_string(),
                "CREATE INDEX IF NOT EXISTS idx_shop_staffs_user ON shop_staffs(user_id);".to_string(),
            ],
            triggers: vec![],
        };
        self.tables.push(shop_staffs_table);

        println!("✅ 定义了 {} 个表", self.tables.len());
    }

    /// 生成CREATE TABLE SQL
    fn generate_create_table_sql(&self, table: &Table) -> String {
        let mut sql = format!("CREATE TABLE IF NOT EXISTS {} (\n", table.name);
        
        let mut field_definitions = Vec::new();
        let mut constraints = Vec::new();

        for field in &table.fields {
            let mut field_def = format!("    {} {}", field.name, field.field_type);
            
            if field.primary_key {
                field_def.push_str(" PRIMARY KEY AUTOINCREMENT");
            }
            
            if !field.nullable && !field.primary_key {
                field_def.push_str(" NOT NULL");
            }
            
            if field.unique && !field.primary_key {
                field_def.push_str(" UNIQUE");
            }
            
            if let Some(ref default) = field.default_value {
                field_def.push_str(&format!(" DEFAULT {}", default));
            }
            
            field_definitions.push(field_def);
            
            // 外键约束
            if let Some((ref table_ref, ref column_ref)) = field.foreign_key {
                constraints.push(format!(
                    "    FOREIGN KEY ({}) REFERENCES {}({}) ON DELETE CASCADE",
                    field.name, table_ref, column_ref
                ));
            }
        }

        // 添加唯一约束（如果需要组合唯一键）
        if table.name == "shop_staffs" {
            constraints.push("    UNIQUE(shop_id, user_id)".to_string());
        }

        // 合并字段定义和约束
        let mut all_definitions = field_definitions;
        all_definitions.extend(constraints);
        
        sql.push_str(&all_definitions.join(",\n"));
        sql.push_str("\n);");
        
        sql
    }

    /// 生成完整的SQL schema
    fn generate_complete_sql(&self) -> String {
        let mut sql = String::new();
        
        // 文件头
        sql.push_str(&format!(
            "-- ==============================================\n\
             -- ELonTalk 客服系统 - 自动生成数据库架构\n\
             -- 生成时间: {}\n\
             -- 生成器: Rust Schema Generator\n\
             -- ==============================================\n\n\
             -- 启用外键约束\n\
             PRAGMA foreign_keys = ON;\n\n",
            chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
        ));

        // 生成表
        for table in &self.tables {
            sql.push_str(&format!(
                "-- ==============================================\n\
                 -- {} 表\n\
                 -- ==============================================\n\n",
                table.name
            ));
            
            sql.push_str(&self.generate_create_table_sql(table));
            sql.push_str("\n\n");
            
            // 添加索引
            if !table.indexes.is_empty() {
                sql.push_str(&format!("-- {} 表索引\n", table.name));
                for index in &table.indexes {
                    sql.push_str(index);
                    sql.push_str("\n");
                }
                sql.push_str("\n");
            }
        }

        // 添加触发器
        sql.push_str("-- ==============================================\n");
        sql.push_str("-- 触发器 (自动更新时间戳)\n");
        sql.push_str("-- ==============================================\n\n");
        
        for table in &self.tables {
            for trigger in &table.triggers {
                sql.push_str(trigger);
                sql.push_str("\n\n");
            }
        }

        sql
    }

    /// 保存到文件
    fn save_to_file(&self, filename: &str) -> Result<(), Box<dyn std::error::Error>> {
        let sql = self.generate_complete_sql();
        fs::write(filename, sql)?;
        println!("✅ Schema已保存到: {}", filename);
        Ok(())
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🦀 Rust Schema Generator");
    println!("========================\n");
    
    let mut generator = SchemaGenerator::new();
    
    // 生成schema
    generator.generate_from_models()?;
    
    // 保存到文件
    let output_file = "database_schema_generated.sql";
    generator.save_to_file(output_file)?;
    
    // 统计信息
    println!("\n📊 生成统计:");
    println!("  📋 表数量: {}", generator.tables.len());
    let total_indexes: usize = generator.tables.iter().map(|t| t.indexes.len()).sum();
    println!("  🔍 索引数量: {}", total_indexes);
    let total_triggers: usize = generator.tables.iter().map(|t| t.triggers.len()).sum();
    println!("  ⚡ 触发器数量: {}", total_triggers);
    
    println!("\n🎉 Schema生成完成！");
    println!("💡 提示: 你可以扩展这个生成器来解析真实的Rust结构体");
    
    Ok(())
}