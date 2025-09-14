/**
 * 付费开通系统模块
 * 功能：店铺付费开通、支付流程管理、订单状态跟踪
 * 作者：QuickTalk团队
 * 版本：1.0.0
 */

class PaymentActivationSystem {
    constructor() {
        this.currentOrder = null;
        this.currentPaymentMethod = null;
        this.paymentPolling = null;
        this.config = {
            activationPrice: 2000, // 付费开通价格
            pollInterval: 3000,    // 支付状态轮询间隔（毫秒）
            orderTimeout: 30 * 60 * 1000, // 订单超时时间（30分钟）
            supportedMethods: ['alipay', 'wechat']
        };
        
        this.init();
    }

    /**
     * 初始化付费开通系统
     */
    init() {
        console.log('🏪 PaymentActivationSystem 初始化');
        this.createActivationModal();
        this.bindEvents();
    }

    /**
     * 创建付费开通模态框
     */
    createActivationModal() {
        const modalHTML = `
            <div id="activationModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>💎 店铺付费开通</h3>
                        <span class="close-btn" onclick="paymentActivationSystem.closeModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <!-- 订单信息 -->
                        <div class="activation-info">
                            <div class="info-item">
                                <strong>订单号：</strong>
                                <span id="activationOrderId">-</span>
                            </div>
                            <div class="info-item">
                                <strong>店铺名称：</strong>
                                <span id="activationShopName">-</span>
                            </div>
                            <div class="info-item">
                                <strong>开通费用：</strong>
                                <span id="activationAmount" class="amount">¥${this.config.activationPrice}</span>
                            </div>
                            <div class="info-item">
                                <strong>订单有效期：</strong>
                                <span id="activationExpiry">-</span>
                            </div>
                            <div class="info-item activation-benefit">
                                <strong>开通后享受：</strong>
                                <span class="benefit-text">✅ 立即审核通过 + 1年服务期</span>
                            </div>
                        </div>

                        <!-- 支付方式选择 -->
                        <div id="activationPaymentMethods" class="payment-methods">
                            <h4>请选择支付方式：</h4>
                            <div class="payment-buttons">
                                <button class="payment-btn alipay-btn" onclick="paymentActivationSystem.selectPaymentMethod('alipay')">
                                    <div class="payment-icon">💰</div>
                                    <div class="payment-text">支付宝支付</div>
                                </button>
                                <button class="payment-btn wechat-btn" onclick="paymentActivationSystem.selectPaymentMethod('wechat')">
                                    <div class="payment-icon">💚</div>
                                    <div class="payment-text">微信支付</div>
                                </button>
                            </div>
                        </div>

                        <!-- 二维码支付区域 -->
                        <div id="activationQrCodeSection" class="qr-code-section" style="display: none;">
                            <h4 id="activationPaymentMethodName">支付宝</h4>
                            <div class="qr-code-container">
                                <img id="activationPaymentQRCode" src="" alt="付费开通支付二维码" />
                                <div class="qr-tips">
                                    <p>请使用<span id="activationPaymentAppName">支付宝</span>扫码支付 <span class="amount">¥${this.config.activationPrice}</span></p>
                                    <p class="tip-text">付费成功后，店铺将立即审核通过</p>
                                </div>

                                <!-- 刷新二维码按钮 -->
                                <div class="qr-actions">
                                    <button class="refresh-btn" onclick="paymentActivationSystem.refreshQRCode()" title="刷新二维码">
                                        🔄 刷新二维码
                                    </button>
                                </div>
                            </div>

                            <!-- 测试按钮 -->
                            <div class="test-buttons">
                                <button class="test-btn" onclick="paymentActivationSystem.mockPaymentSuccess()">
                                    🧪 模拟支付成功 (测试)
                                </button>
                            </div>
                        </div>

                        <!-- 支付成功 -->
                        <div id="activationPaymentSuccess" class="payment-success" style="display: none;">
                            <div class="success-icon">🎉</div>
                            <h4>付费开通成功！</h4>
                            <p>您的店铺已自动审核通过并获得1年有效期</p>
                            <div class="success-actions">
                                <button class="btn btn-primary" onclick="paymentActivationSystem.closeModal(); ShopManager.loadShops();">返回店铺列表</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 如果模态框不存在，则添加到页面
        if (!document.getElementById('activationModal')) {
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 点击模态框外部关闭
        document.addEventListener('click', (e) => {
            if (e.target.id === 'activationModal') {
                this.closeModal();
            }
        });
    }

    /**
     * 开始付费开通流程
     * @param {string} shopId - 店铺ID
     * @param {string} shopName - 店铺名称
     */
    async startActivation(shopId, shopName) {
        console.log('🎯 开始付费开通流程:', { shopId, shopName });

        if (!confirm(`确定要付费开通店铺 "${shopName}" 吗？\n\n付费开通价格：¥${this.config.activationPrice}\n付费成功后，店铺将立即审核通过并获得1年有效期`)) {
            console.log('❌ 用户取消了付费开通');
            return;
        }

        try {
            // 创建付费开通订单
            const order = await this.createActivationOrder(shopId, shopName);
            this.currentOrder = order;
            this.showModal(order);
        } catch (error) {
            console.error('❌ 创建付费开通订单失败:', error);
            alert('创建付费开通订单失败: ' + error.message);
        }
    }

    /**
     * 创建付费开通订单
     * @param {string} shopId - 店铺ID
     * @param {string} shopName - 店铺名称
     */
    async createActivationOrder(shopId, shopName) {
        const sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            throw new Error('用户未登录');
        }

        const response = await fetch(`/api/shops/${shopId}/activate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ 订单创建成功:', data);
        
        return {
            orderId: data.orderId || 'activation_' + Date.now(),
            shopId: shopId,
            shopName: shopName,
            amount: this.config.activationPrice,
            expiresAt: new Date(Date.now() + this.config.orderTimeout).toISOString(),
            status: 'pending'
        };
    }

