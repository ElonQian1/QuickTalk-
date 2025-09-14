/**
 * 模块加载器 - 统一的ES6模块加载和管理系统
 */
class ModuleLoader {
    constructor() {
        this.modules = new Map();
        this.loadingPromises = new Map();
        this.dependencies = new Map();
        this.initialized = new Set();
        this.config = {
            baseURL: '/assets/js/',
            timeout: 10000,
            retryCount: 3
        };
    }

    /**
     * 设置配置
     * @param {Object} config - 配置对象
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }

    /**
     * 加载单个模块
     * @param {string} moduleName - 模块名称
     * @param {Object} options - 加载选项
     * @returns {Promise<Object>} - 模块对象
     */
    async loadModule(moduleName, options = {}) {
        // 如果模块已加载，直接返回
        if (this.modules.has(moduleName)) {
            return this.modules.get(moduleName);
        }

        // 如果正在加载，返回加载Promise
        if (this.loadingPromises.has(moduleName)) {
            return this.loadingPromises.get(moduleName);
        }

        // 创建加载Promise
        const loadingPromise = this._loadModuleInternal(moduleName, options);
        this.loadingPromises.set(moduleName, loadingPromise);

        try {
            const module = await loadingPromise;
            this.modules.set(moduleName, module);
            this.loadingPromises.delete(moduleName);
            return module;
        } catch (error) {
            this.loadingPromises.delete(moduleName);
            throw error;
        }
    }

