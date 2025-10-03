/**
 * 工作台/报表模块
 * 提供数据统计、趋势分析等功能
 */
(function() {
    'use strict';

    // 切换到工作台页面
    window.viewAnalytics = function() {
        console.log('打开工作台/报表');
        if (typeof window.switchPage === 'function') {
            window.switchPage('workbench');
        }
    };

    // 加载工作台汇总数据
    window.loadWorkbenchSummary = async function() {
        const container = document.getElementById('workbenchContent');
        if (!container) return;

        container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <div class="loading-text">正在加载工作台数据...</div>
            </div>
        `;

        try {
            const params = new URLSearchParams();
            // 若已选店铺则过滤；否则汇总全部
            if (window.currentShopId) params.set('shop_id', window.currentShopId);
            params.set('days', '7');
            
            const token = typeof window.getAuthToken === 'function' ? window.getAuthToken() : '';
            const res = await fetch(`/api/workbench/summary?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await res.json();
            if (!data.success) throw new Error(data.error || '加载失败');
            
            window.renderWorkbench(data.data);
        } catch (err) {
            console.error('加载工作台失败:', err);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <div class="empty-title">加载失败</div>
                    <div class="empty-desc">无法加载工作台数据，请稍后重试</div>
                </div>
            `;
        }
    };

    // 渲染工作台数据
    window.renderWorkbench = function(summary) {
        const container = document.getElementById('workbenchContent');
        if (!container) return;

        const t = summary.totals || {};

        // 简单的条形图渲染（纯CSS宽度）
        const byDay = Array.isArray(summary.by_day) ? summary.by_day : [];
        const maxVal = Math.max(1, ...byDay.map(d => Math.max(d.messages || 0, d.conversations_started || 0)));

        const trendHtml = byDay.map(d => {
            const msgPct = Math.round((d.messages || 0) * 100 / maxVal);
            const convPct = Math.round((d.conversations_started || 0) * 100 / maxVal);
            return `
                <div class="trend-row">
                    <div class="trend-date">${d.date}</div>
                    <div class="trend-bars">
                        <div class="bar bar-msg" style="width:${msgPct}%" title="消息: ${d.messages}"></div>
                        <div class="bar bar-conv" style="width:${convPct}%" title="新会话: ${d.conversations_started}"></div>
                    </div>
                    <div class="trend-nums">📨 ${d.messages}｜🗣️ ${d.conversations_started}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${t.conversations || 0}</div><div class="stat-label">总会话</div></div>
                <div class="stat-card"><div class="stat-value">${t.active_conversations || 0}</div><div class="stat-label">活跃会话</div></div>
                <div class="stat-card"><div class="stat-value">${t.waiting_customers || 0}</div><div class="stat-label">待回复</div></div>
                <div class="stat-card"><div class="stat-value">${t.overdue_conversations || 0}</div><div class="stat-label">超时未回</div></div>
                <div class="stat-card"><div class="stat-value">${t.messages_today || 0}</div><div class="stat-label">今日消息</div></div>
                <div class="stat-card"><div class="stat-value">${t.messages_7d || 0}</div><div class="stat-label">7日消息</div></div>
            </div>

            <div class="section" style="margin-top: 16px;">
                <h3 class="actions-title">近7天趋势</h3>
                <div class="trend-list">
                    ${trendHtml || '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">暂无数据</div><div class="empty-desc">最近7天没有消息或会话</div></div>'}
                </div>
                <div class="hint" style="margin-top:8px;color:#6c757d;font-size:12px;">蓝条=消息，紫条=新会话</div>
            </div>

            <style>
                .trend-list { display:flex; flex-direction:column; gap:8px; }
                .trend-row { display:flex; align-items:center; gap:8px; }
                .trend-date { width: 90px; color:#6c757d; font-size:12px; }
                .trend-bars { flex:1; display:flex; gap:4px; align-items:center; }
                .bar { height:10px; border-radius:4px; background:#e9ecef; }
                .bar-msg { background:#4dabf7; }
                .bar-conv { background:#845ef7; }
                .trend-nums { width: 120px; text-align:right; color:#495057; font-size:12px; }
            </style>
        `;
    };

    console.log('✅ 工作台模块已加载 (workbench.js)');
})();
