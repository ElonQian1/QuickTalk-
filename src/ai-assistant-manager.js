/**
 * AI智能客服管理器
 * 
 * 功能包括：
 * - 智能问答机器人
 * - 自然语言处理
 * - 情感分析
 * - 意图识别
 * - 智能推荐
 * - 自动回复
 * - 学习优化
 * 
 * @author QuickTalk Team
 * @version 4.0.0
 */

class AIAssistantManager {
    constructor(db) {
        this.db = db;
        this.knowledgeBase = new Map(); // 知识库缓存
        this.intentClassifier = new Map(); // 意图分类器
        this.conversationContext = new Map(); // 对话上下文
        this.learningData = new Map(); // 学习数据
        
        console.log('🤖 AI智能客服管理器初始化');
        this.initializeAI();
    }

    /**
     * 初始化AI相关表结构 - 重构后使用统一的数据库模式管理器
     */
    async initializeTables() {
        try {
            console.log('🚀 开始初始化AI智能客服表...');
            
            // 使用统一的数据库模式管理器
            const DatabaseSchemaManager = require('./utils/DatabaseSchemaManager');
            const AIAssistantSchemaConfig = require('./schemas/AIAssistantSchemaConfig');
            
            const schemaManager = new DatabaseSchemaManager(this.db);
            
            // 批量创建表
            const tableDefinitions = AIAssistantSchemaConfig.getTableDefinitions();
            await schemaManager.createTables(tableDefinitions);
            
            // 批量创建索引
            const indexDefinitions = AIAssistantSchemaConfig.getIndexDefinitions();
            await schemaManager.createIndexes(indexDefinitions);
            
            console.log('✅ AI智能客服表初始化完成');
            
        } catch (error) {
            console.error('❌ AI智能客服模块初始化失败:', error);
            throw error;
        }
    }

    /**
     * 创建知识库表
     */
    async createKnowledgeBaseTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS knowledge_base (
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
            )
        `;

        await this.db.run(sql);
        console.log('📚 知识库表创建完成');
    }

    /**
     * 创建意图识别表
     */
    async createIntentClassificationTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS intent_classification (
                id TEXT PRIMARY KEY,
                shop_id TEXT NOT NULL,
                intent_name TEXT NOT NULL,
                intent_description TEXT,
                training_phrases TEXT NOT NULL, -- JSON格式存储训练短语
                response_templates TEXT, -- JSON格式存储回复模板
                confidence_threshold REAL DEFAULT 0.7,
                priority_level INTEGER DEFAULT 1,
                is_active BOOLEAN DEFAULT TRUE,
                success_rate REAL DEFAULT 0.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
            )
        `;

