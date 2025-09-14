/**
 * 高级通知系统
 * 支持实时通知、多渠道推送、通知模板、订阅管理、统计分析等功能
 */
class AdvancedNotificationSystem {
    constructor(database, webSocketManager) {
        this.db = database;
        this.wsManager = webSocketManager;
        
        // 通知渠道
        this.channels = new Map();
        
        // 通知模板
        this.templates = new Map();
        
        // 订阅管理
        this.subscriptions = new Map();
        
        // 通知队列
        this.notificationQueue = [];
        this.processingQueue = false;
        
        // 统计数据
        this.stats = {
            totalSent: 0,
            totalDelivered: 0,
            totalFailed: 0,
            channelStats: new Map(),
            lastUpdated: new Date().toISOString()
        };
        
        // 配置
        this.config = {
            maxRetries: 3,
            retryDelay: 5000,
            batchSize: 100,
            queueProcessInterval: 1000,
            enableWebSocket: true,
            enableEmail: true,
            enableSMS: false,
            enablePush: true
        };
        
        console.log('📡 高级通知系统初始化...');
    }

    /**
     * 初始化通知系统
     */
    async initialize() {
        try {
            console.log('🚀 开始初始化高级通知系统...');
            
            // 1. 创建数据表
            await this.createNotificationTables();
            
            // 2. 初始化通知渠道
            await this.initializeChannels();
            
            // 3. 加载通知模板
            await this.loadTemplates();
            
            // 4. 启动队列处理器
            this.startQueueProcessor();
            
            // 5. 加载订阅数据
            await this.loadSubscriptions();
            
            console.log('✅ 高级通知系统初始化完成');
            return true;
            
        } catch (error) {
            console.error('❌ 高级通知系统初始化失败:', error);
            throw error;
        }
    }

    /**
     * 创建通知相关数据表
     */
    async createNotificationTables() {
        try {
            console.log('📋 创建通知相关数据表...');
            
            if (this.db.prepare && typeof this.db.prepare === 'function') {
                // SQLite数据库
                await this.db.exec(`
                    -- 通知记录表
                    CREATE TABLE IF NOT EXISTS notifications (
                        id TEXT PRIMARY KEY,
                        shop_id TEXT NOT NULL,
                        user_id TEXT,
                        title TEXT NOT NULL,
                        message TEXT NOT NULL,
                        type TEXT NOT NULL,
                        priority TEXT DEFAULT 'normal',
                        channels TEXT NOT NULL,
                        template_id TEXT,
                        metadata TEXT,
                        status TEXT DEFAULT 'pending',
                        retry_count INTEGER DEFAULT 0,
                        scheduled_at TEXT,
                        sent_at TEXT,
                        delivered_at TEXT,
                        failed_at TEXT,
                        error_message TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );
                    
                    -- 通知模板表
                    CREATE TABLE IF NOT EXISTS notification_templates (
                        id TEXT PRIMARY KEY,
                        shop_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        title TEXT NOT NULL,
                        content TEXT NOT NULL,
                        type TEXT NOT NULL,
                        channels TEXT NOT NULL,
                        variables TEXT,
                        is_active INTEGER DEFAULT 1,
                        created_by TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );
                    
                    -- 订阅管理表
                    CREATE TABLE IF NOT EXISTS notification_subscriptions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT NOT NULL,
                        shop_id TEXT NOT NULL,
                        channel TEXT NOT NULL,
                        type TEXT NOT NULL,
                        is_enabled INTEGER DEFAULT 1,
                        settings TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        UNIQUE(user_id, shop_id, channel, type)
                    );
                    
                    -- 通知统计表
                    CREATE TABLE IF NOT EXISTS notification_stats (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        shop_id TEXT NOT NULL,
                        date TEXT NOT NULL,
                        channel TEXT NOT NULL,
                        type TEXT NOT NULL,
                        sent_count INTEGER DEFAULT 0,
                        delivered_count INTEGER DEFAULT 0,
                        failed_count INTEGER DEFAULT 0,
                        click_count INTEGER DEFAULT 0,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        UNIQUE(shop_id, date, channel, type)
                    );
                    
                    -- 通知设备表
                    CREATE TABLE IF NOT EXISTS notification_devices (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        shop_id TEXT NOT NULL,
                        device_type TEXT NOT NULL,
                        device_token TEXT NOT NULL,
                        platform TEXT NOT NULL,
                        is_active INTEGER DEFAULT 1,
                        last_used_at TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );
                `);
                
                console.log('📄 通知记录表创建完成');
                console.log('🎨 通知模板表创建完成');
                console.log('📢 订阅管理表创建完成');
                console.log('📊 通知统计表创建完成');
                console.log('📱 通知设备表创建完成');
                
            } else {
                // 内存数据库
                this.db.notifications = this.db.notifications || new Map();
                this.db.notificationTemplates = this.db.notificationTemplates || new Map();
                this.db.notificationSubscriptions = this.db.notificationSubscriptions || new Map();
                this.db.notificationStats = this.db.notificationStats || new Map();
                this.db.notificationDevices = this.db.notificationDevices || new Map();
                
                console.log('💾 内存数据库通知表初始化完成');
            }
            
            // 创建索引
            await this.createNotificationIndexes();
            
            console.log('✅ 通知相关数据表创建完成');
            
        } catch (error) {
            console.error('❌ 创建通知数据表失败:', error);
            throw error;
        }
    }

