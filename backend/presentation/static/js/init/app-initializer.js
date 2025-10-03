/**
 * 应用初始化管理器
 * 确保所有模块按正确顺序加载和初始化
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-10-03
 */

window.AppInitializer = (function() {
    'use strict';
    
    const requiredModules = [
        'module-loader',
        'session-manager', 
        'customer-session-manager',
        'data-sync-manager'
    ];
    
    const optionalModules = [
        'nav-badge-manager',
        'shop-card-manager',
        'badge-integration'
    ];
    
    let isInitialized = false;
    let initCallbacks = [];
    
    /**
     * 等待必需模块加载完成
     */
    async function waitForRequiredModules() {
        console.log('🔄 等待必需模块加载...');
        await window.ModuleLoader.waitForModules(requiredModules);
        console.log('✅ 必需模块加载完成');
    }
    
    /**
     * 等待可选模块加载完成
     */
    async function waitForOptionalModules() {
        console.log('🔄 等待可选模块加载...');
        await window.ModuleLoader.waitForModules(optionalModules);
        console.log('✅ 可选模块加载完成');
    }
    
    /**
     * 初始化应用
     */
    async function initialize() {
        if (isInitialized) {
            console.log('⚠️ 应用已初始化，跳过重复初始化');
            return;
        }
        
        try {
            console.log('🚀 开始初始化应用...');
            
            // 等待必需模块
            await waitForRequiredModules();
            
            // 初始化核心实例
            if (window.DataSyncManager && !window.dataSyncManager) {
                window.dataSyncManager = new window.DataSyncManager();
                console.log('✅ DataSyncManager 实例已创建');
            }
            
            if (window.SessionManager && !window.sessionManager) {
                window.sessionManager = new window.SessionManager();
                console.log('✅ SessionManager 实例已创建');
            }
            
            // 等待可选模块
            await waitForOptionalModules();
            
            // 执行回调
            for (const callback of initCallbacks) {
                try {
                    await callback();
                } catch (error) {
                    console.error('初始化回调执行失败:', error);
                }
            }
            
            isInitialized = true;
            console.log('🎉 应用初始化完成');
            
            // 触发初始化完成事件
            document.dispatchEvent(new CustomEvent('app:initialized'));
            
        } catch (error) {
            console.error('❌ 应用初始化失败:', error);
            throw error;
        }
    }
    
    /**
     * 添加初始化完成后的回调
     */
    function onReady(callback) {
        if (isInitialized) {
            callback();
        } else {
            initCallbacks.push(callback);
        }
    }
    
    /**
     * 检查是否已初始化
     */
    function isReady() {
        return isInitialized;
    }
    
    // 公开 API
    return {
        initialize,
        onReady,
        isReady,
        
        // 调试信息
        getRequiredModules: () => [...requiredModules],
        getOptionalModules: () => [...optionalModules],
        getLoadedModules: () => window.ModuleLoader ? window.ModuleLoader.getLoadedModules() : []
    };
})();

// DOM加载完成后自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.AppInitializer.initialize();
    });
} else {
    // DOM已经加载完成
    setTimeout(() => {
        window.AppInitializer.initialize();
    }, 100);
}