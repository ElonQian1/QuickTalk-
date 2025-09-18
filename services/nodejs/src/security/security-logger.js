/**
 * 安全日志模块
 * 记录和监控安全相关事件
 */
const fs = require('fs').promises;
const path = require('path');

class SecurityLogger {
    constructor(options = {}) {
        this.logDir = options.logDir || './logs';
        this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB
        this.maxLogFiles = options.maxLogFiles || 5;
        this.logLevel = options.logLevel || 'INFO';
        
        this.initializeLogDir();
    }

    /**
     * 初始化日志目录
     */
    async initializeLogDir() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
        } catch (error) {
            console.error('创建日志目录失败:', error);
        }
    }

    /**
     * 格式化日志消息
     */
    formatLogMessage(level, event, data) {
        return {
            timestamp: new Date().toISOString(),
            level,
            event,
            data,
            pid: process.pid
        };
    }

    /**
     * 写入日志文件
     */
    async writeLog(filename, message) {
        try {
            const logPath = path.join(this.logDir, filename);
            const logLine = JSON.stringify(message) + '\n';
            
            await fs.appendFile(logPath, logLine);
            
            // 检查文件大小并轮转
            await this.rotateLogIfNeeded(logPath);
        } catch (error) {
            console.error('写入日志失败:', error);
        }
    }

    /**
     * 轮转日志文件
     */
    async rotateLogIfNeeded(logPath) {
        try {
            const stats = await fs.stat(logPath);
            
            if (stats.size > this.maxLogSize) {
                const dir = path.dirname(logPath);
                const basename = path.basename(logPath, '.log');
                
                // 轮转现有文件
                for (let i = this.maxLogFiles - 1; i > 0; i--) {
                    const oldFile = path.join(dir, `${basename}.${i}.log`);
                    const newFile = path.join(dir, `${basename}.${i + 1}.log`);
                    
                    try {
                        await fs.rename(oldFile, newFile);
                    } catch (error) {
                        // 文件可能不存在，忽略错误
                    }
                }
                
                // 重命名当前文件
                const newFile = path.join(dir, `${basename}.1.log`);
                await fs.rename(logPath, newFile);
            }
        } catch (error) {
            console.error('轮转日志失败:', error);
        }
    }

    /**
     * 记录API密钥验证事件
     */
    async logApiKeyEvent(event, data) {
        const message = this.formatLogMessage('SECURITY', `API_KEY_${event}`, {
            apiKey: data.apiKey ? data.apiKey.substring(0, 8) + '...' : null,
            shopId: data.shopId,
            ip: data.ip,
            userAgent: data.userAgent,
            success: data.success,
            error: data.error,
            timestamp: data.timestamp
        });

        await this.writeLog('api-key.log', message);
        
        if (!data.success) {
            await this.writeLog('security-alerts.log', message);
        }
    }

    /**
     * 记录域名验证事件
     */
    async logDomainEvent(event, data) {
        const message = this.formatLogMessage('SECURITY', `DOMAIN_${event}`, {
            requestDomain: data.requestDomain,
            authorizedDomain: data.authorizedDomain,
            shopId: data.shopId,
            ip: data.ip,
            success: data.success,
            matchType: data.matchType,
            error: data.error
        });

        await this.writeLog('domain-validation.log', message);
        
        if (!data.success) {
            await this.writeLog('security-alerts.log', message);
        }
    }

    /**
     * 记录频率限制事件
     */
    async logRateLimitEvent(event, data) {
        const message = this.formatLogMessage('SECURITY', `RATE_LIMIT_${event}`, {
            key: data.key,
            ip: data.ip,
            shopId: data.shopId,
            limit: data.limit,
            current: data.current,
            resetTime: data.resetTime,
            endpoint: data.endpoint
        });

        await this.writeLog('rate-limit.log', message);
        
        if (event === 'EXCEEDED') {
            await this.writeLog('security-alerts.log', message);
        }
    }

    /**
     * 记录访问日志
     */
    async logAccess(req, res, data = {}) {
        const message = this.formatLogMessage('ACCESS', 'HTTP_REQUEST', {
            method: req.method,
            url: req.url,
            ip: this.getClientIp(req),
            userAgent: req.headers['user-agent'],
            shopId: req.shop?.id,
            apiKey: req.apiKey ? req.apiKey.substring(0, 8) + '...' : null,
            statusCode: res.statusCode,
            responseTime: data.responseTime,
            contentLength: res.get('Content-Length'),
            referer: req.headers.referer,
            authenticated: !!req.shop,
            domainValid: req.domainValid
        });

        await this.writeLog('access.log', message);
    }

    /**
     * 记录错误日志
     */
    async logError(error, context = {}) {
        const message = this.formatLogMessage('ERROR', 'APPLICATION_ERROR', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            context,
            timestamp: new Date().toISOString()
        });

        await this.writeLog('error.log', message);
        await this.writeLog('security-alerts.log', message);
    }

    /**
     * 记录安全警报
     */
    async logSecurityAlert(type, data) {
        const message = this.formatLogMessage('ALERT', `SECURITY_${type}`, {
            ...data,
            alertTime: new Date().toISOString()
        });

        await this.writeLog('security-alerts.log', message);
        
        // 如果是高风险事件，也记录到单独的文件
        if (['ATTACK', 'BREACH', 'SUSPICIOUS'].includes(type)) {
            await this.writeLog('high-priority-alerts.log', message);
        }
    }

    /**
     * 记录店铺操作
     */
    async logShopOperation(operation, data) {
        const message = this.formatLogMessage('AUDIT', `SHOP_${operation}`, {
            shopId: data.shopId,
            operatorId: data.operatorId,
            changes: data.changes,
            ip: data.ip,
            userAgent: data.userAgent
        });

        await this.writeLog('shop-operations.log', message);
    }

    /**
     * 获取客户端IP
     */
    getClientIp(req) {
        return req.ip ||
               req.connection?.remoteAddress ||
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               '127.0.0.1';
    }

    /**
     * 创建访问日志中间件
     */
    createAccessLogMiddleware() {
        return (req, res, next) => {
            const startTime = Date.now();
            
            // 保存原始的res.end方法
            const originalEnd = res.end;
            
            // 重写res.end方法以记录响应时间
            res.end = (...args) => {
                const responseTime = Date.now() - startTime;
                
                // 记录访问日志
                this.logAccess(req, res, { responseTime }).catch(error => {
                    console.error('记录访问日志失败:', error);
                });
                
                // 调用原始方法
                originalEnd.apply(res, args);
            };
            
            next();
        };
    }

    /**
     * 创建安全事件中间件
     */
    createSecurityEventMiddleware() {
        return (req, res, next) => {
            // 监听认证失败事件
            req.on('authFailed', (data) => {
                this.logApiKeyEvent('VALIDATION_FAILED', {
                    apiKey: data.apiKey,
                    shopId: data.shopId,
                    ip: this.getClientIp(req),
                    userAgent: req.headers['user-agent'],
                    success: false,
                    error: data.error,
                    timestamp: new Date().toISOString()
                });
            });

            // 监听域名验证失败事件
            req.on('domainValidationFailed', (data) => {
                this.logDomainEvent('VALIDATION_FAILED', {
                    requestDomain: data.requestDomain,
                    authorizedDomain: data.authorizedDomain,
                    shopId: data.shopId,
                    ip: this.getClientIp(req),
                    success: false,
                    error: data.error
                });
            });

            next();
        };
    }

    /**
     * 查询日志
     */
    async queryLogs(filename, options = {}) {
        try {
            const logPath = path.join(this.logDir, filename);
            const content = await fs.readFile(logPath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            
            let logs = lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            }).filter(log => log !== null);

            // 应用过滤器
            if (options.level) {
                logs = logs.filter(log => log.level === options.level);
            }

            if (options.event) {
                logs = logs.filter(log => log.event.includes(options.event));
            }

            if (options.startTime) {
                logs = logs.filter(log => new Date(log.timestamp) >= new Date(options.startTime));
            }

            if (options.endTime) {
                logs = logs.filter(log => new Date(log.timestamp) <= new Date(options.endTime));
            }

            // 限制返回数量
            if (options.limit) {
                logs = logs.slice(-options.limit);
            }

            return logs;
        } catch (error) {
            console.error('查询日志失败:', error);
            return [];
        }
    }

    /**
     * 获取日志统计
     */
    async getLogStats() {
        const logFiles = [
            'api-key.log',
            'domain-validation.log',
            'rate-limit.log',
            'access.log',
            'error.log',
            'security-alerts.log'
        ];

        const stats = {};

        for (const filename of logFiles) {
            try {
                const logPath = path.join(this.logDir, filename);
                const fileStat = await fs.stat(logPath);
                stats[filename] = {
                    size: fileStat.size,
                    modified: fileStat.mtime,
                    exists: true
                };
            } catch {
                stats[filename] = {
                    exists: false
                };
            }
        }

        return stats;
    }
}

module.exports = SecurityLogger;
