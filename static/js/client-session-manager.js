/**
 * QuickTalk 客户端SDK - 会话持久化模块
 * 负责客户端的会话管理和持久化功能
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-09-29
 */

class QuickTalkClientSessionManager {
    constructor() {
        this.storageKey = 'qt_customer_id';
        this.userId = null;
        this.init();
    }

    /**
     * 初始化客户端会话管理器
     */
    init() {
        this.userId = this.getOrCreateUserId();
        this.setupDebugTools();
        console.log('QuickTalk客户端会话管理器已初始化:', this.userId);
    }

    /**
     * 获取或创建用户ID
     * @returns {string} 用户ID
     */
    getOrCreateUserId() {
        // 检查localStorage是否已有持久化ID
        let persistentUserId = localStorage.getItem(this.storageKey);
        
        if (persistentUserId) {
            // 同步到sessionStorage
            sessionStorage.setItem(this.storageKey, persistentUserId);
            console.log('恢复客户会话:', persistentUserId);
            return persistentUserId;
        }
        
        // 检查sessionStorage（降级处理）
        persistentUserId = sessionStorage.getItem(this.storageKey);
        if (persistentUserId) {
            localStorage.setItem(this.storageKey, persistentUserId);
            console.log('从会话存储恢复客户ID:', persistentUserId);
            return persistentUserId;
        }
        
        // 创建新的客户ID
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        persistentUserId = `customer_${timestamp}_${random}`;
        
        // 双重保存确保持久化
        localStorage.setItem(this.storageKey, persistentUserId);
        sessionStorage.setItem(this.storageKey, persistentUserId);
        
        console.log('创建新客户会话:', persistentUserId);
        return persistentUserId;
    }

    /**
     * 获取当前用户ID
     * @returns {string} 当前用户ID
     */
    getCurrentUserId() {
        return this.userId || this.getOrCreateUserId();
    }

    /**
     * 重置客户会话
     * @returns {string} 新的用户ID
     */
    resetCustomerSession() {
        // 清除所有存储
        localStorage.removeItem(this.storageKey);
        sessionStorage.removeItem(this.storageKey);
        
        // 重新创建
        this.userId = this.getOrCreateUserId();
        
        console.log('客户会话已重置，新ID:', this.userId);
        return this.userId;
    }

    /**
     * 强制创建新会话（测试用）
     * @returns {string} 新的用户ID
     */
    forceNewSession() {
        console.log('强制创建新会话...');
        
        // 备份旧ID
        const oldUserId = this.userId;
        
        // 重置并创建新会话
        this.resetCustomerSession();
        
        console.log(`会话已切换: ${oldUserId} → ${this.userId}`);
        return this.userId;
    }

    /**
     * 获取会话信息
     * @returns {Object} 会话信息
     */
    getSessionInfo() {
        return {
            userId: this.getCurrentUserId(),
            timestamp: Date.now(),
            storageStatus: {
                localStorage: !!localStorage.getItem(this.storageKey),
                sessionStorage: !!sessionStorage.getItem(this.storageKey)
            }
        };
    }

    /**
     * 设置客户端调试工具
     */
    setupDebugTools() {
        // 创建全局调试对象
        window.QuickTalkDebug = {
            getCurrentUserId: () => this.getCurrentUserId(),
            resetSession: () => this.resetCustomerSession(),
            getStoredId: () => localStorage.getItem(this.storageKey),
            forceNewSession: () => this.forceNewSession(),
            showSessionInfo: () => {
                const info = this.getSessionInfo();
                console.group('QuickTalk客户端会话信息');
                console.log('用户ID:', info.userId);
                console.log('时间戳:', new Date(info.timestamp));
                console.log('存储状态:', info.storageStatus);
                console.groupEnd();
                return info;
            }
        };
    }

    /**
     * 检查会话是否有效
     * @returns {boolean} 会话是否有效
     */
    isSessionValid() {
        const userId = this.getCurrentUserId();
        return !!userId && userId.startsWith('customer_');
    }

    /**
     * 会话保活（定期调用以维持会话）
     */
    keepSessionAlive() {
        const userId = this.getCurrentUserId();
        
        // 更新存储时间戳
        localStorage.setItem(this.storageKey + '_last_active', Date.now().toString());
        
        return userId;
    }
}

// 创建并暴露全局实例
window.QuickTalkSession = new QuickTalkClientSessionManager();

// 向后兼容的函数
window.getOrCreateUserId = function() {
    return window.QuickTalkSession.getCurrentUserId();
};

window.resetCustomerSession = function() {
    return window.QuickTalkSession.resetCustomerSession();
};

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuickTalkClientSessionManager;
}