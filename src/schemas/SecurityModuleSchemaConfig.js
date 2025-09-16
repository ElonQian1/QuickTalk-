/**
 * 综合安全模块的数据库模式定义
 */
const DatabaseSchemaManager = require('../utils/DatabaseSchemaManager');

class SecurityModuleSchemaConfig {
    /**
     * 获取安全相关的所有表定义
     */
    static getTableDefinitions() {
        return [
            // 安全审计日志表
            DatabaseSchemaManager.createTableDefinition(
                'security_audit_logs',
                `(
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    user_id TEXT,
                    event_type TEXT NOT NULL,
                    event_description TEXT NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    risk_level TEXT DEFAULT 'low',
                    event_data TEXT,
                    created_at TEXT NOT NULL,
                    INDEX(shop_id, event_type),
                    INDEX(user_id, created_at),
                    INDEX(risk_level, created_at)
                )`,
                '安全审计日志表'
            ),
            
            // 安全会话表
            DatabaseSchemaManager.createTableDefinition(
                'security_sessions',
                `(
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    shop_id TEXT NOT NULL,
                    session_token TEXT UNIQUE NOT NULL,
                    ip_address TEXT NOT NULL,
                    user_agent TEXT,
                    is_active INTEGER DEFAULT 1,
                    last_activity_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    security_flags TEXT DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    INDEX(user_id, is_active),
                    INDEX(session_token),
                    INDEX(expires_at)
                )`,
                '安全会话表'
            ),
            
            // 访问控制规则表
            DatabaseSchemaManager.createTableDefinition(
                'security_access_rules',
                `(
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    rule_name TEXT NOT NULL,
                    resource_type TEXT NOT NULL,
                    resource_pattern TEXT NOT NULL,
                    permission_type TEXT NOT NULL,
                    allowed_roles TEXT NOT NULL,
                    allowed_users TEXT,
                    conditions TEXT DEFAULT '{}',
                    priority INTEGER DEFAULT 0,
                    is_active INTEGER DEFAULT 1,
                    created_by TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    INDEX(shop_id, resource_type),
                    INDEX(priority, is_active)
                )`,
                '访问控制规则表'
            ),
            
            // 威胁检测记录表
            DatabaseSchemaManager.createTableDefinition(
                'security_threats',
                `(
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    threat_type TEXT NOT NULL,
                    threat_level TEXT NOT NULL,
                    source_ip TEXT,
                    target_resource TEXT,
                    detection_method TEXT NOT NULL,
                    threat_description TEXT NOT NULL,
                    evidence TEXT,
                    status TEXT DEFAULT 'active',
                    resolution TEXT,
                    resolved_by TEXT,
                    resolved_at TEXT,
                    created_at TEXT NOT NULL,
                    INDEX(shop_id, threat_level),
                    INDEX(threat_type, status),
                    INDEX(source_ip, created_at)
                )`,
                '威胁检测记录表'
            ),
            
            // 加密密钥管理表
            DatabaseSchemaManager.createTableDefinition(
                'security_encryption_keys',
                `(
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    key_type TEXT NOT NULL,
                    key_purpose TEXT NOT NULL,
                    encrypted_key TEXT NOT NULL,
                    key_version INTEGER DEFAULT 1,
                    is_active INTEGER DEFAULT 1,
                    expires_at TEXT,
                    created_at TEXT NOT NULL,
                    INDEX(shop_id, key_type, is_active)
                )`,
                '加密密钥管理表'
            ),
            
            // 安全策略配置表
            DatabaseSchemaManager.createTableDefinition(
                'security_policies',
                `(
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    policy_name TEXT NOT NULL,
                    policy_type TEXT NOT NULL,
                    policy_config TEXT NOT NULL,
                    is_active INTEGER DEFAULT 1,
                    priority INTEGER DEFAULT 0,
                    created_by TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    INDEX(shop_id, policy_type),
                    INDEX(is_active, priority)
                )`,
                '安全策略配置表'
            )
        ];
    }

    /**
     * 获取安全相关的所有索引定义
     */
    static getIndexDefinitions() {
        return [
            // 安全审计日志索引
            DatabaseSchemaManager.createIndexDefinition('idx_audit_shop_event', 'security_audit_logs', 'shop_id, event_type', '审计日志店铺事件索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_audit_user_time', 'security_audit_logs', 'user_id, created_at', '审计日志用户时间索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_audit_risk_time', 'security_audit_logs', 'risk_level, created_at', '审计日志风险时间索引'),
            
            // 安全会话索引
            DatabaseSchemaManager.createIndexDefinition('idx_sessions_user_active', 'security_sessions', 'user_id, is_active', '会话用户状态索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_sessions_token', 'security_sessions', 'session_token', '会话令牌索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_sessions_expires', 'security_sessions', 'expires_at', '会话过期索引'),
            
            // 访问控制规则索引
            DatabaseSchemaManager.createIndexDefinition('idx_access_shop_resource', 'security_access_rules', 'shop_id, resource_type', '访问控制店铺资源索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_access_priority_active', 'security_access_rules', 'priority, is_active', '访问控制优先级状态索引'),
            
            // 威胁检测索引
            DatabaseSchemaManager.createIndexDefinition('idx_threats_shop_level', 'security_threats', 'shop_id, threat_level', '威胁检测店铺级别索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_threats_type_status', 'security_threats', 'threat_type, status', '威胁检测类型状态索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_threats_ip_time', 'security_threats', 'source_ip, created_at', '威胁检测IP时间索引'),
            
            // 加密密钥索引
            DatabaseSchemaManager.createIndexDefinition('idx_keys_shop_type', 'security_encryption_keys', 'shop_id, key_type, is_active', '加密密钥店铺类型索引'),
            
            // 安全策略索引
            DatabaseSchemaManager.createIndexDefinition('idx_policies_shop_type', 'security_policies', 'shop_id, policy_type', '安全策略店铺类型索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_policies_active_priority', 'security_policies', 'is_active, priority', '安全策略状态优先级索引')
        ];
    }

    /**
     * 获取内存数据库初始化语句（用于memory模式）
     */
    static getMemoryInitStatements() {
        return [
            {
                sql: "// 初始化内存Map结构",
                description: "创建安全相关内存表"
            }
        ];
    }
}

module.exports = SecurityModuleSchemaConfig;