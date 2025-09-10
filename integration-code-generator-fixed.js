// 傻瓜式集成代码生成器
class IntegrationCodeGenerator {
    constructor(database) {
        this.database = database;
    }

    /**
     * 为店铺生成API密钥
     */
    generateApiKey() {
        // 生成32位随机字符串，以sk_开头表示shop key
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let key = 'sk_';
        for (let i = 0; i < 32; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return key;
    }

    /**
     * 为店铺生成完整的集成代码
     */
    async generateIntegrationCode(shopId, options = {}) {
        try {
            // 获取店铺信息
            const shops = await this.database.getAllShops();
            const shop = shops.find(s => s.id === shopId);
            
            if (!shop) {
                throw new Error('店铺不存在');
            }

            // 如果店铺还没有API密钥，生成一个
            if (!shop.api_key) {
                const apiKey = this.generateApiKey();
                await this.database.updateShopApiKey(shopId, apiKey);
                shop.api_key = apiKey;
            }

            // 默认配置
            const defaultConfig = {
                position: 'bottom-right',
                theme: 'default',
                welcomeMessage: '您好！有什么可以帮您的吗？',
                title: '在线客服',
                placeholder: '请输入您的消息...',
                sendButton: '发送',
                serverUrl: options.serverUrl || 'http://localhost:3030', // 优先使用传入的服务器地址
                autoOpen: false
            };

            const config = { ...defaultConfig, ...options };

            // 生成集成代码
            const integrationCode = this.generateCodeTemplate(shop, config);
            
            // 记录代码生成日志
            console.log(`🔑 为店铺 "${shop.name}" 生成集成代码，API密钥: ${shop.api_key.substring(0, 8)}...`);

            return {
                success: true,
                shop: {
                    id: shop.id,
                    name: shop.name,
                    domain: shop.domain,
                    apiKey: shop.api_key
                },
                config,
                code: integrationCode,
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('生成集成代码失败:', error);
            throw error;
        }
    }

    /**
     * 生成HTML集成代码模板
     */
    generateCodeTemplate(shop, config) {
        // 构建代码模板
        const wsUrl = config.serverUrl.replace('http', 'ws');
        
        const codeTemplate = `<!-- QuickTalk客服系统集成代码 -->
<!-- 店铺: ${shop.name} -->
<!-- 域名: ${shop.domain} -->
<!-- 生成时间: ${new Date().toLocaleString('zh-CN')} -->
<!-- 注意: 请勿修改以下代码，直接复制粘贴到您的网站页面中 -->

<script>
// QuickTalk客服系统配置
window.QUICKTALK_CONFIG = {
    // 店铺认证信息（请勿修改）
    shopKey: '${shop.api_key}',
    shopId: '${shop.id}',
    shopName: '${shop.name}',
    authorizedDomain: '${shop.domain}',
    
    // 服务器配置
    serverUrl: '${config.serverUrl}',
    apiUrl: '${config.serverUrl}/api',
    wsUrl: '${wsUrl}/ws',
    
    // 界面配置（可根据需要修改）
    ui: {
        position: '${config.position}',
        theme: '${config.theme}',
        title: '${config.title}',
        placeholder: '${config.placeholder}',
        sendButton: '${config.sendButton}',
        autoOpen: ${config.autoOpen}
    },
    
    // 欢迎消息（可根据需要修改）
    welcomeMessage: '${config.welcomeMessage}',
    
    // 系统信息（请勿修改）
    version: '1.0.0',
    generatedAt: '${new Date().toISOString()}'
};

// 初始化客服系统
(function() {
    console.log('🚀 正在加载QuickTalk客服系统...');
    console.log('📋 店铺:', window.QUICKTALK_CONFIG.shopName);
    console.log('🌐 授权域名:', window.QUICKTALK_CONFIG.authorizedDomain);
    
    // 验证当前域名
    const currentDomain = window.location.hostname;
    const authorizedDomain = window.QUICKTALK_CONFIG.authorizedDomain;
    
    if (currentDomain !== authorizedDomain && 
        !currentDomain.endsWith('.' + authorizedDomain) && 
        currentDomain !== 'localhost') {
        console.error('❌ QuickTalk客服系统：域名未授权');
        console.error('当前域名:', currentDomain);
        console.error('授权域名:', authorizedDomain);
        return;
    }
    
    console.log('✅ 域名验证通过，正在连接客服系统...');
    
    // 兼容老版本网站的客服按钮
    document.addEventListener('DOMContentLoaded', function() {
        // 等待SDK加载完成
        const checkSDK = setInterval(function() {
            if (window.customerService && window.customerService.toggle) {
                clearInterval(checkSDK);
                
                // 绑定现有的客服按钮
                const existingButtons = document.querySelectorAll('#cb, .customer-service-btn, [data-action="customer-service"]');
                existingButtons.forEach(function(btn) {
                    // 移除原有的onclick事件
                    btn.onclick = null;
                    btn.removeAttribute('onclick');
                    
                    // 添加新的点击事件
                    btn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.customerService && window.customerService.toggle) {
                            window.customerService.toggle();
                        }
                    });
                });
                
                // 为兼容性添加全局函数
                window.toggleCS = function() {
                    if (window.customerService && window.customerService.toggle) {
                        window.customerService.toggle();
                    }
                };
                window.openCS = function() {
                    if (window.customerService && window.customerService.open) {
                        window.customerService.open();
                    }
                };
                window.closeCS = function() {
                    if (window.customerService && window.customerService.close) {
                        window.customerService.close();
                    }
                };
                
                console.log('✅ QuickTalk客服系统加载完成');
            }
        }, 100);
        
        // 10秒后清理检查器
        setTimeout(function() {
            clearInterval(checkSDK);
        }, 10000);
    });
})();
</script>

<!-- 加载客服SDK -->
<script src="${config.serverUrl}/secure-customer-service-sdk.js"></script>

<!-- 可选：自定义样式 -->
<style>
/* 您可以在这里添加自定义样式 */
.quicktalk-custom-button {
    /* 自定义客服按钮样式 */
}

/* 兼容老版本样式 - 如果页面上有老的客服按钮，这些样式会保持其外观 */
.viewport-nav .nav-box#cb {
    cursor: pointer !important;
}
</style>

<!-- 
🎯 使用说明：
1. 此代码会自动创建一个浮动的客服按钮
2. 如果您的网站已有客服按钮（id="cb" 或 class="customer-service-btn"），会自动绑定
3. 客服系统会自动验证域名和API密钥
4. 如有问题，请联系技术支持

📞 技术支持：
- 如需修改样式，请编辑上面的CSS部分
- 如需更换域名，请重新生成集成代码
- 如遇连接问题，请检查服务器状态
-->`;

        return codeTemplate;
    }

    /**
     * 验证API密钥和域名
     */
    async verifyApiKey(apiKey, domain, ip) {
        try {
            const shops = await this.database.getAllShops();
            const shop = shops.find(s => s.api_key === apiKey);
            
            if (!shop) {
                return {
                    valid: false,
                    reason: 'API密钥无效',
                    code: 'INVALID_API_KEY'
                };
            }

            // 验证域名
            const normalizedCurrentDomain = this.normalizeDomain(domain);
            const normalizedShopDomain = this.normalizeDomain(shop.domain);
            
            // 检查域名匹配
            const domainMatch = 
                normalizedCurrentDomain === normalizedShopDomain ||
                normalizedCurrentDomain.endsWith('.' + normalizedShopDomain) ||
                normalizedCurrentDomain === 'localhost'; // 开发环境

            if (!domainMatch) {
                return {
                    valid: false,
                    reason: `域名不匹配，当前: ${domain}，授权: ${shop.domain}`,
                    code: 'DOMAIN_MISMATCH',
                    shop: shop
                };
            }

            // 记录成功验证
            console.log(`🔑 API密钥验证成功: ${shop.name} (${domain})`);
            
            return {
                valid: true,
                shop: shop,
                reason: '验证通过',
                matchType: 'api_key_and_domain'
            };

        } catch (error) {
            console.error('API密钥验证失败:', error);
            return {
                valid: false,
                reason: `验证过程出错: ${error.message}`,
                code: 'VERIFICATION_ERROR'
            };
        }
    }

    /**
     * 标准化域名
     */
    normalizeDomain(domain) {
        if (!domain) return '';
        return domain.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/:\d+$/, '')
            .split('/')[0]
            .replace(/^www\./, '');
    }

    /**
     * 重新生成店铺的API密钥
     */
    async regenerateApiKey(shopId) {
        try {
            const newApiKey = this.generateApiKey();
            await this.database.updateShopApiKey(shopId, newApiKey);
            
            console.log(`🔄 店铺 ${shopId} 的API密钥已重新生成: ${newApiKey.substring(0, 8)}...`);
            
            return {
                success: true,
                shopId,
                newApiKey,
                message: 'API密钥已重新生成，请更新集成代码'
            };
        } catch (error) {
            console.error('重新生成API密钥失败:', error);
            throw error;
        }
    }

    /**
     * 获取店铺的使用统计
     */
    async getShopUsageStats(shopId) {
        // 这里可以扩展为从数据库获取真实的使用统计
        return {
            shopId,
            totalRequests: 0,
            todayRequests: 0,
            lastUsed: null,
            activeConnections: 0
        };
    }
}

module.exports = IntegrationCodeGenerator;
