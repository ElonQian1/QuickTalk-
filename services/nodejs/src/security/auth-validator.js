/**
 * API密钥验证模块
 * 负责验证客户端请求的API密钥
 */
class AuthValidator {
    constructor(shopRepository) {
        this.shopRepository = shopRepository;
    }

    /**
     * 验证API密钥
     */
    async validateApiKey(apiKey) {
        if (!apiKey) {
            return {
                valid: false,
                error: 'API密钥不能为空',
                code: 'MISSING_API_KEY'
            };
        }

        if (!apiKey.startsWith('sk_')) {
            return {
                valid: false,
                error: 'API密钥格式不正确',
                code: 'INVALID_API_KEY_FORMAT'
            };
        }

        try {
            console.log('🔍 验证API密钥:', apiKey);
            console.log('🔍 shopRepository:', !!this.shopRepository);
            
            const shop = await this.shopRepository.getShopByApiKey(apiKey);
            console.log('🔍 查询结果:', shop);
            
            if (!shop) {
                console.log('❌ 店铺不存在');
                return {
                    valid: false,
                    error: 'API密钥无效',
                    code: 'INVALID_API_KEY'
                };
            }

            if (shop.status !== 'active') {
                return {
                    valid: false,
                    error: '店铺已被禁用',
                    code: 'SHOP_DISABLED',
                    shop
                };
            }

            // 更新最后使用时间
            await this.shopRepository.updateLastUsed(shop.id);

            return {
                valid: true,
                shop,
                message: 'API密钥验证成功'
            };

        } catch (error) {
            console.error('API密钥验证失败:', error);
            return {
                valid: false,
                error: '验证过程出错',
                code: 'VALIDATION_ERROR'
            };
        }
    }

    /**
     * 从请求头获取API密钥
     */
    extractApiKeyFromRequest(req) {
        // 优先从自定义头获取
        const shopKey = req.headers['x-shop-key'] || req.headers['X-Shop-Key'];
        if (shopKey) return shopKey;

        // 从Authorization头获取
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        // 从请求体获取
        if (req.body && req.body.shopKey) {
            return req.body.shopKey;
        }

        // 从查询参数获取（不推荐，但提供兼容性）
        if (req.query && req.query.shopKey) {
            return req.query.shopKey;
        }

        return null;
    }

    /**
     * 验证请求的完整性
     */
    async validateRequest(req) {
        const apiKey = this.extractApiKeyFromRequest(req);
        const validation = await this.validateApiKey(apiKey);

        if (!validation.valid) {
            return validation;
        }

        // 验证店铺ID匹配
        const shopId = req.headers['x-shop-id'] || req.body?.shopId;
        if (shopId && shopId !== validation.shop.id) {
            return {
                valid: false,
                error: '店铺ID不匹配',
                code: 'SHOP_ID_MISMATCH'
            };
        }

        return {
            valid: true,
            shop: validation.shop,
            apiKey,
            message: '请求验证成功'
        };
    }

    /**
     * 生成新的API密钥
     */
    generateApiKey() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let key = 'sk_';
        
        for (let i = 0; i < 32; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        return key;
    }

    /**
     * 验证API密钥格式
     */
    isValidApiKeyFormat(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }

        // 检查前缀和长度
        return apiKey.startsWith('sk_') && apiKey.length === 35;
    }

    /**
     * 创建验证中间件
     */
    createMiddleware() {
        return async (req, res, next) => {
            try {
                const validation = await this.validateRequest(req);
                
                if (!validation.valid) {
                    return res.status(401).json({
                        success: false,
                        error: {
                            code: validation.code,
                            message: validation.error
                        }
                    });
                }

                // 将验证信息附加到请求对象
                req.shop = validation.shop;
                req.apiKey = validation.apiKey;
                
                next();
            } catch (error) {
                console.error('验证中间件错误:', error);
                res.status(500).json({
                    success: false,
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: '内部验证错误'
                    }
                });
            }
        };
    }

    /**
     * 创建可选验证中间件（验证失败不阻止请求）
     */
    createOptionalMiddleware() {
        return async (req, res, next) => {
            try {
                const validation = await this.validateRequest(req);
                
                if (validation.valid) {
                    req.shop = validation.shop;
                    req.apiKey = validation.apiKey;
                    req.authenticated = true;
                } else {
                    req.authenticated = false;
                    req.authError = validation;
                }
                
                next();
            } catch (error) {
                console.error('可选验证中间件错误:', error);
                req.authenticated = false;
                req.authError = {
                    code: 'INTERNAL_ERROR',
                    error: '内部验证错误'
                };
                next();
            }
        };
    }
}

module.exports = AuthValidator;
