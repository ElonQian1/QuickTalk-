// 安全管理器
class SecurityManager {
    constructor(shopRepository) {
        this.shopRepository = shopRepository;
    }

    /**
     * 验证API密钥和域名
     */
    async validateApiKeyAndDomain(apiKey, domain, shopId = null) {
        try {
            console.log(`🔐 开始验证 API密钥: ${apiKey?.substring(0, 8)}... 域名: ${domain}`);
            
            // 1. 验证API密钥格式
            if (!apiKey || !apiKey.startsWith('sk_')) {
                return {
                    valid: false,
                    code: 'INVALID_API_KEY_FORMAT',
                    message: 'API密钥格式无效'
                };
            }

            // 2. 从数据库获取店铺信息
            const shop = await this.shopRepository.getShopByApiKey(apiKey);
            if (!shop) {
                console.log(`❌ 未找到API密钥对应的店铺: ${apiKey}`);
                return {
                    valid: false,
                    code: 'INVALID_API_KEY',
                    message: 'API密钥无效'
                };
            }

            // 3. 验证店铺状态
            if (shop.status !== 'active') {
                return {
                    valid: false,
                    code: 'SHOP_INACTIVE',
                    message: '店铺已被禁用'
                };
            }

            // 4. 验证店铺ID（如果提供）
            if (shopId && shop.id !== shopId) {
                return {
                    valid: false,
                    code: 'SHOP_ID_MISMATCH',
                    message: '店铺ID不匹配'
                };
            }

            // 5. 验证域名
            const domainValid = this.validateDomain(domain, shop.domain);
            if (!domainValid.valid) {
                return domainValid;
            }

            // 6. 更新最后使用时间
            await this.shopRepository.updateLastUsed(shop.id);

            console.log(`✅ 验证通过: 店铺 ${shop.name} (${shop.id})`);
            
            return {
                valid: true,
                shop: shop,
                code: 'VALIDATION_SUCCESS',
                message: '验证通过'
            };

        } catch (error) {
            console.error('❌ 验证过程中发生错误:', error);
            return {
                valid: false,
                code: 'VALIDATION_ERROR',
                message: '验证过程出错'
            };
        }
    }

    /**
     * 验证域名
     */
    validateDomain(requestDomain, authorizedDomain) {
        try {
            const normalizedRequest = this.normalizeDomain(requestDomain);
            const normalizedAuthorized = this.normalizeDomain(authorizedDomain);

            console.log(`🔍 域名验证: ${normalizedRequest} vs ${normalizedAuthorized}`);

            // 完全匹配
            if (normalizedRequest === normalizedAuthorized) {
                return { valid: true, matchType: 'exact' };
            }

            // 子域名匹配
            if (normalizedRequest.endsWith('.' + normalizedAuthorized)) {
                return { valid: true, matchType: 'subdomain' };
            }

            // 开发环境
            if (normalizedRequest === 'localhost' || normalizedRequest === '127.0.0.1') {
                return { valid: true, matchType: 'development' };
            }

            return {
                valid: false,
                code: 'DOMAIN_MISMATCH',
                message: `域名不匹配: ${requestDomain} 不在授权域名 ${authorizedDomain} 范围内`
            };

        } catch (error) {
            return {
                valid: false,
                code: 'DOMAIN_VALIDATION_ERROR',
                message: '域名验证过程出错'
            };
        }
    }

    /**
     * 规范化域名
     */
    normalizeDomain(domain) {
        if (!domain) return '';
        
        return domain.toLowerCase()
            .replace(/^https?:\/\//, '')  // 移除协议
            .replace(/:\d+$/, '')         // 移除端口号
            .split('/')[0]                // 取第一部分
            .replace(/^www\./, '');       // 移除www前缀
    }

    /**
     * 生成API密钥
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
     * 验证会话
     */
    validateSession(sessionId) {
        // 基础的会话验证
        return sessionId && sessionId.startsWith('sess_');
    }
}

module.exports = SecurityManager;
