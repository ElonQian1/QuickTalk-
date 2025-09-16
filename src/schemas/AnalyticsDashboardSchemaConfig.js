/**
 * 分析仪表板管理器的数据库模式定义
 */
const DatabaseSchemaManager = require('../utils/DatabaseSchemaManager');

class AnalyticsDashboardSchemaConfig {
    /**
     * 获取分析仪表板相关的所有表定义
     */
    static getTableDefinitions() {
        return [
            // KPI指标表
            DatabaseSchemaManager.createTableDefinition(
                'kpi_metrics',
                `(
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    metric_name TEXT NOT NULL,
                    metric_value REAL NOT NULL,
                    metric_unit TEXT,
                    time_period TEXT NOT NULL, -- 'hourly', 'daily', 'weekly', 'monthly'
                    category TEXT DEFAULT 'general',
                    target_value REAL,
                    status TEXT DEFAULT 'normal' CHECK(status IN ('normal', 'warning', 'critical')),
                    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
                )`,
                'KPI指标表'
            ),
            
            // 用户活动日志表
            DatabaseSchemaManager.createTableDefinition(
                'user_activity_logs',
                `(
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    shop_id TEXT NOT NULL,
                    activity_type TEXT NOT NULL,
                    activity_description TEXT,
                    activity_data TEXT, -- JSON格式存储活动数据
                    ip_address TEXT,
                    user_agent TEXT,
                    duration INTEGER, -- 活动持续时间（秒）
                    result_status TEXT DEFAULT 'success',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
                )`,
                '用户活动日志表'
            ),
            
            // 性能监控表
            DatabaseSchemaManager.createTableDefinition(
                'performance_metrics',
                `(
                    id TEXT PRIMARY KEY,
                    metric_name TEXT NOT NULL,
                    metric_value REAL NOT NULL,
                    metric_type TEXT DEFAULT 'response_time',
                    endpoint TEXT,
                    method TEXT,
                    status_code INTEGER,
                    execution_time REAL,
                    memory_usage REAL,
                    cpu_usage REAL,
                    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    INDEX(metric_name, recorded_at)
                )`,
                '性能监控表'
            ),
            
            // 客户满意度表
            DatabaseSchemaManager.createTableDefinition(
                'customer_satisfaction',
                `(
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    conversation_id TEXT,
                    customer_id TEXT,
                    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
                    feedback_text TEXT,
                    feedback_category TEXT,
                    service_aspect TEXT, -- 服务方面：'response_time', 'helpfulness', 'resolution', 'overall'
                    staff_id TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
                )`,
                '客户满意度表'
            ),
            
            // 报告配置表
            DatabaseSchemaManager.createTableDefinition(
                'report_configs',
                `(
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    report_name TEXT NOT NULL,
                    report_type TEXT NOT NULL,
                    report_config TEXT NOT NULL, -- JSON格式存储报告配置
                    schedule_type TEXT DEFAULT 'manual', -- 'manual', 'daily', 'weekly', 'monthly'
                    is_active BOOLEAN DEFAULT TRUE,
                    last_generated_at DATETIME,
                    next_generation_at DATETIME,
                    created_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
                )`,
                '报告配置表'
            )
        ];
    }

    /**
     * 获取分析仪表板相关的所有索引定义
     */
    static getIndexDefinitions() {
        return [
            // KPI指标索引
            DatabaseSchemaManager.createIndexDefinition('idx_kpi_shop_metric', 'kpi_metrics', 'shop_id, metric_name', 'KPI店铺指标索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_kpi_time_period', 'kpi_metrics', 'time_period, recorded_at', 'KPI时间周期索引'),
            
            // 用户活动索引
            DatabaseSchemaManager.createIndexDefinition('idx_activity_user_shop', 'user_activity_logs', 'user_id, shop_id', '用户活动店铺索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_activity_type_time', 'user_activity_logs', 'activity_type, created_at', '用户活动类型时间索引'),
            
            // 性能监控索引
            DatabaseSchemaManager.createIndexDefinition('idx_performance_name_time', 'performance_metrics', 'metric_name, recorded_at', '性能监控指标时间索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_performance_endpoint', 'performance_metrics', 'endpoint', '性能监控端点索引'),
            
            // 客户满意度索引
            DatabaseSchemaManager.createIndexDefinition('idx_satisfaction_shop_time', 'customer_satisfaction', 'shop_id, created_at', '客户满意度店铺时间索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_satisfaction_rating', 'customer_satisfaction', 'rating', '客户满意度评分索引'),
            
            // 报告配置索引
            DatabaseSchemaManager.createIndexDefinition('idx_report_shop_active', 'report_configs', 'shop_id, is_active', '报告配置店铺状态索引')
        ];
    }
}

module.exports = AnalyticsDashboardSchemaConfig;