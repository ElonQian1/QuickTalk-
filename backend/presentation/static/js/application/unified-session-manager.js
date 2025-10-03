/**
 * 整合的会话管理服务
 * 合并原有SessionManager和CustomerSessionManager的功能，去除重复
 * 
 * @author GitHub Copilot
 * @version 2.0
 * @date 2025-10-03
 */

class UnifiedSessionManager {
    constructor(dependencies = {}) {
        this.eventBus = dependencies.eventBus || window.eventBus;
        this.logger = dependencies.logger || window.logger;
        
        // 存储键名
        this.customerIdKey = 'qt_customer_id';
        this.sessionDataKey = 'qt_session_data';
        this.conversationMapKey = 'qt_conversation_map';
        this.sessionMetadataKey = 'qt_session_metadata';
        
        // 会话状态
        this.activeSessions = new Map();
        this.sessionTimeout = 30 * 60 * 1000; // 30分钟
        this.cleanupInterval = 5 * 60 * 1000;  // 5分钟清理一次
        
        this.init();
    }

    /**
     * 初始化会话管理器
     */
    init() {
        // 确保存储数据同步
        this.syncStorageData();
        
        // 恢复现有会话
        this.restoreExistingSessions();
        
        // 监听页面卸载事件
        window.addEventListener('beforeunload', () => {
            this.saveSessionState();
        });

        // 启动清理定时器
        this._startCleanupTimer();

        // 监听相关事件
        this._setupEventListeners();

        this.logger?.info('UnifiedSessionManager', '会话管理器初始化完成');
    }

    /**
     * 同步存储数据
     */
    syncStorageData() {
        const localId = localStorage.getItem(this.customerIdKey);
        const sessionId = sessionStorage.getItem(this.customerIdKey);
        
        if (localId && !sessionId) {
            sessionStorage.setItem(this.customerIdKey, localId);
        } else if (sessionId && !localId) {
            localStorage.setItem(this.customerIdKey, sessionId);
        }
    }

    /**
     * 获取或创建客户ID
     */
    getOrCreateCustomerId() {
        let customerId = localStorage.getItem(this.customerIdKey);
        
        if (customerId) {
            sessionStorage.setItem(this.customerIdKey, customerId);
            this.logger?.info('UnifiedSessionManager', `恢复现有客户会话: ${customerId}`);
            return customerId;
        }

        customerId = this.generateCustomerId();
        
        localStorage.setItem(this.customerIdKey, customerId);
        sessionStorage.setItem(this.customerIdKey, customerId);
        
        this.logger?.info('UnifiedSessionManager', `创建新客户会话: ${customerId}`);
        
        // 发布事件
        this.eventBus?.emit(window.APP_CONSTANTS?.EVENTS.SESSION_CREATED, {
            customerId,
            timestamp: new Date().toISOString()
        });
        
        return customerId;
    }

