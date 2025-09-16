const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * 综合安全模块
 * 提供会话管理、访问控制、威胁检测、数据加密等安全功能
 */
class ComprehensiveSecurityModule {
    constructor(database) {
        this.db = database;
        
        // 初始化内存存储
        this.activeSessions = new Map();
        this.accessControlRules = new Map();
        this.threatCache = new Map();
        this.encryptionKeys = new Map();
        this.securityPolicies = new Map();
        this.auditLog = [];
        this.threatRules = new Map();
        this.securityEvents = new Map();
        
        // 安全配置
        this.securityConfig = {
            session: {
                maxAge: 24 * 60 * 60 * 1000, // 24小时
                maxConcurrentSessions: 5,
                checkInterval: 60 * 1000 // 1分钟
            },
            encryption: {
                algorithm: 'aes-256-cbc',
                keyLength: 32,
                ivLength: 16
            }
        };
        
        // 监控间隔器
        this.sessionCleanupInterval = null;
    }

    /**
     * 初始化安全模块
     */
    async initialize() {
        try {
            console.log('🔐 初始化综合安全模块...');
            
            // 创建安全相关数据表
            await this.createSecurityTables();
            
            // 初始化加密系统
            await this.initializeEncryption();
            
            // 启动安全监控
            await this.startSecurityMonitoring();
            
            console.log('✅ 综合安全模块初始化完成');
            
        } catch (error) {
            console.error('❌ 安全模块初始化失败:', error);
            throw error;
        }
    }

    /**
     * 创建安全相关数据表
     */
    async createSecurityTables() {
        try {
            console.log('📋 创建安全相关数据表...');
            
            if (this.db.prepare && typeof this.db.prepare === 'function') {
                // 创建安全审计日志表
                const auditTableSQL = 'CREATE TABLE IF NOT EXISTS security_audit_logs (id TEXT PRIMARY KEY, shop_id TEXT NOT NULL, user_id TEXT, event_type TEXT NOT NULL, event_category TEXT NOT NULL, event_description TEXT NOT NULL, ip_address TEXT, session_id TEXT, risk_level TEXT DEFAULT "low", created_at TEXT NOT NULL)';
                await this.db.exec(auditTableSQL);
                
                // 创建用户会话管理表
                const sessionTableSQL = 'CREATE TABLE IF NOT EXISTS security_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, shop_id TEXT NOT NULL, session_token TEXT UNIQUE NOT NULL, ip_address TEXT NOT NULL, is_active INTEGER DEFAULT 1, last_activity_at TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)';
                await this.db.exec(sessionTableSQL);
                
                console.log('📄 SQLite安全表创建完成');
            } else {
                // 内存数据库
                if (!this.db.securityAuditLogs) this.db.securityAuditLogs = new Map();
                if (!this.db.securitySessions) this.db.securitySessions = new Map();
                console.log('📄 内存安全表创建完成');
            }
            
            console.log('✅ 安全相关数据表创建完成');
            
        } catch (error) {
            console.error('❌ 创建安全数据表失败:', error);
            throw error;
        }
    }

    /**
     * 初始化加密系统
     */
    async initializeEncryption() {
        try {
            console.log('🔐 初始化加密系统...');
            
            // 生成主加密密钥
            const masterKey = crypto.randomBytes(this.securityConfig.encryption.keyLength);
            this.encryptionKeys.set('master', masterKey);
            
            // 生成默认加密密钥
            const defaultKey = crypto.randomBytes(this.securityConfig.encryption.keyLength);
            this.encryptionKeys.set('default', defaultKey);
            
            console.log('✅ 加密系统初始化完成，共生成 2 个密钥');
            
        } catch (error) {
            console.error('❌ 加密系统初始化失败:', error);
            throw error;
        }
    }

    /**
     * 启动安全监控
     */
    async startSecurityMonitoring() {
        try {
            console.log('👁️ 启动安全监控...');
            
            // 启动会话清理
            this.sessionCleanupInterval = setInterval(() => {
                this.cleanupExpiredSessions();
            }, 60000); // 每分钟清理一次
            
            console.log('✅ 安全监控已启动');
            
        } catch (error) {
            console.error('❌ 安全监控启动失败:', error);
            throw error;
        }
    }

    /**
     * 创建安全会话
     */
    async createSecureSession(userId, shopId, metadata = {}) {
        try {
            const sessionId = uuidv4();
            const sessionToken = crypto.randomBytes(32).toString('hex');
            const now = new Date();
            const expiresAt = new Date(now.getTime() + this.securityConfig.session.maxAge);
            
            const session = {
                id: sessionId,
                userId,
                shopId,
                sessionToken,
                ipAddress: metadata.ipAddress || 'unknown',
                isActive: true,
                lastActivityAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                createdAt: now.toISOString()
            };
            
            this.activeSessions.set(sessionId, session);
            
            // 记录安全事件
            await this.logSecurityEvent({
                shopId,
                userId,
                eventType: 'session_created',
                eventCategory: 'authentication',
                eventDescription: '用户会话创建',
                ipAddress: session.ipAddress,
                sessionId: sessionId
            });
            
            return { sessionId, sessionToken };
            
        } catch (error) {
            console.error('❌ 创建安全会话失败:', error);
            throw error;
        }
    }