    /**
     * 内部模块加载逻辑
     * @private
     */
    async _loadModuleInternal(moduleName, options) {
        const { path, dependencies = [], retryCount = this.config.retryCount } = options;
        
        let lastError;
        
        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                // 加载依赖
                if (dependencies.length > 0) {
                    await this.loadModules(dependencies);
                }

                // 构建模块路径
                const modulePath = path || this._resolveModulePath(moduleName);
                
                // 使用动态导入加载模块
                const module = await this._importWithTimeout(modulePath);
                
                console.log(`✅ 模块加载成功: ${moduleName}`);
                return module;
                
            } catch (error) {
                lastError = error;
                console.warn(`⚠️ 模块加载失败 (尝试 ${attempt + 1}/${retryCount + 1}): ${moduleName}`, error);
                
                if (attempt < retryCount) {
                    // 等待后重试
                    await this._wait(1000 * (attempt + 1));
                }
            }
        }
        
        console.error(`❌ 模块加载最终失败: ${moduleName}`, lastError);
        throw new Error(`加载模块失败: ${moduleName} - ${lastError.message}`);
    }

    /**
     * 批量加载模块
     * @param {Array} moduleList - 模块列表
     * @returns {Promise<Object>} - 加载结果
     */
    async loadModules(moduleList) {
        const promises = moduleList.map(moduleInfo => {
            if (typeof moduleInfo === 'string') {
                return this.loadModule(moduleInfo);
            } else {
                return this.loadModule(moduleInfo.name, moduleInfo.options);
            }
        });

        const results = await Promise.allSettled(promises);
        
        const loaded = [];
        const failed = [];
        
        results.forEach((result, index) => {
            const moduleInfo = moduleList[index];
            const moduleName = typeof moduleInfo === 'string' ? moduleInfo : moduleInfo.name;
            
            if (result.status === 'fulfilled') {
                loaded.push({ name: moduleName, module: result.value });
            } else {
                failed.push({ name: moduleName, error: result.reason });
            }
        });

        return { loaded, failed };
    }

    /**
     * 初始化模块
     * @param {string} moduleName - 模块名称
     * @param {Object} initOptions - 初始化选项
     */
    async initializeModule(moduleName, initOptions = {}) {
        if (this.initialized.has(moduleName)) {
            console.log(`模块已初始化: ${moduleName}`);
            return;
        }

        const module = this.modules.get(moduleName);
        if (!module) {
            throw new Error(`模块未加载: ${moduleName}`);
        }

        try {
            // 调用模块的初始化方法
            if (module.default && typeof module.default.init === 'function') {
                await module.default.init(initOptions);
            } else if (typeof module.init === 'function') {
                await module.init(initOptions);
            }

            this.initialized.add(moduleName);
            console.log(`✅ 模块初始化成功: ${moduleName}`);
            
            // 触发模块初始化事件
            if (window.eventBus) {
                window.eventBus.emit('module:initialized', { name: moduleName, module });
            }
            
        } catch (error) {
            console.error(`❌ 模块初始化失败: ${moduleName}`, error);
            throw error;
        }
    }

    /**
     * 获取已加载的模块
     * @param {string} moduleName - 模块名称
     * @returns {Object|null} - 模块对象
     */
    getModule(moduleName) {
        return this.modules.get(moduleName) || null;
    }

    /**
     * 检查模块是否已加载
     * @param {string} moduleName - 模块名称
     * @returns {boolean} - 是否已加载
     */
    isLoaded(moduleName) {
        return this.modules.has(moduleName);
    }

    /**
     * 检查模块是否已初始化
     * @param {string} moduleName - 模块名称
     * @returns {boolean} - 是否已初始化
     */
    isInitialized(moduleName) {
        return this.initialized.has(moduleName);
    }

    /**
     * 卸载模块
     * @param {string} moduleName - 模块名称
     */
    unloadModule(moduleName) {
        const module = this.modules.get(moduleName);
        
        if (module) {
            // 调用模块的销毁方法
            try {
                if (module.default && typeof module.default.destroy === 'function') {
                    module.default.destroy();
                } else if (typeof module.destroy === 'function') {
                    module.destroy();
                }
            } catch (error) {
                console.warn(`模块销毁时出错: ${moduleName}`, error);
            }

            this.modules.delete(moduleName);
            this.initialized.delete(moduleName);
            
            console.log(`🗑️ 模块已卸载: ${moduleName}`);
        }
    }

    /**
     * 获取所有已加载的模块
     * @returns {Array} - 模块名称列表
     */
    getLoadedModules() {
        return Array.from(this.modules.keys());
    }

    /**
     * 清理所有模块
     */
    clear() {
        // 卸载所有模块
        for (const moduleName of this.modules.keys()) {
            this.unloadModule(moduleName);
        }
        
        this.modules.clear();
        this.loadingPromises.clear();
        this.dependencies.clear();
        this.initialized.clear();
    }

    /**
     * 预加载模块
     * @param {Array} moduleList - 要预加载的模块列表
     */
    async preloadModules(moduleList) {
        console.log('开始预加载模块...', moduleList);
        
        const { loaded, failed } = await this.loadModules(moduleList);
        
        console.log(`预加载完成: 成功 ${loaded.length} 个，失败 ${failed.length} 个`);
        
        if (failed.length > 0) {
            console.warn('预加载失败的模块:', failed);
        }
        
        return { loaded, failed };
    }

    /**
     * 解析模块路径
     * @private
     */
    _resolveModulePath(moduleName) {
        // 如果包含路径分隔符，直接返回
        if (moduleName.includes('/')) {
            return `${this.config.baseURL}${moduleName}`;
        }
        
        // 自动推断路径
        const pathMap = {
            // 核心模块
            'api-client': 'core/api-client.js',
            'utils': 'core/utils.js',
            'config': 'core/config.js',
            'event-bus': 'core/event-bus.js',
            
            // 管理器
            'auth-manager': 'managers/auth-manager.js',
            'shop-manager': 'managers/shop-manager.js',
            'message-manager': 'managers/message-manager.js',
            'page-manager': 'managers/page-manager.js',
            
            // 组件
            'modal': 'components/modal.js',
            'toast': 'components/toast.js',
            'pagination': 'components/pagination.js',
            
            // 服务
            'websocket-service': 'services/websocket-service.js',
            'notification-service': 'services/notification-service.js'
        };
        
        const path = pathMap[moduleName];
        if (path) {
            return `${this.config.baseURL}${path}`;
        }
        
        // 默认路径
        return `${this.config.baseURL}${moduleName}.js`;
    }

    /**
     * 带超时的动态导入
     * @private
     */
    async _importWithTimeout(modulePath) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`模块加载超时: ${modulePath}`));
            }, this.config.timeout);

            import(modulePath)
                .then(module => {
                    clearTimeout(timer);
                    resolve(module);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /**
     * 等待指定时间
     * @private
     */
    _wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 创建全局模块加载器实例
window.moduleLoader = new ModuleLoader();

export default ModuleLoader;