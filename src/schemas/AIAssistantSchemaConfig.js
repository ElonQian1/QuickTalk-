/**
 * AI助手管理器的数据库模式定义
 * 将原本分散在各个createXXXTable方法中的表定义集中管理
 */
const DatabaseSchemaManager = require('../utils/DatabaseSchemaManager');

class AIAssistantSchemaConfig {
    /**
     * 获取AI助手相关的所有表定义
     * @returns {Array} 表定义数组
     */
    static getTableDefinitions() {
        return [
            // 知识库表
            DatabaseSchemaManager.createTableDefinition(
                'knowledge_base',
                `(
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    category TEXT NOT NULL CHECK(category IN ('faq', 'product', 'service', 'policy', 'technical', 'other')),
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    keywords TEXT, -- JSON格式存储关键词
                    confidence_score REAL DEFAULT 0.8,
                    usage_count INTEGER DEFAULT 0,
                    effectiveness_score REAL DEFAULT 0.0,
                    source_type TEXT CHECK(source_type IN ('manual', 'auto_generated', 'learned', 'imported')),
                    tags TEXT, -- JSON格式存储标签
                    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'pending_review')),
                    created_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
                )`,
                '知识库表'
            ),
            
            // 意图识别表
            DatabaseSchemaManager.createTableDefinition(
                'intent_classification',
                `(
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    intent_name TEXT NOT NULL,
                    intent_description TEXT,
                    training_phrases TEXT NOT NULL, -- JSON格式存储训练短语
                    response_templates TEXT, -- JSON格式存储响应模板
                    confidence_threshold REAL DEFAULT 0.7,
                    is_active BOOLEAN DEFAULT TRUE,
                    priority_level INTEGER DEFAULT 1,
                    fallback_response TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
                )`,
                '意图识别表'
            ),
            
            // 对话上下文表
            DatabaseSchemaManager.createTableDefinition(
                'conversation_context',
                `(
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    shop_id TEXT NOT NULL,
                    context_data TEXT NOT NULL, -- JSON格式存储上下文信息
                    last_intent TEXT,
                    session_variables TEXT, -- JSON格式存储会话变量
                    conversation_stage TEXT DEFAULT 'initial',
                    context_expires_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
                )`,
                '对话上下文表'
            ),
            
            // 自动回复模板表
            DatabaseSchemaManager.createTableDefinition(
                'auto_reply_templates',
                `(
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    template_name TEXT NOT NULL,
                    template_type TEXT NOT NULL CHECK(template_type IN ('greeting', 'fallback', 'escalation', 'closing', 'faq', 'custom')),
                    template_content TEXT NOT NULL,
                    trigger_conditions TEXT, -- JSON格式存储触发条件
                    variables TEXT, -- JSON格式存储模板变量
                    is_active BOOLEAN DEFAULT TRUE,
                    priority INTEGER DEFAULT 0,
                    usage_count INTEGER DEFAULT 0,
                    effectiveness_score REAL DEFAULT 0.0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
                )`,
                '自动回复模板表'
            ),
            
            // 学习数据表
            DatabaseSchemaManager.createTableDefinition(
                'learning_data',
                `(
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    data_type TEXT NOT NULL CHECK(data_type IN ('conversation', 'feedback', 'correction', 'pattern', 'outcome')),
                    input_text TEXT NOT NULL,
                    expected_output TEXT,
                    actual_output TEXT,
                    feedback_score REAL, -- 反馈评分 -1到1
                    learning_context TEXT, -- JSON格式存储学习上下文
                    improvement_suggestions TEXT,
                    pattern_category TEXT,
                    confidence_level REAL DEFAULT 0.5,
                    is_validated BOOLEAN DEFAULT FALSE,
                    training_status TEXT DEFAULT 'pending' CHECK(training_status IN ('pending', 'training', 'completed', 'failed')),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    processed_at DATETIME,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
                )`,
                '学习数据表'
            ),
            
            // 情感分析表
            DatabaseSchemaManager.createTableDefinition(
                'sentiment_analysis',
                `(
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    shop_id TEXT NOT NULL,
                    message_content TEXT NOT NULL,
                    sentiment_score REAL NOT NULL, -- -1(负面) 到 1(正面)
                    sentiment_label TEXT NOT NULL CHECK(sentiment_label IN ('positive', 'negative', 'neutral')),
                    confidence_score REAL NOT NULL,
                    emotions TEXT, -- JSON格式存储检测到的情感
                    urgency_level TEXT DEFAULT 'normal' CHECK(urgency_level IN ('low', 'normal', 'high', 'urgent')),
                    requires_human_intervention BOOLEAN DEFAULT FALSE,
                    analysis_model TEXT DEFAULT 'default',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
                )`,
                '情感分析表'
            ),
            
            // 智能推荐表
            DatabaseSchemaManager.createTableDefinition(
                'intelligent_recommendations',
                `(
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    shop_id TEXT NOT NULL,
                    recommendation_type TEXT NOT NULL CHECK(recommendation_type IN ('response', 'product', 'action', 'escalation', 'template')),
                    recommendation_content TEXT NOT NULL,
                    recommendation_data TEXT, -- JSON格式存储推荐数据
                    relevance_score REAL NOT NULL,
                    confidence_score REAL NOT NULL,
                    reasoning TEXT,
                    is_accepted BOOLEAN,
                    feedback_score REAL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    accepted_at DATETIME,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
                )`,
                '智能推荐表'
            ),
            
            // AI配置表
            DatabaseSchemaManager.createTableDefinition(
                'ai_config',
                `(
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    config_type TEXT NOT NULL CHECK(config_type IN ('general', 'intent', 'sentiment', 'learning', 'template')),
                    config_name TEXT NOT NULL,
                    config_value TEXT NOT NULL, -- JSON格式存储配置值
                    config_description TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
                    UNIQUE(shop_id, config_type, config_name)
                )`,
                'AI配置表'
            )
        ];
    }

