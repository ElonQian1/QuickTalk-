/**
 * 综合安全模块
 * 提供全面的安全防护功能，包括访问控制、数据加密、审计日志、威胁检测等
 */
const crypto = require('crypto');
const bcrypt = require('bcrypt');

class ComprehensiveSecurityModule {
    constructor(database) {
        this.db = database;
        this.securityConfig = {
            encryption: {
                algorithm: 'aes-256-gcm',
                keyLength: 32,
                ivLength: 16,
                tagLength: 16
            },
            session: {
                timeout: 30 * 60 * 1000, // 30分钟
                refreshThreshold: 5 * 60 * 1000, // 5分钟
                maxConcurrentSessions: 5
            },
            password: {
                minLength: 8,
                requireUppercase: true,
                requireLowercase: true,
                requireNumbers: true,
                requireSpecialChars: true,
                maxAge: 90 * 24 * 60 * 60 * 1000, // 90天
                historyCount: 12
            },
            audit: {
                retentionDays: 365,
                criticalEvents: ['login', 'logout', 'password_change', 'permission_change', 'data_access', 'security_violation']
            },
            rateLimit: {
                windowMs: 15 * 60 * 1000, // 15分钟
                max: 100, // 限制每个IP 15分钟内最多100个请求
                loginMax: 5, // 登录尝试限制
                skipSuccessfulRequests: true
            },
            threat: {
                maxFailedLogins: 5,
                lockoutDuration: 15 * 60 * 1000, // 15分钟
                suspiciousActivityThreshold: 10
            }
        };
        
        // 安全状态缓存
        this.encryptionKeys = new Map();
        this.activeSessions = new Map();
        this.auditLog = [];
        this.threatCache = new Map();
        this.accessControlRules = new Map();
        this.securityPolicies = new Map();
        this.securityEvents = new Map();
        
        console.log('🛡️ 综合安全模块初始化...');
    }

