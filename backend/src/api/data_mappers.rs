/// 公共数据转换和映射函数
/// 用于消除各模块中重复的数据转换代码

use sqlx::{Row, sqlite::SqliteRow};
use crate::types::{Shop, Conversation, Message, ConversationSummary, Employee};

/// 从数据库行转换为Shop结构体
pub fn row_to_shop(row: &SqliteRow) -> Shop {
    row_to_shop_with_owner(row, row.try_get("owner_id").unwrap_or_else(|_| "legacy_data".to_string()))
}

/// 从数据库行转换为Shop结构体，使用自定义owner_id
pub fn row_to_shop_with_owner(row: &SqliteRow, owner_id: String) -> Shop {
    Shop {
        id: row.get("id"),
        name: row.get("name"),
        domain: row.get("domain"),
        api_key: row.get("api_key"),
        owner_id,
        status: row.get("status"),
        created_at: row.get("created_at"),
        payment_status: row.try_get("payment_status").ok(),
        subscription_type: row.try_get("subscription_type").ok(),
        subscription_status: row.try_get("subscription_status").ok(),
        subscription_expires_at: row.try_get("subscription_expires_at").ok(),
        contact_email: row.try_get("contact_email").ok(),
        contact_phone: row.try_get("contact_phone").ok(),
        contact_info: row.try_get("contact_info").ok(),
        membership: row.try_get("membership").ok(),
    }
}

/// 从数据库行转换为Shop结构体，并设置membership为employee
pub fn row_to_shop_employee(row: &SqliteRow) -> Shop {
    row_to_shop_with_membership(row, "employee")
}

/// 从数据库行转换为Shop结构体，并设置membership为owner
pub fn row_to_shop_owner(row: &SqliteRow) -> Shop {
    row_to_shop_with_membership(row, "owner")
}

/// 通用的membership设置函数
fn row_to_shop_with_membership(row: &SqliteRow, membership: &str) -> Shop {
    let mut shop = row_to_shop(row);
        shop.membership = Some(membership.to_string());
    shop
}

/// 从数据库行转换为Employee结构体
pub fn row_to_employee(row: &SqliteRow) -> Employee {
    Employee {
        id: row.get("id"),
        shop_id: row.get("shop_id"),
        name: row.get("name"),
        email: row.get("email"),
        role: row.get("role"),
        status: row.get("status"),
        created_at: row.get("created_at"),
    }
}

/// 从邀请接受场景的数据构造Employee结构体
pub fn create_employee_from_invitation(
    id: String,
    shop_id: String,
    name: String,
    email: String,
    role: String,
    created_at: chrono::DateTime<chrono::Utc>
) -> Employee {
    Employee {
        id,
        shop_id,
        name,
        email,
        role,
        status: "active".to_string(),
        created_at,
    }
}/// 从CreateShopOutput构造Shop结构体
pub fn create_shop_output_to_shop(output: &crate::application::shops::usecases::CreateShopOutput, name: String, domain: String, owner_id: String) -> Shop {
    Shop {
        id: output.id.clone(),
        name,
        domain,
        api_key: output.api_key.clone(),
        owner_id,
        status: "pending".to_string(),
        created_at: output.created_at.clone(),
        payment_status: None,
        subscription_type: None,
        subscription_status: None,
        subscription_expires_at: None,
        contact_email: None,
        contact_phone: None,
        contact_info: None,
        membership: None,
    }
}

/// 从数据库行转换为Conversation结构体
pub fn row_to_conversation(row: &SqliteRow) -> Conversation {
    Conversation {
        id: row.get("id"),
        shop_id: row.get("shop_id"),
        customer_id: row.get("customer_id"),
        status: row.get("status"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        unread_count: row.try_get("unread_count").ok(),
        last_message: row.try_get("last_message").ok(),
        last_message_time: row.try_get("last_message_time").ok(),
    }
}

/// 从数据库行转换为ConversationSummary结构体
pub fn row_to_conversation_summary(row: &SqliteRow) -> ConversationSummary {
    ConversationSummary {
        id: row.get("id"),
        shop_id: row.get("shop_id"),
        customer_name: row.try_get("customer_name").unwrap_or_else(|_| "Unknown".to_string()),
        status: row.get("status"),
        last_message: row.try_get("last_message").unwrap_or_else(|_| "".to_string()),
        updated_at: row.get("updated_at"),
        created_at: row.try_get("created_at").ok(),
        last_message_time: row.try_get("last_message_time").ok(),
    }
}

/// 从数据库行转换为Message结构体
pub fn row_to_message(row: &SqliteRow) -> Message {
    Message {
        id: row.get("id"),
        conversation_id: row.get("conversation_id"),
        sender_type: row.get("sender_type"),
        sender_id: row.try_get("sender_id").unwrap_or_else(|_| "unknown".to_string()),
        content: row.get("content"),
        message_type: row.get("message_type"),
        timestamp: row.get("timestamp"),
        shop_id: row.try_get("shop_id").ok(),
    }
}