        await this.db.run(sql);
        console.log('🎯 意图识别表创建完成');
    }

    /**
     * 创建对话上下文表
     */
    async createConversationContextTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS conversation_context (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                shop_id TEXT NOT NULL,
                customer_id TEXT,
                context_data TEXT NOT NULL, -- JSON格式存储上下文信息
                intent_history TEXT, -- JSON格式存储意图历史
                emotion_state TEXT, -- 当前情绪状态
                satisfaction_prediction REAL, -- 满意度预测
                next_best_action TEXT, -- 建议的下一步行动
                session_duration INTEGER, -- 会话持续时间(秒)
                message_count INTEGER DEFAULT 0,
                last_ai_response TEXT,
                context_expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
            )
        `;

        await this.db.run(sql);
        console.log('💭 对话上下文表创建完成');
    }

    /**
     * 创建自动回复模板表
     */
    async createAutoReplyTemplateTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS auto_reply_templates (
                id TEXT PRIMARY KEY,
                shop_id TEXT NOT NULL,
                template_name TEXT NOT NULL,
                template_type TEXT NOT NULL CHECK(template_type IN ('greeting', 'closing', 'faq_answer', 'escalation', 'fallback', 'confirmation')),
                trigger_conditions TEXT, -- JSON格式存储触发条件
                response_content TEXT NOT NULL,
                variables TEXT, -- JSON格式存储可替换变量
                personalization_level TEXT DEFAULT 'basic' CHECK(personalization_level IN ('basic', 'advanced', 'dynamic')),
                usage_frequency INTEGER DEFAULT 0,
                effectiveness_rating REAL DEFAULT 0.0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
            )
        `;

        await this.db.run(sql);
        console.log('💬 自动回复模板表创建完成');
    }

    /**
     * 创建学习数据表
     */
    async createLearningDataTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS learning_data (
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
            )
        `;

        await this.db.run(sql);
        console.log('🧠 学习数据表创建完成');
    }

    /**
     * 创建情感分析表
     */
    async createSentimentAnalysisTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS sentiment_analysis (
                id TEXT PRIMARY KEY,
                message_id TEXT NOT NULL,
                conversation_id TEXT NOT NULL,
                shop_id TEXT NOT NULL,
                message_content TEXT NOT NULL,
                sentiment_score REAL NOT NULL, -- -1到1，负值表示负面情绪
                sentiment_label TEXT NOT NULL CHECK(sentiment_label IN ('very_negative', 'negative', 'neutral', 'positive', 'very_positive')),
                emotion_categories TEXT, -- JSON格式存储情绪类别(愤怒、喜悦、悲伤等)
                urgency_level INTEGER DEFAULT 1 CHECK(urgency_level >= 1 AND urgency_level <= 5),
                keywords_detected TEXT, -- JSON格式存储检测到的关键词
                confidence_score REAL DEFAULT 0.0,
                recommended_action TEXT,
                human_verification BOOLEAN DEFAULT FALSE,
                analysis_model_version TEXT DEFAULT 'v1.0',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
            )
        `;

        await this.db.run(sql);
        console.log('😊 情感分析表创建完成');
    }

    /**
     * 创建智能推荐表
     */
    async createIntelligentRecommendationTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS intelligent_recommendations (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                shop_id TEXT NOT NULL,
                recommendation_type TEXT NOT NULL CHECK(recommendation_type IN ('product', 'service', 'action', 'response', 'escalation', 'resource')),
                recommendation_content TEXT NOT NULL,
                recommendation_data TEXT, -- JSON格式存储推荐详细数据
                relevance_score REAL DEFAULT 0.0,
                confidence_score REAL DEFAULT 0.0,
                priority_level INTEGER DEFAULT 1,
                reasoning TEXT, -- 推荐理由
                context_factors TEXT, -- JSON格式存储影响因素
                user_interaction TEXT, -- 用户对推荐的交互结果
                acceptance_rate REAL DEFAULT 0.0,
                effectiveness_score REAL DEFAULT 0.0,
                is_active BOOLEAN DEFAULT TRUE,
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
            )
        `;

        await this.db.run(sql);
        console.log('💡 智能推荐表创建完成');
    }

    /**
     * 创建AI配置表
     */
    async createAIConfigTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS ai_config (
                id TEXT PRIMARY KEY,
                shop_id TEXT NOT NULL,
                config_type TEXT NOT NULL CHECK(config_type IN ('general', 'nlp', 'sentiment', 'recommendation', 'learning', 'integration')),
                config_name TEXT NOT NULL,
                config_value TEXT NOT NULL, -- JSON格式存储配置值
                config_description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                validation_rules TEXT, -- JSON格式存储验证规则
                default_value TEXT,
                last_updated_by TEXT,
                version TEXT DEFAULT '1.0',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
                UNIQUE(shop_id, config_type, config_name)
            )
        `;

        await this.db.run(sql);
        console.log('⚙️ AI配置表创建完成');
    }

    /**
     * 创建AI索引
     */
    async createAIIndexes() {
        const indexes = [
            // 知识库索引
            'CREATE INDEX IF NOT EXISTS idx_knowledge_shop_category ON knowledge_base(shop_id, category)',
            'CREATE INDEX IF NOT EXISTS idx_knowledge_keywords ON knowledge_base(keywords)',
            'CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_base(status, confidence_score)',
            
            // 意图识别索引
            'CREATE INDEX IF NOT EXISTS idx_intent_shop_active ON intent_classification(shop_id, is_active)',
            'CREATE INDEX IF NOT EXISTS idx_intent_confidence ON intent_classification(confidence_threshold)',
            
            // 对话上下文索引
            'CREATE INDEX IF NOT EXISTS idx_context_conversation ON conversation_context(conversation_id)',
            'CREATE INDEX IF NOT EXISTS idx_context_shop_customer ON conversation_context(shop_id, customer_id)',
            'CREATE INDEX IF NOT EXISTS idx_context_expires ON conversation_context(context_expires_at)',
            
            // 自动回复模板索引
            'CREATE INDEX IF NOT EXISTS idx_template_shop_type ON auto_reply_templates(shop_id, template_type)',
            'CREATE INDEX IF NOT EXISTS idx_template_active ON auto_reply_templates(is_active)',
            
            // 学习数据索引
            'CREATE INDEX IF NOT EXISTS idx_learning_shop_type ON learning_data(shop_id, data_type)',
            'CREATE INDEX IF NOT EXISTS idx_learning_status ON learning_data(training_status, created_at)',
            
            // 情感分析索引
            'CREATE INDEX IF NOT EXISTS idx_sentiment_conversation ON sentiment_analysis(conversation_id)',
            'CREATE INDEX IF NOT EXISTS idx_sentiment_shop_score ON sentiment_analysis(shop_id, sentiment_score)',
            'CREATE INDEX IF NOT EXISTS idx_sentiment_urgency ON sentiment_analysis(urgency_level, created_at)',
            
            // 智能推荐索引
            'CREATE INDEX IF NOT EXISTS idx_recommendation_conversation ON intelligent_recommendations(conversation_id)',
            'CREATE INDEX IF NOT EXISTS idx_recommendation_shop_type ON intelligent_recommendations(shop_id, recommendation_type)',
            'CREATE INDEX IF NOT EXISTS idx_recommendation_score ON intelligent_recommendations(relevance_score, confidence_score)',
            
            // AI配置索引
            'CREATE INDEX IF NOT EXISTS idx_ai_config_shop_type ON ai_config(shop_id, config_type)',
            'CREATE INDEX IF NOT EXISTS idx_ai_config_active ON ai_config(is_active)'
        ];

        for (const indexSql of indexes) {
            await this.db.run(indexSql);
        }
        
        console.log('📇 AI智能客服索引创建完成');
    }

    /**
     * 初始化AI核心功能
     */
    async initializeAI() {
        try {
            // 加载默认知识库
            await this.loadDefaultKnowledgeBase();
            
            // 初始化意图分类器
            await this.initializeIntentClassifier();
            
            // 加载自动回复模板
            await this.loadAutoReplyTemplates();
            
            // 初始化情感分析引擎
            this.initializeSentimentAnalysis();
            
            console.log('🤖 AI核心功能初始化完成');
            
        } catch (error) {
            console.error('❌ AI核心功能初始化失败:', error);
        }
    }

    /**
     * 加载默认知识库
     */
    async loadDefaultKnowledgeBase() {
        const defaultKnowledge = [
            {
                category: 'faq',
                question: '营业时间',
                answer: '我们的营业时间是周一至周日 9:00-21:00，节假日正常营业。',
                keywords: ['营业时间', '工作时间', '上班时间', '几点开门', '几点关门']
            },
            {
                category: 'faq',
                question: '联系方式',
                answer: '您可以通过以下方式联系我们：在线客服、电话400-123-4567、邮箱service@example.com',
                keywords: ['联系方式', '客服电话', '邮箱', '如何联系']
            },
            {
                category: 'service',
                question: '退换货政策',
                answer: '我们支持7天无理由退换货，商品需保持原包装完好。具体流程请联系客服办理。',
                keywords: ['退货', '换货', '退换货', '退款', '不满意']
            },
            {
                category: 'technical',
                question: '支付方式',
                answer: '我们支持支付宝、微信支付、银行卡支付等多种支付方式，支付安全有保障。',
                keywords: ['支付方式', '付款', '支付宝', '微信支付', '银行卡']
            },
            {
                category: 'service',
                question: '物流配送',
                answer: '我们与多家知名快递公司合作，一般1-3个工作日发货，支持全国配送。',
                keywords: ['物流', '配送', '快递', '发货', '多久到货']
            }
        ];

        this.knowledgeBase.clear();
        defaultKnowledge.forEach((item, index) => {
            this.knowledgeBase.set(`kb_${index}`, {
                ...item,
                confidence: 0.9,
                usage: 0
            });
        });

        console.log('📚 默认知识库加载完成');
    }

    /**
     * 初始化意图分类器
     */
    async initializeIntentClassifier() {
        const defaultIntents = [
            {
                name: 'greeting',
                description: '问候语',
                patterns: ['你好', '您好', 'hello', 'hi', '早上好', '下午好', '晚上好'],
                responses: ['您好！很高兴为您服务！', '您好！有什么可以帮助您的吗？', '您好！请问有什么需要咨询的吗？']
            },
            {
                name: 'inquiry',
                description: '咨询问题',
                patterns: ['咨询', '询问', '请问', '想了解', '能告诉我'],
                responses: ['好的，请您详细说明您想咨询的问题。', '我很乐意为您解答，请问具体是什么问题呢？']
            },
            {
                name: 'complaint',
                description: '投诉问题',
                patterns: ['投诉', '不满意', '有问题', '质量差', '服务不好'],
                responses: ['非常抱歉给您带来不好的体验，我会认真处理您的投诉。', '我深表歉意，请详细告诉我遇到的问题，我会尽快为您解决。']
            },
            {
                name: 'praise',
                description: '表扬赞美',
                patterns: ['很好', '满意', '不错', '赞', '棒', '谢谢'],
                responses: ['非常感谢您的认可！', '谢谢您的好评，我们会继续努力！', '很高兴您满意我们的服务！']
            },
            {
                name: 'goodbye',
                description: '告别语',
                patterns: ['再见', '拜拜', 'bye', '88', '走了'],
                responses: ['再见！祝您生活愉快！', '感谢您的咨询，再见！', '再见！有问题随时联系我们！']
            }
        ];

        this.intentClassifier.clear();
        defaultIntents.forEach(intent => {
            this.intentClassifier.set(intent.name, {
                ...intent,
                confidence: 0.8,
                usage: 0
            });
        });

        console.log('🎯 意图分类器初始化完成');
    }

    /**
     * 加载自动回复模板
     */
    async loadAutoReplyTemplates() {
        const templates = [
            {
                type: 'greeting',
                name: '欢迎问候',
                content: '您好！欢迎来到{shop_name}，我是AI客服助手，很高兴为您服务！请问有什么可以帮助您的吗？',
                variables: ['shop_name']
            },
            {
                type: 'fallback',
                name: '无法理解',
                content: '抱歉，我暂时无法理解您的问题。您可以换个说法，或者我为您转接人工客服。',
                variables: []
            },
            {
                type: 'escalation',
                name: '转接人工',
                content: '好的，我正在为您转接人工客服，请稍等片刻...',
                variables: []
            },
            {
                type: 'confirmation',
                name: '确认回复',
                content: '我的回答是否解决了您的问题？如果还有其他疑问，请随时告诉我。',
                variables: []
            }
        ];

        console.log('💬 自动回复模板加载完成');
    }

    /**
     * 初始化情感分析引擎
     */
    initializeSentimentAnalysis() {
        // 情感词典
        this.sentimentWords = {
            positive: ['好', '棒', '满意', '喜欢', '赞', '不错', '优秀', '完美', '感谢'],
            negative: ['差', '烂', '不满意', '讨厌', '垃圾', '问题', '投诉', '退货', '愤怒'],
            neutral: ['一般', '还行', '普通', '正常', '可以']
        };

        // 情绪强度词
        this.intensityWords = {
            high: ['非常', '特别', '超级', '极其', '十分'],
            medium: ['比较', '还是', '挺'],
            low: ['有点', '稍微', '略']
        };

        console.log('😊 情感分析引擎初始化完成');
    }

    /**
     * 处理AI自动回复
     * @param {string} message - 用户消息
     * @param {string} conversationId - 对话ID
     * @param {string} shopId - 店铺ID
     * @returns {Object} AI回复结果
     */
    async processAIResponse(message, conversationId, shopId) {
        try {
            console.log('🤖 AI处理消息:', message);

            // 1. 意图识别
            const intent = await this.recognizeIntent(message);
            console.log('🎯 识别意图:', intent);

            // 2. 情感分析
            const sentiment = await this.analyzeSentiment(message, conversationId, shopId);
            console.log('😊 情感分析:', sentiment);

            // 3. 知识库匹配
            const knowledgeMatch = await this.matchKnowledge(message, shopId);
            console.log('📚 知识库匹配:', knowledgeMatch);

            // 4. 生成回复
            const response = await this.generateResponse({
                message,
                intent,
                sentiment,
                knowledgeMatch,
                conversationId,
                shopId
            });

            // 5. 更新对话上下文
            await this.updateConversationContext(conversationId, {
                intent,
                sentiment,
                lastMessage: message,
                lastResponse: response.content
            });

            // 6. 记录学习数据
            await this.recordLearningData(message, response, shopId);

            return {
                success: true,
                response: response,
                intent: intent,
                sentiment: sentiment,
                confidence: response.confidence,
                shouldEscalate: sentiment.urgency_level >= 4 || sentiment.sentiment_score < -0.7
            };

        } catch (error) {
            console.error('❌ AI回复处理失败:', error);
            return {
                success: false,
                response: {
                    content: '抱歉，我遇到了一些技术问题。请稍后再试，或者联系人工客服。',
                    type: 'fallback',
                    confidence: 0.1
                },
                error: error.message
            };
        }
    }

    /**
     * 意图识别
     * @param {string} message - 用户消息
     * @returns {Object} 识别的意图
     */
    async recognizeIntent(message) {
        try {
            const messageText = message.toLowerCase();
            let bestMatch = null;
            let maxScore = 0;

            // 遍历意图分类器
            for (const [intentName, intentData] of this.intentClassifier) {
                let score = 0;
                
                // 检查模式匹配
                for (const pattern of intentData.patterns) {
                    if (messageText.includes(pattern.toLowerCase())) {
                        score += 0.8;
                    }
                }

                // 模糊匹配
                for (const pattern of intentData.patterns) {
                    const similarity = this.calculateSimilarity(messageText, pattern.toLowerCase());
                    if (similarity > 0.6) {
                        score += similarity * 0.5;
                    }
                }

                if (score > maxScore && score > 0.3) {
                    maxScore = score;
                    bestMatch = {
                        name: intentName,
                        description: intentData.description,
                        confidence: Math.min(maxScore, 1.0),
                        patterns: intentData.patterns
                    };
                }
            }

            return bestMatch || {
                name: 'unknown',
                description: '未知意图',
                confidence: 0.1,
                patterns: []
            };

        } catch (error) {
            console.error('❌ 意图识别失败:', error);
            return { name: 'unknown', confidence: 0.0 };
        }
    }

    /**
     * 情感分析
     * @param {string} message - 用户消息
     * @param {string} conversationId - 对话ID
     * @param {string} shopId - 店铺ID
     * @returns {Object} 情感分析结果
     */
    async analyzeSentiment(message, conversationId, shopId) {
        try {
            const messageText = message.toLowerCase();
            let sentimentScore = 0;
            let emotions = [];
            let urgencyLevel = 1;

            // 情感词汇分析
            let positiveCount = 0;
            let negativeCount = 0;

            // 检测积极情感
            for (const word of this.sentimentWords.positive) {
                if (messageText.includes(word)) {
                    positiveCount++;
                    sentimentScore += 0.3;
                }
            }

            // 检测消极情感
            for (const word of this.sentimentWords.negative) {
                if (messageText.includes(word)) {
                    negativeCount++;
                    sentimentScore -= 0.4;
                    if (['投诉', '愤怒', '垃圾'].includes(word)) {
                        urgencyLevel = Math.max(urgencyLevel, 4);
                    }
                }
            }

            // 强度词调整
            let intensityMultiplier = 1.0;
            for (const word of this.intensityWords.high) {
                if (messageText.includes(word)) {
                    intensityMultiplier = 1.5;
                    break;
                }
            }

            sentimentScore *= intensityMultiplier;
            sentimentScore = Math.max(-1, Math.min(1, sentimentScore));

            // 确定情感标签
            let sentimentLabel;
            if (sentimentScore >= 0.6) sentimentLabel = 'very_positive';
            else if (sentimentScore >= 0.2) sentimentLabel = 'positive';
            else if (sentimentScore >= -0.2) sentimentLabel = 'neutral';
            else if (sentimentScore >= -0.6) sentimentLabel = 'negative';
            else sentimentLabel = 'very_negative';

            // 特殊情况检测
            if (messageText.includes('急') || messageText.includes('赶紧') || messageText.includes('马上')) {
                urgencyLevel = Math.max(urgencyLevel, 3);
            }

            const result = {
                sentiment_score: sentimentScore,
                sentiment_label: sentimentLabel,
                emotion_categories: emotions,
                urgency_level: urgencyLevel,
                confidence_score: Math.abs(sentimentScore),
                positive_words: positiveCount,
                negative_words: negativeCount
            };

            // 记录到数据库
            try {
                await this.recordSentimentAnalysis(message, conversationId, shopId, result);
            } catch (dbError) {
                console.error('❌ 情感分析记录失败:', dbError);
            }

            return result;

        } catch (error) {
            console.error('❌ 情感分析失败:', error);
            return {
                sentiment_score: 0,
                sentiment_label: 'neutral',
                urgency_level: 1,
                confidence_score: 0
            };
        }
    }

    /**
     * 知识库匹配
     * @param {string} message - 用户消息
     * @param {string} shopId - 店铺ID
     * @returns {Object} 匹配的知识
     */
    async matchKnowledge(message, shopId) {
        try {
            const messageText = message.toLowerCase();
            let bestMatch = null;
            let maxScore = 0;

            // 遍历知识库
            for (const [id, knowledge] of this.knowledgeBase) {
                let score = 0;

                // 问题匹配
                const questionSimilarity = this.calculateSimilarity(
                    messageText, 
                    knowledge.question.toLowerCase()
                );
                score += questionSimilarity * 0.6;

                // 关键词匹配
                if (knowledge.keywords) {
                    for (const keyword of knowledge.keywords) {
                        if (messageText.includes(keyword.toLowerCase())) {
                            score += 0.3;
                        }
                    }
                }

                if (score > maxScore && score > 0.4) {
                    maxScore = score;
                    bestMatch = {
                        id: id,
                        question: knowledge.question,
                        answer: knowledge.answer,
                        category: knowledge.category,
                        confidence: Math.min(maxScore, 1.0),
                        keywords: knowledge.keywords
                    };
                }
            }

            if (bestMatch) {
                // 更新使用次数
                this.knowledgeBase.get(bestMatch.id).usage++;
            }

            return bestMatch;

        } catch (error) {
            console.error('❌ 知识库匹配失败:', error);
            return null;
        }
    }

    /**
     * 生成回复
     * @param {Object} context - 上下文信息
     * @returns {Object} 生成的回复
     */
    async generateResponse(context) {
        try {
            const { message, intent, sentiment, knowledgeMatch, conversationId, shopId } = context;

            let responseContent = '';
            let responseType = 'ai_generated';
            let confidence = 0.5;

            // 1. 根据知识库匹配生成回复
            if (knowledgeMatch && knowledgeMatch.confidence > 0.6) {
                responseContent = knowledgeMatch.answer;
                responseType = 'knowledge_base';
                confidence = knowledgeMatch.confidence;
            }
            // 2. 根据意图生成回复
            else if (intent && intent.confidence > 0.5) {
                const intentData = this.intentClassifier.get(intent.name);
                if (intentData && intentData.responses.length > 0) {
                    const randomIndex = Math.floor(Math.random() * intentData.responses.length);
                    responseContent = intentData.responses[randomIndex];
                    responseType = 'intent_based';
                    confidence = intent.confidence;
                }
            }

            // 3. 情感调整回复
            if (sentiment.urgency_level >= 4 || sentiment.sentiment_score < -0.7) {
                responseContent = '我注意到您可能遇到了问题，我会尽力帮助您解决。' + responseContent;
                // 建议转人工
                if (sentiment.urgency_level >= 4) {
                    responseContent += '\n\n如果需要更详细的帮助，我可以为您转接人工客服。';
                }
            } else if (sentiment.sentiment_score > 0.5) {
                responseContent = '很高兴为您服务！' + responseContent;
            }

            // 4. 默认回复
            if (!responseContent) {
                responseContent = '感谢您的咨询！我正在努力理解您的问题。您可以提供更多详细信息，或者我为您转接人工客服？';
                responseType = 'fallback';
                confidence = 0.2;
            }

            // 5. 添加确认问题
            if (responseType === 'knowledge_base' && confidence > 0.8) {
                responseContent += '\n\n我的回答是否解决了您的问题？';
            }

            return {
                content: responseContent,
                type: responseType,
                confidence: confidence,
                intent: intent?.name,
                knowledge_used: knowledgeMatch?.id,
                sentiment_adjusted: sentiment.urgency_level > 2
            };

        } catch (error) {
            console.error('❌ 回复生成失败:', error);
            return {
                content: '抱歉，我遇到了一些问题。请稍后再试或联系人工客服。',
                type: 'error',
                confidence: 0.1
            };
        }
    }

    /**
     * 更新对话上下文
     * @param {string} conversationId - 对话ID
     * @param {Object} contextData - 上下文数据
     */
    async updateConversationContext(conversationId, contextData) {
        try {
            // 获取或创建上下文
            let context = this.conversationContext.get(conversationId);
            
            if (!context) {
                context = {
                    messages: [],
                    intents: [],
                    emotions: [],
                    sessionStart: new Date(),
                    messageCount: 0
                };
            }

            // 更新上下文
            context.messageCount++;
            context.lastUpdate = new Date();
            
            if (contextData.intent) {
                context.intents.push({
                    intent: contextData.intent.name,
                    confidence: contextData.intent.confidence,
                    timestamp: new Date()
                });
            }

            if (contextData.sentiment) {
                context.emotions.push({
                    sentiment: contextData.sentiment.sentiment_label,
                    score: contextData.sentiment.sentiment_score,
                    timestamp: new Date()
                });
            }

            // 保持最近10条消息
            context.messages.push({
                message: contextData.lastMessage,
                response: contextData.lastResponse,
                timestamp: new Date()
            });

            if (context.messages.length > 10) {
                context.messages = context.messages.slice(-10);
            }

            // 保存到内存
            this.conversationContext.set(conversationId, context);

            // TODO: 保存到数据库
            console.log('💭 对话上下文已更新');

        } catch (error) {
            console.error('❌ 更新对话上下文失败:', error);
        }
    }

    /**
     * 记录学习数据
     * @param {string} input - 输入消息
     * @param {Object} response - AI回复
     * @param {string} shopId - 店铺ID
     */
    async recordLearningData(input, response, shopId) {
        try {
            const learningRecord = {
                input_text: input,
                actual_output: response.content,
                confidence_level: response.confidence,
                response_type: response.type,
                intent_detected: response.intent,
                knowledge_used: response.knowledge_used,
                timestamp: new Date()
            };

            // 保存到学习数据集合
            const recordId = `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.learningData.set(recordId, learningRecord);

            console.log('🧠 学习数据已记录');

        } catch (error) {
            console.error('❌ 记录学习数据失败:', error);
        }
    }

    /**
     * 记录情感分析结果
     */
    async recordSentimentAnalysis(message, conversationId, shopId, sentiment) {
        try {
            // 检查表是否存在
            const tableExists = await this.db.get(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='sentiment_analysis'
            `);
            
            if (!tableExists) {
                console.log('⚠️ 情感分析表不存在，跳过记录');
                return;
            }

            const id = 'sentiment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            await this.db.run(`
                INSERT INTO sentiment_analysis (
                    id, message_id, conversation_id, shop_id, message_content,
                    sentiment_score, sentiment_label, urgency_level,
                    confidence_score, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                id,
                'msg_' + Date.now(),
                conversationId,
                shopId,
                message,
                sentiment.sentiment_score,
                sentiment.sentiment_label,
                sentiment.urgency_level,
                sentiment.confidence_score
            ]);

        } catch (error) {
            console.error('❌ 情感分析记录失败:', error);
        }
    }

    /**
     * 计算文本相似度
     * @param {string} text1 - 文本1
     * @param {string} text2 - 文本2
     * @returns {number} 相似度分数
     */
    calculateSimilarity(text1, text2) {
        try {
            // 简单的词汇重叠相似度算法
            const words1 = text1.split(/\s+/);
            const words2 = text2.split(/\s+/);
            
            const set1 = new Set(words1);
            const set2 = new Set(words2);
            
            const intersection = new Set([...set1].filter(x => set2.has(x)));
            const union = new Set([...set1, ...set2]);
            
            return intersection.size / union.size;

        } catch (error) {
            console.error('❌ 相似度计算失败:', error);
            return 0;
        }
    }

    /**
     * 获取AI统计信息
     * @param {string} shopId - 店铺ID
     * @returns {Object} 统计信息
     */
    async getAIStatistics(shopId) {
        try {
            const stats = {
                knowledgeBase: {
                    totalItems: this.knowledgeBase.size,
                    categories: {},
                    mostUsed: null
                },
                intentClassification: {
                    totalIntents: this.intentClassifier.size,
                    accuracy: 0.85 // 模拟准确率
                },
                conversationContext: {
                    activeContexts: this.conversationContext.size,
                    averageSessionLength: 0
                },
                learningData: {
                    totalRecords: this.learningData.size,
                    improvementRate: 0.12 // 模拟改进率
                }
            };

            // 统计知识库分类
            for (const [id, knowledge] of this.knowledgeBase) {
                const category = knowledge.category;
                stats.knowledgeBase.categories[category] = 
                    (stats.knowledgeBase.categories[category] || 0) + 1;
            }

            // 找出最常用的知识条目
            let maxUsage = 0;
            for (const [id, knowledge] of this.knowledgeBase) {
                if (knowledge.usage > maxUsage) {
                    maxUsage = knowledge.usage;
                    stats.knowledgeBase.mostUsed = {
                        id,
                        question: knowledge.question,
                        usage: knowledge.usage
                    };
                }
            }

            return stats;

        } catch (error) {
            console.error('❌ 获取AI统计信息失败:', error);
            return {};
        }
    }

    /**
     * 训练AI模型
     * @param {string} shopId - 店铺ID
     * @param {Array} trainingData - 训练数据
     */
    async trainAIModel(shopId, trainingData) {
        try {
            console.log('🧠 开始AI模型训练...');

            let successCount = 0;
            let totalCount = trainingData.length;

            for (const data of trainingData) {
                try {
                    // 处理训练数据
                    if (data.type === 'knowledge') {
                        // 添加到知识库
                        const id = `kb_trained_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        this.knowledgeBase.set(id, {
                            category: data.category || 'other',
                            question: data.question,
                            answer: data.answer,
                            keywords: data.keywords || [],
                            confidence: 0.8,
                            usage: 0,
                            source: 'training'
                        });
                    } else if (data.type === 'intent') {
                        // 更新意图分类器
                        if (this.intentClassifier.has(data.intent)) {
                            const existing = this.intentClassifier.get(data.intent);
                            existing.patterns = [...new Set([...existing.patterns, ...data.patterns])];
                            if (data.responses) {
                                existing.responses = [...new Set([...existing.responses, ...data.responses])];
                            }
                        }
                    }

                    successCount++;

                } catch (itemError) {
                    console.error('❌ 训练数据项处理失败:', itemError);
                }
            }

            const result = {
                success: true,
                processed: totalCount,
                successful: successCount,
                failed: totalCount - successCount,
                accuracy: successCount / totalCount,
                timestamp: new Date()
            };

            console.log(`✅ AI模型训练完成: ${successCount}/${totalCount} 成功`);
            return result;

        } catch (error) {
            console.error('❌ AI模型训练失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 清理过期上下文
     */
    cleanupExpiredContexts() {
        try {
            const now = new Date();
            const expiredKeys = [];

            for (const [conversationId, context] of this.conversationContext) {
                // 超过1小时没有更新的上下文被认为过期
                if (context.lastUpdate && (now - context.lastUpdate) > 60 * 60 * 1000) {
                    expiredKeys.push(conversationId);
                }
            }

            expiredKeys.forEach(key => {
                this.conversationContext.delete(key);
            });

            if (expiredKeys.length > 0) {
                console.log(`🗑️ 清理了 ${expiredKeys.length} 个过期对话上下文`);
            }

        } catch (error) {
            console.error('❌ 清理过期上下文失败:', error);
        }
    }

    /**
     * 导出AI配置
     * @param {string} shopId - 店铺ID
     * @returns {Object} AI配置数据
     */
    async exportAIConfig(shopId) {
        try {
            const config = {
                knowledgeBase: Array.from(this.knowledgeBase.entries()),
                intentClassifier: Array.from(this.intentClassifier.entries()),
                sentimentWords: this.sentimentWords,
                intensityWords: this.intensityWords,
                exportTime: new Date().toISOString(),
                version: '4.0.0'
            };

            return {
                success: true,
                data: config,
                size: JSON.stringify(config).length
            };

        } catch (error) {
            console.error('❌ 导出AI配置失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = AIAssistantManager;
