/**
 * 基础日志器 - 为其他模块提供日志服务
 * 兼容旧版Logger接口，同时为UnifiedLogger提供基础
 */
(function() {
    'use strict';

    const Logger = {
        levels: {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3
        },

        currentLevel: 1, // 默认INFO级别

        setLevel(level) {
            if (typeof level === 'string') {
                this.currentLevel = this.levels[level.toUpperCase()] || 1;
            } else {
                this.currentLevel = level;
            }
        },

        shouldLog(level) {
            return level >= this.currentLevel;
        },

        formatMessage(level, module, message, ...args) {
            const timestamp = new Date().toISOString();
            const levelStr = Object.keys(this.levels)[level] || 'INFO';
            const prefix = `[${timestamp}] [${levelStr}] [${module}]`;
            
            return {
                prefix,
                message: typeof message === 'string' ? message : JSON.stringify(message),
                args
            };
        },

        debug(module, message, ...args) {
            if (!this.shouldLog(this.levels.DEBUG)) return;
            
            const formatted = this.formatMessage(this.levels.DEBUG, module, message, ...args);
            console.debug(formatted.prefix, formatted.message, ...formatted.args);
        },

        info(module, message, ...args) {
            if (!this.shouldLog(this.levels.INFO)) return;
            
            const formatted = this.formatMessage(this.levels.INFO, module, message, ...args);
            console.info(formatted.prefix, formatted.message, ...formatted.args);
        },

        warn(module, message, ...args) {
            if (!this.shouldLog(this.levels.WARN)) return;
            
            const formatted = this.formatMessage(this.levels.WARN, module, message, ...args);
            console.warn(formatted.prefix, formatted.message, ...formatted.args);
        },

        error(module, message, ...args) {
            if (!this.shouldLog(this.levels.ERROR)) return;
            
            const formatted = this.formatMessage(this.levels.ERROR, module, message, ...args);
            console.error(formatted.prefix, formatted.message, ...formatted.args);
        },

        // 创建模块专用日志器
        createModuleLogger(moduleName) {
            return {
                debug: (...args) => this.debug(moduleName, ...args),
                info: (...args) => this.info(moduleName, ...args),
                warn: (...args) => this.warn(moduleName, ...args),
                error: (...args) => this.error(moduleName, ...args),
                log: (...args) => this.info(moduleName, ...args) // 兼容console.log
            };
        },

        // 兼容旧版接口
        log(level, module, message, ...args) {
            const levelNum = typeof level === 'string' 
                ? this.levels[level.toUpperCase()] 
                : level;
            
            switch (levelNum) {
                case this.levels.DEBUG:
                    this.debug(module, message, ...args);
                    break;
                case this.levels.INFO:
                    this.info(module, message, ...args);
                    break;
                case this.levels.WARN:
                    this.warn(module, message, ...args);
                    break;
                case this.levels.ERROR:
                    this.error(module, message, ...args);
                    break;
                default:
                    this.info(module, message, ...args);
            }
        }
    };

    // 根据环境设置日志级别
    if (window.QT_CONFIG?.features?.debug) {
        Logger.setLevel('DEBUG');
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        Logger.setLevel('INFO');
    } else {
        Logger.setLevel('WARN');
    }

    // 全局暴露
    window.Logger = Logger;
    
    // 创建默认的基础日志器实例
    window.Loggers = window.Loggers || {};

    // 模块注册
    if (typeof window.ModuleLoader?.registerModule === 'function') {
        window.ModuleLoader.registerModule('logger', 'core', 'Logger 已加载');
    } else {
        console.log('✅ Logger 已加载');
    }
})();