    /**
     * 显示付费开通模态框
     * @param {Object} order - 订单信息
     */
    showModal(order) {
        // 填充订单信息
        document.getElementById('activationOrderId').textContent = order.orderId;
        document.getElementById('activationShopName').textContent = order.shopName;
        document.getElementById('activationExpiry').textContent = new Date(order.expiresAt).toLocaleString();

        // 重置UI状态
        this.resetModalState();

        // 显示模态框
        document.getElementById('activationModal').style.display = 'flex';
        console.log('💎 显示付费开通模态框');
    }

    /**
     * 选择支付方式并生成二维码
     * @param {string} method - 支付方式 ('alipay' | 'wechat')
     */
    async selectPaymentMethod(method) {
        if (!this.config.supportedMethods.includes(method)) {
            alert('不支持的支付方式');
            return;
        }

        if (!this.currentOrder) {
            alert('订单信息异常，请重新发起付费开通');
            return;
        }

        console.log('💳 选择支付方式:', method);
        this.currentPaymentMethod = method;

        try {
            const qrData = await this.generateQRCode(method);
            this.showQRCode(qrData, method);
            this.startPaymentPolling();
        } catch (error) {
            console.error('❌ 生成支付二维码失败:', error);
            alert('生成支付二维码失败: ' + error.message);
        }
    }

