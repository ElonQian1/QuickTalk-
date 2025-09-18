/**
 * Ruilong版本 - 付费激活模块
 * 处理店铺付费开通和续费功能
 */

class RuilongPayment {
    
    /**
     * 付费激活店铺（ruilong原版功能）
     * @param {string} shopId - 店铺ID
     */
    static async payToActivate(shopId) {
        try {
            console.log('💰 [Ruilong] 开始付费开通流程:', shopId);
            
            // 从当前加载的店铺数据中查找店铺（兼容ruilong原版逻辑）
            let shop = null;
            if (window.currentShops && window.currentShops.length > 0) {
                shop = window.currentShops.find(s => s.id === shopId);
                console.log('🔍 找到的店铺:', shop);
            } else {
                // 如果currentShops不可用，尝试从API获取
                shop = await this.getShopInfo(shopId);
            }

            if (!shop) {
                alert('店铺不存在或数据未加载，请刷新页面后重试');
                console.error('❌ Shop not found:', shopId);
                return;
            }

            console.log('✅ 店铺验证通过，显示确认对话框');
            if (!confirm(`确定要付费开通店铺 "${shop.name}" 吗？\n\n付费开通价格：¥2000\n付费成功后，店铺将立即审核通过并获得1年有效期`)) {
                console.log('❌ 用户取消了付费开通');
                return;
            }

            console.log('✅ 用户确认付费开通，创建订单...');
            
            // 使用ruilong原版API
            const sessionId = localStorage.getItem('sessionId') || localStorage.getItem('token');
            const response = await fetch(`/api/shops/${shopId}/activate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': sessionId,
                    'Authorization': `Bearer ${sessionId}`
                }
            });

            console.log('📡 API响应状态:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ 付费开通成功:', result);
                alert('🎉 付费开通成功！店铺已自动审核通过，可以正常使用了。');
                
                // 刷新店铺列表
                this.refreshShopList();
            } else {
                const error = await response.json();
                console.error('❌ 付费开通失败:', error);
                alert(`付费开通失败: ${error.error || '未知错误'}`);
            }
            
        } catch (error) {
            console.error('❌ [Ruilong] 付费激活失败:', error);
            alert(`付费激活失败: ${error.message}`);
        }
    }
    
    /**
     * 续费店铺（ruilong原版功能）
     * @param {string} shopId - 店铺ID
     */
    static async renewShop(shopId) {
        try {
            console.log('🔄 [Ruilong] 开始续费流程:', shopId);
            
            // 获取店铺信息
            let shop = null;
            if (window.currentShops && window.currentShops.length > 0) {
                shop = window.currentShops.find(s => s.id === shopId);
            } else {
                shop = await this.getShopInfo(shopId);
            }

            if (!shop) {
                alert('店铺信息不存在');
                return;
            }
            
            const expiryDate = shop.expiryDate ? new Date(shop.expiryDate).toLocaleDateString() : '未设置';
            
            if (!confirm(`确定要为店铺 "${shop.name}" 续费吗？\n\n续费价格：¥2000/年\n当前到期时间：${expiryDate}\n续费后将延长1年有效期`)) {
                return;
            }
            
            // 使用ruilong原版续费逻辑
            const sessionId = localStorage.getItem('sessionId') || localStorage.getItem('token');
            const response = await fetch(`/api/shops/${shopId}/renew`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': sessionId,
                    'Authorization': `Bearer ${sessionId}`
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ 续费成功:', result);
                alert('🎉 续费成功！店铺有效期已延长1年。');
                this.refreshShopList();
            } else {
                const error = await response.json();
                console.error('❌ 续费失败:', error);
                alert(`续费失败: ${error.error || '未知错误'}`);
            }
            
        } catch (error) {
            console.error('❌ [Ruilong] 续费失败:', error);
            alert(`续费失败: ${error.message}`);
        }
    }
    
    /**
     * 获取店铺信息
     * @param {string} shopId - 店铺ID
     * @returns {Object} - 店铺信息
     */
    static async getShopInfo(shopId) {
        try {
            const response = await fetch(`/api/shops/${shopId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取店铺信息失败:', error);
            return null;
        }
    }
    
    /**
     * 显示付费确认模态框
     * @param {Object} shopInfo - 店铺信息
     */
    static showPaymentConfirmModal(shopInfo) {
        const modal = document.createElement('div');
        modal.className = 'payment-confirm-modal';
        modal.innerHTML = `
            <div class="payment-confirm-content">
                <div class="payment-confirm-header">
                    <h3>💰 付费开通店铺</h3>
                    <button class="close-btn" onclick="this.closest('.payment-confirm-modal').remove()">✕</button>
                </div>
                <div class="payment-confirm-body">
                    <div class="shop-info-card">
                        <h4>📄 店铺信息</h4>
                        <div class="info-item">
                            <span class="label">店铺名称：</span>
                            <span class="value">${shopInfo.name}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">店铺域名：</span>
                            <span class="value">${shopInfo.domain || '未设置'}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">当前状态：</span>
                            <span class="value status-${shopInfo.approval_status}">${this.getStatusText(shopInfo.approval_status)}</span>
                        </div>
                    </div>
                    
                    <div class="pricing-info">
                        <h4>💳 付费方案</h4>
                        <div class="pricing-options">
                            <div class="pricing-option" data-plan="monthly">
                                <div class="plan-name">月费套餐</div>
                                <div class="plan-price">¥99/月</div>
                                <div class="plan-features">
                                    <div class="feature">✅ 无限消息数量</div>
                                    <div class="feature">✅ 实时消息推送</div>
                                    <div class="feature">✅ 基础数据统计</div>
                                </div>
                                <button class="select-plan-btn" onclick="RuilongPayment.selectPlan('monthly', 99, '${shopInfo.id}')">选择此方案</button>
                            </div>
                            
                            <div class="pricing-option recommended" data-plan="yearly">
                                <div class="plan-badge">推荐</div>
                                <div class="plan-name">年费套餐</div>
                                <div class="plan-price">¥999/年</div>
                                <div class="plan-original">原价 ¥1188</div>
                                <div class="plan-features">
                                    <div class="feature">✅ 无限消息数量</div>
                                    <div class="feature">✅ 实时消息推送</div>
                                    <div class="feature">✅ 高级数据统计</div>
                                    <div class="feature">✅ 自定义样式</div>
                                    <div class="feature">✅ 优先技术支持</div>
                                </div>
                                <button class="select-plan-btn primary" onclick="RuilongPayment.selectPlan('yearly', 999, '${shopInfo.id}')">选择此方案</button>
                            </div>
                            
                            <div class="pricing-option" data-plan="enterprise">
                                <div class="plan-name">企业套餐</div>
                                <div class="plan-price">¥2999/年</div>
                                <div class="plan-features">
                                    <div class="feature">✅ 所有功能</div>
                                    <div class="feature">✅ 多店铺管理</div>
                                    <div class="feature">✅ API接口</div>
                                    <div class="feature">✅ 专属客服</div>
                                </div>
                                <button class="select-plan-btn" onclick="RuilongPayment.selectPlan('enterprise', 2999, '${shopInfo.id}')">选择此方案</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="payment-notice">
                        <h4>📝 付费说明</h4>
                        <ul>
                            <li>付费后店铺将立即激活，无需等待审核</li>
                            <li>支持微信支付、支付宝等多种付款方式</li>
                            <li>7天内无条件退款保障</li>
                            <li>如有问题请联系客服：400-123-4567</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    /**
     * 显示续费模态框
     * @param {Object} shopInfo - 店铺信息
     */
    static showRenewalModal(shopInfo) {
        const modal = document.createElement('div');
        modal.className = 'renewal-modal';
        modal.innerHTML = `
            <div class="renewal-content">
                <div class="renewal-header">
                    <h3>🔄 续费店铺</h3>
                    <button class="close-btn" onclick="this.closest('.renewal-modal').remove()">✕</button>
                </div>
                <div class="renewal-body">
                    <div class="current-plan-info">
                        <h4>📊 当前套餐信息</h4>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="label">当前套餐：</span>
                                <span class="value">${this.getCurrentPlan(shopInfo)}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">到期时间：</span>
                                <span class="value">${this.getExpiryDate(shopInfo)}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">剩余天数：</span>
                                <span class="value">${this.getRemainingDays(shopInfo)}天</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="renewal-options">
                        <h4>🔄 续费选项</h4>
                        <div class="renewal-plans">
                            <div class="renewal-plan" data-duration="1">
                                <div class="duration">续费1个月</div>
                                <div class="price">¥99</div>
                                <button class="renewal-btn" onclick="RuilongPayment.processRenewal('${shopInfo.id}', 1, 99)">立即续费</button>
                            </div>
                            <div class="renewal-plan recommended" data-duration="12">
                                <div class="badge">最划算</div>
                                <div class="duration">续费1年</div>
                                <div class="price">¥999</div>
                                <div class="savings">节省¥189</div>
                                <button class="renewal-btn primary" onclick="RuilongPayment.processRenewal('${shopInfo.id}', 12, 999)">立即续费</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="renewal-benefits">
                        <h4>✨ 续费优惠</h4>
                        <ul>
                            <li>续费1年享受8.5折优惠</li>
                            <li>老用户专享技术支持</li>
                            <li>免费升级新功能</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    /**
     * 选择付费方案
     * @param {string} plan - 方案类型
     * @param {number} amount - 金额
     * @param {string} shopId - 店铺ID
     */
    static async selectPlan(plan, amount, shopId) {
        try {
            console.log('💳 [Ruilong] 选择付费方案:', { plan, amount, shopId });
            
            // 确认付费
            const confirmed = confirm(`确认选择${plan}套餐吗？\n\n金额：¥${amount}\n\n点击确认后将跳转到支付页面。`);
            if (!confirmed) return;
            
            // 创建付费订单
            const response = await fetch('/api/payment/create-order', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    shopId: shopId,
                    plan: plan,
                    amount: amount,
                    type: 'activation'
                })
            });
            
            if (!response.ok) {
                throw new Error('创建订单失败');
            }
            
            const orderData = await response.json();
            this.redirectToPayment(orderData);
            
        } catch (error) {
            console.error('❌ [Ruilong] 选择方案失败:', error);
            alert(`付费失败: ${error.message}`);
        }
    }
    