    /**
     * 创建通知相关索引
     */
    async createNotificationIndexes() {
        try {
            console.log('📇 创建通知相关索引...');
            
            if (this.db.run && typeof this.db.run === 'function') {
                const indexes = [
                    'CREATE INDEX IF NOT EXISTS idx_notifications_shop_user ON notifications(shop_id, user_id)',
                    'CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status)',
                    'CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_at)',
                    'CREATE INDEX IF NOT EXISTS idx_templates_shop_type ON notification_templates(shop_id, type)',
                    'CREATE INDEX IF NOT EXISTS idx_subscriptions_user_shop ON notification_subscriptions(user_id, shop_id)',
                    'CREATE INDEX IF NOT EXISTS idx_stats_shop_date ON notification_stats(shop_id, date)',
                    'CREATE INDEX IF NOT EXISTS idx_devices_user_active ON notification_devices(user_id, is_active)'
                ];
                
                for (const indexSql of indexes) {
                    await this.db.run(indexSql);
                }
            }
            
            console.log('✅ 通知相关索引创建完成');
            
        } catch (error) {
            console.error('❌ 创建通知索引失败:', error);
            throw error;
        }
    }

    /**
     * 初始化通知渠道
     */
    async initializeChannels() {
        try {
            console.log('📡 初始化通知渠道...');
            
            // WebSocket 实时通知
            if (this.config.enableWebSocket) {
                this.channels.set('websocket', {
                    name: 'WebSocket实时通知',
                    enabled: true,
                    priority: 1,
                    handler: this.sendWebSocketNotification.bind(this),
                    config: {
                        timeout: 5000,
                        retryOnError: true
                    }
                });
                console.log('🔌 WebSocket通知渠道已启用');
            }
            
            // 邮件通知
            if (this.config.enableEmail) {
                this.channels.set('email', {
                    name: '邮件通知',
                    enabled: true,
                    priority: 2,
                    handler: this.sendEmailNotification.bind(this),
                    config: {
                        smtpHost: process.env.SMTP_HOST || 'localhost',
                        smtpPort: process.env.SMTP_PORT || 587,
                        smtpUser: process.env.SMTP_USER || '',
                        smtpPass: process.env.SMTP_PASS || '',
                        fromAddress: process.env.SMTP_FROM || 'noreply@example.com'
                    }
                });
                console.log('📧 邮件通知渠道已启用');
            }
            
            // 短信通知 (模拟)
            if (this.config.enableSMS) {
                this.channels.set('sms', {
                    name: '短信通知',
                    enabled: false, // 需要配置短信服务商
                    priority: 3,
                    handler: this.sendSMSNotification.bind(this),
                    config: {
                        apiKey: process.env.SMS_API_KEY || '',
                        apiSecret: process.env.SMS_API_SECRET || '',
                        signName: process.env.SMS_SIGN_NAME || '客服系统'
                    }
                });
                console.log('📱 短信通知渠道已配置 (需要API密钥)');
            }
            
            // 推送通知 (模拟)
            if (this.config.enablePush) {
                this.channels.set('push', {
                    name: '推送通知',
                    enabled: true,
                    priority: 2,
                    handler: this.sendPushNotification.bind(this),
                    config: {
                        fcmServerKey: process.env.FCM_SERVER_KEY || '',
                        apnsCertificate: process.env.APNS_CERTIFICATE || ''
                    }
                });
                console.log('🔔 推送通知渠道已启用');
            }
            
            console.log(`✅ 通知渠道初始化完成，共启用 ${this.channels.size} 个渠道`);
            
        } catch (error) {
            console.error('❌ 初始化通知渠道失败:', error);
            throw error;
        }
    }

