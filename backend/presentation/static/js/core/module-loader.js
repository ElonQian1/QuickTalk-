/**
 * 模块加载器 - 防止重复加载和提供依赖管理
 * 
 * @author GitHub Copilot  
 * @version 1.0
 * @date 2025-10-03
 */

window.ModuleLoader = (function() {
    'use strict';
    
    const loadedModules = new Set();
    const loadingPromises = new Map();
    
    /**
     * 检查模块是否已加载
     * @param {string} moduleId 模块标识
     * @returns {boolean}
     */
    function isLoaded(moduleId) {
        return loadedModules.has(moduleId);
    }
    
    /**
     * 标记模块为已加载
     * @param {string} moduleId 模块标识
     */
    function markLoaded(moduleId) {
        loadedModules.add(moduleId);
        console.log(`✅ 模块已加载: ${moduleId}`);
    }
    
    /**
     * 防止类重复声明
     * @param {string} className 类名
     * @param {Function} classDefinition 类定义函数
     */
    function defineClass(className, classDefinition) {
        if (window[className]) {
            console.warn(`⚠️ 类 ${className} 已存在，跳过重复定义`);
            return window[className];
        }
        
        const classInstance = classDefinition();
        window[className] = classInstance;
        console.log(`✅ 类已定义: ${className}`);
        return classInstance;
    }
    
    /**
     * 安全地初始化单例
     * @param {string} instanceName 实例名
     * @param {Function} creator 创建函数
     */
    function defineSingleton(instanceName, creator) {
        if (window[instanceName]) {
            console.warn(`⚠️ 单例 ${instanceName} 已存在，跳过重复创建`);
            return window[instanceName];
        }
        
        const instance = creator();
        window[instanceName] = instance;
        console.log(`✅ 单例已创建: ${instanceName}`);
        return instance;
    }
    
    /**
     * 等待模块加载完成
     * @param {string|string[]} moduleIds 模块ID或模块ID数组
     * @returns {Promise}
     */
    function waitForModules(moduleIds) {
        const modules = Array.isArray(moduleIds) ? moduleIds : [moduleIds];
        const promises = modules.map(moduleId => {
            if (isLoaded(moduleId)) {
                return Promise.resolve();
            }
            
            if (loadingPromises.has(moduleId)) {
                return loadingPromises.get(moduleId);
            }
            
            const promise = new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (isLoaded(moduleId)) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 50);
                
                // 超时保护
                setTimeout(() => {
                    clearInterval(checkInterval);
                    console.warn(`⚠️ 模块加载超时: ${moduleId}`);
                    resolve();
                }, 10000);
            });
            
            loadingPromises.set(moduleId, promise);
            return promise;
        });
        
        return Promise.all(promises);
    }
    
    // 公开 API
    return {
        isLoaded,
        markLoaded,
        defineClass,
        defineSingleton,
        waitForModules,
        
        // 调试信息
        getLoadedModules: () => Array.from(loadedModules),
        clearCache: () => {
            loadedModules.clear();
            loadingPromises.clear();
            console.log('🧹 模块加载缓存已清理');
        }
    };
})();

// 标记模块加载器本身已加载
window.ModuleLoader.markLoaded('module-loader');