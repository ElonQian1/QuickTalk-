/**
 * 模块注册中心
 * 轻量级模块管理，替代之前的复杂模块加载器
 * 
 * @author GitHub Copilot
 * @version 2.0  
 * @date 2025-10-03
 */

class ModuleRegistry {
    constructor() {
        this.modules = new Map();
        this.instances = new Map();
        this.dependencies = new Map();
        this.loading = new Set();
        this.ready = new Set();
    }

    /**
     * 注册模块
     * @param {string} name 模块名
     * @param {Function|Object} moduleDefinition 模块定义
     * @param {string[]} deps 依赖模块
     */
    register(name, moduleDefinition, deps = []) {
        if (this.modules.has(name)) {
            console.warn(`⚠️ 模块 ${name} 已存在，跳过注册`);
            return;
        }

        this.modules.set(name, moduleDefinition);
        this.dependencies.set(name, deps);
        
        console.log(`📦 模块已注册: ${name} (依赖: ${deps.join(', ') || '无'})`);
    }

    /**
     * 获取模块实例
     * @param {string} name 模块名
     * @returns {Object|null} 模块实例
     */
    get(name) {
        if (this.instances.has(name)) {
            return this.instances.get(name);
        }

        if (!this.modules.has(name)) {
            console.error(`❌ 模块 ${name} 未注册`);
            return null;
        }

        return this._createInstance(name);
    }

    /**
     * 检查模块是否已准备就绪
     * @param {string} name 模块名
     */
    isReady(name) {
        return this.ready.has(name);
    }

    /**
     * 等待模块就绪
     * @param {string|string[]} names 模块名或模块名数组
     * @returns {Promise}
     */
    async waitFor(names) {
        const moduleNames = Array.isArray(names) ? names : [names];
        
        const promises = moduleNames.map(name => {
            if (this.isReady(name)) {
                return Promise.resolve();
            }

            return new Promise((resolve) => {
                const checkReady = () => {
                    if (this.isReady(name)) {
                        resolve();
                    } else {
                        setTimeout(checkReady, 50);
                    }
                };
                checkReady();
            });
        });

        return Promise.all(promises);
    }

    /**
     * 创建模块实例
     * @private
     */
    _createInstance(name) {
        if (this.loading.has(name)) {
            console.warn(`⚠️ 模块 ${name} 正在加载中`);
            return null;
        }

        this.loading.add(name);

        try {
            // 检查依赖
            const deps = this.dependencies.get(name) || [];
            const resolvedDeps = {};

            for (const dep of deps) {
                const depInstance = this.get(dep);
                if (!depInstance) {
                    throw new Error(`依赖模块 ${dep} 不可用`);
                }
                resolvedDeps[dep] = depInstance;
            }

            // 创建实例
            const moduleDefinition = this.modules.get(name);
            let instance;

            if (typeof moduleDefinition === 'function') {
                instance = new moduleDefinition(resolvedDeps);
            } else {
                instance = moduleDefinition;
            }

            this.instances.set(name, instance);
            this.ready.add(name);
            this.loading.delete(name);

            console.log(`✅ 模块实例已创建: ${name}`);
            return instance;

        } catch (error) {
            this.loading.delete(name);
            console.error(`❌ 创建模块 ${name} 失败:`, error);
            return null;
        }
    }

    /**
     * 获取所有已注册的模块名
     */
    getRegisteredModules() {
        return Array.from(this.modules.keys());
    }

    /**
     * 获取所有已准备的模块名
     */
    getReadyModules() {
        return Array.from(this.ready);
    }

    /**
     * 判断模块是否已注册
     */
    isRegistered(name) {
        return this.modules.has(name);
    }

    /**
     * 清理所有模块（主要用于测试）
     */
    clear() {
        this.modules.clear();
        this.instances.clear();
        this.dependencies.clear();
        this.loading.clear();
        this.ready.clear();
        console.log('🧹 模块注册中心已清理');
    }
}

// 创建全局单例
window.ModuleRegistry = window.ModuleRegistry || new ModuleRegistry();
// 确保 ModuleLoader 兼容对象存在（由 compat 脚本提供或占位）
window.ModuleLoader = window.ModuleLoader || { defineClass: function(n, f){ try { return f(); } catch(e){ console.error('ModuleLoader.defineClass error', e); } } };

// 便捷的全局函数
window.registerModule = (name, definition, deps) => {
    window.ModuleRegistry.register(name, definition, deps);
};

window.getModule = (name) => {
    return window.ModuleRegistry.get(name);
};

window.waitForModules = (names) => {
    return window.ModuleRegistry.waitFor(names);
};

console.log('🏗️ 模块注册中心已初始化');