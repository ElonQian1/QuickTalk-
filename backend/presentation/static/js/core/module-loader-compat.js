/**
 * ModuleLoader 兼容性桥接
 * 为了向后兼容旧的模块加载系统
 */

// 创建 ModuleLoader 兼容接口
window.ModuleLoader = {
    // 模拟已加载的模块列表
    loadedModules: new Set(),
    
    /**
     * 标记模块已加载
     */
    markLoaded(moduleName) {
        this.loadedModules.add(moduleName);
        console.log(`📦 ModuleLoader (兼容): 模块已标记为加载 - ${moduleName}`);
        return true;
    },
    
    /**
     * 检查模块是否已加载
     */
    isLoaded(moduleName) {
        // 先检查新模块系统
        if (window.ModuleRegistry) {
            const newModuleName = this.convertToNewModuleName(moduleName);
            if (window.ModuleRegistry.isRegistered(newModuleName)) {
                return true;
            }
        }
        
        // 检查旧标记系统
        return this.loadedModules.has(moduleName);
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
            const instance = factory();
            window[className] = instance;
            this.markLoaded(className.toLowerCase().replace(/([A-Z])/g, '-$1').substring(1));
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
        const modules = Array.from(this.loadedModules);
        
        // 添加新模块系统中的模块
        if (window.ModuleRegistry) {
            const newModules = window.ModuleRegistry.getRegisteredModules();
            modules.push(...newModules);
        }
        
        return [...new Set(modules)]; // 去重
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