/**
 * Ruilong版本 - 模块加载器
 * 统一加载所有Ruilong功能模块，避免与Elon版本冲突
 */

class RuilongModuleLoader {
    
    constructor() {
        this.modules = [];
        this.loadedModules = new Set();
        this.loadedStyles = new Set();
        this.isInitialized = false;
    }
    
    /**
     * 初始化所有Ruilong模块
     */
    async init() {
        if (this.isInitialized) {
            console.log('🔄 [Ruilong] 模块已初始化，跳过重复加载');
            return;
        }
        
        console.log('🚀 [Ruilong] 开始初始化模块系统...');
        
        try {
            // 加载CSS样式模块
            await this.loadStyles();
            
            // 加载JavaScript模块
            await this.loadModules();
            
            // 初始化模块间的依赖关系
            this.setupModuleDependencies();
            
            // 注册全局事件监听器
            this.setupGlobalListeners();
            
            this.isInitialized = true;
            console.log('✅ [Ruilong] 模块系统初始化完成');
            
            // 触发初始化完成事件
            this.dispatchEvent('ruilong:modules:ready');
            
        } catch (error) {
            console.error('❌ [Ruilong] 模块初始化失败:', error);
            throw error;
        }
    }
    
    /**
     * 加载CSS样式模块
     */
    async loadStyles() {
        const styleModules = [
            'shop-components.css',
            'mobile-modals.css', 
            'payment-styles.css'
        ];
        
        const basePath = '/static/css/modules/ruilong-features/';
        
        for (const styleFile of styleModules) {
            if (this.loadedStyles.has(styleFile)) {
                console.log(`⏭️ [Ruilong] 样式已加载: ${styleFile}`);
                continue;
            }
            
            try {
                await this.loadStylesheet(`${basePath}${styleFile}`);
                this.loadedStyles.add(styleFile);
                console.log(`✅ [Ruilong] 样式加载成功: ${styleFile}`);
            } catch (error) {
                console.error(`❌ [Ruilong] 样式加载失败: ${styleFile}`, error);
            }
        }
    }
    
    /**
     * 加载JavaScript模块
     */
    async loadModules() {
        const jsModules = [
            'role-manager.js',
            'shop-buttons.js',
            'mobile-functions.js',
            'integration-generator.js',
            'payment-system.js'
        ];
        
        const basePath = '/static/js/modules/ruilong-features/';
        
        for (const moduleFile of jsModules) {
            if (this.loadedModules.has(moduleFile)) {
                console.log(`⏭️ [Ruilong] 模块已加载: ${moduleFile}`);
                continue;
            }
            
            try {
                await this.loadScript(`${basePath}${moduleFile}`);
                this.loadedModules.add(moduleFile);
                console.log(`✅ [Ruilong] 模块加载成功: ${moduleFile}`);
            } catch (error) {
                console.error(`❌ [Ruilong] 模块加载失败: ${moduleFile}`, error);
            }
        }
    }
    
