/**
 * 统一管理器工厂
 * 避免管理器重复创建和功能重叠
 */

class ManagerFactory {
    static managers = new Map();
    static initialized = false;

    /**
     * 初始化管理器工厂
     */
    static init() {
        if (this.initialized) return;
        
        this.initialized = true;
        // 模块注册
    if (typeof window.ModuleLoader?.registerModule === 'function') {
        window.ModuleLoader.registerModule('manager-factory', 'core', 'ManagerFactory 已加载');
    } else {
        console.log('✅ ManagerFactory 已加载');
    }
    }

    /**
     * 获取或创建管理器实例
     * @param {string} type - 管理器类型
     * @param {Object} options - 配置选项
     * @returns {Object} 管理器实例
     */
    static getManager(type, options = {}) {
        const key = `${type}_${JSON.stringify(options)}`;
        
        if (this.managers.has(key)) {
            return this.managers.get(key);
        }

        let manager;
        switch (type) {
            case 'conversations':
                manager = this.createConversationsManager(options);
                break;
            case 'messages':
                manager = this.createMessagesManager(options);
                break;
            case 'readState':
                manager = this.createReadStateManager(options);
                break;
            case 'realtimeData':
                manager = this.createRealtimeDataManager(options);
                break;
            default:
                throw new Error(`未知的管理器类型: ${type}`);
        }

        this.managers.set(key, manager);
        
        // 如果StateCoordinator可用，同时注册到协调器，避免重复管理
        if (window.StateCoordinator && window.StateCoordinator.registerManager) {
            window.StateCoordinator.registerManager(type, manager);
        }
        
        return manager;
    }

    /**
     * 创建对话管理器
     * @param {Object} options 
     * @returns {ConversationsManager}
     */
    static createConversationsManager(options) {
        if (!window.ConversationsManager) {
            console.warn('ConversationsManager 类未加载，等待加载...');
            return null;
        }
        return new window.ConversationsManager(options);
    }

    /**
     * 创建消息管理器
     * @param {Object} options 
     * @returns {MessagesManager}
     */
    static createMessagesManager(options) {
        if (!window.MessagesManager) {
            console.warn('MessagesManager 类未加载，等待加载...');
            return null;
        }
        return new window.MessagesManager(options);
    }

    /**
     * 创建已读状态管理器
     * @param {Object} options 
     * @returns {ReadStateManager}
     */
    static createReadStateManager(options) {
        if (!window.ReadStateManager) {
            console.warn('ReadStateManager 类未加载，等待加载...');
            return null;
        }
        return new window.ReadStateManager(options);
    }

    /**
     * 创建实时数据管理器
     * @param {Object} options 
     * @returns {RealtimeDataManager}
     */
    static createRealtimeDataManager(options) {
        if (!window.RealtimeDataManager) {
            console.warn('RealtimeDataManager 类未加载，等待加载...');
            return null;
        }
        return new window.RealtimeDataManager(options);
    }

    /**
     * 获取所有管理器实例
     * @returns {Map}
     */
    static getAllManagers() {
        return new Map(this.managers);
    }

    /**
     * 销毁指定类型的管理器
     * @param {string} type 
     */
    static destroyManagersByType(type) {
        for (const [key, manager] of this.managers) {
            if (key.startsWith(type + '_')) {
                if (manager && typeof manager.destroy === 'function') {
                    manager.destroy();
                }
                this.managers.delete(key);
            }
        }
    }

    /**
     * 销毁所有管理器
     */
    static destroyAll() {
        for (const [key, manager] of this.managers) {
            if (manager && typeof manager.destroy === 'function') {
                manager.destroy();
            }
        }
        this.managers.clear();
    }

    /**
     * 检查管理器是否存在
     * @param {string} type 
     * @param {Object} options 
     * @returns {boolean}
     */
    static hasManager(type, options = {}) {
        const key = `${type}_${JSON.stringify(options)}`;
        return this.managers.has(key);
    }
}

// 自动初始化
ManagerFactory.init();

// 全局注册
window.ManagerFactory = ManagerFactory;