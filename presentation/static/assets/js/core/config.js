/**
 * 配置管理器 - 统一管理应用配置
 */
class ConfigManager {
    constructor() {
        this.config = {
            // API配置
            api: {
                baseURL: window.location.origin,
                timeout: 10000,
                retryCount: 3
            },

            // WebSocket配置
            websocket: {
                url: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`,
                reconnectInterval: 5000,
                maxReconnectAttempts: 10
            },

            // 应用配置
            app: {
                name: 'QuickTalk客服系统',
                version: '2.0.0',
                debug: localStorage.getItem('debug') === 'true'
            },

            // UI配置
            ui: {
                theme: 'default',
                language: 'zh-CN',
                pageSize: 20,
                animationDuration: 300
            },

            // 消息配置
            message: {
                maxLength: 1000,
                typingTimeout: 3000,
                messageRetention: 30 * 24 * 60 * 60 * 1000 // 30天
            },

            // 文件上传配置
            upload: {
                maxFileSize: 10 * 1024 * 1024, // 10MB
                allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
                endpoint: '/api/upload'
            },

            // 安全配置
            security: {
                sessionTimeout: 24 * 60 * 60 * 1000, // 24小时
                maxLoginAttempts: 5,
                lockoutTime: 15 * 60 * 1000 // 15分钟
            }
        };

        // 加载用户配置
        this.loadUserConfig();
    }

    /**
     * 获取配置值
     * @param {string} path - 配置路径，如 'api.baseURL'
     * @param {*} defaultValue - 默认值
     * @returns {*} 配置值
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let value = this.config;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }

        return value;
    }

    /**
     * 设置配置值
     * @param {string} path - 配置路径
     * @param {*} value - 配置值
     */
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this.config;

        for (const key of keys) {
            if (!(key in target) || typeof target[key] !== 'object') {
                target[key] = {};
            }
            target = target[key];
        }

        target[lastKey] = value;
        this.saveUserConfig();
    }

    /**
     * 获取完整配置
     */
    getAll() {
        return Utils.deepClone(this.config);
    }

    /**
     * 批量更新配置
     * @param {Object} newConfig - 新配置对象
     */
    update(newConfig) {
        this.config = this.mergeConfig(this.config, newConfig);
        this.saveUserConfig();
    }

    /**
     * 重置配置到默认值
     */
    reset() {
        localStorage.removeItem('userConfig');
        this.loadUserConfig();
    }

    /**
     * 加载用户自定义配置
     */
    loadUserConfig() {
        try {
            const userConfig = localStorage.getItem('userConfig');
            if (userConfig) {
                const parsed = JSON.parse(userConfig);
                this.config = this.mergeConfig(this.config, parsed);
            }
        } catch (error) {
            console.warn('加载用户配置失败:', error);
        }
    }

    /**
     * 保存用户配置
     */
    saveUserConfig() {
        try {
            const userConfig = {
                ui: this.config.ui,
                message: this.config.message
            };
            localStorage.setItem('userConfig', JSON.stringify(userConfig));
        } catch (error) {
            console.warn('保存用户配置失败:', error);
        }
    }

    /**
     * 深度合并配置对象
     */
    mergeConfig(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (
                    typeof source[key] === 'object' &&
                    source[key] !== null &&
                    !Array.isArray(source[key]) &&
                    typeof result[key] === 'object' &&
                    result[key] !== null &&
                    !Array.isArray(result[key])
                ) {
                    result[key] = this.mergeConfig(result[key], source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }

        return result;
    }

    /**
     * 启用调试模式
     */
    enableDebug() {
        this.set('app.debug', true);
        localStorage.setItem('debug', 'true');
    }

    /**
     * 禁用调试模式
     */
    disableDebug() {
        this.set('app.debug', false);
        localStorage.removeItem('debug');
    }

    /**
     * 检查是否为调试模式
     */
    isDebugMode() {
        return this.get('app.debug', false);
    }

    /**
     * 获取环境信息
     */
    getEnvironment() {
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        } else if (hostname.includes('test') || hostname.includes('staging')) {
            return 'staging';
        } else {
            return 'production';
        }
    }

    /**
     * 验证配置
     */
    validate() {
        const errors = [];

        // 验证必需的配置项
        const requiredPaths = [
            'api.baseURL',
            'websocket.url',
            'app.name'
        ];

        for (const path of requiredPaths) {
            if (!this.get(path)) {
                errors.push(`缺少必需的配置: ${path}`);
            }
        }

        // 验证数值配置
        const numericPaths = [
            { path: 'api.timeout', min: 1000 },
            { path: 'message.maxLength', min: 1 },
            { path: 'upload.maxFileSize', min: 1 }
        ];

        for (const { path, min, max } of numericPaths) {
            const value = this.get(path);
            if (typeof value === 'number') {
                if (min !== undefined && value < min) {
                    errors.push(`配置 ${path} 值过小，最小值为 ${min}`);
                }
                if (max !== undefined && value > max) {
                    errors.push(`配置 ${path} 值过大，最大值为 ${max}`);
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// 创建全局配置管理实例
window.configManager = new ConfigManager();
window.ConfigManager = ConfigManager;