    /**
     * 加载通知模板
     */
    async loadTemplates() {
        try {
            console.log('🎨 加载通知模板...');
            
            // 默认模板
            const defaultTemplates = [
                {
                    id: 'welcome',
                    name: '欢迎消息',
                    title: '欢迎来到 {{shopName}}',
                    content: '欢迎您，{{userName}}！感谢您选择我们的服务。如有任何问题，请随时联系我们。',
                    type: 'system',
                    channels: ['websocket', 'email'],
                    variables: ['shopName', 'userName']
                },
                {
                    id: 'new_message',
                    name: '新消息通知',
                    title: '您有新消息',
                    content: '{{senderName}} 向您发送了新消息：{{messagePreview}}',
                    type: 'message',
                    channels: ['websocket', 'push'],
                    variables: ['senderName', 'messagePreview']
                },
                {
                    id: 'order_update',
                    name: '订单更新',
                    title: '订单状态更新',
                    content: '您的订单 {{orderNumber}} 状态已更新为：{{status}}',
                    type: 'order',
                    channels: ['websocket', 'email', 'sms'],
                    variables: ['orderNumber', 'status']
                },
                {
                    id: 'system_maintenance',
                    name: '系统维护通知',
                    title: '系统维护通知',
                    content: '系统将于 {{maintenanceTime}} 进行维护，预计耗时 {{duration}}，请提前做好准备。',
                    type: 'system',
                    channels: ['websocket', 'email'],
                    variables: ['maintenanceTime', 'duration']
                }
            ];
            
            for (const template of defaultTemplates) {
                this.templates.set(template.id, {
                    ...template,
                    shopId: 'default',
                    isActive: true,
                    createdBy: 'system',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
            
            console.log(`✅ 通知模板加载完成，共 ${this.templates.size} 个模板`);
            
        } catch (error) {
            console.error('❌ 加载通知模板失败:', error);
            throw error;
        }
    }

    /**
     * 启动队列处理器
     */
    startQueueProcessor() {
        try {
            console.log('⚙️ 启动通知队列处理器...');
            
            setInterval(() => {
                if (!this.processingQueue && this.notificationQueue.length > 0) {
                    this.processNotificationQueue();
                }
            }, this.config.queueProcessInterval);
            
            console.log('✅ 通知队列处理器已启动');
            
        } catch (error) {
            console.error('❌ 启动队列处理器失败:', error);
            throw error;
        }
    }

    /**
     * 加载订阅数据
     */
    async loadSubscriptions() {
        try {
            console.log('📢 加载用户订阅设置...');
            
            // 默认订阅设置
            const defaultSubscriptions = [
                {
                    type: 'message',
                    channels: ['websocket', 'push'],
                    enabled: true
                },
                {
                    type: 'order',
                    channels: ['websocket', 'email'],
                    enabled: true
                },
                {
                    type: 'system',
                    channels: ['websocket'],
                    enabled: true
                }
            ];
            
            // 存储默认设置
            for (const subscription of defaultSubscriptions) {
                const key = `default_${subscription.type}`;
                this.subscriptions.set(key, subscription);
            }
            
            console.log('✅ 订阅设置加载完成');
            
        } catch (error) {
            console.error('❌ 加载订阅数据失败:', error);
            throw error;
        }
    }

    /**
     * 发送通知
     */
    async sendNotification(notificationData) {
        try {
            const {
                shopId,
                userId,
                title,
                message,
                type = 'general',
                priority = 'normal',
                channels = ['websocket'],
                templateId = null,
                templateData = {},
                scheduledAt = null,
                metadata = {}
            } = notificationData;
            
            // 生成通知ID
            const notificationId = 'notification_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // 处理模板
            let processedTitle = title;
            let processedMessage = message;
            
            if (templateId && this.templates.has(templateId)) {
                const template = this.templates.get(templateId);
                processedTitle = this.processTemplate(template.title, templateData);
                processedMessage = this.processTemplate(template.content, templateData);
            }
            
            // 创建通知记录
            const notification = {
                id: notificationId,
                shopId,
                userId,
                title: processedTitle,
                message: processedMessage,
                type,
                priority,
                channels: JSON.stringify(channels),
                templateId,
                metadata: JSON.stringify(metadata),
                status: scheduledAt ? 'scheduled' : 'pending',
                retryCount: 0,
                scheduledAt,
                sentAt: null,
                deliveredAt: null,
                failedAt: null,
                errorMessage: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // 添加到队列
            if (scheduledAt && new Date(scheduledAt) > new Date()) {
                // 定时通知
                this.notificationQueue.push(notification);
                console.log(`⏰ 定时通知已添加到队列: ${notificationId}`);
            } else {
                // 立即发送
                this.notificationQueue.unshift(notification);
                console.log(`📤 通知已添加到队列: ${notificationId}`);
            }
            
            return {
                success: true,
                notificationId,
                message: '通知已添加到发送队列'
            };
            
        } catch (error) {
            console.error('❌ 发送通知失败:', error);
            throw error;
        }
    }

    /**
     * 处理通知队列
     */
    async processNotificationQueue() {
        if (this.processingQueue || this.notificationQueue.length === 0) {
            return;
        }
        
        this.processingQueue = true;
        
        try {
            const batchSize = Math.min(this.config.batchSize, this.notificationQueue.length);
            const batch = this.notificationQueue.splice(0, batchSize);
            
            console.log(`📋 处理通知队列，批次大小: ${batch.length}`);
            
            for (const notification of batch) {
                await this.processNotification(notification);
            }
            
        } catch (error) {
            console.error('❌ 处理通知队列失败:', error);
        } finally {
            this.processingQueue = false;
        }
    }

    /**
     * 处理单个通知
     */
    async processNotification(notification) {
        try {
            // 检查是否为定时通知
            if (notification.scheduledAt && new Date(notification.scheduledAt) > new Date()) {
                // 重新添加到队列末尾
                this.notificationQueue.push(notification);
                return;
            }
            
            // 检查用户订阅设置
            if (notification.userId) {
                const subscriptionKey = `${notification.userId}_${notification.shopId}_${notification.type}`;
                const userSubscription = this.subscriptions.get(subscriptionKey);
                
                if (userSubscription && !userSubscription.enabled) {
                    console.log(`⏭️ 用户已取消订阅该类型通知: ${notification.id}`);
                    return;
                }
            }
            
            let channels;
            try {
                channels = typeof notification.channels === 'string' 
                    ? JSON.parse(notification.channels) 
                    : notification.channels;
            } catch (error) {
                console.warn(`⚠️ 通知 ${notification.id} 渠道数据格式错误:`, error.message);
                channels = ['websocket']; // 使用默认渠道
            }
            
            const results = [];
            
            // 通过各个渠道发送
            for (const channelName of channels) {
                if (this.channels.has(channelName)) {
                    const channel = this.channels.get(channelName);
                    
                    if (channel.enabled) {
                        try {
                            const result = await channel.handler(notification, channel.config);
                            results.push({ channel: channelName, success: true, result });
                            
                            // 更新统计
                            this.updateChannelStats(notification.shopId, channelName, notification.type, 'sent');
                            
                        } catch (error) {
                            console.error(`❌ 通过 ${channelName} 发送通知失败:`, error);
                            results.push({ channel: channelName, success: false, error: error.message });
                            
                            this.updateChannelStats(notification.shopId, channelName, notification.type, 'failed');
                        }
                    } else {
                        console.log(`⚠️ 通道 ${channelName} 已禁用`);
                    }
                } else {
                    console.log(`⚠️ 未知通道: ${channelName}`);
                }
            }
            
            // 更新通知状态
            const successCount = results.filter(r => r.success).length;
            if (successCount > 0) {
                notification.status = successCount === results.length ? 'delivered' : 'partial';
                notification.deliveredAt = new Date().toISOString();
                this.stats.totalDelivered++;
            } else {
                notification.status = 'failed';
                notification.failedAt = new Date().toISOString();
                notification.retryCount++;
                
                // 重试逻辑
                if (notification.retryCount < this.config.maxRetries) {
                    setTimeout(() => {
                        this.notificationQueue.push(notification);
                    }, this.config.retryDelay);
                } else {
                    this.stats.totalFailed++;
                }
            }
            
            notification.updatedAt = new Date().toISOString();
            this.stats.totalSent++;
            
            console.log(`📤 通知处理完成: ${notification.id} (${notification.status})`);
            
        } catch (error) {
            console.error('❌ 处理通知失败:', error);
        }
    }

    /**
     * WebSocket 通知发送器
     */
    async sendWebSocketNotification(notification, config) {
        try {
            if (!this.wsManager) {
                throw new Error('WebSocket管理器未初始化');
            }
            
            const notificationData = {
                type: 'notification',
                id: notification.id,
                title: notification.title,
                message: notification.message,
                notificationType: notification.type,
                priority: notification.priority,
                timestamp: new Date().toISOString(),
                metadata: JSON.parse(notification.metadata || '{}')
            };
            
            // 发送给特定用户
            if (notification.userId) {
                const sent = this.wsManager.sendToUser(notification.userId, notificationData);
                if (!sent) {
                    throw new Error('用户不在线或连接不存在');
                }
            } else {
                // 广播给店铺所有用户
                this.wsManager.broadcastToShop(notification.shopId, notificationData);
            }
            
            console.log(`🔌 WebSocket通知发送成功: ${notification.id}`);
            return { delivered: true, timestamp: new Date().toISOString() };
            
        } catch (error) {
            console.error('❌ WebSocket通知发送失败:', error);
            throw error;
        }
    }

    /**
     * 邮件通知发送器 (模拟)
     */
    async sendEmailNotification(notification, config) {
        try {
            // 模拟邮件发送
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log(`📧 邮件通知发送成功: ${notification.id}`);
            console.log(`   收件人: ${notification.userId}`);
            console.log(`   主题: ${notification.title}`);
            console.log(`   内容: ${notification.message.substring(0, 50)}...`);
            
            return { 
                delivered: true, 
                timestamp: new Date().toISOString(),
                messageId: 'email_' + Date.now()
            };
            
        } catch (error) {
            console.error('❌ 邮件通知发送失败:', error);
            throw error;
        }
    }

    /**
     * 短信通知发送器 (模拟)
     */
    async sendSMSNotification(notification, config) {
        try {
            // 模拟短信发送
            await new Promise(resolve => setTimeout(resolve, 800));
            
            console.log(`📱 短信通知发送成功: ${notification.id}`);
            console.log(`   收件人: ${notification.userId}`);
            console.log(`   内容: ${notification.message.substring(0, 50)}...`);
            
            return { 
                delivered: true, 
                timestamp: new Date().toISOString(),
                messageId: 'sms_' + Date.now()
            };
            
        } catch (error) {
            console.error('❌ 短信通知发送失败:', error);
            throw error;
        }
    }

    /**
     * 推送通知发送器 (模拟)
     */
    async sendPushNotification(notification, config) {
        try {
            // 模拟推送通知
            await new Promise(resolve => setTimeout(resolve, 600));
            
            console.log(`🔔 推送通知发送成功: ${notification.id}`);
            console.log(`   标题: ${notification.title}`);
            console.log(`   内容: ${notification.message.substring(0, 50)}...`);
            
            return { 
                delivered: true, 
                timestamp: new Date().toISOString(),
                messageId: 'push_' + Date.now()
            };
            
        } catch (error) {
            console.error('❌ 推送通知发送失败:', error);
            throw error;
        }
    }

    /**
     * 处理模板变量
     */
    processTemplate(template, data) {
        let processed = template;
        
        for (const [key, value] of Object.entries(data)) {
            const placeholder = `{{${key}}}`;
            processed = processed.replace(new RegExp(placeholder, 'g'), value);
        }
        
        return processed;
    }

    /**
     * 更新渠道统计
     */
    updateChannelStats(shopId, channel, type, action) {
        const key = `${shopId}_${channel}_${type}`;
        
        if (!this.stats.channelStats.has(key)) {
            this.stats.channelStats.set(key, {
                shopId,
                channel,
                type,
                sent: 0,
                delivered: 0,
                failed: 0,
                lastUpdated: new Date().toISOString()
            });
        }
        
        const stats = this.stats.channelStats.get(key);
        
        switch (action) {
            case 'sent':
                stats.sent++;
                break;
            case 'delivered':
                stats.delivered++;
                break;
            case 'failed':
                stats.failed++;
                break;
        }
        
        stats.lastUpdated = new Date().toISOString();
        this.stats.lastUpdated = new Date().toISOString();
    }

    /**
     * 获取通知统计
     */
    async getNotificationStats(shopId, options = {}) {
        try {
            const { startDate, endDate, channel, type } = options;
            
            const stats = {
                shopId,
                totalStats: {
                    sent: this.stats.totalSent,
                    delivered: this.stats.totalDelivered,
                    failed: this.stats.totalFailed,
                    successRate: this.stats.totalSent > 0 ? 
                        ((this.stats.totalDelivered / this.stats.totalSent) * 100).toFixed(2) + '%' : '0%'
                },
                channelStats: [],
                typeStats: [],
                queueStatus: {
                    pending: this.notificationQueue.length,
                    processing: this.processingQueue
                },
                lastUpdated: this.stats.lastUpdated
            };
            
            // 渠道统计
            for (const [key, channelStat] of this.stats.channelStats.entries()) {
                if (channelStat.shopId === shopId) {
                    if (!channel || channelStat.channel === channel) {
                        if (!type || channelStat.type === type) {
                            stats.channelStats.push(channelStat);
                        }
                    }
                }
            }
            
            // 类型统计汇总
            const typeMap = new Map();
            for (const channelStat of stats.channelStats) {
                if (!typeMap.has(channelStat.type)) {
                    typeMap.set(channelStat.type, {
                        type: channelStat.type,
                        sent: 0,
                        delivered: 0,
                        failed: 0
                    });
                }
                
                const typeStat = typeMap.get(channelStat.type);
                typeStat.sent += channelStat.sent;
                typeStat.delivered += channelStat.delivered;
                typeStat.failed += channelStat.failed;
            }
            
            stats.typeStats = Array.from(typeMap.values());
            
            return {
                success: true,
                stats
            };
            
        } catch (error) {
            console.error('❌ 获取通知统计失败:', error);
            throw error;
        }
    }

    /**
     * 管理用户订阅
     */
    async manageSubscription(userId, shopId, subscriptionData) {
        try {
            const { type, channels, enabled = true, settings = {} } = subscriptionData;
            
            const subscriptionKey = `${userId}_${shopId}_${type}`;
            
            this.subscriptions.set(subscriptionKey, {
                userId,
                shopId,
                type,
                channels,
                enabled,
                settings,
                updatedAt: new Date().toISOString()
            });
            
            console.log(`📢 用户订阅设置已更新: ${subscriptionKey}`);
            
            return {
                success: true,
                message: '订阅设置已更新'
            };
            
        } catch (error) {
            console.error('❌ 管理用户订阅失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户订阅设置
     */
    async getUserSubscriptions(userId, shopId) {
        try {
            const subscriptions = [];
            
            for (const [key, subscription] of this.subscriptions.entries()) {
                if (subscription.userId === userId && subscription.shopId === shopId) {
                    subscriptions.push(subscription);
                }
            }
            
            return {
                success: true,
                subscriptions
            };
            
        } catch (error) {
            console.error('❌ 获取用户订阅失败:', error);
            throw error;
        }
    }

    /**
     * 创建通知模板
     */
    async createTemplate(templateData) {
        try {
            const {
                shopId,
                name,
                title,
                content,
                type,
                channels = ['websocket'],
                variables = [],
                createdBy
            } = templateData;
            
            const templateId = 'template_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const template = {
                id: templateId,
                shopId,
                name,
                title,
                content,
                type,
                channels: JSON.stringify(channels),
                variables: JSON.stringify(variables),
                isActive: true,
                createdBy,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.templates.set(templateId, template);
            
            console.log(`🎨 通知模板创建成功: ${templateId}`);
            
            return {
                success: true,
                templateId,
                template
            };
            
        } catch (error) {
            console.error('❌ 创建通知模板失败:', error);
            throw error;
        }
    }

    /**
     * 获取通知模板列表
     */
    async getTemplates(shopId, options = {}) {
        try {
            const { type, isActive } = options;
            
            const templates = [];
            
            for (const [id, template] of this.templates.entries()) {
                if (template.shopId === shopId || template.shopId === 'default') {
                    if (!type || template.type === type) {
                        if (isActive === undefined || template.isActive === isActive) {
                            try {
                                templates.push({
                                    ...template,
                                    channels: typeof template.channels === 'string' 
                                        ? JSON.parse(template.channels) 
                                        : template.channels,
                                    variables: typeof template.variables === 'string' 
                                        ? JSON.parse(template.variables) 
                                        : template.variables
                                });
                            } catch (error) {
                                console.warn(`⚠️ 模板 ${id} 数据格式错误:`, error.message);
                                // 使用默认值替代有问题的数据
                                templates.push({
                                    ...template,
                                    channels: Array.isArray(template.channels) 
                                        ? template.channels 
                                        : ['websocket'],
                                    variables: Array.isArray(template.variables) 
                                        ? template.variables 
                                        : []
                                });
                            }
                        }
                    }
                }
            }
            
            return {
                success: true,
                templates
            };
            
        } catch (error) {
            console.error('❌ 获取通知模板失败:', error);
            throw error;
        }
    }
}

module.exports = AdvancedNotificationSystem;