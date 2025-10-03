/**
 * 会话领域服务
 * 处理会话相关的业务逻辑
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-10-03
 */

class SessionDomainService {
    constructor(dependencies = {}) {
        this.eventBus = dependencies.eventBus || window.eventBus;
        this.logger = dependencies.logger || window.logger;
        
        // 会话状态
        this.sessions = new Map();
        this.sessionTimeout = 30 * 60 * 1000; // 30分钟
        this.cleanupInterval = 5 * 60 * 1000;  // 5分钟清理一次
        
        this._startCleanupTimer();
    }

    /**
     * 创建新会话
     */
    createSession(customerId, shopId, metadata = {}) {
        if (!customerId || !shopId) {
            throw new Error('客户ID和店铺ID不能为空');
        }

        const sessionId = this._generateSessionId(customerId, shopId);
        
        const session = {
            id: sessionId,
            customerId,
            shopId,
            status: window.APP_CONSTANTS.SESSION_STATUS.ACTIVE,
            createdAt: new Date().toISOString(),
            lastActivityAt: new Date().toISOString(),
            metadata: { ...metadata },
            conversationIds: []
        };

        this.sessions.set(sessionId, session);

        // 发布事件
        this.eventBus.emit(window.APP_CONSTANTS.EVENTS.SESSION_CREATED, {
            sessionId,
            customerId,
            shopId
        });

        this.logger.info('SessionService', `会话已创建: ${sessionId}`);
        return session;
    }

    /**
     * 获取会话
     */
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        // 检查会话是否过期
        if (this._isSessionExpired(session)) {
            this.expireSession(sessionId);
            return null;
        }

        return session;
    }

    /**
     * 更新会话活动时间
     */
    updateSessionActivity(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        const oldStatus = session.status;
        session.lastActivityAt = new Date().toISOString();
        session.status = window.APP_CONSTANTS.SESSION_STATUS.ACTIVE;

        // 如果状态发生变化，发布事件
        if (oldStatus !== session.status) {
            this.eventBus.emit(window.APP_CONSTANTS.EVENTS.SESSION_UPDATED, {
                sessionId,
                oldStatus,
                newStatus: session.status
            });
        }

        this.logger.debug('SessionService', `会话活动已更新: ${sessionId}`);
        return true;
    }

    /**
     * 将对话关联到会话
     */
    associateConversation(sessionId, conversationId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`会话不存在: ${sessionId}`);
        }

        if (!session.conversationIds.includes(conversationId)) {
            session.conversationIds.push(conversationId);
            this.updateSessionActivity(sessionId);
            
            this.logger.debug('SessionService', 
                `对话 ${conversationId} 已关联到会话 ${sessionId}`);
        }
    }

    /**
     * 设置会话为空闲状态
     */
    setSessionIdle(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.status === window.APP_CONSTANTS.SESSION_STATUS.IDLE) {
            return false;
        }

        const oldStatus = session.status;
        session.status = window.APP_CONSTANTS.SESSION_STATUS.IDLE;

        this.eventBus.emit(window.APP_CONSTANTS.EVENTS.SESSION_UPDATED, {
            sessionId,
            oldStatus,
            newStatus: session.status
        });

        this.logger.info('SessionService', `会话设为空闲: ${sessionId}`);
        return true;
    }

    /**
     * 使会话过期
     */
    expireSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        const oldStatus = session.status;
        session.status = window.APP_CONSTANTS.SESSION_STATUS.EXPIRED;

        this.eventBus.emit(window.APP_CONSTANTS.EVENTS.SESSION_EXPIRED, {
            sessionId,
            customerId: session.customerId,
            shopId: session.shopId,
            duration: Date.now() - new Date(session.createdAt).getTime()
        });

        // 延迟删除会话（保留一段时间用于统计）
        setTimeout(() => {
            this.sessions.delete(sessionId);
            this.logger.debug('SessionService', `已删除过期会话: ${sessionId}`);
        }, 5 * 60 * 1000); // 5分钟后删除

        this.logger.info('SessionService', `会话已过期: ${sessionId}`);
        return true;
    }

    /**
     * 获取客户的活跃会话
     */
    getCustomerActiveSession(customerId, shopId) {
        for (const [sessionId, session] of this.sessions) {
            if (session.customerId === customerId && 
                session.shopId === shopId &&
                session.status === window.APP_CONSTANTS.SESSION_STATUS.ACTIVE &&
                !this._isSessionExpired(session)) {
                return session;
            }
        }
        return null;
    }

    /**
     * 获取店铺的活跃会话列表
     */
    getShopActiveSessions(shopId) {
        const activeSessions = [];
        
        for (const [sessionId, session] of this.sessions) {
            if (session.shopId === shopId &&
                session.status === window.APP_CONSTANTS.SESSION_STATUS.ACTIVE &&
                !this._isSessionExpired(session)) {
                activeSessions.push(session);
            }
        }

        return activeSessions;
    }

    /**
     * 获取会话统计
     */
    getSessionStats(shopId = null) {
        let totalSessions = 0;
        let activeSessions = 0;
        let idleSessions = 0;

        for (const [sessionId, session] of this.sessions) {
            if (shopId && session.shopId !== shopId) {
                continue;
            }

            totalSessions++;
            
            if (this._isSessionExpired(session)) {
                continue;
            }

            switch (session.status) {
                case window.APP_CONSTANTS.SESSION_STATUS.ACTIVE:
                    activeSessions++;
                    break;
                case window.APP_CONSTANTS.SESSION_STATUS.IDLE:
                    idleSessions++;
                    break;
            }
        }

        return {
            total: totalSessions,
            active: activeSessions,
            idle: idleSessions,
            shopId
        };
    }

    /**
     * 检查会话是否过期
     * @private
     */
    _isSessionExpired(session) {
        const now = Date.now();
        const lastActivity = new Date(session.lastActivityAt).getTime();
        return (now - lastActivity) > this.sessionTimeout;
    }

    /**
     * 生成会话ID
     * @private
     */
    _generateSessionId(customerId, shopId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `session_${shopId}_${customerId}_${timestamp}_${random}`;
    }

    /**
     * 启动清理定时器
     * @private
     */
    _startCleanupTimer() {
        setInterval(() => {
            this._cleanupExpiredSessions();
        }, this.cleanupInterval);
    }

    /**
     * 清理过期会话
     * @private
     */
    _cleanupExpiredSessions() {
        const expiredSessions = [];

        for (const [sessionId, session] of this.sessions) {
            if (this._isSessionExpired(session) && 
                session.status !== window.APP_CONSTANTS.SESSION_STATUS.EXPIRED) {
                expiredSessions.push(sessionId);
            }
        }

        expiredSessions.forEach(sessionId => {
            this.expireSession(sessionId);
        });

        if (expiredSessions.length > 0) {
            this.logger.info('SessionService', 
                `清理了 ${expiredSessions.length} 个过期会话`);
        }
    }
}

// 注册到模块系统
window.registerModule('SessionDomainService', SessionDomainService, ['EventBus']);

console.log('🔐 会话领域服务已初始化');