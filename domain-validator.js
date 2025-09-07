// 域名验证和身份识别中间件
// 用于识别和验证第三方网站的身份，防止服务被滥用

const url = require('url');
const dns = require('dns').promises;

class DomainValidator {
    constructor(database) {
        this.database = database;
        // 缓存解析结果，避免频繁DNS查询
        this.ipCache = new Map();
        this.cacheExpiry = 30 * 60 * 1000; // 30分钟缓存
    }

    /**
     * 从请求中提取客户端信息
     */
    extractClientInfo(req) {
        const info = {
            ip: this.getClientIP(req),
            referer: req.get('Referer'),
            origin: req.get('Origin'),
            userAgent: req.get('User-Agent'),
            host: req.get('Host'),
            timestamp: new Date().toISOString()
        };

        // 解析域名
        if (info.referer) {
            try {
                const parsedUrl = new URL(info.referer);
                info.refererDomain = parsedUrl.hostname;
                info.refererProtocol = parsedUrl.protocol;
                info.refererPort = parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80);
            } catch (e) {
                console.warn('无法解析Referer URL:', info.referer);
            }
        }

        if (info.origin) {
            try {
                const parsedUrl = new URL(info.origin);
                info.originDomain = parsedUrl.hostname;
                info.originProtocol = parsedUrl.protocol;
                info.originPort = parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80);
            } catch (e) {
                console.warn('无法解析Origin URL:', info.origin);
            }
        }

        return info;
    }

    /**
     * 获取客户端真实IP
     */
    getClientIP(req) {
        return req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               req.headers['cf-connecting-ip'] || // Cloudflare
               req.headers['x-client-ip'] ||
               'unknown';
    }

    /**
     * 解析域名到IP地址
     */
    async resolveDomainToIP(domain) {
        if (!domain) return null;

        // 检查缓存
        const cacheKey = domain;
        const cached = this.ipCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            return cached.ips;
        }

        try {
            // 同时解析A和AAAA记录
            const [ipv4Records, ipv6Records] = await Promise.allSettled([
                dns.resolve4(domain),
                dns.resolve6(domain)
            ]);

            const ips = [];
            if (ipv4Records.status === 'fulfilled') {
                ips.push(...ipv4Records.value);
            }
            if (ipv6Records.status === 'fulfilled') {
                ips.push(...ipv6Records.value);
            }

            // 缓存结果
            this.ipCache.set(cacheKey, {
                ips,
                timestamp: Date.now()
            });

            return ips;
        } catch (error) {
            console.warn(`DNS解析失败 ${domain}:`, error.message);
            return [];
        }
    }

    /**
     * 验证域名是否在白名单中
     */
    async validateDomain(clientInfo) {
        const validationResult = {
            isValid: false,
            shopInfo: null,
            reason: '',
            clientInfo,
            matchedBy: null // 'domain', 'ip', 'both'
        };

        try {
            // 获取所有已验证的店铺
            const shops = await this.database.getAllShops();
            
            // 如果没有店铺，默认允许（开发模式）
            if (!shops || shops.length === 0) {
                validationResult.isValid = true;
                validationResult.reason = '开发模式：无店铺限制';
                return validationResult;
            }

            // 提取要验证的域名
            const domainsToCheck = [];
            if (clientInfo.refererDomain) domainsToCheck.push(clientInfo.refererDomain);
            if (clientInfo.originDomain) domainsToCheck.push(clientInfo.originDomain);
            
            // 如果没有域名信息，检查是否为直接访问
            if (domainsToCheck.length === 0) {
                // 检查是否为localhost或内网访问（开发环境）
                if (this.isLocalOrDevelopmentAccess(clientInfo.ip)) {
                    validationResult.isValid = true;
                    validationResult.reason = '本地开发访问';
                    return validationResult;
                }
                
                validationResult.reason = '无法获取请求来源域名';
                return validationResult;
            }

            // 检查是否包含localhost域名（开发环境）
            const hasLocalDomain = domainsToCheck.some(domain => 
                domain === 'localhost' || 
                domain.endsWith('.localhost') ||
                /^127\.0\.0\.1$/.test(domain) ||
                /^192\.168\./.test(domain) ||
                /^10\./.test(domain)
            );
            
            if (hasLocalDomain && this.isLocalOrDevelopmentAccess(clientInfo.ip)) {
                validationResult.isValid = true;
                validationResult.reason = `本地开发访问: ${domainsToCheck.join(', ')}`;
                return validationResult;
            }

            // 遍历所有店铺，检查域名匹配
            for (const shop of shops) {
                if (!shop.domain) continue;

                // 标准化店铺域名
                const shopDomain = this.normalizeDomain(shop.domain);
                
                // 检查域名匹配
                for (const clientDomain of domainsToCheck) {
                    if (this.isDomainMatch(clientDomain, shopDomain)) {
                        validationResult.isValid = true;
                        validationResult.shopInfo = shop;
                        validationResult.matchedBy = 'domain';
                        validationResult.reason = `域名匹配: ${clientDomain} -> ${shopDomain}`;
                        
                        // 记录访问日志
                        await this.logAccess(clientInfo, shop, 'domain_match', true);
                        return validationResult;
                    }
                }

                // 如果域名不匹配，尝试IP匹配（可选）
                try {
                    const shopIPs = await this.resolveDomainToIP(shopDomain);
                    const clientIPs = [];
                    
                    for (const domain of domainsToCheck) {
                        const ips = await this.resolveDomainToIP(domain);
                        clientIPs.push(...ips);
                    }

                    // 检查IP匹配
                    const hasIPMatch = shopIPs.some(shopIP => 
                        clientIPs.includes(shopIP) || shopIP === clientInfo.ip
                    );

                    if (hasIPMatch) {
                        validationResult.isValid = true;
                        validationResult.shopInfo = shop;
                        validationResult.matchedBy = 'ip';
                        validationResult.reason = `IP地址匹配`;
                        
                        await this.logAccess(clientInfo, shop, 'ip_match', true);
                        return validationResult;
                    }
                } catch (ipError) {
                    console.warn('IP匹配检查失败:', ipError.message);
                }
            }

            // 没有找到匹配的店铺
            validationResult.reason = `域名未在白名单中: ${domainsToCheck.join(', ')}`;
            await this.logAccess(clientInfo, null, 'domain_rejected', false);

        } catch (error) {
            console.error('域名验证过程出错:', error);
            validationResult.reason = `验证过程出错: ${error.message}`;
        }

        return validationResult;
    }

    /**
     * 标准化域名（去除协议、端口、www等）
     */
    normalizeDomain(domain) {
        if (!domain) return '';
        
        // 去除协议
        domain = domain.replace(/^https?:\/\//, '');
        // 去除端口
        domain = domain.replace(/:\d+$/, '');
        // 去除路径
        domain = domain.split('/')[0];
        // 去除www前缀（可选）
        domain = domain.replace(/^www\./, '');
        
        return domain.toLowerCase();
    }

    /**
     * 检查域名是否匹配（支持通配符）
     */
    isDomainMatch(clientDomain, allowedDomain) {
        if (!clientDomain || !allowedDomain) return false;

        // 标准化两个域名
        const normalizedClient = this.normalizeDomain(clientDomain);
        const normalizedAllowed = this.normalizeDomain(allowedDomain);

        // 完全匹配
        if (normalizedClient === normalizedAllowed) return true;

        // 通配符匹配 (*.example.com)
        if (normalizedAllowed.startsWith('*.')) {
            const baseDomain = normalizedAllowed.substring(2);
            return normalizedClient.endsWith('.' + baseDomain) || normalizedClient === baseDomain;
        }

        // 子域名匹配（如果配置允许）
        if (normalizedClient.endsWith('.' + normalizedAllowed)) {
            return true;
        }

        return false;
    }

    /**
     * 检查是否为本地或开发环境访问
     */
    isLocalOrDevelopmentAccess(ip) {
        if (!ip || ip === 'unknown') return false;
        
        // 本地地址
        const localPatterns = [
            '127.0.0.1',
            '::1',
            '::ffff:127.0.0.1', // IPv4-mapped IPv6 localhost
            'localhost',
            /^192\.168\./,
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[01])\./,
            /^::ffff:192\.168\./, // IPv4-mapped IPv6 private networks
            /^::ffff:10\./,
            /^::ffff:172\.(1[6-9]|2[0-9]|3[01])\./
        ];

        return localPatterns.some(pattern => {
            if (typeof pattern === 'string') {
                return ip === pattern;
            } else {
                return pattern.test(ip);
            }
        });
    }

    /**
     * 记录访问日志
     */
    async logAccess(clientInfo, shop, action, success) {
        try {
            const logData = {
                timestamp: new Date(),
                ip: clientInfo.ip,
                domain: clientInfo.refererDomain || clientInfo.originDomain,
                referer: clientInfo.referer,
                origin: clientInfo.origin,
                userAgent: clientInfo.userAgent,
                shopId: shop ? shop.id : null,
                shopName: shop ? shop.name : null,
                action,
                success,
                details: JSON.stringify(clientInfo)
            };

            // 这里可以存储到数据库或日志文件
            console.log(`🔍 访问日志 [${success ? '✅' : '❌'}]:`, {
                action,
                domain: logData.domain,
                ip: logData.ip,
                shop: shop ? shop.name : 'N/A'
            });

            // 可以扩展到数据库存储
            // await this.database.insertAccessLog(logData);
        } catch (error) {
            console.error('记录访问日志失败:', error);
        }
    }

    /**
     * 创建Express中间件
     */
    createMiddleware() {
        return async (req, res, next) => {
            // 只对第三方客户端API请求进行验证，排除管理后台API
            const shouldValidate = req.path.startsWith('/api/') && 
                                 !req.path.startsWith('/api/auth/') &&
                                 !req.path.startsWith('/api/admin/') &&
                                 !req.path.startsWith('/api/shop/');
            
            if (!shouldValidate) {
                return next();
            }

            // 提取客户端信息
            const clientInfo = this.extractClientInfo(req);
            
            // 验证域名
            const validation = await this.validateDomain(clientInfo);
            
            // 将验证结果附加到请求对象
            req.domainValidation = validation;
            req.clientInfo = clientInfo;

            if (!validation.isValid) {
                console.warn(`🚫 域名验证失败:`, validation.reason);
                console.warn(`📋 客户端信息:`, clientInfo);
                
                return res.status(403).json({
                    error: '访问被拒绝',
                    reason: '域名未经授权',
                    code: 'DOMAIN_NOT_ALLOWED',
                    timestamp: new Date().toISOString()
                });
            }

            console.log(`✅ 域名验证通过:`, validation.reason);
            next();
        };
    }

    /**
     * 获取验证统计信息
     */
    async getValidationStats() {
        // 这里可以从数据库获取统计信息
        return {
            totalRequests: 0,
            allowedRequests: 0,
            blockedRequests: 0,
            uniqueDomains: 0,
            recentAccess: []
        };
    }
}

module.exports = DomainValidator;
