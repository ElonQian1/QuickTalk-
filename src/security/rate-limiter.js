/**
 * 请求频率限制模块
 * 防止API被恶意调用
 */
class RateLimiter {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 15 * 60 * 1000; // 15分钟
        this.maxRequests = options.maxRequests || 100;     // 最大请求数
        this.keyGenerator = options.keyGenerator || this.defaultKeyGenerator;
        this.skipSuccessfulRequests = options.skipSuccessfulRequests || false;
        this.skipFailedRequests = options.skipFailedRequests || false;
        
        // 存储请求计数
        this.store = new Map();
        
        // 清理过期记录的定时器
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, this.windowMs);
    }

    /**
     * 默认的key生成器
     */
    defaultKeyGenerator(req) {
        const ip = this.getClientIp(req);
        const shop = req.shop?.id || 'unknown';
        return `${ip}:${shop}`;
    }

    /**
     * 获取客户端IP
     */
    getClientIp(req) {
        return req.ip ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               '127.0.0.1';
    }

    /**
     * 检查请求是否超过限制
     */
    async checkLimit(req) {
        const key = this.keyGenerator(req);
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // 获取或创建记录
        let record = this.store.get(key);
        if (!record) {
            record = {
                requests: [],
                firstRequest: now
            };
            this.store.set(key, record);
        }

        // 清理过期请求
        record.requests = record.requests.filter(time => time > windowStart);

        // 检查是否超过限制
        if (record.requests.length >= this.maxRequests) {
            const oldestRequest = Math.min(...record.requests);
            const resetTime = oldestRequest + this.windowMs;
            
            return {
                allowed: false,
                limit: this.maxRequests,
                remaining: 0,
                resetTime: new Date(resetTime),
                retryAfter: Math.ceil((resetTime - now) / 1000)
            };
        }

        // 记录请求时间
        record.requests.push(now);

        return {
            allowed: true,
            limit: this.maxRequests,
            remaining: this.maxRequests - record.requests.length,
            resetTime: new Date(now + this.windowMs),
            retryAfter: 0
        };
    }

    /**
     * 清理过期记录
     */
    cleanup() {
        const now = Date.now();
        const cutoff = now - this.windowMs;

        for (const [key, record] of this.store.entries()) {
            // 清理过期请求
            record.requests = record.requests.filter(time => time > cutoff);
            
            // 如果记录为空且超过窗口时间，删除记录
            if (record.requests.length === 0 && record.firstRequest < cutoff) {
                this.store.delete(key);
            }
        }
    }

    /**
     * 创建限流中间件
     */
    createMiddleware() {
        return async (req, res, next) => {
            try {
                const result = await this.checkLimit(req);

                // 设置响应头
                res.set({
                    'X-RateLimit-Limit': result.limit,
                    'X-RateLimit-Remaining': result.remaining,
                    'X-RateLimit-Reset': result.resetTime.toISOString()
                });

                if (!result.allowed) {
                    res.set('Retry-After', result.retryAfter);
                    
                    return res.status(429).json({
                        success: false,
                        error: {
                            code: 'RATE_LIMIT_EXCEEDED',
                            message: '请求过于频繁，请稍后重试',
                            details: {
                                limit: result.limit,
                                retryAfter: result.retryAfter,
                                resetTime: result.resetTime
                            }
                        }
                    });
                }

                next();
            } catch (error) {
                console.error('限流中间件错误:', error);
                // 出错时不阻止请求
                next();
            }
        };
    }

    /**
     * 创建针对特定操作的限流器
     */
    createOperationLimiter(operation, limit, windowMs) {
        const operationLimiter = new RateLimiter({
            maxRequests: limit,
            windowMs: windowMs,
            keyGenerator: (req) => {
                const baseKey = this.defaultKeyGenerator(req);
                return `${baseKey}:${operation}`;
            }
        });

        return operationLimiter.createMiddleware();
    }

    /**
     * 获取当前状态
     */
    getStatus() {
        return {
            totalKeys: this.store.size,
            windowMs: this.windowMs,
            maxRequests: this.maxRequests,
            currentTime: new Date().toISOString()
        };
    }

    /**
     * 重置指定key的限制
     */
    resetKey(key) {
        this.store.delete(key);
    }

    /**
     * 重置所有限制
     */
    resetAll() {
        this.store.clear();
    }

    /**
     * 销毁限流器
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.store.clear();
    }
}

/**
 * 预定义的限流配置
 */
const RateLimitConfigs = {
    // 客户端API限流
    CLIENT_API: {
        windowMs: 1 * 60 * 1000,  // 1分钟
        maxRequests: 60           // 60次请求
    },
    
    // 消息发送限流
    MESSAGE_SEND: {
        windowMs: 1 * 60 * 1000,  // 1分钟
        maxRequests: 30           // 30条消息
    },
    
    // 连接建立限流
    CONNECTION: {
        windowMs: 5 * 60 * 1000,  // 5分钟
        maxRequests: 10           // 10次连接
    },
    
    // 管理员API限流
    ADMIN_API: {
        windowMs: 1 * 60 * 1000,  // 1分钟
        maxRequests: 120          // 120次请求
    },
    
    // 代码生成限流
    CODE_GENERATION: {
        windowMs: 1 * 60 * 1000,  // 1分钟
        maxRequests: 5            // 5次生成
    }
};

module.exports = { RateLimiter, RateLimitConfigs };
