/**
 * 店铺列表加载模块
 * 负责店铺列表的加载、渲染和显示
 */
(function() {
    'use strict';

    // 加载对话列表（消息页面入口）
    window.loadConversations = async function() {
        // 初始化消息模块（如果还没有创建）
        if (!window.messageModule) {
            if (typeof window.MessageModule === 'function') {
                try { window.messageModule = new window.MessageModule(); }
                catch(e){ console.error('初始化 MessageModule 失败:', e); }
            }
        }
        
        // 重置页面状态 
        const backBtn = document.getElementById('messagesBackBtn');
        const titleElement = document.getElementById('messagesTitle');
        
        if (titleElement) {
            titleElement.textContent = '客服消息';
        }
        
        if (backBtn) {
            backBtn.style.display = 'none';
        }
        
        // 显示店铺列表作为消息页面的入口
        try {
            // 确保片段加载（避免容器不存在）
            if (window.PartialsLoader && typeof window.PartialsLoader.loadPartials === 'function') {
                await window.PartialsLoader.loadPartials();
            }
        } catch(_) {}
        if (window.messageModule && typeof window.messageModule.showShops === 'function') {
            try { await window.messageModule.showShops(); } catch(e){ console.warn('showShops 调用失败:', e); }
        }
    };

    // 获取对话列表（备用/模拟数据）
    window.fetchConversations = async function() {
        try {
            const response = await fetch('/api/conversations');
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('获取对话列表API调用失败:', error);
        }
        
        // 返回模拟数据
        return [
            {
                id: '1',
                customerName: '张三',
                lastMessage: '你好，我想咨询一下产品价格',
                lastTime: new Date(Date.now() - 1000 * 60 * 5),
                unreadCount: 2
            },
            {
                id: '2',
                customerName: '李四',
                lastMessage: '订单什么时候能发货？',
                lastTime: new Date(Date.now() - 1000 * 60 * 30),
                unreadCount: 0
            },
            {
                id: '3',
                customerName: '王五',
                lastMessage: '可以提供发票吗？',
                lastTime: new Date(Date.now() - 1000 * 60 * 60 * 2),
                unreadCount: 1
            }
        ];
    };

    // 加载店铺列表
    window.loadShops = async function() {
        const fetchShops = typeof window.fetchShops === 'function' ? window.fetchShops : null;
        const getEffectiveStatus = typeof window.getEffectiveStatus === 'function' ? window.getEffectiveStatus : (s) => s.status;
        const getShopStatusClass = typeof window.getShopStatusClass === 'function' ? window.getShopStatusClass : () => '';
        const getShopStatusText = typeof window.getShopStatusText === 'function' ? window.getShopStatusText : (s) => s;
        const getShopActions = typeof window.getShopActions === 'function' ? window.getShopActions : () => '';
        const handleShopClick = typeof window.handleShopClick === 'function' ? window.handleShopClick : () => {};

        const container = document.getElementById('shopsList');
        if (!container) return;

        container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <div class="loading-text">正在加载店铺...</div>
            </div>
        `;
        
        try {
            console.log('🔄 开始加载店铺列表');
            const rawShops = fetchShops ? await fetchShops() : [];
            console.log('📊 获取到的店铺数据:', rawShops);

            // 统一过滤活跃/已审批店铺（若有需要）
            const filterFn = (typeof window.getActiveShops === 'function') ? window.getActiveShops : (arr)=>arr;
            const shopsData = Array.isArray(rawShops) ? filterFn(rawShops) : [];

            // 将店铺数据存储到全局
            window.shopsData = shopsData;
            
            // 确保shopsData是数组
            if (!Array.isArray(rawShops)) {
                console.error('❌ shopsData不是数组:', typeof shopsData, shopsData);
                window.shopsData = [];
            }
            
            if (window.shopsData.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🏪</div>
                        <div class="empty-title">暂无店铺</div>
                        <div class="empty-desc">添加您的第一个店铺开始使用客服系统</div>
                    </div>
                `;
            } else {
                const shopsHTML = window.shopsData.map(shop => {
                    const effStatus = getEffectiveStatus(shop);
                    const statusClass = getShopStatusClass(effStatus);
                    const statusText = getShopStatusText(effStatus);
                    const actions = getShopActions(shop);
                    const isEmployee = shop.membership === 'employee';
                    const sid = shop.id;
                    const unread = Number(shop.unreadCount || 0);
                    
                    return `
                    <div class="shop-card ${(getEffectiveStatus(shop) === 'inactive') ? 'shop-card-inactive' : ''}" data-shop-id="${sid}" onclick="handleShopClick('${sid}', event)">
                        <div class="shop-header">
                            <div class="shop-icon">${shop.name.charAt(0).toUpperCase()}</div>
                        </div>
                        <div class="shop-name">
                            ${shop.name}
                            <span class="unread-count" data-unread="${unread}" style="display: ${unread > 0 ? 'inline' : 'none'};">
                                ${unread > 0 ? `(${unread})` : ''}
                            </span>
                        </div>
                        <div class="shop-domain">${shop.domain || 'domain.example.com'}</div>
                        </div>
                        
                        <div class="shop-meta">
                            <div class="shop-actions">
                                ${actions}
                            </div>
                        </div>
                        
                        ${isEmployee ? `<div class="shop-role-badge">员工</div>` : ''}
                    </div>
                    `;
                }).join('');
                
                container.innerHTML = `
                    <div class="shop-list">
                        ${shopsHTML}
                    </div>
                `;
            }
        } catch (error) {
            console.error('❌ 加载店铺列表失败:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <div class="empty-title">加载失败</div>
                    <div class="empty-desc">无法加载店铺列表，请稍后重试</div>
                </div>
            `;
        }
    };

    // 获取店铺状态CSS类
    window.getShopStatusClass = function(status) {
        const statusMap = {
            'active': 'status-active',
            'approved': 'status-approved',
            'pending': 'status-pending',
            'rejected': 'status-rejected',
            'inactive': 'status-inactive'
        };
        return statusMap[status] || 'status-pending';
    };

    console.log('✅ 店铺列表加载模块已加载 (shops-list.js)');
})();
