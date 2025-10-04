"use strict";

// common-utils.js — 通用工具函数（从 mobile-dashboard.html 抽取）
// 提供：formatTime(date), showToast(message, type), fetchShops(), openConversation(id), createNewShop()

(function(){
  // 时间格式化
  window.formatTime = function formatTime(date) {
    if (!date) return '未知';
    const dateObj = (date instanceof Date) ? date : new Date(date);
    const now = new Date();
    const diff = now - dateObj;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) {
      return '刚刚';
    } else if (minutes < 60) {
      return `${minutes}分钟前`;
    } else if (hours < 24) {
      return `${hours}小时前`;
    } else {
      return `${days}天前`;
    }
  };

  // 显示提示信息（简单实现，可被其他 showToast 覆盖）
  if (typeof window.showToast === 'undefined') {
    window.showToast = function showToast(message, type = 'info') {
      console.log(`[${type.toUpperCase()}] ${message}`);
      // 可在此处添加UI提示逻辑
    };
  }

  // 获取店铺列表
  window.fetchShops = async function fetchShops(options) {
    const TTL = (options && options.ttlMs) || 30000; // 30s 默认TTL
    const CACHE_KEY = 'shops_cache_v1';
    const now = Date.now();

    const readCache = () => {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.data)) return null;
        if (now - (parsed.ts || 0) > TTL) return null; // 过期
        return parsed;
      } catch(_) { return null; }
    };

    const writeCache = (data) => {
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch(_) {}
    };

    const fireUpdated = (data) => {
      try { window.dispatchEvent(new CustomEvent('shops:updated', { detail: { count: data.length }})); } catch(_) {}
    };

    // 先尝试返回缓存 (快速渲染)
    const cached = readCache();
    if (cached) {
      // 后台刷新（不阻塞首次渲染）
      setTimeout(() => fetchShops({ force: true }), 0);
      return cached.data;
    }

    if (options && options.force) {
      // 强制刷新逻辑继续向下执行
    }

    try {
      console.log('🔄 正在获取店铺列表...');

      // 等待会话（避免过早请求导致 401 返回空列表）
      const waitForSession = async (retries = 10, interval = 150) => {
        for (let i = 0; i < retries; i++) {
          const t = (typeof getAuthToken === 'function') ? getAuthToken() : '';
          if (t) return t;
          await new Promise(r => setTimeout(r, interval));
        }
        return '';
      };

      let authToken = (typeof getAuthToken === 'function') ? getAuthToken() : '';
      if (!authToken) {
        authToken = await waitForSession();
      }

      if (!authToken) {
        console.warn('⚠️ 无可用会话 token，延迟返回空数组（未登录或登录尚未完成）');
        return [];
      }

      const apiUrl = '/api/shops';
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}`, 'X-Session-Id': authToken };
      console.log(`📡 调用API: ${apiUrl}`, { hasToken: !!authToken });

      const response = await fetch(apiUrl, { headers });
      if (response.status === 401) {
        console.warn('⚠️ 401 未授权，尝试调用 /api/auth/session 诊断');
        try {
          const diag = await fetch('/api/auth/session', { headers });
          if (diag.ok) {
            const j = await diag.json();
            console.log('🩺 会话诊断:', j);
          }
        } catch(_){ }
        try { sessionStorage.removeItem(CACHE_KEY); } catch(_) {}
        if (typeof showToast === 'function') showToast('登录已过期或未登录，请重新登录', 'warning');
        return [];
      }
      if (!response.ok) {
        console.error('❌ API响应失败:', response.status, response.statusText);
        return [];
      }

      const result = await response.json();
      console.log('📦 API响应:', result);
      let data = [];
      if (result.success && Array.isArray(result.data)) {
        data = result.data;
      } else if (Array.isArray(result)) {
        data = result;
      } else if (Array.isArray(result.data?.items)) {
        data = result.data.items;
      } else {
        console.warn('⚠️ 意外的响应格式:', result);
        data = [];
      }
      writeCache(data);
      fireUpdated(data);
      console.log('✅ 成功获取并缓存店铺数据:', data.length);
      return data;
    } catch (error) {
      console.error('❌ 获取店铺列表API调用失败:', error);
      return [];
    }
  };

  // 打开对话
  window.openConversation = function openConversation(conversationId) {
    console.log('打开对话:', conversationId);
    if (typeof showToast === 'function') showToast('对话功能开发中...', 'info');
  };

  // 创建新店铺
  window.createNewShop = function createNewShop() {
    console.log('🏪 createNewShop 函数被调用');
    try {
      if (typeof showCreateShopModal === 'function') {
        showCreateShopModal();
      } else {
        console.warn('showCreateShopModal 函数未定义');
        if (typeof showToast === 'function') showToast('创建店铺功能加载中...', 'info');
      }
    } catch (error) {
      console.error('❌ createNewShop 错误:', error);
      if (typeof showToast === 'function') showToast('显示创建店铺对话框时出错: ' + error.message, 'error');
    }
  };

  // 显示店铺管理模态框
  window.showShopManagementModal = function showShopManagementModal(shop) {
    if (!shop) return;
    console.log('显示店铺管理模态框:', shop.name);
    if (typeof showToast === 'function') showToast(`管理店铺"${shop.name}"功能开发中...`, 'info');
    // TODO: 实现店铺管理模态框
  };
})();
