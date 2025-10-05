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
        try {
            // 使用增强的认证头获取
            const headers = typeof window.getAuthHeaders === 'function' 
                ? window.getAuthHeaders() 
                : {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${typeof window.getAuthToken === 'function' ? window.getAuthToken() : ''}`,
                    'X-Session-Id': typeof window.getAuthToken === 'function' ? window.getAuthToken() : ''
                };

            console.log('📊 加载仪表板统计数据...', { hasToken: !!headers.Authorization });

            // 1) 店铺总数
            let totalShops = 0;
            try {
                const shopsResponse = await fetch('/api/shops', { headers });
                if (shopsResponse.status === 401) {
                    console.warn('⚠️ 店铺数据加载：收到401未授权错误');
                    if (typeof window.checkLoginStatus === 'function') {
                        setTimeout(() => window.checkLoginStatus(), 1000);
                    }
                } else if (shopsResponse.ok) {
                    const shopsData = await shopsResponse.json();
                    if (shopsData.success && Array.isArray(shopsData.data)) {
                        totalShops = shopsData.data.length;
                    }
                }
            } catch (e) { 
                console.warn('店铺统计获取失败:', e.message);
            }

            // 2) 今日消息数（复用工作台汇总接口）
            let todayMessages = 0;
            try {
                const wbRes = await fetch('/api/workbench/summary?days=1', { headers });
                if (wbRes.status === 401) {
                    console.warn('⚠️ 工作台数据加载：收到401未授权错误');
                    if (typeof window.checkLoginStatus === 'function') {
                        setTimeout(() => window.checkLoginStatus(), 1000);
                    }
                } else if (wbRes.ok) {
                    const wb = await wbRes.json();
                    if (wb.success && wb.data && wb.data.totals) {
                        todayMessages = wb.data.totals.messages_today || 0;
                    }
                }
            } catch (e) { 
                console.warn('今日消息统计获取失败:', e.message);
            }

            console.log('✅ 仪表板统计数据加载完成:', { totalShops, todayMessages });

            return {
                totalShops,
                todayMessages
            };
        } catch (error) {
            console.error('❌ 获取统计数据失败:', error);
            return { totalShops: 0, todayMessages: 0 };
        }
    };

    // 调试工具：测试仪表板数据加载
    window.debugDashboard = async function() {
        console.log('🧪 调试工具：测试仪表板数据加载');
        
        console.log('1. 检查认证状态...');
        if (typeof window.debugAuth === 'function') {
            window.debugAuth();
        }
        
        console.log('2. 检查DOM元素...');
        console.log('- totalShops元素:', !!document.getElementById('totalShops'));
        console.log('- totalMessages元素:', !!document.getElementById('totalMessages'));
        console.log('- workbenchContent元素:', !!document.getElementById('workbenchContent'));
        
        console.log('3. 测试API调用...');
        try {
            const stats = await window.fetchDashboardStats();
            console.log('✅ 仪表板统计获取成功:', stats);
            
            // 更新显示
            if (typeof window.loadDashboardData === 'function') {
                await window.loadDashboardData();
                console.log('✅ 仪表板数据已更新到界面');
            }
            
            return stats;
        } catch (e) {
            console.error('❌ 仪表板数据获取失败:', e);
            return null;
        }
    };

    console.log('✅ 仪表板模块已加载 (dashboard.js)，调试命令: window.debugDashboard()');
})();
