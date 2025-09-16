/**
 * 消息仓库的数据库模式定义
 */
const DatabaseSchemaManager = require('../utils/DatabaseSchemaManager');

class MessageRepositorySchemaConfig {
    /**
     * 获取消息相关的所有表定义
     */
    static getTableDefinitions() {
        return [
            // 对话表
            DatabaseSchemaManager.createTableDefinition(
                'conversations',
                `(
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    user_name TEXT,
                    user_email TEXT,
                    user_ip TEXT,
                    status TEXT DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_message_at DATETIME,
                    unread_count INTEGER DEFAULT 0,
                    tags TEXT DEFAULT '[]',
                    notes TEXT,
                    FOREIGN KEY (shop_id) REFERENCES shops(id)
                )`,
                '对话表'
            ),
            
            // 消息表
            DatabaseSchemaManager.createTableDefinition(
                'messages',
                `(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT NOT NULL,
                    sender_type TEXT NOT NULL,
                    sender_id TEXT,
                    sender_name TEXT,
                    message TEXT NOT NULL,
                    message_type TEXT DEFAULT 'text',
                    attachments TEXT DEFAULT '[]',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    read_at DATETIME,
                    is_read BOOLEAN DEFAULT FALSE,
                    metadata TEXT DEFAULT '{}',
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
                )`,
                '消息表'
            ),
            
            // 未读计数表
            DatabaseSchemaManager.createTableDefinition(
                'unread_counts',
                `(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    shop_id TEXT NOT NULL,
                    conversation_id TEXT NOT NULL,
                    user_type TEXT NOT NULL,
                    count INTEGER DEFAULT 0,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (shop_id) REFERENCES shops(id),
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
                    UNIQUE(shop_id, conversation_id, user_type)
                )`,
                '未读计数表'
            ),
            
            // 对话映射表（兼容模式）
            DatabaseSchemaManager.createTableDefinition(
                'conversation_mapping',
                `(
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(shop_id, user_id)
                )`,
                '对话映射表（兼容模式）'
            )
        ];
    }

    /**
     * 获取消息相关的所有索引定义
     */
    static getIndexDefinitions() {
        return [
            // 对话表索引
            DatabaseSchemaManager.createIndexDefinition('idx_conversations_shop_id', 'conversations', 'shop_id', '对话店铺索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_conversations_user_id', 'conversations', 'user_id', '对话用户索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_conversations_status', 'conversations', 'status', '对话状态索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_conversations_updated_at', 'conversations', 'updated_at', '对话更新时间索引'),
            
            // 消息表索引
            DatabaseSchemaManager.createIndexDefinition('idx_messages_conversation_id', 'messages', 'conversation_id', '消息对话索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_messages_created_at', 'messages', 'created_at', '消息创建时间索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_messages_sender_type', 'messages', 'sender_type', '消息发送者类型索引'),
            
            // 未读计数表索引
            DatabaseSchemaManager.createIndexDefinition('idx_unread_shop_id', 'unread_counts', 'shop_id', '未读计数店铺索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_unread_conversation_id', 'unread_counts', 'conversation_id', '未读计数对话索引'),
            
            // 对话映射表索引（兼容模式）
            DatabaseSchemaManager.createIndexDefinition('idx_conversation_mapping_shop_user', 'conversation_mapping', 'shop_id, user_id', '对话映射店铺用户索引')
        ];
    }
}

module.exports = MessageRepositorySchemaConfig;