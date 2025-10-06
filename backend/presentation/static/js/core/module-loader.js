/**
 * 统一模块加载管理器
 * 消除重复的模块加载日志和初始化模式
 */

class ModuleLoader {
    static loaded = new Set();
    static dependencies = new Map();
    static initCallbacks = new Map();

    /**
     * 注册模块加载完成
     * @param {string} moduleName - 模块名称
     * @param {string} moduleType - 模块类型 (manager/utils/core/ui/usecase)
     * @param {Function} [initCallback] - 初始化回调
     */
    static register(moduleName, moduleType, initCallback = null) {
        if (this.loaded.has(moduleName)) {
            return; // 避免重复注册
        }

        this.loaded.add(moduleName);
        
        // 统一的加载日志格式
        const emoji = this.getTypeEmoji(moduleType);
        const typeName = this.getTypeName(moduleType);
        console.log(`${emoji} ${moduleName} ${typeName}已加载`);

        if (initCallback) {
            this.initCallbacks.set(moduleName, initCallback);
        }

        this.checkDependencies(moduleName);
    }

    /**
     * 设置模块依赖关系
     * @param {string} moduleName - 模块名称
     * @param {string[]} dependencies - 依赖的模块列表
     */
    static setDependencies(moduleName, dependencies) {
        this.dependencies.set(moduleName, dependencies);
    }

    /**
     * 检查并执行依赖就绪的模块初始化
     * @param {string} justLoadedModule - 刚加载的模块
     */
    static checkDependencies(justLoadedModule) {
        this.dependencies.forEach((deps, moduleName) => {
            if (this.initCallbacks.has(moduleName) && !this.initCallbacks.get(moduleName).executed) {
                const allDepsLoaded = deps.every(dep => this.loaded.has(dep));
                if (allDepsLoaded) {
                    const callback = this.initCallbacks.get(moduleName);
                    callback.executed = true;
                    callback();
                    console.log(`🚀 ${moduleName} 初始化完成 (依赖: ${deps.join(', ')})`);
                }
            }
        });
    }

    /**
     * 获取模块类型的emoji
     * @param {string} moduleType 
     * @returns {string}
     */
    static getTypeEmoji(moduleType) {
        const emojis = {
            'manager': '📊',
            'utils': '🔧',
            'core': '⚡',
            'ui': '🎨',
            'usecase': '💼',
            'websocket': '🌐',
            'compat': '🔄'
        };
        return emojis[moduleType] || '✅';
    }

    /**
     * 获取模块类型的中文名称
     * @param {string} moduleType 
     * @returns {string}
     */
    static getTypeName(moduleType) {
        const names = {
            'manager': '管理器',
            'utils': '工具库',
            'core': '核心模块',
            'ui': 'UI组件',
            'usecase': '用例模块',
            'websocket': 'WebSocket模块',
            'compat': '兼容层'
        };
        return names[moduleType] || '模块';
    }

    /**
     * 检查模块是否已加载
     * @param {string} moduleName 
     * @returns {boolean}
     */
    static isLoaded(moduleName) {
        return this.loaded.has(moduleName);
    }

    /**
     * 等待模块加载完成
     * @param {string[]} moduleNames - 要等待的模块列表
     * @returns {Promise}
     */
    static waitFor(moduleNames) {
        return new Promise((resolve) => {
            const checkLoaded = () => {
                if (moduleNames.every(name => this.loaded.has(name))) {
                    resolve();
                } else {
                    setTimeout(checkLoaded, 10);
                }
            };
            checkLoaded();
        });
    }

    /**
     * 获取已加载模块列表
     * @returns {string[]}
     */
    static getLoadedModules() {
        return Array.from(this.loaded);
    }

    /**
     * 统一错误处理
     * @param {string} moduleName - 模块名称
     * @param {string} operation - 操作名称
     * @param {Error} error - 错误对象
     */
    static handleError(moduleName, operation, error) {
        console.error(`❌ [${moduleName}] ${operation} 失败:`, error);
    }

    /**
     * 统一警告处理
     * @param {string} moduleName - 模块名称
     * @param {string} message - 警告消息
     */
    static warn(moduleName, message) {
        console.warn(`⚠️ [${moduleName}] ${message}`);
    }
}

// 全局注册函数简化调用（避免覆盖现有的registerModule）
if (!window.registerModule) {
    window.registerModule = (name, type, initCallback) => ModuleLoader.register(name, type, initCallback);
}

console.log('⚡ ModuleLoader 模块加载管理器已加载');