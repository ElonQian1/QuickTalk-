/**
 * 域名验证模块
 * 负责验证请求来源域名是否与店铺绑定域名匹配
 */
class DomainValidator {
    constructor() {
        this.trustedDomains = ['localhost', '127.0.0.1'];
    }

    /**
     * 标准化域名
     */
    normalizeDomain(domain) {
        if (!domain) return '';
        
        return domain.toLowerCase()
            .replace(/^https?:\/\//, '')  // 移除协议
            .replace(/:\d+$/, '')         // 移除端口
            .split('/')[0]                // 只取域名部分
            .replace(/^www\./, '');       // 移除www前缀
    }

    /**
     * 从请求中提取域名
     */
    extractDomainFromRequest(req) {
        // 优先从自定义头获取
        const customDomain = req.headers['x-domain'] || req.headers['X-Domain'];
        if (customDomain) {
            return this.normalizeDomain(customDomain);
        }

        // 从Origin头获取
        if (req.headers.origin) {
            return this.normalizeDomain(req.headers.origin);
        }

        // 从Referer头获取
        if (req.headers.referer) {
            return this.normalizeDomain(req.headers.referer);
        }

        // 从Host头获取
        if (req.headers.host) {
            return this.normalizeDomain(req.headers.host);
        }

        // 从请求体获取
        if (req.body && req.body.domain) {
            return this.normalizeDomain(req.body.domain);
        }

        return null;
    }

    /**
     * 验证域名匹配
     */
    validateDomain(requestDomain, authorizedDomain) {
        if (!requestDomain || !authorizedDomain) {
            return {
                valid: false,
                reason: '域名信息缺失',
                code: 'MISSING_DOMAIN'
            };
        }

        const normalizedRequest = this.normalizeDomain(requestDomain);
        const normalizedAuthorized = this.normalizeDomain(authorizedDomain);

        // 检查是否为受信任的开发域名
        if (this.trustedDomains.includes(normalizedRequest)) {
            return {
                valid: true,
                reason: '开发环境域名',
                matchType: 'trusted_domain'
            };
        }

        // 精确匹配
        if (normalizedRequest === normalizedAuthorized) {
            return {
                valid: true,
                reason: '域名完全匹配',
                matchType: 'exact_match'
            };
        }

        // 子域名匹配
        if (normalizedRequest.endsWith('.' + normalizedAuthorized)) {
            return {
                valid: true,
                reason: '子域名匹配',
                matchType: 'subdomain_match'
            };
        }

        // 通配符匹配（如果授权域名以*开头）
        if (normalizedAuthorized.startsWith('*.')) {
            const baseDomain = normalizedAuthorized.substring(2);
            if (normalizedRequest === baseDomain || normalizedRequest.endsWith('.' + baseDomain)) {
                return {
                    valid: true,
                    reason: '通配符域名匹配',
                    matchType: 'wildcard_match'
                };
            }
        }

        return {
            valid: false,
            reason: `域名不匹配: ${normalizedRequest} != ${normalizedAuthorized}`,
            code: 'DOMAIN_MISMATCH',
            requestDomain: normalizedRequest,
            authorizedDomain: normalizedAuthorized
        };
    }

    /**
     * 验证请求域名
     */
    validateRequestDomain(req, shop) {
        const requestDomain = this.extractDomainFromRequest(req);
        
        if (!requestDomain) {
            return {
                valid: false,
                reason: '无法获取请求域名',
                code: 'NO_REQUEST_DOMAIN'
            };
        }

        if (!shop || !shop.domain) {
            return {
                valid: false,
                reason: '店铺域名未配置',
                code: 'NO_SHOP_DOMAIN'
            };
        }

        const validation = this.validateDomain(requestDomain, shop.domain);
        
        // 记录验证结果
        if (validation.valid) {
            console.log(`✅ 域名验证通过: ${validation.reason} - ${requestDomain} -> ${shop.domain}`);
        } else {
            console.log(`❌ 域名验证失败: ${validation.reason}`);
        }

        return {
            ...validation,
            requestDomain,
            authorizedDomain: shop.domain,
            shop
        };
    }

    /**
     * 检查域名是否为IP地址
     */
    isIpAddress(domain) {
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        return ipRegex.test(domain);
    }

    /**
     * 检查域名格式是否有效
     */
    isValidDomainFormat(domain) {
        if (!domain || typeof domain !== 'string') {
            return false;
        }

        const normalized = this.normalizeDomain(domain);
        
        // 检查是否为IP地址
        if (this.isIpAddress(normalized)) {
            return true;
        }

        // 检查域名格式
        const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
        return domainRegex.test(normalized);
    }

    /**
     * 添加受信任域名
     */
    addTrustedDomain(domain) {
        const normalized = this.normalizeDomain(domain);
        if (!this.trustedDomains.includes(normalized)) {
            this.trustedDomains.push(normalized);
        }
    }

    /**
     * 移除受信任域名
     */
    removeTrustedDomain(domain) {
        const normalized = this.normalizeDomain(domain);
        const index = this.trustedDomains.indexOf(normalized);
        if (index > -1) {
            this.trustedDomains.splice(index, 1);
        }
    }

    /**
     * 获取受信任域名列表
     */
    getTrustedDomains() {
        return [...this.trustedDomains];
    }

    /**
     * 创建域名验证中间件
     */
    createMiddleware() {
        return (req, res, next) => {
            // 如果请求已经包含店铺信息，进行域名验证
            if (req.shop) {
                const validation = this.validateRequestDomain(req, req.shop);
                
                if (!validation.valid) {
                    return res.status(403).json({
                        success: false,
                        error: {
                            code: validation.code,
                            message: validation.reason,
                            details: {
                                requestDomain: validation.requestDomain,
                                authorizedDomain: validation.authorizedDomain
                            }
                        }
                    });
                }

                req.domainValidation = validation;
            }

            next();
        };
    }

    /**
     * 创建可选域名验证中间件
     */
    createOptionalMiddleware() {
        return (req, res, next) => {
            if (req.shop) {
                const validation = this.validateRequestDomain(req, req.shop);
                req.domainValidation = validation;
                req.domainValid = validation.valid;
            } else {
                req.domainValid = false;
            }

            next();
        };
    }

    /**
     * 生成CORS设置
     */
    generateCorsOptions(shop) {
        if (!shop || !shop.domain) {
            return {
                origin: false,
                credentials: false
            };
        }

        const authorizedDomain = this.normalizeDomain(shop.domain);
        const allowedOrigins = [
            `http://${authorizedDomain}`,
            `https://${authorizedDomain}`,
            `http://www.${authorizedDomain}`,
            `https://www.${authorizedDomain}`
        ];

        // 添加子域名支持
        if (shop.domain.startsWith('*.')) {
            const baseDomain = shop.domain.substring(2);
            allowedOrigins.push(
                `http://${baseDomain}`,
                `https://${baseDomain}`,
                `http://*.${baseDomain}`,
                `https://*.${baseDomain}`
            );
        }

        // 添加受信任域名
        this.trustedDomains.forEach(domain => {
            allowedOrigins.push(
                `http://${domain}`,
                `https://${domain}`
            );
        });

        return {
            origin: (origin, callback) => {
                // 允许无origin的请求（如移动应用）
                if (!origin) return callback(null, true);

                const normalizedOrigin = this.normalizeDomain(origin);
                const isAllowed = allowedOrigins.some(allowed => {
                    const normalizedAllowed = this.normalizeDomain(allowed);
                    return normalizedOrigin === normalizedAllowed ||
                           normalizedOrigin.endsWith('.' + normalizedAllowed);
                });

                callback(null, isAllowed);
            },
            credentials: true,
            optionsSuccessStatus: 200
        };
    }
}

module.exports = DomainValidator;