    /**
     * 生成新的客户ID
     */
    generateCustomerId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `customer_${timestamp}_${random}`;
    }

    /**
     * 获取当前客户ID（不创建新的）
     */
    getCurrentCustomerId() {
        return localStorage.getItem(this.customerIdKey) || 
               sessionStorage.getItem(this.customerIdKey);
    }

    /**
     * 重置客户会话
     */
    resetCustomerSession() {
        const oldCustomerId = this.getCurrentCustomerId();
        
        // 清理存储
        localStorage.removeItem(this.customerIdKey);
        sessionStorage.removeItem(this.customerIdKey);
        localStorage.removeItem(this.sessionDataKey);
        sessionStorage.removeItem(this.sessionDataKey);
        localStorage.removeItem(this.conversationMapKey);
        
        // 创建新会话
        const newCustomerId = this.getOrCreateCustomerId();
        
        this.logger?.info('UnifiedSessionManager', 
            `客户会话已重置: ${oldCustomerId} -> ${newCustomerId}`);
        
        // 发布事件
        this.eventBus?.emit('session.reset', {
            oldCustomerId,
            newCustomerId,
            timestamp: new Date().toISOString()
        });
        
        return newCustomerId;
    }

    /**
     * 保存会话数据
     */
    saveSessionData(data) {
        const sessionData = {
            ...data,
            timestamp: Date.now(),
            customerId: this.getCurrentCustomerId()
        };
        
        const serializedData = JSON.stringify(sessionData);
        localStorage.setItem(this.sessionDataKey, serializedData);
        sessionStorage.setItem(this.sessionDataKey, serializedData);
        
        this.logger?.debug('UnifiedSessionManager', '会话数据已保存');
    }

    /**
     * 获取会话数据
     */
    getSessionData() {
        const localData = localStorage.getItem(this.sessionDataKey);
        const sessionData = sessionStorage.getItem(this.sessionDataKey);
        
        // 优先使用sessionStorage的数据
        const dataStr = sessionData || localData;
        
        if (!dataStr) {
            return null;
        }

        try {
            return JSON.parse(dataStr);
        } catch (error) {
            this.logger?.error('UnifiedSessionManager', '会话数据解析失败', error);
            return null;
        }
    }

    /**
     * 保存对话映射
     */
    saveConversationMapping(conversationId, shopId, metadata = {}) {
        const customerId = this.getCurrentCustomerId();
        if (!customerId) {
            throw new Error('客户ID不存在');
        }

        let conversationMap = this.getConversationMapping();
        if (!conversationMap) {
            conversationMap = {};
        }

        conversationMap[conversationId] = {
            shopId,
            customerId,
            createdAt: new Date().toISOString(),
            lastAccessAt: new Date().toISOString(),
            metadata
        };

        const serializedMap = JSON.stringify(conversationMap);
        localStorage.setItem(this.conversationMapKey, serializedMap);
        
        this.logger?.debug('UnifiedSessionManager', 
            `对话映射已保存: ${conversationId} -> ${shopId}`);
    }

    /**
     * 获取对话映射
     */
    getConversationMapping() {
        const mapData = localStorage.getItem(this.conversationMapKey);
        
        if (!mapData) {
            return null;
        }

        try {
            return JSON.parse(mapData);
        } catch (error) {
            this.logger?.error('UnifiedSessionManager', '对话映射解析失败', error);
            return null;
        }
    }

    /**
     * 获取特定对话的映射信息
     */
    getConversationInfo(conversationId) {
        const mapping = this.getConversationMapping();
        return mapping ? mapping[conversationId] : null;
    }

    /**
     * 更新对话最后访问时间
     */
    updateConversationAccess(conversationId) {
        const mapping = this.getConversationMapping();
        if (mapping && mapping[conversationId]) {
            mapping[conversationId].lastAccessAt = new Date().toISOString();
            
            const serializedMap = JSON.stringify(mapping);
            localStorage.setItem(this.conversationMapKey, serializedMap);
        }
    }

    /**
     * 保存会话状态
     */
    saveSessionState() {
        const sessionState = {
            customerId: this.getCurrentCustomerId(),
            timestamp: Date.now(),
            sessions: Array.from(this.activeSessions.entries()),
            metadata: this._getSessionMetadata()
        };

        try {
            const serializedState = JSON.stringify(sessionState);
            localStorage.setItem(this.sessionMetadataKey, serializedState);
            this.logger?.debug('UnifiedSessionManager', '会话状态已保存');
        } catch (error) {
            this.logger?.error('UnifiedSessionManager', '保存会话状态失败', error);
        }
    }

    /**
     * 恢复现有会话
     */
    restoreExistingSessions() {
        try {
            const savedState = localStorage.getItem(this.sessionMetadataKey);
            if (!savedState) {
                return;
            }

            const sessionState = JSON.parse(savedState);
            const customerId = this.getCurrentCustomerId();

            // 验证会话归属
            if (sessionState.customerId !== customerId) {
                localStorage.removeItem(this.sessionMetadataKey);
                return;
            }

            // 检查会话是否过期
            const sessionAge = Date.now() - sessionState.timestamp;
            if (sessionAge > this.sessionTimeout) {
                localStorage.removeItem(this.sessionMetadataKey);
                this.logger?.info('UnifiedSessionManager', '会话已过期，已清理');
                return;
            }

            // 恢复会话
            if (sessionState.sessions) {
                this.activeSessions = new Map(sessionState.sessions);
                this.logger?.info('UnifiedSessionManager', 
                    `已恢复 ${this.activeSessions.size} 个活跃会话`);
            }

        } catch (error) {
            this.logger?.error('UnifiedSessionManager', '恢复会话失败', error);
            localStorage.removeItem(this.sessionMetadataKey);
        }
    }

    /**
     * 清理过期会话数据
     */
    cleanupExpiredSessions() {
        const maxAge = 24 * 60 * 60 * 1000; // 24小时
        
        // 清理会话数据
        const sessionData = this.getSessionData();
        if (sessionData && sessionData.timestamp) {
            const age = Date.now() - sessionData.timestamp;
            
            if (age > maxAge) {
                localStorage.removeItem(this.sessionDataKey);
                sessionStorage.removeItem(this.sessionDataKey);
                this.logger?.info('UnifiedSessionManager', '清理过期会话数据');
            }
        }

        // 清理对话映射
        const mapping = this.getConversationMapping();
        if (mapping) {
            let hasChanges = false;
            const now = Date.now();
            
            Object.keys(mapping).forEach(conversationId => {
                const conversationInfo = mapping[conversationId];
                const lastAccess = new Date(conversationInfo.lastAccessAt).getTime();
                
                if (now - lastAccess > maxAge) {
                    delete mapping[conversationId];
                    hasChanges = true;
                }
            });

            if (hasChanges) {
                const serializedMap = JSON.stringify(mapping);
                localStorage.setItem(this.conversationMapKey, serializedMap);
                this.logger?.info('UnifiedSessionManager', '清理过期对话映射');
            }
        }
    }

    /**
     * 获取会话统计
     */
    getSessionStats() {
        const customerId = this.getCurrentCustomerId();
        const sessionData = this.getSessionData();
        const conversationMapping = this.getConversationMapping();
        const activeSessions = this.activeSessions.size;

        return {
            customerId,
            hasActiveSession: !!customerId,
            sessionDataExists: !!sessionData,
            conversationCount: conversationMapping ? Object.keys(conversationMapping).length : 0,
            activeSessions,
            sessionAge: sessionData ? Date.now() - sessionData.timestamp : null
        };
    }

    /**
     * 设置事件监听器
     * @private
     */
    _setupEventListeners() {
        // 监听对话选择事件
        this.eventBus?.on(window.APP_CONSTANTS?.EVENTS.CONVERSATION_SELECTED, (data) => {
            if (data.conversationId) {
                this.updateConversationAccess(data.conversationId);
            }
        });

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.saveSessionState();
            }
        });
    }

    /**
     * 启动清理定时器
     * @private
     */
    _startCleanupTimer() {
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, this.cleanupInterval);
    }

    /**
     * 获取会话元数据
     * @private
     */
    _getSessionMetadata() {
        return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screenResolution: `${screen.width}x${screen.height}`,
            timestamp: new Date().toISOString()
        };
    }
}

// 注册到模块系统
window.registerModule('UnifiedSessionManager', UnifiedSessionManager, ['EventBus']);

// 向后兼容 - 创建全局实例
window.unifiedSessionManager = window.getModule('UnifiedSessionManager');

// 向后兼容 - 提供原有的API
window.SessionManager = UnifiedSessionManager;
window.CustomerSessionManager = UnifiedSessionManager;

// 全局便捷函数
window.getOrCreateCustomerId = function() {
    return window.unifiedSessionManager.getOrCreateCustomerId();
};

window.getCurrentCustomerId = function() {
    return window.unifiedSessionManager.getCurrentCustomerId();
};

window.resetCustomerSession = function() {
    return window.unifiedSessionManager.resetCustomerSession();
};

console.log('🔄 统一会话管理器已初始化 (整合了SessionManager和CustomerSessionManager)');