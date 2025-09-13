/**
 * Ruilong版本 - 付费激活模块 (开发中版本)
 * 保留商业化框架，暂时禁用真实支付功能
 */

class RuilongPayment {
    
    /**
     * 付费激活店铺（开发中版本）
     * @param {string} shopId - 店铺ID
     */
    static async payToActivate(shopId) {
        try {
            console.log('💰 [Ruilong] 付费开通功能访问:', shopId);
            
            // 获取店铺信息用于显示
            let shop = null;
            if (window.currentShops && window.currentShops.length > 0) {
                shop = window.currentShops.find(s => s.id === shopId);
            }
            
            const shopName = shop ? shop.name : '未知店铺';
            
            // 显示开发中提示
            this.showDevelopmentNotice('付费开通功能', shopName, {
                feature: '付费激活',
                price: '¥2000/年',
                benefits: [
                    '✅ 店铺立即审核通过',
                    '✅ 获得1年完整使用权限',
                    '✅ 专业客服技术支持',
                    '✅ 数据统计分析功能',
                    '✅ 自定义品牌定制'
                ]
            });
            
        } catch (error) {
            console.error('❌ [Ruilong] 付费激活访问失败:', error);
            alert('功能暂时不可用，请稍后重试');
        }
    }
    
    /**
     * 续费店铺（开发中版本）
     * @param {string} shopId - 店铺ID
     */
    static async renewShop(shopId) {
        try {
            console.log('🔄 [Ruilong] 续费功能访问:', shopId);
            
            // 获取店铺信息
            let shop = null;
            if (window.currentShops && window.currentShops.length > 0) {
                shop = window.currentShops.find(s => s.id === shopId);
            }
            
            const shopName = shop ? shop.name : '未知店铺';
            const expiryDate = shop && shop.expiryDate ? 
                new Date(shop.expiryDate).toLocaleDateString() : '未设置';
            
            // 显示开发中提示
            this.showDevelopmentNotice('续费功能', shopName, {
                feature: '服务续费',
                price: '¥2000/年',
                currentExpiry: expiryDate,
                benefits: [
                    '🔄 延长1年服务期限',
                    '📈 继续享受数据分析',
                    '🛠️ 持续技术支持更新',
                    '⚡ 保持高级功能访问',
                    '💾 数据安全备份保障'
                ]
            });
            
        } catch (error) {
            console.error('❌ [Ruilong] 续费功能访问失败:', error);
            alert('功能暂时不可用，请稍后重试');
        }
    }
    
    /**
     * 显示开发中通知
     * @param {string} featureName - 功能名称
     * @param {string} shopName - 店铺名称
     * @param {Object} details - 详细信息
     */
    static showDevelopmentNotice(featureName, shopName, details) {
        const { feature, price, currentExpiry, benefits } = details;
        
        let message = `🚧 ${featureName}开发中\n\n`;
        message += `📊 店铺：${shopName}\n`;
        message += `💰 功能：${feature}\n`;
        message += `💸 价格：${price}\n`;
        
        if (currentExpiry) {
            message += `📅 当前到期：${currentExpiry}\n`;
        }
        
        message += `\n🎯 预期功能包含：\n`;
        benefits.forEach(benefit => {
            message += `${benefit}\n`;
        });
        
        message += `\n📞 如需开通，请联系客服：\n`;
        message += `• 微信客服：quicktalk-service\n`;
        message += `• 邮箱：service@quicktalk.com\n`;
        message += `• 电话：400-123-4567\n\n`;
        message += `💡 该功能正在开发中，敬请期待！`;
        
        alert(message);
        
        // 记录用户对付费功能的兴趣（用于商业分析）
        this.logPaymentInterest(shopName, feature);
    }
    
    /**
     * 记录付费功能兴趣（用于商业分析）
     * @param {string} shopName - 店铺名称
     * @param {string} feature - 功能名称
     */
    static logPaymentInterest(shopName, feature) {
        try {
            const interestData = {
                timestamp: new Date().toISOString(),
                shopName: shopName,
                feature: feature,
                userAgent: navigator.userAgent,
                referrer: document.referrer
            };
            
            // 发送到分析接口（可选）
            console.log('📊 付费功能兴趣记录:', interestData);
            
            // 存储到本地（用于后续分析）
            const existingData = JSON.parse(localStorage.getItem('paymentInterests') || '[]');
            existingData.push(interestData);
            
            // 只保留最近50条记录
            if (existingData.length > 50) {
                existingData.splice(0, existingData.length - 50);
            }
            
            localStorage.setItem('paymentInterests', JSON.stringify(existingData));
            
        } catch (error) {
            console.error('记录付费兴趣失败:', error);
        }
    }
    
    /**
     * 检查支付状态（开发中版本）
     * @param {string} orderId - 订单ID
     */
    static async checkPaymentStatus(orderId) {
        console.log('🔍 [开发中] 支付状态查询功能:', orderId);
        alert('支付状态查询功能开发中，如有问题请联系客服。');
    }
    
    /**
     * 获取店铺信息
     * @param {string} shopId - 店铺ID
     * @returns {Object|null} 店铺信息
     */
    static async getShopInfo(shopId) {
        try {
            const sessionId = localStorage.getItem('sessionId') || localStorage.getItem('token');
            const response = await fetch(`/api/shops/${shopId}`, {
                headers: {
                    'X-Session-Id': sessionId,
                    'Authorization': `Bearer ${sessionId}`
                }
            });
            
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('获取店铺信息失败:', error);
            return null;
        }
    }
    
    /**
     * 刷新店铺列表
     */
    static refreshShopList() {
        // 如果存在店铺管理器，刷新列表
        if (window.mobileShopManager && typeof window.mobileShopManager.loadShops === 'function') {
            console.log('🔄 刷新店铺列表');
            window.mobileShopManager.loadShops();
        } else {
            console.log('🔄 尝试刷新页面');
            setTimeout(() => window.location.reload(), 2000);
        }
    }
    
    /**
     * 获取付费兴趣统计（管理用）
     * @returns {Array} 付费兴趣记录
     */
    static getPaymentInterests() {
        try {
            return JSON.parse(localStorage.getItem('paymentInterests') || '[]');
        } catch (error) {
            console.error('获取付费兴趣统计失败:', error);
            return [];
        }
    }
    
    /**
     * 清理付费兴趣记录（管理用）
     */
    static clearPaymentInterests() {
        localStorage.removeItem('paymentInterests');
        console.log('✅ 付费兴趣记录已清理');
    }
}

// 模块就绪通知
if (typeof window !== 'undefined') {
    console.log('💰 [Ruilong] 付费模块已加载（开发中版本）');
    
    // 暴露给全局作用域
    window.RuilongPayment = RuilongPayment;
}