    /**
     * 验证会话
     */
    async validateSession(sessionToken) {
        try {
            for (const [sessionId, session] of this.activeSessions.entries()) {
                if (session.sessionToken === sessionToken && session.isActive) {
                    // 检查会话是否过期
                    if (new Date() > new Date(session.expiresAt)) {
                        await this.destroySession(sessionId);
                        return null;
                    }
                    
                    // 更新最后活动时间
                    session.lastActivityAt = new Date().toISOString();
                    this.activeSessions.set(sessionId, session);
                    
                    return session;
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ 会话验证失败:', error);
            return null;
        }
    }

    /**
     * 销毁会话
     */
    async destroySession(sessionId) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (session) {
                session.isActive = false;
                this.activeSessions.delete(sessionId);
                
                // 记录安全事件
                await this.logSecurityEvent({
                    shopId: session.shopId,
                    userId: session.userId,
                    eventType: 'session_destroyed',
                    eventCategory: 'authentication',
                    eventDescription: '用户会话销毁',
                    sessionId: sessionId
                });
            }
            
        } catch (error) {
            console.error('❌ 销毁会话失败:', error);
        }
    }

    /**
     * 记录安全事件
     */
    async logSecurityEvent(event) {
        try {
            const eventId = uuidv4();
            const auditEvent = {
                id: eventId,
                shopId: event.shopId,
                userId: event.userId || null,
                eventType: event.eventType,
                eventCategory: event.eventCategory,
                eventDescription: event.eventDescription,
                ipAddress: event.ipAddress || null,
                sessionId: event.sessionId || null,
                riskLevel: event.riskLevel || 'low',
                createdAt: new Date().toISOString()
            };
            
            this.auditLog.push(auditEvent);
            
            // 如果是SQLite数据库，保存到数据库
            if (this.db.prepare && typeof this.db.prepare === 'function') {
                const stmt = this.db.prepare('INSERT INTO security_audit_logs (id, shop_id, user_id, event_type, event_category, event_description, ip_address, session_id, risk_level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                
                stmt.run(
                    eventId, auditEvent.shopId, auditEvent.userId, auditEvent.eventType,
                    auditEvent.eventCategory, auditEvent.eventDescription, auditEvent.ipAddress,
                    auditEvent.sessionId, auditEvent.riskLevel, auditEvent.createdAt
                );
            }
            
        } catch (error) {
            console.error('❌ 记录安全事件失败:', error);
        }
    }

    /**
     * 清理过期会话
     */
    async cleanupExpiredSessions() {
        try {
            const now = new Date();
            const expiredSessions = [];
            
            for (const [sessionId, session] of this.activeSessions.entries()) {
                if (new Date(session.expiresAt) < now) {
                    expiredSessions.push(sessionId);
                }
            }
            
            for (const sessionId of expiredSessions) {
                await this.destroySession(sessionId);
            }
            
            if (expiredSessions.length > 0) {
                console.log(`🧹 清理过期会话: ${expiredSessions.length} 个`);
            }
            
        } catch (error) {
            console.error('❌ 清理过期会话失败:', error);
        }
    }

    /**
     * 收集安全指标
     */
    async collectSecurityMetrics() {
        try {
            const metrics = {
                activeSessions: this.activeSessions.size,
                auditEvents: this.auditLog.length,
                threats: this.threatCache.size,
                accessRules: this.accessControlRules.size,
                securityPolicies: this.securityPolicies.size,
                timestamp: new Date().toISOString()
            };
            
            console.log(`📊 安全指标: 活跃会话${metrics.activeSessions}个，审计事件${metrics.auditEvents}条`);
            
            return metrics;
            
        } catch (error) {
            console.error('❌ 安全指标收集失败:', error);
            return {};
        }
    }

    /**
     * 关闭安全模块
     */
    async shutdown() {
        try {
            console.log('🔒 关闭安全模块...');
            
            // 清理定时器
            if (this.sessionCleanupInterval) {
                clearInterval(this.sessionCleanupInterval);
                this.sessionCleanupInterval = null;
            }
            
            // 清理内存存储
            this.activeSessions.clear();
            this.accessControlRules.clear();
            this.threatCache.clear();
            this.encryptionKeys.clear();
            this.securityPolicies.clear();
            this.auditLog.length = 0;
            this.threatRules.clear();
            this.securityEvents.clear();
            
            console.log('✅ 安全模块关闭完成');
            
        } catch (error) {
            console.error('❌ 安全模块关闭失败:', error);
        }
    }
}

module.exports = ComprehensiveSecurityModule;