    /**
     * 生成支付二维码
     * @param {string} method - 支付方式
     */
    async generateQRCode(method) {
        const sessionId = localStorage.getItem('sessionId');
        
        const response = await fetch(`/api/activation-orders/${this.currentOrder.orderId}/qrcode`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({
                paymentMethod: method
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        
        // 如果API返回失败，使用模拟数据
        if (!data.qrCodeUrl) {
            console.warn('⚠️ API未返回二维码，使用模拟数据');
            return this.generateMockQRCode(method);
        }

        return data;
    }

    /**
     * 生成模拟二维码数据
     * @param {string} method - 支付方式
     */
    generateMockQRCode(method) {
        const orderId = this.currentOrder.orderId;
        const amount = this.config.activationPrice;
        const qrText = `模拟${method === 'alipay' ? '支付宝' : '微信'}付费开通订单:${orderId} 金额:¥${amount}`;
        
        return {
            orderId: orderId,
            amount: amount,
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrText)}`,
            expiresAt: this.currentOrder.expiresAt
        };
    }

    /**
     * 显示支付二维码
     * @param {Object} qrData - 二维码数据
     * @param {string} method - 支付方式
     */
    showQRCode(qrData, method) {
        const methodName = method === 'alipay' ? '支付宝' : '微信';
        const appName = method === 'alipay' ? '支付宝' : '微信';

        // 更新界面显示
        document.getElementById('activationPaymentMethodName').textContent = methodName;
        document.getElementById('activationPaymentQRCode').src = qrData.qrCodeUrl;
        document.getElementById('activationPaymentAppName').textContent = appName;

        // 设置支付方式样式
        const qrSection = document.getElementById('activationQrCodeSection');
        const qrContainer = qrSection.querySelector('.qr-code-container');

        // 清除旧样式
        qrContainer.classList.remove('alipay-style', 'wechat-style');
        qrSection.removeAttribute('data-method');

        // 应用新样式
        qrContainer.classList.add(method === 'alipay' ? 'alipay-style' : 'wechat-style');
        qrSection.setAttribute('data-method', method);

        // 添加二维码加载错误处理
        const qrImg = document.getElementById('activationPaymentQRCode');
        qrImg.onerror = () => {
            console.warn('二维码加载失败，使用备用方案');
            const fallbackData = this.generateMockQRCode(method);
            qrImg.src = fallbackData.qrCodeUrl;
        };

        // 隐藏支付方式选择，显示二维码
        document.getElementById('activationPaymentMethods').style.display = 'none';
        document.getElementById('activationQrCodeSection').style.display = 'block';

        console.log(`💎 显示${methodName}付费开通支付二维码`);
    }

    /**
     * 开始支付状态轮询
     */
    startPaymentPolling() {
        // 清理之前的轮询
        if (this.paymentPolling) {
            clearInterval(this.paymentPolling);
        }

        console.log('🔄 开始付费开通支付状态轮询...');

        this.paymentPolling = setInterval(async () => {
            try {
                const status = await this.checkPaymentStatus();
                
                if (status === 'paid') {
                    this.handlePaymentSuccess();
                } else if (status === 'expired') {
                    this.handlePaymentExpired();
                }
            } catch (error) {
                console.error('轮询支付状态失败:', error);
            }
        }, this.config.pollInterval);

        // 设置超时停止轮询
        setTimeout(() => {
            if (this.paymentPolling) {
                clearInterval(this.paymentPolling);
                this.paymentPolling = null;
                console.log('⏰ 支付轮询超时停止');
            }
        }, this.config.orderTimeout);
    }

    /**
     * 检查支付状态
     */
    async checkPaymentStatus() {
        if (!this.currentOrder) return 'unknown';

        const sessionId = localStorage.getItem('sessionId');
        
        try {
            const response = await fetch(`/api/activation-orders/${this.currentOrder.orderId}/status`, {
                headers: {
                    'X-Session-Id': sessionId
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.order?.status || 'pending';
            }
        } catch (error) {
            console.error('检查支付状态失败:', error);
        }

        return 'pending';
    }

    /**
     * 处理支付成功
     */
    handlePaymentSuccess() {
        console.log('🎉 付费开通支付成功');
        
        // 停止轮询
        if (this.paymentPolling) {
            clearInterval(this.paymentPolling);
            this.paymentPolling = null;
        }

        // 显示支付成功页面
        document.getElementById('activationQrCodeSection').style.display = 'none';
        document.getElementById('activationPaymentSuccess').style.display = 'block';

        // 显示成功提示
        setTimeout(() => {
            alert('🎉 付费开通成功！\n\n您的店铺已自动审核通过并获得1年有效期，感谢您的支持！');
        }, 1000);
    }

    /**
     * 处理支付超时
     */
    handlePaymentExpired() {
        console.log('⏰ 付费开通支付超时');
        
        // 停止轮询
        if (this.paymentPolling) {
            clearInterval(this.paymentPolling);
            this.paymentPolling = null;
        }

        alert('支付超时，请重新发起付费开通');
        this.closeModal();
    }

    /**
     * 刷新二维码
     */
    async refreshQRCode() {
        if (!this.currentOrder || !this.currentPaymentMethod) {
            alert('无法刷新二维码，请重新选择支付方式');
            return;
        }

        const refreshBtn = document.querySelector('#activationQrCodeSection .refresh-btn');
        const originalText = refreshBtn.textContent;

        // 显示加载状态
        refreshBtn.textContent = '🔄 刷新中...';
        refreshBtn.disabled = true;

        try {
            await this.selectPaymentMethod(this.currentPaymentMethod);
        } catch (error) {
            console.error('刷新二维码失败:', error);
            alert('刷新失败，请重试');
        } finally {
            // 恢复按钮状态
            setTimeout(() => {
                refreshBtn.textContent = originalText;
                refreshBtn.disabled = false;
            }, 500);
        }
    }

    /**
     * 模拟支付成功 (测试功能)
     */
    mockPaymentSuccess() {
        console.log('🧪 模拟付费开通支付成功');
        this.handlePaymentSuccess();
    }

    /**
     * 重置模态框状态
     */
    resetModalState() {
        document.getElementById('activationPaymentMethods').style.display = 'block';
        document.getElementById('activationQrCodeSection').style.display = 'none';
        document.getElementById('activationPaymentSuccess').style.display = 'none';
    }

    /**
     * 关闭模态框
     */
    closeModal() {
        document.getElementById('activationModal').style.display = 'none';
        
        // 清理轮询
        if (this.paymentPolling) {
            clearInterval(this.paymentPolling);
            this.paymentPolling = null;
        }

        // 重置状态
        this.resetModalState();
        this.currentOrder = null;
        this.currentPaymentMethod = null;
        
        console.log('❌ 关闭付费开通模态框');
    }

    /**
     * 销毁实例
     */
    destroy() {
        // 清理轮询
        if (this.paymentPolling) {
            clearInterval(this.paymentPolling);
            this.paymentPolling = null;
        }

        // 移除模态框
        const modal = document.getElementById('activationModal');
        if (modal) {
            modal.remove();
        }

        console.log('🗑️ PaymentActivationSystem 已销毁');
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentActivationSystem;
}

// 全局实例（在浏览器环境中）
if (typeof window !== 'undefined') {
    window.PaymentActivationSystem = PaymentActivationSystem;
    
    // 自动初始化（如果需要）
    if (window.AUTO_INIT_MODULES !== false) {
        window.paymentActivationSystem = new PaymentActivationSystem();
    }
}