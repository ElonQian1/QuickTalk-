/**
 * 仪表板模块
 * 负责首页数据统计的加载和显示
 */
(function() {
    'use strict';

    // 加载仪表板数据
    window.loadDashboardData = async function() {
        try {
            // 调用统计数据API
            const stats = await window.fetchDashboardStats();
            
            const totalShopsEl = document.getElementById('totalShops');
            const totalMessagesEl = document.getElementById('totalMessages');

            if (totalShopsEl) totalShopsEl.textContent = stats.totalShops;
            if (totalMessagesEl) totalMessagesEl.textContent = stats.todayMessages;
            // 指标已移除：activeChats / responseRate
        } catch (error) {
            console.error('❌ 加载仪表板数据失败:', error);
        }
    };

    // 获取仪表板统计数据
    window.fetchDashboardStats = async function() {
        const getAuthToken = typeof window.getAuthToken === 'function' ? window.getAuthToken : () => '';

        try {
            // 调用不需要认证的店铺API（与成功的店铺列表API保持一致）
            const authToken = getAuthToken();
            const shopsResponse = await fetch('/api/shops', {
                headers: authToken ? {
                    'Authorization': `Bearer ${authToken}`,
                    'X-Session-Id': authToken
                } : {}
            });

            if (shopsResponse.ok) {
                const shopsData = await shopsResponse.json();
                const shops = shopsData.data || [];
                
                return {
                    totalShops: shops.length,
                    todayMessages: 0,  // 暂时设为0，需要消息API
                    // 已移除：activeChats / responseRate
                };
            } else {
                throw new Error('获取店铺数据失败');
            }
        } catch (error) {
            console.error('获取统计数据失败:', error);
            // 如果API调用失败，返回空数据而不是随机数据
            return {
                totalShops: 0,
                todayMessages: 0,
                // 已移除：activeChats / responseRate
            };
        }
    };

    console.log('✅ 仪表板模块已加载 (dashboard.js)');
})();
