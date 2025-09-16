/**
 * 统一错误处理器
 * 用于处理所有API错误响应，避免重复代码
 */
class ErrorHandler {
    /**
     * 错误代码常量
     */
    static ERROR_CODES = {
        // 认证相关
        AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
        INVALID_API_KEY: 'INVALID_API_KEY',
        UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
        
        // 请求参数相关
        MISSING_REQUIRED_PARAMS: 'MISSING_REQUIRED_PARAMS',
        INVALID_PARAMETERS: 'INVALID_PARAMETERS',
        MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',
        
        // 资源相关
        SHOP_NOT_FOUND: 'SHOP_NOT_FOUND',
        CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
        USER_NOT_FOUND: 'USER_NOT_FOUND',
        
        // 业务逻辑相关
        SHOP_DISABLED: 'SHOP_DISABLED',
        RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
        
        // 系统错误
        INTERNAL_ERROR: 'INTERNAL_ERROR',
        DATABASE_ERROR: 'DATABASE_ERROR',
        NETWORK_ERROR: 'NETWORK_ERROR'
    };

    /**
     * 错误消息映射
     */
    static ERROR_MESSAGES = {
        [this.ERROR_CODES.AUTHENTICATION_REQUIRED]: '需要认证',
        [this.ERROR_CODES.INVALID_API_KEY]: 'API密钥无效',
        [this.ERROR_CODES.UNAUTHORIZED_ACCESS]: '无权访问',
        [this.ERROR_CODES.MISSING_REQUIRED_PARAMS]: '缺少必需参数',
        [this.ERROR_CODES.INVALID_PARAMETERS]: '参数格式错误',
        [this.ERROR_CODES.MESSAGE_TOO_LONG]: '消息内容过长',
        [this.ERROR_CODES.SHOP_NOT_FOUND]: '店铺不存在',
        [this.ERROR_CODES.CONVERSATION_NOT_FOUND]: '对话不存在',
        [this.ERROR_CODES.USER_NOT_FOUND]: '用户不存在',
        [this.ERROR_CODES.SHOP_DISABLED]: '店铺已禁用',
        [this.ERROR_CODES.RATE_LIMIT_EXCEEDED]: '请求过于频繁',
        [this.ERROR_CODES.INTERNAL_ERROR]: '服务器内部错误',
        [this.ERROR_CODES.DATABASE_ERROR]: '数据库错误',
        [this.ERROR_CODES.NETWORK_ERROR]: '网络错误'
    };

    /**
     * HTTP状态码映射
     */
    static HTTP_STATUS_MAP = {
        [this.ERROR_CODES.AUTHENTICATION_REQUIRED]: 401,
        [this.ERROR_CODES.INVALID_API_KEY]: 401,
        [this.ERROR_CODES.UNAUTHORIZED_ACCESS]: 403,
        [this.ERROR_CODES.MISSING_REQUIRED_PARAMS]: 400,
        [this.ERROR_CODES.INVALID_PARAMETERS]: 400,
        [this.ERROR_CODES.MESSAGE_TOO_LONG]: 400,
        [this.ERROR_CODES.SHOP_NOT_FOUND]: 404,
        [this.ERROR_CODES.CONVERSATION_NOT_FOUND]: 404,
        [this.ERROR_CODES.USER_NOT_FOUND]: 404,
        [this.ERROR_CODES.SHOP_DISABLED]: 403,
        [this.ERROR_CODES.RATE_LIMIT_EXCEEDED]: 429,
        [this.ERROR_CODES.INTERNAL_ERROR]: 500,
        [this.ERROR_CODES.DATABASE_ERROR]: 500,
        [this.ERROR_CODES.NETWORK_ERROR]: 502
    };

    /**
     * 发送标准化错误响应
     * @param {Object} res - Express response对象
     * @param {string} errorCode - 错误代码
     * @param {string} customMessage - 自定义错误消息（可选）
     * @param {Object} additionalData - 额外数据（可选）
     */
    static sendError(res, errorCode, customMessage = null, additionalData = {}) {
        const message = customMessage || this.ERROR_MESSAGES[errorCode] || '未知错误';
        const statusCode = this.HTTP_STATUS_MAP[errorCode] || 500;

        const response = {
            success: false,
            error: {
                code: errorCode,
                message: message,
                ...additionalData
            }
        };

        res.status(statusCode).json(response);
    }

    /**
     * 发送成功响应
     * @param {Object} res - Express response对象
     * @param {Object} data - 响应数据
     * @param {string} message - 成功消息
     */
    static sendSuccess(res, data = {}, message = '操作成功') {
        res.json({
            success: true,
            data: data,
            message: message
        });
    }

    /**
     * 处理异步函数的错误
     * @param {Function} fn - 异步函数
     * @param {Object} req - Express request对象
     * @param {Object} res - Express response对象
     * @param {Function} next - Express next函数
     */
    static async handleAsync(fn, req, res, next) {
        try {
            await fn(req, res, next);
        } catch (error) {
            console.error('异步处理错误:', error);
            
            // 如果已经发送了响应，不要再次发送
            if (res.headersSent) {
                return;
            }

            this.sendError(res, this.ERROR_CODES.INTERNAL_ERROR, error.message);
        }
    }

    /**
     * 创建异步路由处理器包装器
     * @param {Function} fn - 异步路由处理函数
     * @returns {Function} 包装后的路由处理器
     */
    static wrapAsync(fn) {
        return (req, res, next) => {
            this.handleAsync(fn, req, res, next);
        };
    }

    /**
     * 验证必需参数
     * @param {Object} params - 参数对象
     * @param {Array} requiredFields - 必需字段数组
     * @returns {Object|null} 如果验证失败返回错误信息，成功返回null
     */
    static validateRequiredParams(params, requiredFields) {
        const missingFields = [];
        
        for (const field of requiredFields) {
            if (!params[field] && params[field] !== 0 && params[field] !== false) {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            return {
                code: this.ERROR_CODES.MISSING_REQUIRED_PARAMS,
                message: `缺少必需参数: ${missingFields.join(', ')}`
            };
        }

        return null;
    }

    /**
     * 记录错误日志
     * @param {Error} error - 错误对象
     * @param {Object} context - 上下文信息
     */
    static logError(error, context = {}) {
        console.error('🚨 错误详情:', {
            message: error.message,
            stack: error.stack,
            context: context,
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = ErrorHandler;