    /**
     * 处理续费
     * @param {string} shopId - 店铺ID
     * @param {number} duration - 续费时长（月）
     * @param {number} amount - 金额
     */
    static async processRenewal(shopId, duration, amount) {
        try {
            console.log('🔄 [Ruilong] 处理续费:', { shopId, duration, amount });
            
            const confirmed = confirm(`确认续费${duration}个月吗？\n\n金额：¥${amount}`);
            if (!confirmed) return;
            
            const response = await fetch('/api/payment/create-order', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    shopId: shopId,
                    duration: duration,
                    amount: amount,
                    type: 'renewal'
                })
            });
            
            if (!response.ok) {
                throw new Error('创建续费订单失败');
            }
            
            const orderData = await response.json();
            this.redirectToPayment(orderData);
            
        } catch (error) {
            console.error('❌ [Ruilong] 续费失败:', error);
            alert(`续费失败: ${error.message}`);
        }
    }
    
    /**
     * 跳转到支付页面
     * @param {Object} orderData - 订单数据
     */
    static redirectToPayment(orderData) {
        // 关闭模态框
        const modals = document.querySelectorAll('.payment-confirm-modal, .renewal-modal');
        modals.forEach(modal => modal.remove());
        
        // 显示支付二维码或跳转支付页面
        this.showPaymentModal(orderData);
    }
    
    /**
     * 显示支付模态框
     * @param {Object} orderData - 订单数据
     */
    static showPaymentModal(orderData) {
        const modal = document.createElement('div');
        modal.className = 'payment-modal';
        modal.innerHTML = `
            <div class="payment-content">
                <div class="payment-header">
                    <h3>💳 完成支付</h3>
                    <button class="close-btn" onclick="this.closest('.payment-modal').remove()">✕</button>
                </div>
                <div class="payment-body">
                    <div class="order-info">
                        <h4>📋 订单信息</h4>
                        <div class="order-details">
                            <div class="detail-item">
                                <span>订单号：</span>
                                <span>${orderData.orderId}</span>
                            </div>
                            <div class="detail-item">
                                <span>金额：</span>
                                <span class="amount">¥${orderData.amount}</span>
                            </div>
                            <div class="detail-item">
                                <span>类型：</span>
                                <span>${orderData.type === 'activation' ? '店铺激活' : '店铺续费'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="payment-methods">
                        <h4>💰 支付方式</h4>
                        <div class="payment-tabs">
                            <button class="payment-tab active" data-method="wechat">微信支付</button>
                            <button class="payment-tab" data-method="alipay">支付宝</button>
                        </div>
                        
                        <div class="payment-qr">
                            <div class="qr-placeholder">
                                <div class="qr-code">📱</div>
                                <div class="qr-text">请使用手机扫描二维码支付</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="payment-status">
                        <button class="check-payment-btn" onclick="RuilongPayment.checkPaymentStatus('${orderData.orderId}')">检查支付状态</button>
                        <div class="payment-notice">支付完成后，店铺将自动激活</div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 初始化支付方式切换
        this.initPaymentTabs(modal);
        
        // 开始轮询支付状态
        this.startPaymentPolling(orderData.orderId);
    }
    
    /**
     * 初始化支付方式标签页
     * @param {Element} modal - 模态框元素
     */
    static initPaymentTabs(modal) {
        const tabs = modal.querySelectorAll('.payment-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // 这里可以切换不同的支付二维码
                console.log('切换支付方式:', tab.dataset.method);
            });
        });
    }
    
    /**
     * 检查支付状态
     * @param {string} orderId - 订单ID
     */
    static async checkPaymentStatus(orderId) {
        try {
            const response = await fetch(`/api/payment/status/${orderId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('查询支付状态失败');
            }
            
            const status = await response.json();
            
            if (status.paid) {
                this.handlePaymentSuccess(status);
            } else {
                alert('支付尚未完成，请完成支付后再试');
            }
            
        } catch (error) {
            console.error('❌ [Ruilong] 支付状态查询失败:', error);
            alert('查询支付状态失败，请稍后重试');
        }
    }
    
    /**
     * 开始轮询支付状态
     * @param {string} orderId - 订单ID
     */
    static startPaymentPolling(orderId) {
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/payment/status/${orderId}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                if (response.ok) {
                    const status = await response.json();
                    if (status.paid) {
                        clearInterval(interval);
                        this.handlePaymentSuccess(status);
                    }
                }
            } catch (error) {
                console.error('轮询支付状态失败:', error);
            }
        }, 3000); // 每3秒检查一次
        
        // 5分钟后停止轮询
        setTimeout(() => clearInterval(interval), 300000);
    }
    
    /**
     * 处理支付成功
     * @param {Object} status - 支付状态
     */
    static handlePaymentSuccess(status) {
        // 关闭支付模态框
        const modal = document.querySelector('.payment-modal');
        if (modal) modal.remove();
        
        // 显示成功提示
        alert('✅ 支付成功！店铺已激活，感谢您的使用！');
        
        // 刷新店铺列表
        if (typeof window.loadUserShops === 'function') {
            window.loadUserShops();
        }
    }
    
    /**
     * 获取状态文本
     * @param {string} status - 状态
     * @returns {string} - 状态文本
     */
    static getStatusText(status) {
        const statusMap = {
            'pending': '待审核',
            'approved': '已批准',
            'rejected': '已拒绝',
            'active': '已激活'
        };
        return statusMap[status] || status;
    }
    
    /**
     * 获取当前套餐
     * @param {Object} shopInfo - 店铺信息
     * @returns {string} - 套餐名称
     */
    static getCurrentPlan(shopInfo) {
        return shopInfo.plan || '月费套餐';
    }
    
    /**
     * 获取到期日期
     * @param {Object} shopInfo - 店铺信息
     * @returns {string} - 到期日期
     */
    static getExpiryDate(shopInfo) {
        if (shopInfo.expiryDate) {
            return new Date(shopInfo.expiryDate).toLocaleDateString('zh-CN');
        }
        return '未设置';
    }
    
    /**
     * 获取剩余天数
     * @param {Object} shopInfo - 店铺信息
     * @returns {number} - 剩余天数
     */
    static getRemainingDays(shopInfo) {
        if (shopInfo.expiryDate) {
            const expiry = new Date(shopInfo.expiryDate);
            const now = new Date();
            const diff = expiry - now;
            return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }
        return 0;
    }
}

// 全局注册模块
window.RuilongPayment = RuilongPayment;

console.log('💰 [Ruilong] 付费激活模块已加载');