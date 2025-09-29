/**
 * 会话管理系统模块
 * 负责客户会话的持久化、管理和恢复
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-09-29
 */

class SessionManager {
    constructor() {
        this.customerIdKey = 'qt_customer_id';
        this.sessionDataKey = 'qt_session_data';
        this.conversationMapKey = 'qt_conversation_map';
        
        this.init();
    }

    /**
     * 初始化会话管理器
     */
    init() {
        // 确保sessionStorage和localStorage同步
        this.syncStorageData();
        
        // 监听页面卸载事件，保存会话状态
        window.addEventListener('beforeunload', () => {
            this.saveSessionState();
        });

        console.log('会话管理器初始化完成');
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
     * @returns {string} 客户ID
     */
    getOrCreateCustomerId() {
        let customerId = localStorage.getItem(this.customerIdKey);
        
        if (customerId) {
            // 更新sessionStorage
            sessionStorage.setItem(this.customerIdKey, customerId);
            console.log(`恢复现有客户会话: ${customerId}`);
            return customerId;
        }

        // 创建新的客户ID
        customerId = this.generateCustomerId();
        
        // 同时保存到localStorage和sessionStorage
        localStorage.setItem(this.customerIdKey, customerId);
        sessionStorage.setItem(this.customerIdKey, customerId);
        
        console.log(`创建新客户会话: ${customerId}`);
        return customerId;
    }

    /**
     * 生成新的客户ID
     * @returns {string} 新的客户ID
     */
    generateCustomerId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `customer_${timestamp}_${random}`;
    }

    /**
     * 获取当前客户ID（不创建新的）
     * @returns {string|null} 当前客户ID或null
     */
    getCurrentCustomerId() {
        return localStorage.getItem(this.customerIdKey) || 
               sessionStorage.getItem(this.customerIdKey);
    }

    /**
     * 重置客户会话
     * @returns {string} 新的客户ID
     */
    resetCustomerSession() {
        // 清理存储
        localStorage.removeItem(this.customerIdKey);
        sessionStorage.removeItem(this.customerIdKey);
        localStorage.removeItem(this.sessionDataKey);
        sessionStorage.removeItem(this.sessionDataKey);
        
        console.log('客户会话已重置');
        
        // 创建新会话
        return this.getOrCreateCustomerId();
    }

    /**
     * 保存会话数据
     * @param {Object} sessionData 会话数据
     */
    saveSessionData(sessionData) {
        try {
            const dataToSave = {
                ...sessionData,
                lastUpdate: Date.now(),
                customerId: this.getCurrentCustomerId()
            };
            
            const jsonData = JSON.stringify(dataToSave);
            localStorage.setItem(this.sessionDataKey, jsonData);
            sessionStorage.setItem(this.sessionDataKey, jsonData);
            
        } catch (error) {
            console.error('保存会话数据失败:', error);
        }
    }

    /**
     * 获取会话数据
     * @returns {Object|null} 会话数据或null
     */
    getSessionData() {
        try {
            const stored = localStorage.getItem(this.sessionDataKey) || 
                          sessionStorage.getItem(this.sessionDataKey);
            
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('获取会话数据失败:', error);
            return null;
        }
    }

    /**
     * 保存会话状态
     */
    saveSessionState() {
        const sessionState = {
            timestamp: Date.now(),
            url: window.location.href,
            customerId: this.getCurrentCustomerId()
        };

        this.saveSessionData(sessionState);
    }

    /**
     * 获取会话信息
     * @returns {Object} 会话信息对象
     */
    getSessionInfo() {
        const customerId = this.getCurrentCustomerId();
        const sessionData = this.getSessionData();
        
        return {
            customerId: customerId,
            hasPersistedSession: !!customerId,
            sessionData: sessionData,
            storageKeys: {
                local: this.customerIdKey,
                session: this.customerIdKey
            },
            created: sessionData?.timestamp,
            lastUpdate: sessionData?.lastUpdate
        };
    }

    /**
     * 强制创建新会话（用于测试）
     * @returns {string} 新的客户ID
     */
    forceNewSession() {
        console.log('强制创建新会话...');
        
        // 备份旧的客户ID
        const oldCustomerId = this.getCurrentCustomerId();
        
        // 清理当前会话
        this.resetCustomerSession();
        
        // 创建新会话
        const newCustomerId = this.getOrCreateCustomerId();
        
        console.log(`会话切换: ${oldCustomerId} -> ${newCustomerId}`);
        return newCustomerId;
    }

    /**
     * 检查会话是否有效
     * @returns {boolean} 会话是否有效
     */
    isSessionValid() {
        const customerId = this.getCurrentCustomerId();
        return !!customerId && customerId.startsWith('customer_');
    }

    /**
     * 清理过期会话数据
     * @param {number} maxAge 最大存储时间（毫秒），默认7天
     */
    cleanExpiredSessions(maxAge = 7 * 24 * 60 * 60 * 1000) {
        const sessionData = this.getSessionData();
        
        if (sessionData && sessionData.timestamp) {
            const age = Date.now() - sessionData.timestamp;
            
            if (age > maxAge) {
                console.log('清理过期会话数据');
                this.resetCustomerSession();
            }
        }
    }
}

/**
 * 客户会话管理器（管理后台专用）
 */
class CustomerSessionManager extends SessionManager {
    constructor() {
        super();
    }

    /**
     * 生成持久化的客户ID（管理后台版本）
     * @returns {string} 客户ID
     */
    static generatePersistentCustomerId() {
        return window.SessionManager.generateCustomerId();
    }

    /**
     * 获取当前客户ID（静态方法）
     * @returns {string|null} 当前客户ID
     */
    static getCurrentCustomerId() {
        return window.SessionManager.getCurrentCustomerId();
    }

    /**
     * 重置客户会话（静态方法）
     * @returns {string} 新的客户ID
     */
    static resetCustomerSession() {
        return window.SessionManager.resetCustomerSession();
    }

    /**
     * 显示会话管理工具
     */
    showSessionTools() {
        const sessionInfo = this.getSessionInfo();
        
        console.group('客户会话管理工具');
        console.log('当前客户ID:', sessionInfo.customerId);
        console.log('会话是否持久化:', sessionInfo.hasPersistedSession);
        console.log('会话数据:', sessionInfo.sessionData);
        console.log('创建时间:', sessionInfo.created ? new Date(sessionInfo.created) : 'N/A');
        console.log('最后更新:', sessionInfo.lastUpdate ? new Date(sessionInfo.lastUpdate) : 'N/A');
        console.groupEnd();
        
        return sessionInfo;
    }

    /**
     * 获取客户会话统计信息
     * @returns {Object} 统计信息
     */
    getSessionStats() {
        const allKeys = Object.keys(localStorage);
        const sessionKeys = allKeys.filter(key => key.startsWith('qt_'));
        
        return {
            totalSessionKeys: sessionKeys.length,
            sessionKeys: sessionKeys,
            currentSession: this.getSessionInfo(),
            storageUsage: {
                localStorage: JSON.stringify(localStorage).length,
                sessionStorage: JSON.stringify(sessionStorage).length
            }
        };
    }
}

// 创建全局实例
window.SessionManager = new SessionManager();
window.CustomerSessionManager = CustomerSessionManager;

// 向后兼容的全局函数
window.getOrCreateUserId = function() {
    return window.SessionManager.getOrCreateCustomerId();
};

window.resetCustomerSession = function() {
    return window.SessionManager.resetCustomerSession();
};

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SessionManager, CustomerSessionManager };
}