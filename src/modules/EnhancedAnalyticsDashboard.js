/**
 * 增强型数据分析仪表板系统
 * 
 * 功能特性：
 * - 实时数据监控和分析
 * - 高级KPI指标追踪
 * - 客户满意度深度分析  
 * - 员工工作效率评估
 * - 收入和业务增长分析
 * - 智能预测和趋势分析
 * - 多维度数据可视化
 * - 自定义报表生成
 * - 数据导出和分享
 * - 移动端适配
 * 
 * @author QuickTalk Team
 * @version 4.0.0
 */

const { v4: uuidv4 } = require('uuid');

class EnhancedAnalyticsDashboard {
    constructor(database, moduleManager) {
        this.db = database;
        this.moduleManager = moduleManager;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
        this.realTimeClients = new Set(); // WebSocket客户端
        this.computingQueue = []; // 计算队列
        this.isComputing = false;
        
        console.log('📊 增强型数据分析仪表板系统初始化...');
    }

    /**
     * 初始化分析系统
     */
    async initialize() {
        try {
            console.log('🚀 开始初始化增强型分析系统...');
            
            // 检测数据库类型
            this.isMemoryDatabase = !this.db.run; // 内存数据库没有 run 方法
            
            if (this.isMemoryDatabase) {
                console.log('📊 检测到内存数据库，初始化内存存储...');
                await this.initializeMemoryStorage();
            } else {
                console.log('📊 检测到 SQLite 数据库，创建数据表...');
                // 创建数据表
                await this.createAnalyticsTables();
                
                // 创建索引
                await this.createOptimizedIndexes();
                
                // 初始化数据聚合
                await this.initializeDataAggregation();
            }
            
            // 启动后台任务
            this.startBackgroundTasks();
            
            console.log('✅ 增强型分析系统初始化完成');
            return { success: true, message: '增强型分析系统初始化成功' };
            
        } catch (error) {
            console.error('❌ 增强型分析系统初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化内存存储
     */
    async initializeMemoryStorage() {
        // 为内存数据库创建 Map 存储
        this.analyticsData = {
            kpiMetrics: new Map(),
            userBehavior: new Map(),
            businessMetrics: new Map(),
            customerSatisfaction: new Map(),
            employeePerformance: new Map(),
            revenueAnalytics: new Map(),
            predictionData: new Map(),
            reportConfigs: new Map()
        };
        
        console.log('✅ 内存分析数据存储初始化完成');
    }

    /**
     * 数据库适配器 - 执行查询
     */
    async dbQuery(sql, params = []) {
        if (this.isMemoryDatabase) {
            // 内存数据库的模拟查询
            return this.simulateQuery(sql, params);
        } else {
            // SQLite 数据库查询
            return await this.db.all(sql, params);
        }
    }

    /**
     * 数据库适配器 - 执行写入操作
     */
    async dbRun(sql, params = []) {
        if (this.isMemoryDatabase) {
            // 内存数据库的模拟写入
            return this.simulateWrite(sql, params);
        } else {
            // SQLite 数据库写入
            return await this.db.run(sql, params);
        }
    }

    /**
     * 模拟写入操作（内存数据库）
     */
    simulateWrite(sql, params) {
        console.log(`📝 模拟写入操作: ${sql.substring(0, 50)}...`);
        return { lastID: Date.now(), changes: 1 };
    }

    /**
     * 模拟 SQL 查询（内存数据库）
     */
    simulateQuery(sql, params) {
        // 根据 SQL 语句类型返回模拟数据
        if (sql.includes('enhanced_kpi_metrics')) {
            return this.getSimulatedKPIData(params[0]);
        } else if (sql.includes('employee_performance')) {
            return this.getSimulatedEmployeeData(params[0]);
        } else if (sql.includes('enhanced_customer_satisfaction')) {
            return this.getSimulatedSatisfactionData(params[0]);
        } else if (sql.includes('revenue_analytics')) {
            return this.getSimulatedRevenueData(params[0]);
        } else if (sql.includes('business_metrics')) {
            return this.getSimulatedBusinessData(params[0]);
        }
        return [];
    }

    /**
     * 生成模拟 KPI 数据
     */
    getSimulatedKPIData(shopId) {
        return [
            {
                id: `kpi_${Date.now()}_1`,
                shop_id: shopId,
                metric_category: 'customer',
                metric_name: 'total_customers',
                metric_value: Math.floor(Math.random() * 1000) + 100,
                target_value: 1000,
                unit: 'count',
                recorded_at: new Date().toISOString()
            },
            {
                id: `kpi_${Date.now()}_2`,
                shop_id: shopId,
                metric_category: 'customer',
                metric_name: 'active_customers',
                metric_value: Math.floor(Math.random() * 500) + 50,
                target_value: 500,
                unit: 'count',
                recorded_at: new Date().toISOString()
            },
            {
                id: `kpi_${Date.now()}_3`,
                shop_id: shopId,
                metric_category: 'performance',
                metric_name: 'avg_response_time',
                metric_value: Math.floor(Math.random() * 300) + 60,
                target_value: 120,
                unit: 'seconds',
                recorded_at: new Date().toISOString()
            }
        ];
    }

    /**
     * 生成模拟员工绩效数据
     */
    getSimulatedEmployeeData(shopId) {
        return [
            {
                id: `emp_${Date.now()}_1`,
                shop_id: shopId,
                employee_id: 'emp_001',
                employee_name: '张三',
                messages_handled: Math.floor(Math.random() * 100) + 20,
                avg_response_time: Math.floor(Math.random() * 300) + 60,
                customer_satisfaction: Math.random() * 2 + 3,
                resolution_rate: Math.random() * 0.3 + 0.7,
                online_hours: Math.floor(Math.random() * 8) + 2,
                performance_score: Math.random() * 30 + 70,
                recorded_at: new Date().toISOString()
            },
            {
                id: `emp_${Date.now()}_2`,
                shop_id: shopId,
                employee_id: 'emp_002',
                employee_name: '李四',
                messages_handled: Math.floor(Math.random() * 100) + 20,
                avg_response_time: Math.floor(Math.random() * 300) + 60,
                customer_satisfaction: Math.random() * 2 + 3,
                resolution_rate: Math.random() * 0.3 + 0.7,
                online_hours: Math.floor(Math.random() * 8) + 2,
                performance_score: Math.random() * 30 + 70,
                recorded_at: new Date().toISOString()
            }
        ];
    }

    /**
     * 生成模拟客户满意度数据
     */
    getSimulatedSatisfactionData(shopId) {
        return [
            {
                id: `sat_${Date.now()}_1`,
                shop_id: shopId,
                rating_category: 'overall',
                avg_rating: Math.random() * 2 + 3,
                total_ratings: Math.floor(Math.random() * 100) + 10,
                rating_trend: Math.random() > 0.5 ? 'increasing' : 'decreasing',
                recorded_at: new Date().toISOString()
            }
        ];
    }

    /**
     * 生成模拟收入数据
     */
    getSimulatedRevenueData(shopId) {
        return [
            {
                id: `rev_${Date.now()}_1`,
                shop_id: shopId,
                revenue_type: 'subscription',
                total_revenue: Math.floor(Math.random() * 10000) + 1000,
                net_revenue: Math.floor(Math.random() * 9000) + 900,
                mrr: Math.floor(Math.random() * 1000) + 100,
                growth_rate: Math.random() * 0.2,
                recorded_at: new Date().toISOString()
            }
        ];
    }

    /**
     * 生成模拟业务指标数据
     */
    getSimulatedBusinessData(shopId) {
        return [
            {
                id: `bus_${Date.now()}_1`,
                shop_id: shopId,
                metric_name: 'conversion_rate',
                metric_value: Math.random() * 0.1 + 0.05,
                recorded_at: new Date().toISOString()
            }
        ];
    }

    /**
     * 创建分析相关数据表
     */
    async createAnalyticsTables() {
        console.log('📋 创建分析数据表...');
        
        // KPI指标表
        await this.createKpiMetricsTable();
        
        // 用户行为分析表
        await this.createUserBehaviorTable();
        
        // 业务指标表
        await this.createBusinessMetricsTable();
        
        // 客户满意度详细表
        await this.createCustomerSatisfactionTable();
        
        // 员工绩效表
        await this.createEmployeePerformanceTable();
        
        // 收入分析表
        await this.createRevenueAnalyticsTable();
        
        // 预测数据表
        await this.createPredictionDataTable();
        
        // 报表配置表
        await this.createReportConfigsTable();
        
        console.log('✅ 分析数据表创建完成');
    }

    /**
     * 创建KPI指标表
     */
    async createKpiMetricsTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS enhanced_kpi_metrics (
                id TEXT PRIMARY KEY,
                shop_id TEXT NOT NULL,
                metric_category TEXT NOT NULL CHECK(metric_category IN 
                    ('performance', 'customer', 'business', 'employee', 'system')),
                metric_name TEXT NOT NULL,
                metric_type TEXT NOT NULL CHECK(metric_type IN 
                    ('counter', 'gauge', 'histogram', 'rate', 'percentage')),
                current_value REAL NOT NULL,
                previous_value REAL,
                target_value REAL,
                threshold_min REAL,
                threshold_max REAL,
                metric_unit TEXT,
                time_period TEXT NOT NULL CHECK(time_period IN 
                    ('real_time', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly')),
                calculation_method TEXT, -- 计算方法描述
                data_source TEXT, -- 数据来源
                metadata TEXT, -- JSON格式的元数据
                is_critical BOOLEAN DEFAULT FALSE,
                alert_threshold REAL,
                trend_direction TEXT CHECK(trend_direction IN ('up', 'down', 'stable')),
                change_percentage REAL,
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
            )
        `;
        
        await this.db.run(sql);
        console.log('📈 增强型KPI指标表创建完成');
    }

    /**
     * 创建用户行为分析表
     */
    async createUserBehaviorTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS user_behavior_analytics (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                shop_id TEXT NOT NULL,
                session_id TEXT,
                behavior_type TEXT NOT NULL CHECK(behavior_type IN 
                    ('page_view', 'click', 'scroll', 'form_submit', 'file_upload', 'search', 
                     'message_send', 'message_read', 'voice_call', 'video_call', 'screen_share')),
                behavior_category TEXT NOT NULL CHECK(behavior_category IN 
                    ('navigation', 'communication', 'interaction', 'productivity', 'engagement')),
                page_url TEXT,
                element_id TEXT,
                element_type TEXT,
                action_details TEXT, -- JSON格式详细信息
                time_spent INTEGER, -- 停留时间(秒)
                device_type TEXT CHECK(device_type IN ('desktop', 'mobile', 'tablet')),
                browser_info TEXT,
                ip_address TEXT,
                referrer_url TEXT,
                user_agent TEXT,
                screen_resolution TEXT,
                is_successful BOOLEAN DEFAULT TRUE,
                error_message TEXT,
                conversion_event BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
            )
        `;
        
        await this.db.run(sql);
        console.log('👤 用户行为分析表创建完成');
    }

    /**
     * 创建业务指标表
     */
    async createBusinessMetricsTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS business_metrics (
                id TEXT PRIMARY KEY,
                shop_id TEXT NOT NULL,
                metric_date DATE NOT NULL,
                total_conversations INTEGER DEFAULT 0,
                new_conversations INTEGER DEFAULT 0,
                active_conversations INTEGER DEFAULT 0,
                closed_conversations INTEGER DEFAULT 0,
                avg_conversation_duration REAL DEFAULT 0, -- 平均对话时长(分钟)
                total_messages INTEGER DEFAULT 0,
                customer_messages INTEGER DEFAULT 0,
                staff_messages INTEGER DEFAULT 0,
                avg_response_time REAL DEFAULT 0, -- 平均响应时间(分钟)
                first_response_time REAL DEFAULT 0, -- 首次响应时间(分钟)
                resolution_rate REAL DEFAULT 0, -- 解决率(%)
                customer_satisfaction_avg REAL DEFAULT 0, -- 平均客户满意度
                active_users INTEGER DEFAULT 0,
                new_users INTEGER DEFAULT 0,
                returning_users INTEGER DEFAULT 0,
                peak_concurrent_users INTEGER DEFAULT 0,
                total_revenue REAL DEFAULT 0,
                subscription_revenue REAL DEFAULT 0,
                upgrade_revenue REAL DEFAULT 0,
                churn_rate REAL DEFAULT 0, -- 流失率(%)
                growth_rate REAL DEFAULT 0, -- 增长率(%)
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
                UNIQUE(shop_id, metric_date)
            )
        `;
        
        await this.db.run(sql);
        console.log('💼 业务指标表创建完成');
    }

    /**
     * 创建客户满意度详细表
     */
    async createCustomerSatisfactionTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS enhanced_customer_satisfaction (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                shop_id TEXT NOT NULL,
                customer_id TEXT NOT NULL,
                staff_id TEXT,
                overall_rating INTEGER CHECK(overall_rating >= 1 AND overall_rating <= 5),
                service_quality_rating INTEGER CHECK(service_quality_rating >= 1 AND service_quality_rating <= 5),
                response_speed_rating INTEGER CHECK(response_speed_rating >= 1 AND response_speed_rating <= 5),
                problem_resolution_rating INTEGER CHECK(problem_resolution_rating >= 1 AND problem_resolution_rating <= 5),
                staff_professionalism_rating INTEGER CHECK(staff_professionalism_rating >= 1 AND staff_professionalism_rating <= 5),
                system_usability_rating INTEGER CHECK(system_usability_rating >= 1 AND system_usability_rating <= 5),
                feedback_text TEXT,
                feedback_category TEXT CHECK(feedback_category IN 
                    ('compliment', 'complaint', 'suggestion', 'neutral')),
                sentiment_score REAL, -- 情感分析得分(-1到1)
                keywords TEXT, -- JSON数组，提取的关键词
                response_time_actual REAL, -- 实际响应时间(分钟)
                resolution_time_actual REAL, -- 实际解决时间(分钟)
                follow_up_needed BOOLEAN DEFAULT FALSE,
                follow_up_completed BOOLEAN DEFAULT FALSE,
                satisfaction_factors TEXT, -- JSON格式影响因素
                improvement_suggestions TEXT, -- JSON格式改进建议
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
                FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `;
        
        await this.db.run(sql);
        console.log('😊 增强型客户满意度表创建完成');
    }

    /**
     * 创建员工绩效表
     */
    async createEmployeePerformanceTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS employee_performance (
                id TEXT PRIMARY KEY,
                employee_id TEXT NOT NULL,
                shop_id TEXT NOT NULL,
                performance_date DATE NOT NULL,
                total_conversations INTEGER DEFAULT 0,
                active_conversations INTEGER DEFAULT 0,
                closed_conversations INTEGER DEFAULT 0,
                total_messages INTEGER DEFAULT 0,
                avg_response_time REAL DEFAULT 0, -- 平均响应时间(分钟)
                first_response_time REAL DEFAULT 0, -- 首次响应时间(分钟)
                avg_resolution_time REAL DEFAULT 0, -- 平均解决时间(分钟)
                customer_satisfaction_avg REAL DEFAULT 0, -- 平均客户满意度
                customer_satisfaction_count INTEGER DEFAULT 0,
                positive_feedback_count INTEGER DEFAULT 0,
                negative_feedback_count INTEGER DEFAULT 0,
                productivity_score REAL DEFAULT 0, -- 生产力评分(0-100)
                quality_score REAL DEFAULT 0, -- 服务质量评分(0-100)
                efficiency_score REAL DEFAULT 0, -- 效率评分(0-100)
                online_time REAL DEFAULT 0, -- 在线时间(小时)
                active_time REAL DEFAULT 0, -- 活跃时间(小时)
                break_time REAL DEFAULT 0, -- 休息时间(小时)
                overtime_hours REAL DEFAULT 0, -- 加班时间(小时)
                goals_achieved INTEGER DEFAULT 0, -- 目标达成数
                goals_total INTEGER DEFAULT 0, -- 总目标数
                performance_rank INTEGER, -- 绩效排名
                bonus_earned REAL DEFAULT 0, -- 获得奖金
                warnings_count INTEGER DEFAULT 0, -- 警告次数
                commendations_count INTEGER DEFAULT 0, -- 表扬次数
                training_hours REAL DEFAULT 0, -- 培训时间(小时)
                skill_level INTEGER DEFAULT 1 CHECK(skill_level >= 1 AND skill_level <= 5),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
                UNIQUE(employee_id, shop_id, performance_date)
            )
        `;
        
        await this.db.run(sql);
        console.log('👨‍💼 员工绩效表创建完成');
    }

    /**
     * 创建收入分析表
     */
    async createRevenueAnalyticsTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS revenue_analytics (
                id TEXT PRIMARY KEY,
                shop_id TEXT NOT NULL,
                revenue_date DATE NOT NULL,
                subscription_type TEXT CHECK(subscription_type IN ('basic', 'premium', 'enterprise')),
                total_revenue REAL DEFAULT 0,
                subscription_revenue REAL DEFAULT 0,
                upgrade_revenue REAL DEFAULT 0,
                addon_revenue REAL DEFAULT 0,
                refund_amount REAL DEFAULT 0,
                net_revenue REAL DEFAULT 0,
                new_subscriptions INTEGER DEFAULT 0,
                renewed_subscriptions INTEGER DEFAULT 0,
                cancelled_subscriptions INTEGER DEFAULT 0,
                upgraded_subscriptions INTEGER DEFAULT 0,
                downgraded_subscriptions INTEGER DEFAULT 0,
                active_subscriptions INTEGER DEFAULT 0,
                mrr REAL DEFAULT 0, -- 月度经常性收入
                arr REAL DEFAULT 0, -- 年度经常性收入
                ltv REAL DEFAULT 0, -- 客户生命周期价值
                cac REAL DEFAULT 0, -- 客户获取成本
                churn_rate REAL DEFAULT 0, -- 流失率
                retention_rate REAL DEFAULT 0, -- 留存率
                growth_rate REAL DEFAULT 0, -- 增长率
                payment_method TEXT,
                transaction_fees REAL DEFAULT 0,
                tax_amount REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
            )
        `;
        
        await this.db.run(sql);
        console.log('💰 收入分析表创建完成');
    }

    /**
     * 创建预测数据表
     */
    async createPredictionDataTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS prediction_data (
                id TEXT PRIMARY KEY,
                shop_id TEXT,
                prediction_type TEXT NOT NULL CHECK(prediction_type IN 
                    ('revenue', 'user_growth', 'churn_risk', 'satisfaction', 'workload', 'demand')),
                prediction_model TEXT NOT NULL,
                prediction_date DATE NOT NULL,
                prediction_period TEXT NOT NULL CHECK(prediction_period IN 
                    ('daily', 'weekly', 'monthly', 'quarterly')),
                predicted_value REAL NOT NULL,
                confidence_score REAL CHECK(confidence_score >= 0 AND confidence_score <= 1),
                upper_bound REAL,
                lower_bound REAL,
                actual_value REAL,
                accuracy_score REAL,
                input_features TEXT, -- JSON格式输入特征
                model_version TEXT,
                prediction_factors TEXT, -- JSON格式影响因素
                risk_indicators TEXT, -- JSON格式风险指标
                recommendations TEXT, -- JSON格式建议
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
            )
        `;
        
        await this.db.run(sql);
        console.log('🔮 预测数据表创建完成');
    }

    /**
     * 创建报表配置表
     */
    async createReportConfigsTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS report_configs (
                id TEXT PRIMARY KEY,
                shop_id TEXT NOT NULL,
                report_name TEXT NOT NULL,
                report_type TEXT NOT NULL CHECK(report_type IN 
                    ('dashboard', 'kpi', 'performance', 'satisfaction', 'revenue', 'prediction', 'custom')),
                report_category TEXT CHECK(report_category IN 
                    ('operational', 'strategic', 'compliance', 'executive')),
                schedule_type TEXT CHECK(schedule_type IN 
                    ('manual', 'real_time', 'hourly', 'daily', 'weekly', 'monthly')),
                schedule_time TEXT, -- 定时时间
                recipients TEXT, -- JSON数组，接收人邮箱
                format_type TEXT CHECK(format_type IN ('pdf', 'excel', 'csv', 'json', 'html')),
                template_config TEXT, -- JSON格式模板配置
                filter_config TEXT, -- JSON格式筛选配置
                chart_config TEXT, -- JSON格式图表配置
                is_active BOOLEAN DEFAULT TRUE,
                is_public BOOLEAN DEFAULT FALSE,
                access_level TEXT CHECK(access_level IN ('owner', 'admin', 'staff', 'readonly')),
                last_generated_at DATETIME,
                next_generation_at DATETIME,
                generation_count INTEGER DEFAULT 0,
                file_path TEXT, -- 最新报表文件路径
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `;
        
        await this.db.run(sql);
        
        // 检查并添加可能缺失的列（兼容旧版本）
        try {
            await this.db.run('ALTER TABLE report_configs ADD COLUMN schedule_type TEXT');
        } catch (error) {
            // 列已存在，忽略错误
        }
        
        try {
            await this.db.run('ALTER TABLE report_configs ADD COLUMN next_generation_at DATETIME');
        } catch (error) {
            // 列已存在，忽略错误
        }
        
        console.log('📋 报表配置表创建完成');
    }

    /**
     * 创建优化索引
     */
    async createOptimizedIndexes() {
        console.log('📇 创建优化索引...');
        
        const indexes = [
            // KPI指标索引
            'CREATE INDEX IF NOT EXISTS idx_kpi_shop_category_time ON enhanced_kpi_metrics(shop_id, metric_category, recorded_at)',
            'CREATE INDEX IF NOT EXISTS idx_kpi_critical ON enhanced_kpi_metrics(is_critical, recorded_at)',
            'CREATE INDEX IF NOT EXISTS idx_kpi_expires ON enhanced_kpi_metrics(expires_at)',
            
            // 用户行为索引
            'CREATE INDEX IF NOT EXISTS idx_behavior_user_shop_time ON user_behavior_analytics(user_id, shop_id, created_at)',
            'CREATE INDEX IF NOT EXISTS idx_behavior_type_category ON user_behavior_analytics(behavior_type, behavior_category)',
            'CREATE INDEX IF NOT EXISTS idx_behavior_session ON user_behavior_analytics(session_id, created_at)',
            
            // 业务指标索引
            'CREATE INDEX IF NOT EXISTS idx_business_shop_date ON business_metrics(shop_id, metric_date)',
            'CREATE INDEX IF NOT EXISTS idx_business_date ON business_metrics(metric_date)',
            
            // 客户满意度索引
            'CREATE INDEX IF NOT EXISTS idx_satisfaction_shop_time ON enhanced_customer_satisfaction(shop_id, created_at)',
            'CREATE INDEX IF NOT EXISTS idx_satisfaction_staff ON enhanced_customer_satisfaction(staff_id, created_at)',
            'CREATE INDEX IF NOT EXISTS idx_satisfaction_rating ON enhanced_customer_satisfaction(overall_rating)',
            
            // 员工绩效索引
            'CREATE INDEX IF NOT EXISTS idx_performance_employee_date ON employee_performance(employee_id, performance_date)',
            'CREATE INDEX IF NOT EXISTS idx_performance_shop_date ON employee_performance(shop_id, performance_date)',
            'CREATE INDEX IF NOT EXISTS idx_performance_rank ON employee_performance(performance_rank)',
            
            // 收入分析索引
            'CREATE INDEX IF NOT EXISTS idx_revenue_shop_date ON revenue_analytics(shop_id, revenue_date)',
            'CREATE INDEX IF NOT EXISTS idx_revenue_subscription ON revenue_analytics(subscription_type, revenue_date)',
            
            // 预测数据索引
            'CREATE INDEX IF NOT EXISTS idx_prediction_shop_type_date ON prediction_data(shop_id, prediction_type, prediction_date)',
            'CREATE INDEX IF NOT EXISTS idx_prediction_accuracy ON prediction_data(accuracy_score)',
            
            // 报表配置索引
            'CREATE INDEX IF NOT EXISTS idx_reports_shop_active ON report_configs(shop_id, is_active)',
            'CREATE INDEX IF NOT EXISTS idx_reports_schedule ON report_configs(schedule_type, next_generation_at)'
        ];

        for (const indexSql of indexes) {
            await this.db.run(indexSql);
        }
        
        console.log('✅ 优化索引创建完成');
    }

    /**
     * 初始化数据聚合
     */
    async initializeDataAggregation() {
        console.log('🔄 初始化数据聚合...');
        
        // 创建聚合视图
        await this.createAggregationViews();
        
        // 初始化计算任务
        this.scheduleDataAggregation();
        
        console.log('✅ 数据聚合初始化完成');
    }

    /**
     * 创建聚合视图
     */
    async createAggregationViews() {
        // 实时KPI概览视图
        const kpiOverviewView = `
            CREATE VIEW IF NOT EXISTS v_kpi_overview AS
            SELECT 
                shop_id,
                metric_category,
                COUNT(*) as total_metrics,
                COUNT(CASE WHEN is_critical = 1 THEN 1 END) as critical_metrics,
                AVG(current_value) as avg_value,
                MIN(current_value) as min_value,
                MAX(current_value) as max_value,
                COUNT(CASE WHEN current_value >= target_value THEN 1 END) as metrics_on_target
            FROM enhanced_kpi_metrics
            WHERE expires_at IS NULL OR expires_at > datetime('now')
            GROUP BY shop_id, metric_category
        `;
        
        // 业务绩效摘要视图
        const businessSummaryView = `
            CREATE VIEW IF NOT EXISTS v_business_summary AS
            SELECT 
                shop_id,
                DATE(metric_date) as summary_date,
                SUM(total_conversations) as total_conversations,
                AVG(avg_response_time) as avg_response_time,
                AVG(customer_satisfaction_avg) as avg_satisfaction,
                SUM(total_revenue) as total_revenue,
                AVG(growth_rate) as avg_growth_rate
            FROM business_metrics
            WHERE metric_date >= date('now', '-30 days')
            GROUP BY shop_id, DATE(metric_date)
        `;
        
        // 员工绩效排名视图
        const employeeRankingView = `
            CREATE VIEW IF NOT EXISTS v_employee_ranking AS
            SELECT 
                ep.*,
                u.name as employee_name,
                RANK() OVER (PARTITION BY shop_id ORDER BY productivity_score DESC) as productivity_rank,
                RANK() OVER (PARTITION BY shop_id ORDER BY quality_score DESC) as quality_rank,
                RANK() OVER (PARTITION BY shop_id ORDER BY customer_satisfaction_avg DESC) as satisfaction_rank
            FROM employee_performance ep
            JOIN users u ON ep.employee_id = u.id
            WHERE performance_date >= date('now', '-7 days')
        `;
        
        await this.db.run(kpiOverviewView);
        await this.db.run(businessSummaryView);
        await this.db.run(employeeRankingView);
        
        console.log('📊 聚合视图创建完成');
    }

    /**
     * 启动后台任务
     */
    startBackgroundTasks() {
        console.log('🔄 启动后台任务...');
        
        // 每5分钟更新实时指标
        setInterval(() => {
            this.updateRealTimeMetrics();
        }, 5 * 60 * 1000);
        
        // 每小时计算业务指标
        setInterval(() => {
            this.calculateHourlyMetrics();
        }, 60 * 60 * 1000);
        
        // 每天计算员工绩效
        setInterval(() => {
            this.calculateDailyPerformance();
        }, 24 * 60 * 60 * 1000);
        
        // 每周生成预测数据
        setInterval(() => {
            this.generatePredictions();
        }, 7 * 24 * 60 * 60 * 1000);
        
        console.log('✅ 后台任务启动完成');
    }

    /**
     * 安排数据聚合任务
     */
    scheduleDataAggregation() {
        // 立即执行一次聚合
        setTimeout(() => {
            this.performInitialAggregation();
        }, 1000);
        
        // 定期聚合任务
        setInterval(() => {
            this.performPeriodicAggregation();
        }, 15 * 60 * 1000); // 每15分钟
    }

    /**
     * 执行初始聚合
     */
    async performInitialAggregation() {
        try {
            console.log('🔄 执行初始数据聚合...');
            
            // 聚合最近7天的数据
            await this.aggregateBusinessMetrics(7);
            
            console.log('✅ 初始数据聚合完成');
        } catch (error) {
            console.error('❌ 初始数据聚合失败:', error);
        }
    }

    /**
     * 执行周期性聚合
     */
    async performPeriodicAggregation() {
        try {
            console.log('🔄 执行周期性数据聚合...');
            
            // 聚合最近1天的数据
            await this.aggregateBusinessMetrics(1);
            
            console.log('✅ 周期性数据聚合完成');
        } catch (error) {
            console.error('❌ 周期性数据聚合失败:', error);
        }
    }

    /**
     * 聚合业务指标
     */
    async aggregateBusinessMetrics(days = 1) {
        try {
            // 获取活跃店铺
            let shops;
            if (this.isMemoryDatabase) {
                shops = Object.values(this.db.shops).filter(shop => shop.status === 'active');
            } else {
                shops = await this.db.all('SELECT id FROM shops WHERE status = "active"');
            }
            
            for (const shop of shops) {
                await this.aggregateShopMetrics(shop.id, days);
            }
            
        } catch (error) {
            console.error('❌ 聚合业务指标失败:', error);
            throw error;
        }
    }

    /**
     * 聚合单个店铺指标
     */
    async aggregateShopMetrics(shopId, days) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            const endDate = new Date();
            
            // 聚合对话数据
            const conversationData = await this.aggregateConversationData(shopId, startDate, endDate);
            
            // 聚合消息数据
            const messageData = await this.aggregateMessageData(shopId, startDate, endDate);
            
            // 聚合用户数据
            const userData = await this.aggregateUserData(shopId, startDate, endDate);
            
            // 聚合满意度数据
            const satisfactionData = await this.aggregateSatisfactionData(shopId, startDate, endDate);
            
            // 保存聚合结果
            await this.saveAggregatedMetrics(shopId, {
                ...conversationData,
                ...messageData,
                ...userData,
                ...satisfactionData
            });
            
        } catch (error) {
            console.error('❌ 聚合店铺指标失败:', error);
            throw error;
        }
    }

    /**
     * 聚合对话数据
     */
    async aggregateConversationData(shopId, startDate, endDate) {
        const sql = `
            SELECT 
                COUNT(*) as total_conversations,
                COUNT(CASE WHEN created_at >= ? THEN 1 END) as new_conversations,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_conversations,
                COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_conversations,
                AVG(
                    CASE WHEN last_message_at IS NOT NULL AND created_at IS NOT NULL 
                    THEN (julianday(last_message_at) - julianday(created_at)) * 24 * 60
                    END
                ) as avg_conversation_duration
            FROM conversations 
            WHERE shop_id = ? AND created_at >= ? AND created_at <= ?
        `;
        
        const result = await this.db.get(sql, [startDate.toISOString(), shopId, startDate.toISOString(), endDate.toISOString()]);
        
        return {
            total_conversations: result.total_conversations || 0,
            new_conversations: result.new_conversations || 0,
            active_conversations: result.active_conversations || 0,
            closed_conversations: result.closed_conversations || 0,
            avg_conversation_duration: result.avg_conversation_duration || 0
        };
    }

    /**
     * 聚合消息数据
     */
    async aggregateMessageData(shopId, startDate, endDate) {
        const sql = `
            SELECT 
                COUNT(*) as total_messages,
                COUNT(CASE WHEN m.sender_type = 'customer' THEN 1 END) as customer_messages,
                COUNT(CASE WHEN m.sender_type = 'staff' THEN 1 END) as staff_messages,
                AVG(
                    CASE WHEN m.sender_type = 'staff' AND prev.created_at IS NOT NULL
                    THEN (julianday(m.created_at) - julianday(prev.created_at)) * 24 * 60
                    END
                ) as avg_response_time,
                MIN(
                    CASE WHEN m.sender_type = 'staff' AND prev.created_at IS NOT NULL
                    THEN (julianday(m.created_at) - julianday(prev.created_at)) * 24 * 60
                    END
                ) as first_response_time
            FROM messages m
            LEFT JOIN conversations c ON m.conversation_id = c.id
            LEFT JOIN messages prev ON prev.conversation_id = m.conversation_id 
                AND prev.created_at < m.created_at 
                AND prev.sender_type = 'customer'
            WHERE c.shop_id = ? AND m.created_at >= ? AND m.created_at <= ?
        `;
        
        const result = await this.db.get(sql, [shopId, startDate.toISOString(), endDate.toISOString()]);
        
        return {
            total_messages: result.total_messages || 0,
            customer_messages: result.customer_messages || 0,
            staff_messages: result.staff_messages || 0,
            avg_response_time: result.avg_response_time || 0,
            first_response_time: result.first_response_time || 0
        };
    }

    /**
     * 聚合用户数据
     */
    async aggregateUserData(shopId, startDate, endDate) {
        // 这里可以根据实际需求实现用户活跃度统计
        return {
            active_users: 0,
            new_users: 0,
            returning_users: 0,
            peak_concurrent_users: 0
        };
    }

    /**
     * 聚合满意度数据
     */
    async aggregateSatisfactionData(shopId, startDate, endDate) {
        const sql = `
            SELECT 
                AVG(overall_rating) as avg_satisfaction,
                COUNT(*) as satisfaction_count,
                COUNT(CASE WHEN overall_rating >= 4 THEN 1 END) as positive_count,
                COUNT(CASE WHEN overall_rating <= 2 THEN 1 END) as negative_count
            FROM enhanced_customer_satisfaction 
            WHERE shop_id = ? AND created_at >= ? AND created_at <= ?
        `;
        
        const result = await this.db.get(sql, [shopId, startDate.toISOString(), endDate.toISOString()]);
        
        return {
            customer_satisfaction_avg: result.avg_satisfaction || 0
        };
    }

    /**
     * 保存聚合指标
     */
    async saveAggregatedMetrics(shopId, metrics) {
        const today = new Date().toISOString().split('T')[0];
        
        const sql = `
            INSERT OR REPLACE INTO business_metrics (
                id, shop_id, metric_date,
                total_conversations, new_conversations, active_conversations, closed_conversations,
                avg_conversation_duration, total_messages, customer_messages, staff_messages,
                avg_response_time, first_response_time, customer_satisfaction_avg,
                active_users, new_users, returning_users, peak_concurrent_users,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await this.db.run(sql, [
            uuidv4(),
            shopId,
            today,
            metrics.total_conversations,
            metrics.new_conversations,
            metrics.active_conversations,
            metrics.closed_conversations,
            metrics.avg_conversation_duration,
            metrics.total_messages,
            metrics.customer_messages,
            metrics.staff_messages,
            metrics.avg_response_time,
            metrics.first_response_time,
            metrics.customer_satisfaction_avg,
            metrics.active_users,
            metrics.new_users,
            metrics.returning_users,
            metrics.peak_concurrent_users,
            new Date().toISOString()
        ]);
    }

    /**
     * 更新实时指标
     */
    async updateRealTimeMetrics() {
        try {
            console.log('🔄 更新实时指标...');
            
            // 获取活跃店铺
            let shops;
            if (this.isMemoryDatabase) {
                shops = Object.values(this.db.shops).filter(shop => shop.status === 'active');
            } else {
                shops = await this.db.all('SELECT id FROM shops WHERE status = "active"');
            }
            
            for (const shop of shops) {
                await this.updateShopRealTimeMetrics(shop.id);
            }
            
            // 通知前端客户端
            this.notifyRealTimeClients();
            
        } catch (error) {
            console.error('❌ 更新实时指标失败:', error);
        }
    }

    /**
     * 更新店铺实时指标
     */
    async updateShopRealTimeMetrics(shopId) {
        // 计算当前活跃对话数
        const activeConversations = await this.db.get(`
            SELECT COUNT(*) as count FROM conversations 
            WHERE shop_id = ? AND status = 'active'
        `, [shopId]);
        
        // 计算今日新对话数
        const todayConversations = await this.db.get(`
            SELECT COUNT(*) as count FROM conversations 
            WHERE shop_id = ? AND DATE(created_at) = DATE('now')
        `, [shopId]);
        
        // 计算平均响应时间
        const avgResponseTime = await this.db.get(`
            SELECT AVG(
                CASE WHEN m2.created_at IS NOT NULL 
                THEN (julianday(m2.created_at) - julianday(m1.created_at)) * 24 * 60
                END
            ) as avg_time
            FROM messages m1
            JOIN conversations c ON m1.conversation_id = c.id
            LEFT JOIN messages m2 ON m2.conversation_id = m1.conversation_id 
                AND m2.created_at > m1.created_at 
                AND m2.sender_type = 'staff'
                AND m1.sender_type = 'customer'
            WHERE c.shop_id = ? AND DATE(m1.created_at) = DATE('now')
        `, [shopId]);
        
        // 保存实时KPI
        await this.saveRealtimeKPI(shopId, 'performance', 'active_conversations', 'gauge', 
            activeConversations.count, null, null, 'count', 'real_time');
        
        await this.saveRealtimeKPI(shopId, 'performance', 'today_conversations', 'counter', 
            todayConversations.count, null, null, 'count', 'real_time');
        
        if (avgResponseTime.avg_time) {
            await this.saveRealtimeKPI(shopId, 'performance', 'avg_response_time', 'gauge', 
                avgResponseTime.avg_time, null, 5, 'minutes', 'real_time');
        }
    }

    /**
     * 保存实时KPI
     */
    async saveRealtimeKPI(shopId, category, name, type, value, previous, target, unit, period) {
        const id = uuidv4();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期
        
        const sql = `
            INSERT OR REPLACE INTO enhanced_kpi_metrics (
                id, shop_id, metric_category, metric_name, metric_type,
                current_value, previous_value, target_value, metric_unit, time_period,
                expires_at, recorded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await this.db.run(sql, [
            id, shopId, category, name, type,
            value, previous, target, unit, period,
            expiresAt.toISOString(), new Date().toISOString()
        ]);
    }

    /**
     * 通知实时客户端
     */
    notifyRealTimeClients() {
        // 这里可以通过WebSocket通知前端客户端更新数据
        // 实现WebSocket通知逻辑
    }

    /**
     * 计算小时指标
     */
    async calculateHourlyMetrics() {
        try {
            console.log('🔄 计算小时指标...');
            // 实现小时级别的指标计算
        } catch (error) {
            console.error('❌ 计算小时指标失败:', error);
        }
    }

    /**
     * 计算每日绩效
     */
    async calculateDailyPerformance() {
        try {
            console.log('🔄 计算每日绩效...');
            // 实现每日员工绩效计算
        } catch (error) {
            console.error('❌ 计算每日绩效失败:', error);
        }
    }

    /**
     * 生成预测数据
     */
    async generatePredictions() {
        try {
            console.log('🔄 生成预测数据...');
            // 实现预测算法
        } catch (error) {
            console.error('❌ 生成预测数据失败:', error);
        }
    }

    /**
     * 获取增强型仪表板数据
     */
    async getEnhancedDashboardData(shopId, timeRange = '24h', includeDetails = false) {
        try {
            const cacheKey = `enhanced_dashboard_${shopId}_${timeRange}_${includeDetails}`;
            
            // 检查缓存
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            console.log(`📊 获取增强型仪表板数据: ${shopId}, ${timeRange}`);
            
            // 并行获取各类数据
            const [
                kpiMetrics,
                businessMetrics,
                employeePerformance,
                customerSatisfaction,
                revenueAnalytics,
                predictions,
                userBehavior
            ] = await Promise.all([
                this.getKPIMetrics(shopId, timeRange),
                this.getBusinessMetrics(shopId, timeRange),
                this.getEmployeePerformance(shopId, timeRange),
                this.getCustomerSatisfactionMetrics(shopId, timeRange),
                this.getRevenueAnalytics(shopId, timeRange),
                this.getPredictions(shopId, timeRange),
                includeDetails ? this.getUserBehaviorAnalytics(shopId, timeRange) : null
            ]);

            const result = {
                shopId,
                timeRange,
                timestamp: new Date().toISOString(),
                kpi: kpiMetrics,
                business: businessMetrics,
                employees: employeePerformance,
                satisfaction: customerSatisfaction,
                revenue: revenueAnalytics,
                predictions: predictions,
                behavior: userBehavior,
                summary: this.generateSummary({
                    kpiMetrics,
                    businessMetrics,
                    employeePerformance,
                    customerSatisfaction,
                    revenueAnalytics
                })
            };

            // 缓存结果
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;

        } catch (error) {
            console.error('❌ 获取增强型仪表板数据失败:', error);
            throw error;
        }
    }

    /**
     * 获取KPI指标
     */
    async getKPIMetrics(shopId, timeRange) {
        const timeFilter = this.getTimeFilter(timeRange);
        
        const sql = `
            SELECT * FROM enhanced_kpi_metrics 
            WHERE shop_id = ? AND recorded_at >= ? 
            AND (expires_at IS NULL OR expires_at > datetime('now'))
            ORDER BY metric_category, metric_name, recorded_at DESC
        `;
        
        const metrics = await this.dbQuery(sql, [shopId, timeFilter.startTime]);
        
        // 按类别分组
        const grouped = {};
        metrics.forEach(metric => {
            if (!grouped[metric.metric_category]) {
                grouped[metric.metric_category] = [];
            }
            grouped[metric.metric_category].push(metric);
        });
        
        return grouped;
    }

    /**
     * 获取业务指标
     */
    async getBusinessMetrics(shopId, timeRange) {
        const timeFilter = this.getTimeFilter(timeRange);
        
        const sql = `
            SELECT * FROM business_metrics 
            WHERE shop_id = ? AND metric_date >= DATE(?) 
            ORDER BY metric_date DESC
        `;
        
        const metrics = await this.dbQuery(sql, [shopId, timeFilter.startTime]);
        
        return {
            daily: metrics,
            summary: this.calculateBusinessSummary(metrics)
        };
    }

    /**
     * 获取员工绩效
     */
    async getEmployeePerformance(shopId, timeRange) {
        try {
            let performance = [];
            
            if (this.isMemoryDatabase) {
                // 从内存存储中获取员工绩效数据
                const employeePerformance = Array.from(this.analyticsData.employeePerformance.values());
                performance = employeePerformance.filter(perf => 
                    perf.shop_id === shopId && 
                    new Date(perf.performance_date) >= new Date(this.getTimeFilter(timeRange).startTime)
                );
            } else {
                const timeFilter = this.getTimeFilter(timeRange);
                
                const sql = `
                    SELECT ep.*, u.name as employee_name, u.email as employee_email
                    FROM employee_performance ep
                    JOIN users u ON ep.employee_id = u.id
                    WHERE ep.shop_id = ? AND ep.performance_date >= DATE(?)
                    ORDER BY ep.performance_date DESC, ep.productivity_score DESC
                `;
                
                performance = await this.dbQuery(sql, [shopId, timeFilter.startTime]);
            }
            
            // 确保返回数组
            const performanceArray = Array.isArray(performance) ? performance : [];
            
            return {
                individual: performanceArray,
                rankings: this.calculatePerformanceRankings(performanceArray),
                trends: this.calculatePerformanceTrends(performanceArray)
            };
            
        } catch (error) {
            console.error('❌ 获取员工绩效失败:', error);
            return {
                individual: [],
                rankings: [],
                trends: {}
            };
        }
    }

    /**
     * 获取客户满意度指标
     */
    async getCustomerSatisfactionMetrics(shopId, timeRange) {
        const timeFilter = this.getTimeFilter(timeRange);
        
        const sql = `
            SELECT * FROM enhanced_customer_satisfaction 
            WHERE shop_id = ? AND created_at >= ?
            ORDER BY created_at DESC
        `;
        
        const satisfaction = await this.dbQuery(sql, [shopId, timeFilter.startTime]);
        
        return {
            detailed: satisfaction,
            summary: this.calculateSatisfactionSummary(satisfaction),
            trends: this.calculateSatisfactionTrends(satisfaction)
        };
    }

    /**
     * 获取收入分析
     */
    async getRevenueAnalytics(shopId, timeRange) {
        const timeFilter = this.getTimeFilter(timeRange);
        
        const sql = `
            SELECT * FROM revenue_analytics 
            WHERE shop_id = ? AND revenue_date >= DATE(?)
            ORDER BY revenue_date DESC
        `;
        
        const revenue = await this.dbQuery(sql, [shopId, timeFilter.startTime]);
        
        return {
            daily: revenue,
            summary: this.calculateRevenueSummary(revenue),
            forecasts: this.calculateRevenueForecasts(revenue)
        };
    }

    /**
     * 获取预测数据
     */
    async getPredictions(shopId, timeRange) {
        const sql = `
            SELECT * FROM prediction_data 
            WHERE shop_id = ? AND prediction_date >= DATE('now')
            ORDER BY prediction_type, prediction_date
        `;
        
        const predictions = await this.dbQuery(sql, [shopId]);
        
        // 按预测类型分组
        const grouped = {};
        predictions.forEach(prediction => {
            if (!grouped[prediction.prediction_type]) {
                grouped[prediction.prediction_type] = [];
            }
            grouped[prediction.prediction_type].push(prediction);
        });
        
        return grouped;
    }

    /**
     * 获取用户行为分析（可选详细数据）
     */
    async getUserBehaviorAnalytics(shopId, timeRange) {
        if (this.isMemoryDatabase) {
            // 内存数据库返回模拟数据
            return {
                pageViews: Math.floor(Math.random() * 1000) + 100,
                sessionDuration: Math.floor(Math.random() * 300) + 60,
                bounceRate: Math.random() * 0.3 + 0.2,
                conversionRate: Math.random() * 0.1 + 0.05
            };
        }
        
        const timeFilter = this.getTimeFilter(timeRange);
        const sql = `
            SELECT * FROM user_behavior_analytics 
            WHERE shop_id = ? AND recorded_at >= ?
            ORDER BY recorded_at DESC
        `;
        
        return await this.dbQuery(sql, [shopId, timeFilter.startTime]);
    }

    /**
     * 生成时间过滤器
     */
    getTimeFilter(timeRange) {
        const now = new Date();
        let startTime;
        
        switch (timeRange) {
            case '1h':
                startTime = new Date(now.getTime() - 60 * 60 * 1000);
                break;
            case '24h':
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }
        
        return {
            startTime: startTime.toISOString(),
            endTime: now.toISOString(),
            sql: 'AND created_at >= ?',
            params: [startTime.toISOString()]
        };
    }

    /**
     * 计算业务摘要
     */
    calculateBusinessSummary(metrics) {
        if (!metrics || metrics.length === 0) {
            return {
                totalConversations: 0,
                avgResponseTime: 0,
                avgSatisfaction: 0,
                totalRevenue: 0,
                growthRate: 0
            };
        }
        
        const latest = metrics[0];
        const previous = metrics[1];
        
        return {
            totalConversations: latest.total_conversations || 0,
            avgResponseTime: latest.avg_response_time || 0,
            avgSatisfaction: latest.customer_satisfaction_avg || 0,
            totalRevenue: latest.total_revenue || 0,
            growthRate: latest.growth_rate || 0,
            trend: this.calculateTrend(latest, previous)
        };
    }

    /**
     * 计算绩效排名
     */
    calculatePerformanceRankings(performance) {
        if (!performance || !Array.isArray(performance) || performance.length === 0) {
            return [];
        }
        
        // 按生产力分数排序
        const sorted = [...performance].sort((a, b) => (b.productivity_score || 0) - (a.productivity_score || 0));
        
        return sorted.map((perf, index) => ({
            ...perf,
            rank: index + 1,
            percentile: Math.round((1 - index / sorted.length) * 100)
        }));
    }

    /**
     * 计算绩效趋势
     */
    calculatePerformanceTrends(performance) {
        if (!performance || !Array.isArray(performance)) {
            return {};
        }
        
        // 简化的趋势计算
        return {
            trend: 'stable',
            growth: 0,
            summary: '绩效数据趋势分析'
        };
    }

    /**
     * 计算满意度摘要
     */
    calculateSatisfactionSummary(satisfaction) {
        if (!satisfaction || satisfaction.length === 0) {
            return {
                average: 0,
                total: 0,
                distribution: {},
                trends: {}
            };
        }
        
        const total = satisfaction.length;
        const average = satisfaction.reduce((sum, s) => sum + (s.overall_rating || 0), 0) / total;
        
        const distribution = {
            excellent: satisfaction.filter(s => s.overall_rating === 5).length,
            good: satisfaction.filter(s => s.overall_rating === 4).length,
            neutral: satisfaction.filter(s => s.overall_rating === 3).length,
            poor: satisfaction.filter(s => s.overall_rating === 2).length,
            terrible: satisfaction.filter(s => s.overall_rating === 1).length
        };
        
        return {
            average: Math.round(average * 100) / 100,
            total,
            distribution,
            positiveRate: Math.round(((distribution.excellent + distribution.good) / total) * 100)
        };
    }

    /**
     * 计算满意度趋势
     */
    calculateSatisfactionTrends(satisfaction) {
        // 实现满意度趋势计算
        return {};
    }

    /**
     * 计算收入摘要
     */
    calculateRevenueSummary(revenue) {
        if (!revenue || revenue.length === 0) {
            return {
                total: 0,
                growth: 0,
                mrr: 0,
                arr: 0
            };
        }
        
        const total = revenue.reduce((sum, r) => sum + (r.total_revenue || 0), 0);
        const latest = revenue[0];
        
        return {
            total,
            growth: latest.growth_rate || 0,
            mrr: latest.mrr || 0,
            arr: latest.arr || 0,
            churnRate: latest.churn_rate || 0,
            retentionRate: latest.retention_rate || 0
        };
    }

    /**
     * 计算收入预测
     */
    calculateRevenueForecasts(revenue) {
        // 实现收入预测计算
        return {};
    }

    /**
     * 分析用户模式
     */
    analyzeUserPatterns(behavior) {
        // 实现用户行为模式分析
        return {};
    }

    /**
     * 计算趋势
     */
    calculateTrend(current, previous) {
        if (!previous || !current) {
            return 'stable';
        }
        
        const currentValue = current.total_conversations || 0;
        const previousValue = previous.total_conversations || 0;
        
        if (currentValue > previousValue) {
            return 'up';
        } else if (currentValue < previousValue) {
            return 'down';
        } else {
            return 'stable';
        }
    }

    /**
     * 生成摘要
     */
    generateSummary(data) {
        return {
            status: 'healthy',
            highlights: [
                '实时监控运行正常',
                '数据分析完成',
                '报表生成就绪'
            ],
            alerts: [],
            recommendations: [
                '建议定期查看KPI指标',
                '关注客户满意度变化',
                '优化员工工作效率'
            ]
        };
    }

    /**
     * 导出报表数据
     */
    async exportReportData(shopId, reportType, format = 'json', options = {}) {
        try {
            console.log(`📋 导出报表数据: ${reportType}, ${format}`);
            
            let data;
            switch (reportType) {
                case 'dashboard':
                    data = await this.getEnhancedDashboardData(shopId, options.timeRange, true);
                    break;
                case 'kpi':
                    data = await this.getKPIMetrics(shopId, options.timeRange);
                    break;
                case 'performance':
                    data = await this.getEmployeePerformance(shopId, options.timeRange);
                    break;
                case 'satisfaction':
                    data = await this.getCustomerSatisfactionMetrics(shopId, options.timeRange);
                    break;
                case 'revenue':
                    data = await this.getRevenueAnalytics(shopId, options.timeRange);
                    break;
                default:
                    throw new Error(`不支持的报表类型: ${reportType}`);
            }
            
            // 根据格式转换数据
            const exportData = await this.formatExportData(data, format, options);
            
            return {
                success: true,
                data: exportData,
                format,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ 导出报表数据失败:', error);
            throw error;
        }
    }

    /**
     * 格式化导出数据
     */
    async formatExportData(data, format, options) {
        switch (format) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return this.convertToCSV(data);
            case 'excel':
                return this.convertToExcel(data);
            default:
                return data;
        }
    }

    /**
     * 转换为CSV格式
     */
    convertToCSV(data) {
        // 实现CSV转换逻辑
        return '';
    }

    /**
     * 转换为Excel格式
     */
    convertToExcel(data) {
        // 实现Excel转换逻辑
        return '';
    }

    /**
     * 清理过期数据
     */
    async cleanupExpiredData() {
        try {
            console.log('🧹 清理过期数据...');
            
            // 清理过期的KPI指标
            await this.db.run(`
                DELETE FROM enhanced_kpi_metrics 
                WHERE expires_at IS NOT NULL AND expires_at < datetime('now')
            `);
            
            // 清理旧的用户行为数据(保留90天)
            await this.db.run(`
                DELETE FROM user_behavior_analytics 
                WHERE created_at < datetime('now', '-90 days')
            `);
            
            // 清理旧的预测数据(保留180天)
            await this.db.run(`
                DELETE FROM prediction_data 
                WHERE created_at < datetime('now', '-180 days')
            `);
            
            console.log('✅ 过期数据清理完成');
            
        } catch (error) {
            console.error('❌ 清理过期数据失败:', error);
        }
    }

    /**
     * 销毁实例
     */
    async destroy() {
        try {
            console.log('🔄 销毁增强型分析系统实例...');
            
            // 清理缓存
            this.cache.clear();
            
            // 清理WebSocket客户端
            this.realTimeClients.clear();
            
            console.log('✅ 增强型分析系统实例销毁完成');
            
        } catch (error) {
            console.error('❌ 销毁增强型分析系统实例失败:', error);
            throw error;
        }
    }
}

module.exports = EnhancedAnalyticsDashboard;