    /**
     * 初始化安全模块
     */
    async initialize() {
        try {
            console.log('🚀 开始初始化综合安全系统...');
            
            // 1. 创建安全相关数据表
            await this.createSecurityTables();
            
            // 2. 初始化加密系统
            await this.initializeEncryption();
            
            // 3. 初始化访问控制
            await this.initializeAccessControl();
            
            // 4. 初始化审计系统
            await this.initializeAuditSystem();
            
            // 5. 初始化威胁检测
            await this.initializeThreatDetection();
            
            // 6. 加载安全策略
            await this.loadSecurityPolicies();
            
            // 7. 启动安全监控
            await this.startSecurityMonitoring();
            
            console.log('✅ 综合安全系统初始化完成');
            return { success: true, message: '安全系统初始化成功' };
            
        } catch (error) {
            console.error('❌ 综合安全系统初始化失败:', error);
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
                // SQLite数据库
                await this.db.exec(`
                    -- 安全事件日志表
                    CREATE TABLE IF NOT EXISTS security_audit_logs (
                        id TEXT PRIMARY KEY,
                        shop_id TEXT NOT NULL,
                        user_id TEXT,
                        event_type TEXT NOT NULL,
                        event_category TEXT NOT NULL,
                        event_description TEXT NOT NULL,
                        ip_address TEXT,
                        user_agent TEXT,
                        session_id TEXT,
                        resource_type TEXT,
                        resource_id TEXT,
                        risk_level TEXT DEFAULT 'low',
                        additional_data TEXT,
                        created_at TEXT NOT NULL,
                        INDEX(shop_id, event_type),
                        INDEX(user_id, created_at),
                        INDEX(event_category, risk_level)
                    );
                    
                    -- 用户会话管理表
                    CREATE TABLE IF NOT EXISTS security_sessions (
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
                    );
                    
                    -- 访问控制规则表
                    CREATE TABLE IF NOT EXISTS security_access_rules (
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
                    );
                    
                    -- 威胁检测记录表
                    CREATE TABLE IF NOT EXISTS security_threats (
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
                    );
                    
                    -- 加密密钥管理表
                    CREATE TABLE IF NOT EXISTS security_encryption_keys (
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
                    );
                    
                    -- 安全策略配置表
                    CREATE TABLE IF NOT EXISTS security_policies (
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
                        INDEX(shop_id, policy_type, is_active)
                    );
                `);
                
                console.log('📄 安全审计日志表创建完成');
                console.log('🔐 用户会话管理表创建完成');
                console.log('🛡️ 访问控制规则表创建完成');
                console.log('⚠️ 威胁检测记录表创建完成');
                console.log('🔑 加密密钥管理表创建完成');
                console.log('📋 安全策略配置表创建完成');
                
            } else {
                // 内存数据库
                if (!this.db.securityAuditLogs) this.db.securityAuditLogs = new Map();
                if (!this.db.securitySessions) this.db.securitySessions = new Map();
                if (!this.db.securityAccessRules) this.db.securityAccessRules = new Map();
                if (!this.db.securityThreats) this.db.securityThreats = new Map();
                if (!this.db.securityEncryptionKeys) this.db.securityEncryptionKeys = new Map();
                if (!this.db.securityPolicies) this.db.securityPolicies = new Map();
                
                console.log('📄 安全相关内存表创建完成');
            }
            
            // 创建安全索引
            await this.createSecurityIndexes();
            
            console.log('✅ 安全相关数据表创建完成');
            
        } catch (error) {
            console.error('❌ 创建安全数据表失败:', error);
            throw error;
        }
    }

    /**
     * 创建安全相关索引
     */
    async createSecurityIndexes() {
        try {
            console.log('📇 创建安全相关索引...');
            
            if (this.db.run && typeof this.db.run === 'function') {
                // 优化查询性能的索引
                const indexes = [
                    'CREATE INDEX IF NOT EXISTS idx_audit_shop_event ON security_audit_logs(shop_id, event_type)',
                    'CREATE INDEX IF NOT EXISTS idx_audit_user_time ON security_audit_logs(user_id, created_at)',
                    'CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON security_sessions(user_id, is_active)',
                    'CREATE INDEX IF NOT EXISTS idx_sessions_token ON security_sessions(session_token)',
                    'CREATE INDEX IF NOT EXISTS idx_threats_shop_level ON security_threats(shop_id, threat_level)',
                    'CREATE INDEX IF NOT EXISTS idx_keys_shop_type ON security_encryption_keys(shop_id, key_type, is_active)'
                ];
                
                for (const indexSQL of indexes) {
                    await this.db.run(indexSQL);
                }
            }
            
            console.log('✅ 安全相关索引创建完成');
            
        } catch (error) {
            console.error('❌ 创建安全索引失败:', error);
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
            
            // 初始化默认加密密钥
            await this.generateEncryptionKey('default', 'data_encryption');
            await this.generateEncryptionKey('session', 'session_encryption');
            await this.generateEncryptionKey('communication', 'api_encryption');
            
            console.log('✅ 加密系统初始化完成，共生成 4 个密钥');
            
        } catch (error) {
            console.error('❌ 加密系统初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化访问控制系统
     */
    async initializeAccessControl() {
        try {
            console.log('🔒 初始化访问控制系统...');
            
            // 加载默认访问控制规则
            const defaultRules = [
                {
                    name: '管理员全权限',
                    resourceType: '*',
                    resourcePattern: '*',
                    permissionType: '*',
                    allowedRoles: ['admin', 'super_admin'],
                    priority: 1000
                },
                {
                    name: '店主店铺权限',
                    resourceType: 'shop',
                    resourcePattern: '{shop_id}',
                    permissionType: '*',
                    allowedRoles: ['shop_owner'],
                    priority: 900
                },
                {
                    name: '员工基础权限',
                    resourceType: 'message',
                    resourcePattern: 'shop/{shop_id}/*',
                    permissionType: 'read,write',
                    allowedRoles: ['employee', 'customer_service'],
                    priority: 800
                },
                {
                    name: '用户个人数据权限',
                    resourceType: 'user_data',
                    resourcePattern: 'user/{user_id}/*',
                    permissionType: 'read,write',
                    allowedRoles: ['user'],
                    priority: 700
                }
            ];
            
            for (const rule of defaultRules) {
                await this.createAccessRule('default_shop', rule);
            }
            
            console.log('✅ 访问控制系统初始化完成，共加载 4 条规则');
            
        } catch (error) {
            console.error('❌ 访问控制系统初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化审计系统
     */
    async initializeAuditSystem() {
        try {
            console.log('📊 初始化审计系统...');
            
            // 设置审计策略
            this.auditConfig = {
                enabledEvents: this.securityConfig.audit.criticalEvents,
                logLevel: 'info',
                retentionDays: this.securityConfig.audit.retentionDays,
                alertThresholds: {
                    failedLogins: 5,
                    dataAccess: 50,
                    securityViolations: 1
                }
            };
            
            // 启动审计日志清理任务
            this.startAuditCleanup();
            
            console.log('✅ 审计系统初始化完成');
            
        } catch (error) {
            console.error('❌ 审计系统初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化威胁检测系统
     */
    async initializeThreatDetection() {
        try {
            console.log('⚡ 初始化威胁检测系统...');
            
            // 威胁检测规则
            this.threatRules = new Map();
            
            // 暴力破解检测
            this.threatRules.set('brute_force', {
                type: 'login_attempts',
                threshold: this.securityConfig.threat.maxFailedLogins,
                timeWindow: 15 * 60 * 1000, // 15分钟
                action: 'lock_account'
            });
            
            // 异常访问检测
            this.threatRules.set('anomaly_access', {
                type: 'access_pattern',
                threshold: this.securityConfig.threat.suspiciousActivityThreshold,
                timeWindow: 60 * 60 * 1000, // 1小时
                action: 'flag_suspicious'
            });
            
            // IP黑名单检测
            this.threatRules.set('ip_blacklist', {
                type: 'ip_reputation',
                blacklist: new Set(),
                action: 'block_request'
            });
            
            console.log('✅ 威胁检测系统初始化完成，共加载 3 个检测规则');
            
        } catch (error) {
            console.error('❌ 威胁检测系统初始化失败:', error);
            throw error;
        }
    }

    /**
     * 加载安全策略
     */
    async loadSecurityPolicies() {
        try {
            console.log('📋 加载安全策略...');
            
            // 默认安全策略
            const defaultPolicies = [
                {
                    name: '密码复杂度策略',
                    type: 'password_policy',
                    config: this.securityConfig.password
                },
                {
                    name: '会话管理策略',
                    type: 'session_policy',
                    config: this.securityConfig.session
                },
                {
                    name: '访问频率限制策略',
                    type: 'rate_limit_policy',
                    config: this.securityConfig.rateLimit
                },
                {
                    name: '数据加密策略',
                    type: 'encryption_policy',
                    config: this.securityConfig.encryption
                }
            ];
            
            for (const policy of defaultPolicies) {
                await this.createSecurityPolicy('default_shop', policy);
            }
            
            console.log('✅ 安全策略加载完成，共 4 个策略');
            
        } catch (error) {
            console.error('❌ 安全策略加载失败:', error);
            throw error;
        }
    }

    /**
     * 启动安全监控
     */
    async startSecurityMonitoring() {
        try {
            console.log('👁️ 启动安全监控...');
            
            // 启动实时威胁检测
            this.threatMonitorInterval = setInterval(() => {
                this.performThreatScan();
            }, 30000); // 每30秒扫描一次
            
            // 启动会话清理
            this.sessionCleanupInterval = setInterval(() => {
                this.cleanupExpiredSessions();
            }, 60000); // 每分钟清理一次
            
            // 启动安全指标收集
            this.metricsCollectionInterval = setInterval(() => {
                this.collectSecurityMetrics();
            }, 300000); // 每5分钟收集一次
            
            console.log('✅ 安全监控已启动');
            
        } catch (error) {
            console.error('❌ 安全监控启动失败:', error);
            throw error;
        }
    }

    // ============ 数据加密解密 ============

    /**
     * 加密敏感数据
     */
    encryptData(data, keyType = 'default') {
        try {
            const key = this.encryptionKeys.get(keyType);
            if (!key) {
                throw new Error(`加密密钥 ${keyType} 不存在`);
            }
            
            const iv = crypto.randomBytes(this.securityConfig.encryption.ivLength);
            const cipher = crypto.createCipher(this.securityConfig.encryption.algorithm, key, { iv });
            
            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return {
                encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                keyType
            };
            
        } catch (error) {
            console.error('❌ 数据加密失败:', error);
            throw error;
        }
    }

    /**
     * 解密敏感数据
     */
    decryptData(encryptedData) {
        try {
            const { encrypted, iv, authTag, keyType } = encryptedData;
            const key = this.encryptionKeys.get(keyType);
            
            if (!key) {
                throw new Error(`加密密钥 ${keyType} 不存在`);
            }
            
            const decipher = crypto.createDecipher(
                this.securityConfig.encryption.algorithm, 
                key, 
                { iv: Buffer.from(iv, 'hex') }
            );
            
            decipher.setAuthTag(Buffer.from(authTag, 'hex'));
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
            
        } catch (error) {
            console.error('❌ 数据解密失败:', error);
            throw error;
        }
    }

    // ============ 会话管理 ============

    /**
     * 创建安全会话
     */
    async createSecureSession(userId, shopId, clientInfo = {}) {
        try {
            const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const sessionToken = crypto.randomBytes(32).toString('hex');
            
            const session = {
                id: sessionId,
                userId,
                shopId,
                sessionToken,
                ipAddress: clientInfo.ip || '127.0.0.1',
                userAgent: clientInfo.userAgent || 'Unknown',
                isActive: true,
                lastActivityAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + this.securityConfig.session.timeout).toISOString(),
                securityFlags: JSON.stringify({
                    requireMFA: false,
                    limitedAccess: false,
                    monitorActivity: true
                }),
                createdAt: new Date().toISOString()
            };
            
            // 检查并发会话限制
            await this.enforceSessionLimit(userId);
            
            // 保存会话
            this.activeSessions.set(sessionId, session);
            
            // 记录审计日志
            await this.logSecurityEvent({
                shopId,
                userId,
                eventType: 'session_created',
                eventCategory: 'authentication',
                eventDescription: '用户会话创建',
                ipAddress: session.ipAddress,
                sessionId,
                riskLevel: 'low'
            });
            
            console.log(`🔐 安全会话创建成功: ${sessionId}`);
            
            return {
                success: true,
                sessionId,
                sessionToken,
                expiresAt: session.expiresAt
            };
            
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
            // 查找会话
            let session = null;
            for (const [id, sess] of this.activeSessions.entries()) {
                if (sess.sessionToken === sessionToken) {
                    session = sess;
                    break;
                }
            }
            
            if (!session) {
                return { valid: false, reason: 'session_not_found' };
            }
            
            // 检查会话是否过期
            if (new Date() > new Date(session.expiresAt)) {
                await this.destroySession(session.id);
                return { valid: false, reason: 'session_expired' };
            }
            
            // 检查会话是否活跃
            if (!session.isActive) {
                return { valid: false, reason: 'session_inactive' };
            }
            
            // 更新最后活动时间
            session.lastActivityAt = new Date().toISOString();
            
            // 如果会话即将过期，自动续期
            const timeToExpire = new Date(session.expiresAt) - new Date();
            if (timeToExpire < this.securityConfig.session.refreshThreshold) {
                session.expiresAt = new Date(Date.now() + this.securityConfig.session.timeout).toISOString();
            }
            
            return {
                valid: true,
                session: {
                    id: session.id,
                    userId: session.userId,
                    shopId: session.shopId,
                    expiresAt: session.expiresAt
                }
            };
            
        } catch (error) {
            console.error('❌ 会话验证失败:', error);
            return { valid: false, reason: 'validation_error' };
        }
    }

    /**
     * 销毁会话
     */
    async destroySession(sessionId) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (session) {
                this.activeSessions.delete(sessionId);
                
                // 记录审计日志
                await this.logSecurityEvent({
                    shopId: session.shopId,
                    userId: session.userId,
                    eventType: 'session_destroyed',
                    eventCategory: 'authentication',
                    eventDescription: '用户会话销毁',
                    sessionId,
                    riskLevel: 'low'
                });
                
                console.log(`🗑️ 会话已销毁: ${sessionId}`);
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ 销毁会话失败:', error);
            throw error;
        }
    }

    // ============ 访问控制 ============

    /**
     * 检查访问权限
     */
    async checkAccess(userId, resourceType, resourceId, permissionType, context = {}) {
        try {
            const { shopId, userRole, userPermissions = [] } = context;
            
            // 获取适用的访问规则
            const applicableRules = this.getApplicableAccessRules(shopId, resourceType);
            
            // 按优先级排序
            applicableRules.sort((a, b) => b.priority - a.priority);
            
            for (const rule of applicableRules) {
                // 检查资源模式匹配
                if (this.matchResourcePattern(rule.resourcePattern, resourceType, resourceId, context)) {
                    // 检查权限类型
                    if (this.matchPermissionType(rule.permissionType, permissionType)) {
                        // 检查角色权限
                        if (this.checkRolePermission(rule.allowedRoles, userRole)) {
                            // 检查用户权限
                            if (this.checkUserPermission(rule.allowedUsers, userId)) {
                                // 检查附加条件
                                if (await this.evaluateConditions(rule.conditions, context)) {
                                    // 记录访问事件
                                    await this.logSecurityEvent({
                                        shopId,
                                        userId,
                                        eventType: 'access_granted',
                                        eventCategory: 'authorization',
                                        eventDescription: `访问权限授予: ${resourceType}/${resourceId}`,
                                        resourceType,
                                        resourceId,
                                        riskLevel: 'low',
                                        additionalData: JSON.stringify({ rule: rule.name, permission: permissionType })
                                    });
                                    
                                    return { allowed: true, rule: rule.name };
                                }
                            }
                        }
                    }
                }
            }
            
            // 访问被拒绝
            await this.logSecurityEvent({
                shopId,
                userId,
                eventType: 'access_denied',
                eventCategory: 'authorization',
                eventDescription: `访问权限拒绝: ${resourceType}/${resourceId}`,
                resourceType,
                resourceId,
                riskLevel: 'medium',
                additionalData: JSON.stringify({ permission: permissionType, userRole })
            });
            
            return { allowed: false, reason: 'access_denied' };
            
        } catch (error) {
            console.error('❌ 访问权限检查失败:', error);
            return { allowed: false, reason: 'check_error' };
        }
    }

    /**
     * 创建访问控制规则
     */
    async createAccessRule(shopId, ruleData) {
        try {
            const {
                name,
                resourceType,
                resourcePattern,
                permissionType,
                allowedRoles,
                allowedUsers = null,
                conditions = {},
                priority = 0,
                createdBy
            } = ruleData;
            
            const ruleId = 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const rule = {
                id: ruleId,
                shopId,
                name,
                resourceType,
                resourcePattern,
                permissionType,
                allowedRoles: Array.isArray(allowedRoles) ? allowedRoles.join(',') : allowedRoles,
                allowedUsers: allowedUsers ? (Array.isArray(allowedUsers) ? allowedUsers.join(',') : allowedUsers) : null,
                conditions: JSON.stringify(conditions),
                priority,
                isActive: true,
                createdBy: createdBy || 'system',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.accessControlRules.set(ruleId, rule);
            
            console.log(`🔒 访问控制规则创建成功: ${name} (${ruleId})`);
            
            return {
                success: true,
                ruleId,
                message: '访问控制规则创建成功'
            };
            
        } catch (error) {
            console.error('❌ 创建访问控制规则失败:', error);
            throw error;
        }
    }

    // ============ 威胁检测 ============

    /**
     * 检测安全威胁
     */
    async detectThreat(eventData) {
        try {
            const { shopId, userId, eventType, ipAddress, userAgent, additionalData = {} } = eventData;
            const threats = [];
            
            // 暴力破解检测
            if (eventType === 'login_failed') {
                const bruteForceResult = await this.detectBruteForce(userId, ipAddress);
                if (bruteForceResult.isThreat) {
                    threats.push(bruteForceResult);
                }
            }
            
            // 异常访问模式检测
            const anomalyResult = await this.detectAnomalousAccess(userId, ipAddress, eventType);
            if (anomalyResult.isThreat) {
                threats.push(anomalyResult);
            }
            
            // IP声誉检测
            const ipReputationResult = await this.checkIPReputation(ipAddress);
            if (ipReputationResult.isThreat) {
                threats.push(ipReputationResult);
            }
            
            // 处理检测到的威胁
            for (const threat of threats) {
                await this.handleThreat(shopId, threat);
            }
            
            return { threats, count: threats.length };
            
        } catch (error) {
            console.error('❌ 威胁检测失败:', error);
            return { threats: [], count: 0 };
        }
    }

    /**
     * 检测暴力破解攻击
     */
    async detectBruteForce(userId, ipAddress) {
        try {
            const key = `brute_force_${userId || ipAddress}`;
            const attempts = this.threatCache.get(key) || [];
            const now = Date.now();
            const rule = this.threatRules.get('brute_force');
            
            // 清理过期的尝试记录
            const validAttempts = attempts.filter(attempt => 
                now - attempt.timestamp < rule.timeWindow
            );
            
            // 添加当前尝试
            validAttempts.push({ timestamp: now, ipAddress, userId });
            this.threatCache.set(key, validAttempts);
            
            // 检查是否超过阈值
            if (validAttempts.length >= rule.threshold) {
                return {
                    isThreat: true,
                    type: 'brute_force',
                    level: 'high',
                    description: `检测到暴力破解攻击: ${validAttempts.length} 次失败尝试`,
                    source: ipAddress,
                    target: userId,
                    evidence: validAttempts
                };
            }
            
            return { isThreat: false };
            
        } catch (error) {
            console.error('❌ 暴力破解检测失败:', error);
            return { isThreat: false };
        }
    }

    /**
     * 检测异常访问模式
     */
    async detectAnomalousAccess(userId, ipAddress, eventType) {
        try {
            const key = `anomaly_${userId}_${ipAddress}`;
            const activities = this.threatCache.get(key) || [];
            const now = Date.now();
            const rule = this.threatRules.get('anomaly_access');
            
            // 清理过期的活动记录
            const validActivities = activities.filter(activity => 
                now - activity.timestamp < rule.timeWindow
            );
            
            // 添加当前活动
            validActivities.push({ timestamp: now, eventType, ipAddress, userId });
            this.threatCache.set(key, validActivities);
            
            // 分析访问模式
            const uniqueEvents = new Set(validActivities.map(a => a.eventType));
            const accessFrequency = validActivities.length;
            
            // 检查异常指标
            let anomalyScore = 0;
            
            // 高频访问
            if (accessFrequency > rule.threshold) {
                anomalyScore += 5;
            }
            
            // 多样化事件类型
            if (uniqueEvents.size > 5) {
                anomalyScore += 3;
            }
            
            // 短时间内大量活动
            const recentActivities = validActivities.filter(a => 
                now - a.timestamp < 5 * 60 * 1000 // 5分钟内
            );
            if (recentActivities.length > 10) {
                anomalyScore += 4;
            }
            
            if (anomalyScore >= 6) {
                return {
                    isThreat: true,
                    type: 'anomalous_access',
                    level: 'medium',
                    description: `检测到异常访问模式: 评分 ${anomalyScore}`,
                    source: ipAddress,
                    target: userId,
                    evidence: { accessFrequency, uniqueEvents: Array.from(uniqueEvents), anomalyScore }
                };
            }
            
            return { isThreat: false };
            
        } catch (error) {
            console.error('❌ 异常访问检测失败:', error);
            return { isThreat: false };
        }
    }

    /**
     * 检查IP声誉
     */
    async checkIPReputation(ipAddress) {
        try {
            const blacklistRule = this.threatRules.get('ip_blacklist');
            
            if (blacklistRule.blacklist.has(ipAddress)) {
                return {
                    isThreat: true,
                    type: 'malicious_ip',
                    level: 'high',
                    description: `检测到恶意IP地址: ${ipAddress}`,
                    source: ipAddress,
                    evidence: { blacklisted: true }
                };
            }
            
            // 这里可以集成外部IP声誉服务
            // 暂时使用简单的本地检查
            
            return { isThreat: false };
            
        } catch (error) {
            console.error('❌ IP声誉检查失败:', error);
            return { isThreat: false };
        }
    }

    // ============ 审计日志 ============

    /**
     * 记录安全事件
     */
    async logSecurityEvent(eventData) {
        try {
            const {
                shopId,
                userId = null,
                eventType,
                eventCategory,
                eventDescription,
                ipAddress = null,
                userAgent = null,
                sessionId = null,
                resourceType = null,
                resourceId = null,
                riskLevel = 'low',
                additionalData = null
            } = eventData;
            
            const eventId = 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const auditEvent = {
                id: eventId,
                shopId,
                userId,
                eventType,
                eventCategory,
                eventDescription,
                ipAddress,
                userAgent,
                sessionId,
                resourceType,
                resourceId,
                riskLevel,
                additionalData: additionalData ? JSON.stringify(additionalData) : null,
                createdAt: new Date().toISOString()
            };
            
            this.auditLog.push(auditEvent);
            
            // 检查是否需要实时告警
            if (riskLevel === 'high' || riskLevel === 'critical') {
                await this.triggerSecurityAlert(auditEvent);
            }
            
            console.log(`📝 安全事件记录: ${eventType} (${riskLevel})`);
            
            return { success: true, eventId };
            
        } catch (error) {
            console.error('❌ 记录安全事件失败:', error);
            throw error;
        }
    }

    /**
     * 获取审计日志
     */
    async getAuditLogs(options = {}) {
        try {
            const {
                shopId,
                eventType,
                eventCategory,
                riskLevel,
                startTime,
                endTime,
                page = 1,
                limit = 50
            } = options;
            
            let logs = [...this.auditLog];
            
            // 应用筛选条件
            if (shopId) {
                logs = logs.filter(log => log.shopId === shopId);
            }
            
            if (eventType) {
                logs = logs.filter(log => log.eventType === eventType);
            }
            
            if (eventCategory) {
                logs = logs.filter(log => log.eventCategory === eventCategory);
            }
            
            if (riskLevel) {
                logs = logs.filter(log => log.riskLevel === riskLevel);
            }
            
            if (startTime) {
                logs = logs.filter(log => new Date(log.createdAt) >= new Date(startTime));
            }
            
            if (endTime) {
                logs = logs.filter(log => new Date(log.createdAt) <= new Date(endTime));
            }
            
            // 按时间倒序排序
            logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // 分页
            const total = logs.length;
            const startIndex = (page - 1) * limit;
            const paginatedLogs = logs.slice(startIndex, startIndex + limit);
            
            return {
                success: true,
                logs: paginatedLogs,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
            
        } catch (error) {
            console.error('❌ 获取审计日志失败:', error);
            throw error;
        }
    }

    // ============ 辅助方法 ============

    /**
     * 生成加密密钥
     */
    async generateEncryptionKey(keyType, purpose) {
        try {
            const keyId = `key_${keyType}_${Date.now()}`;
            const key = crypto.randomBytes(this.securityConfig.encryption.keyLength);
            
            this.encryptionKeys.set(keyType, key);
            
            return { success: true, keyId, keyType };
            
        } catch (error) {
            console.error('❌ 生成加密密钥失败:', error);
            throw error;
        }
    }

    /**
     * 创建安全策略
     */
    async createSecurityPolicy(shopId, policyData) {
        try {
            const { name, type, config } = policyData;
            const policyId = 'policy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const policy = {
                id: policyId,
                shopId,
                name,
                type,
                config: JSON.stringify(config),
                isActive: true,
                priority: 0,
                createdBy: 'system',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.securityPolicies.set(policyId, policy);
            
            return { success: true, policyId };
            
        } catch (error) {
            console.error('❌ 创建安全策略失败:', error);
            throw error;
        }
    }

    /**
     * 获取适用的访问规则
     */
    getApplicableAccessRules(shopId, resourceType) {
        const rules = [];
        
        for (const [id, rule] of this.accessControlRules.entries()) {
            if (rule.isActive && (rule.shopId === shopId || rule.shopId === 'default_shop')) {
                if (rule.resourceType === '*' || rule.resourceType === resourceType) {
                    rules.push(rule);
                }
            }
        }
        
        return rules;
    }

    /**
     * 匹配资源模式
     */
    matchResourcePattern(pattern, resourceType, resourceId, context) {
        // 简化的模式匹配逻辑
        if (pattern === '*') return true;
        
        // 替换变量
        let expandedPattern = pattern
            .replace('{shop_id}', context.shopId || '')
            .replace('{user_id}', context.userId || '');
        
        const resourcePath = `${resourceType}${resourceId ? '/' + resourceId : ''}`;
        
        // 支持通配符匹配
        const regexPattern = expandedPattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        
        return new RegExp(`^${regexPattern}$`).test(resourcePath);
    }

    /**
     * 匹配权限类型
     */
    matchPermissionType(rulePermissions, requestedPermission) {
        if (rulePermissions === '*') return true;
        
        const permissions = rulePermissions.split(',').map(p => p.trim());
        return permissions.includes(requestedPermission);
    }

    /**
     * 检查角色权限
     */
    checkRolePermission(allowedRoles, userRole) {
        if (!allowedRoles || allowedRoles === '*') return true;
        
        const roles = allowedRoles.split(',').map(r => r.trim());
        return roles.includes(userRole);
    }

    /**
     * 检查用户权限
     */
    checkUserPermission(allowedUsers, userId) {
        if (!allowedUsers) return true;
        
        const users = allowedUsers.split(',').map(u => u.trim());
        return users.includes(userId);
    }

    /**
     * 评估附加条件
     */
    async evaluateConditions(conditions, context) {
        try {
            if (!conditions || conditions === '{}') return true;
            
            const conditionObj = typeof conditions === 'string' ? JSON.parse(conditions) : conditions;
            
            // 这里可以实现复杂的条件评估逻辑
            // 暂时返回true
            return true;
            
        } catch (error) {
            console.error('❌ 条件评估失败:', error);
            return false;
        }
    }

    /**
     * 执行威胁扫描
     */
    async performThreatScan() {
        try {
            // 扫描活跃威胁
            console.log('🔍 执行威胁扫描...');
            
            // 这里可以实现更复杂的威胁扫描逻辑
            
        } catch (error) {
            console.error('❌ 威胁扫描失败:', error);
        }
    }

    /**
     * 清理过期会话
     */
    async cleanupExpiredSessions() {
        try {
            const now = new Date();
            let cleanedCount = 0;
            
            for (const [sessionId, session] of this.activeSessions.entries()) {
                if (new Date(session.expiresAt) < now) {
                    await this.destroySession(sessionId);
                    cleanedCount++;
                }
            }
            
            if (cleanedCount > 0) {
                console.log(`🧹 清理过期会话: ${cleanedCount} 个`);
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
            
            console.log(`📊 安全指标收集: ${JSON.stringify(metrics)}`);
            
        } catch (error) {
            console.error('❌ 安全指标收集失败:', error);
        }
    }

    /**
     * 启动审计日志清理
     */
    startAuditCleanup() {
        setInterval(() => {
            const cutoffTime = new Date(Date.now() - this.securityConfig.audit.retentionDays * 24 * 60 * 60 * 1000);
            const initialCount = this.auditLog.length;
            
            this.auditLog = this.auditLog.filter(log => new Date(log.createdAt) > cutoffTime);
            
            const cleanedCount = initialCount - this.auditLog.length;
            if (cleanedCount > 0) {
                console.log(`🧹 清理过期审计日志: ${cleanedCount} 条`);
            }
        }, 24 * 60 * 60 * 1000); // 每天清理一次
    }

    /**
     * 强制会话限制
     */
    async enforceSessionLimit(userId) {
        const userSessions = [];
        for (const [sessionId, session] of this.activeSessions.entries()) {
            if (session.userId === userId && session.isActive) {
                userSessions.push({ sessionId, lastActivity: new Date(session.lastActivityAt) });
            }
        }
        
        if (userSessions.length >= this.securityConfig.session.maxConcurrentSessions) {
            // 按最后活动时间排序，移除最旧的会话
            userSessions.sort((a, b) => a.lastActivity - b.lastActivity);
            const sessionsToRemove = userSessions.slice(0, userSessions.length - this.securityConfig.session.maxConcurrentSessions + 1);
            
            for (const sessionInfo of sessionsToRemove) {
                await this.destroySession(sessionInfo.sessionId);
            }
        }
    }

    /**
     * 处理威胁
     */
    async handleThreat(shopId, threat) {
        try {
            const threatId = 'threat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const threatRecord = {
                id: threatId,
                shopId,
                threatType: threat.type,
                threatLevel: threat.level,
                sourceIp: threat.source,
                targetResource: threat.target,
                detectionMethod: 'automated_scan',
                threatDescription: threat.description,
                evidence: JSON.stringify(threat.evidence),
                status: 'active',
                createdAt: new Date().toISOString()
            };
            
            this.securityEvents.set(threatId, threatRecord);
            
            // 记录安全事件
            await this.logSecurityEvent({
                shopId,
                eventType: 'threat_detected',
                eventCategory: 'security',
                eventDescription: threat.description,
                ipAddress: threat.source,
                riskLevel: threat.level === 'high' ? 'high' : 'medium',
                additionalData: threat.evidence
            });
            
            console.log(`⚠️ 威胁处理: ${threat.type} (${threat.level})`);
            
        } catch (error) {
            console.error('❌ 威胁处理失败:', error);
        }
    }

    /**
     * 触发安全告警
     */
    async triggerSecurityAlert(event) {
        try {
            console.log(`🚨 安全告警: ${event.eventType} - ${event.eventDescription}`);
            
            // 这里可以集成告警通知系统
            // 例如发送邮件、短信、或推送通知
            
        } catch (error) {
            console.error('❌ 安全告警失败:', error);
        }
    }
}

module.exports = ComprehensiveSecurityModule;