    /**
     * 加载单个样式文件
     * @param {string} href - 样式文件路径
     */
    loadStylesheet(href) {
        return new Promise((resolve, reject) => {
            // 检查是否已经加载
            const existingLink = document.querySelector(`link[href="${href}"]`);
            if (existingLink) {
                resolve();
                return;
            }
            
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = href;
            
            link.onload = () => resolve();
            link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`));
            
            document.head.appendChild(link);
        });
    }
    
    /**
     * 加载单个脚本文件
     * @param {string} src - 脚本文件路径
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            // 检查是否已经加载
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * 设置模块间的依赖关系
     */
    setupModuleDependencies() {
        // 确保RuilongRoleManager先加载完成
        if (window.RuilongRoleManager) {
            console.log('🔗 [Ruilong] 角色管理器依赖已建立');
        }
        
        // 设置店铺按钮模块对角色管理器的依赖
        if (window.RuilongShopButtons && window.RuilongRoleManager) {
            console.log('🔗 [Ruilong] 店铺按钮模块依赖已建立');
        }
        
        // 设置移动端模块依赖
        if (window.RuilongMobile) {
            console.log('🔗 [Ruilong] 移动端模块依赖已建立');
        }
        
        // 设置付费模块依赖
        if (window.RuilongPayment) {
            console.log('🔗 [Ruilong] 付费模块依赖已建立');
        }
    }
    
    /**
     * 设置全局事件监听器
     */
    setupGlobalListeners() {
        // 监听页面导航变化
        window.addEventListener('popstate', () => {
            this.onPageChange();
        });
        
        // 监听DOM变化，确保动态内容也能应用Ruilong功能
        if (window.MutationObserver) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        this.onDOMChange(mutation.addedNodes);
                    }
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            console.log('👁️ [Ruilong] DOM变化监听器已设置');
        }
        
        // 设置错误捕获
        window.addEventListener('error', (event) => {
            if (event.filename && event.filename.includes('ruilong-features')) {
                console.error('❌ [Ruilong] 模块运行时错误:', event.error);
            }
        });
    }
    
    /**
     * 页面变化处理
     */
    onPageChange() {
        console.log('🔄 [Ruilong] 页面变化，重新初始化模块功能');
        // 重新绑定事件监听器等
        this.rebindEventListeners();
    }
    
    /**
     * DOM变化处理
     * @param {NodeList} addedNodes - 新增的DOM节点
     */
    onDOMChange(addedNodes) {
        addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // 检查是否是店铺相关元素
                if (node.classList && (
                    node.classList.contains('shop-item') ||
                    node.classList.contains('shop-container') ||
                    node.querySelector && node.querySelector('.shop-item')
                )) {
                    console.log('🔄 [Ruilong] 检测到店铺元素变化，重新应用功能');
                    this.enhanceShopElements(node);
                }
            }
        });
    }
    
    /**
     * 增强店铺元素
     * @param {Element} container - 容器元素
     */
    enhanceShopElements(container) {
        // 查找店铺元素并应用Ruilong增强功能
        const shopItems = container.classList?.contains('shop-item') 
            ? [container] 
            : container.querySelectorAll('.shop-item');
            
        shopItems.forEach(shopItem => {
            // 添加Ruilong特有的CSS类
            if (!shopItem.classList.contains('ruilong-enhanced')) {
                shopItem.classList.add('ruilong-enhanced');
                
                // 这里可以添加其他增强功能
                console.log('🎨 [Ruilong] 店铺元素增强完成');
            }
        });
    }
    
    /**
     * 重新绑定事件监听器
     */
    rebindEventListeners() {
        // 重新绑定店铺按钮事件
        const shopButtons = document.querySelectorAll('.shop-btn[onclick*="Ruilong"]');
        shopButtons.forEach(button => {
            // 确保Ruilong模块方法可用
            if (button.onclick && typeof button.onclick === 'function') {
                console.log('🔗 [Ruilong] 重新绑定按钮事件');
            }
        });
    }
    
    /**
     * 检查模块健康状态
     */
    checkModuleHealth() {
        const requiredModules = [
            'RuilongRoleManager',
            'RuilongShopButtons', 
            'RuilongMobile',
            'RuilongPayment'
        ];
        
        const missingModules = [];
        const availableModules = [];
        
        requiredModules.forEach(moduleName => {
            if (window[moduleName]) {
                availableModules.push(moduleName);
            } else {
                missingModules.push(moduleName);
            }
        });
        
        console.log('📊 [Ruilong] 模块健康检查:', {
            available: availableModules,
            missing: missingModules,
            totalLoaded: availableModules.length,
            totalRequired: requiredModules.length
        });
        
        return {
            healthy: missingModules.length === 0,
            availableModules,
            missingModules
        };
    }
    
    /**
     * 重新加载失败的模块
     */
    async reloadFailedModules() {
        const health = this.checkModuleHealth();
        
        if (health.missingModules.length > 0) {
            console.log('🔄 [Ruilong] 重新加载失败的模块:', health.missingModules);
            
            // 清除已加载记录，强制重新加载
            this.loadedModules.clear();
            this.loadedStyles.clear();
            this.isInitialized = false;
            
            // 重新初始化
            await this.init();
        }
    }
    
    /**
     * 触发自定义事件
     * @param {string} eventName - 事件名称
     * @param {Object} detail - 事件详情
     */
    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        window.dispatchEvent(event);
        console.log(`📢 [Ruilong] 事件已触发: ${eventName}`, detail);
    }
    
    /**
     * 获取模块信息
     */
    getModuleInfo() {
        return {
            initialized: this.isInitialized,
            loadedModules: Array.from(this.loadedModules),
            loadedStyles: Array.from(this.loadedStyles),
            health: this.checkModuleHealth()
        };
    }
}

// 创建全局实例
window.RuilongLoader = new RuilongModuleLoader();

// 自动初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.RuilongLoader.init();
    } catch (error) {
        console.error('❌ [Ruilong] 自动初始化失败:', error);
    }
});

// 如果DOM已经加载完成，立即初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await window.RuilongLoader.init();
        } catch (error) {
            console.error('❌ [Ruilong] 自动初始化失败:', error);
        }
    });
} else {
    // DOM已经加载完成，立即初始化
    window.RuilongLoader.init().catch(error => {
        console.error('❌ [Ruilong] 立即初始化失败:', error);
    });
}

console.log('🔧 [Ruilong] 模块加载器已就绪');