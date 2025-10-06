/**
 * ModuleLoader 兼容性桥接
 * 为了向后兼容旧的模块加载系统，桥接到 ModuleRegistry
 * 
 * @deprecated 推荐直接使用 ModuleRegistry
 * @version 2.0 - 优化桥接实现
 */

// 创建 ModuleLoader 兼容接口
window.ModuleLoader = {
    /**
     * 标记模块已加载 (兼容方法)
     */
    markLoaded(moduleName) {
        // 如果 ModuleRegistry 存在，什么都不做（让 registry 管理）
        if (window.ModuleRegistry) {
            console.log(`📦 ModuleLoader (兼容): ${moduleName} - 委托给 ModuleRegistry`);
            return true;
        }
        
        // 降级处理
        console.log(`📦 ModuleLoader (兼容): 模块已标记为加载 - ${moduleName}`);
        return true;
    },
    
    /**
     * 检查模块是否已加载
     */
    isLoaded(moduleName) {
        // 委托给 ModuleRegistry
        if (window.ModuleRegistry) {
            const newModuleName = this.convertToNewModuleName(moduleName);
            return window.ModuleRegistry.isReady(newModuleName) || 
                   window.ModuleRegistry.isRegistered(newModuleName);
        }
        
        // 降级：检查全局对象是否存在
        return window[moduleName] !== undefined;
    },
    
    /**
     * 转换旧模块名到新模块名
     */
    convertToNewModuleName(oldName) {
        const nameMap = {
            'data-sync-manager': 'UnifiedDataSyncManager',
            'session-manager': 'UnifiedSessionManager',
            'shop-card-manager': 'ShopCardManager',
            'nav-badge-manager': 'NavBadgeManager',
            'event-bus': 'EventBus',
            'logger': 'Logger'
        };
        
        return nameMap[oldName] || oldName;
    },
    
    /**
     * 定义类（向后兼容）
     */
    defineClass(className, factory) {
        try {
            // 委托给 ModuleRegistry
            if (window.ModuleRegistry && window.registerModule) {
                const instance = factory();
                window.registerModule(className, instance);
                return instance;
            }
            
            // 降级处理
            const instance = factory();
            window[className] = instance;
            console.log(`📦 ModuleLoader (兼容): 类已定义 - ${className}`);
            return instance;
        } catch (error) {
            console.error(`ModuleLoader (兼容): 定义类失败 - ${className}`, error);
            return null;
        }
    },
    
    /**
     * 等待模块加载
     */
    waitForModule(moduleName, timeout = 5000) {
        return new Promise((resolve, reject) => {
            // 委托给 ModuleRegistry
            if (window.ModuleRegistry && window.waitForModules) {
                const newModuleName = this.convertToNewModuleName(moduleName);
                return window.waitForModules(newModuleName)
                    .then(() => resolve(true))
                    .catch(reject);
            }
            
            // 降级处理：简单轮询
            if (this.isLoaded(moduleName)) {
                resolve(true);
                return;
            }
            
            let attempts = 0;
            const maxAttempts = timeout / 100;
            
            const checkInterval = setInterval(() => {
                attempts++;
                
                if (this.isLoaded(moduleName)) {
                    clearInterval(checkInterval);
                    resolve(true);
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    reject(new Error(`模块加载超时: ${moduleName}`));
                }
            }, 100);
        });
    },
    
    /**
     * 获取所有已加载模块
     */
    getLoadedModules() {
        let modules = [];
        
        // 从新模块系统获取模块列表
        if (window.ModuleRegistry) {
            modules = window.ModuleRegistry.getRegisteredModules();
        }
        
        return modules;
    },
    
    /**
     * 清理缓存 (兼容方法)
     */
    clearCache() {
        if (window.ModuleRegistry) {
            console.log('📦 ModuleLoader (兼容): 清理缓存 - 委托给 ModuleRegistry');
            // ModuleRegistry 有自己的清理方法
            return;
        }
        
        console.log('📦 ModuleLoader (兼容): 缓存已清理');
    }
};

// 自动标记已知的全局模块为已加载
setTimeout(() => {
    const knownModules = [
        'EventBus',
        'Logger', 
        'UnifiedSessionManager',
        'UnifiedDataSyncManager',
        'AppConstants'
    ];
    
    knownModules.forEach(moduleName => {
        if (window[moduleName] || (window.moduleRegistry && window.moduleRegistry.isRegistered(moduleName))) {
            const oldName = moduleName.toLowerCase().replace(/([A-Z])/g, '-$1').substring(1);
            window.ModuleLoader.markLoaded(oldName);
        }
    });
}, 100);

console.log('🔄 ModuleLoader 兼容性桥接已加载');