    /**
     * 获取AI助手相关的所有索引定义
     * @returns {Array} 索引定义数组
     */
    static getIndexDefinitions() {
        return [
            // 知识库索引
            DatabaseSchemaManager.createIndexDefinition('idx_knowledge_shop_category', 'knowledge_base', 'shop_id, category', '知识库店铺分类索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_knowledge_status', 'knowledge_base', 'status, is_active', '知识库状态索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_knowledge_usage', 'knowledge_base', 'usage_count, effectiveness_score', '知识库使用效果索引'),
            
            // 意图识别索引
            DatabaseSchemaManager.createIndexDefinition('idx_intent_shop_active', 'intent_classification', 'shop_id, is_active', '意图识别店铺状态索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_intent_priority', 'intent_classification', 'priority_level, confidence_threshold', '意图识别优先级索引'),
            
            // 对话上下文索引
            DatabaseSchemaManager.createIndexDefinition('idx_context_conversation', 'conversation_context', 'conversation_id', '对话上下文会话索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_context_shop_stage', 'conversation_context', 'shop_id, conversation_stage', '对话上下文阶段索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_context_expires', 'conversation_context', 'context_expires_at', '对话上下文过期索引'),
            
            // 自动回复模板索引
            DatabaseSchemaManager.createIndexDefinition('idx_template_shop_type', 'auto_reply_templates', 'shop_id, template_type', '自动回复模板类型索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_template_active', 'auto_reply_templates', 'is_active', '自动回复模板状态索引'),
            
            // 学习数据索引
            DatabaseSchemaManager.createIndexDefinition('idx_learning_shop_type', 'learning_data', 'shop_id, data_type', '学习数据类型索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_learning_status', 'learning_data', 'training_status, created_at', '学习数据状态索引'),
            
            // 情感分析索引
            DatabaseSchemaManager.createIndexDefinition('idx_sentiment_conversation', 'sentiment_analysis', 'conversation_id', '情感分析会话索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_sentiment_shop_score', 'sentiment_analysis', 'shop_id, sentiment_score', '情感分析评分索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_sentiment_urgency', 'sentiment_analysis', 'urgency_level, created_at', '情感分析紧急度索引'),
            
            // 智能推荐索引
            DatabaseSchemaManager.createIndexDefinition('idx_recommendation_conversation', 'intelligent_recommendations', 'conversation_id', '智能推荐会话索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_recommendation_shop_type', 'intelligent_recommendations', 'shop_id, recommendation_type', '智能推荐类型索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_recommendation_score', 'intelligent_recommendations', 'relevance_score, confidence_score', '智能推荐评分索引'),
            
            // AI配置索引
            DatabaseSchemaManager.createIndexDefinition('idx_ai_config_shop_type', 'ai_config', 'shop_id, config_type', 'AI配置类型索引'),
            DatabaseSchemaManager.createIndexDefinition('idx_ai_config_active', 'ai_config', 'is_active', 'AI配置状态索引')
        ];
    }
}

module.exports = AIAssistantSchemaConfig;