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
            const authToken = getAuthToken();
            const headers = authToken ? { 'Authorization': `Bearer ${authToken}`, 'X-Session-Id': authToken } : {};

            // 1) 店铺总数
            let totalShops = 0;
            try {
                const shopsResponse = await fetch('/api/shops', { headers });
                if (shopsResponse.ok) {
                    const shopsData = await shopsResponse.json();
                    totalShops = Array.isArray(shopsData.data) ? shopsData.data.length : 0;
                }
            } catch (_) { /* 忽略，保留默认0 */ }

            // 2) 今日消息数（复用工作台汇总接口）
            let todayMessages = 0;
            try {
                const wbRes = await fetch('/api/workbench/summary?days=1', { headers });
                if (wbRes.ok) {
                    const wb = await wbRes.json();
                    const totals = (wb && wb.data && wb.data.totals) || (wb && wb.totals) || {};
                    todayMessages = totals.messages_today || 0;
                }
            } catch (_) { /* 忽略，保留默认0 */ }

            return {
                totalShops,
                todayMessages
            };
        } catch (error) {
            console.error('获取统计数据失败:', error);
            return { totalShops: 0, todayMessages: 0 };
        }
    };

    console.log('✅ 仪表板模块已加载 (dashboard.js)');
})();
