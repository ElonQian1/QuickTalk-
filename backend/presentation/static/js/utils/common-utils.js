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

  // 调试工具：检查当前登录状态和token
  window.debugAuthStatus = function() {
    console.log('🔍 当前认证状态调试信息:');
    console.log('localStorage.quicktalk_user:', localStorage.getItem('quicktalk_user'));
    console.log('localStorage.authToken:', localStorage.getItem('authToken'));
    console.log('localStorage.admin_token:', localStorage.getItem('admin_token'));
    console.log('localStorage.qt_admin_token:', localStorage.getItem('qt_admin_token'));
    
    if (typeof getAuthToken === 'function') {
      const token = getAuthToken();
      console.log('getAuthToken()结果:', token ? `${token.substr(0, 20)}... (长度: ${token.length})` : '空');
    }
    
    if (window.userData) {
      console.log('window.userData:', window.userData);
    }
  };

  // 调试工具：测试API调用
  window.testShopsAPI = async function() {
    console.log('🧪 测试店铺API调用...');
    try {
      const shops = await window.fetchShops(true); // 强制刷新
      console.log('✅ API调用成功，返回店铺数量:', shops.length);
      console.log('店铺列表:', shops);
      return shops;
    } catch (e) {
      console.error('❌ API调用失败:', e);
      return null;
    }
  };

  console.log('🛠️ 调试工具已加载: window.debugAuthStatus(), window.testShopsAPI()');

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

      // 增强的token获取逻辑，支持多种token格式
      const getValidToken = () => {
        // 尝试从不同来源获取token
        const sources = [
          () => {
            if (typeof getAuthToken === 'function') {
              return getAuthToken();
            }
            return '';
          },
          () => localStorage.getItem('authToken') || '',
          () => localStorage.getItem('admin_token') || '',
          () => localStorage.getItem('qt_admin_token') || '',
          () => {
            try {
              const userData = localStorage.getItem('quicktalk_user');
              if (userData) {
                const parsed = JSON.parse(userData);
                return parsed.token || parsed.session_id || '';
              }
            } catch (e) {
              console.warn('解析用户数据失败:', e);
            }
            return '';
          }
        ];

        for (const source of sources) {
          const token = source();
          if (token && token.length > 10) { // 基本长度检查
            return token;
          }
        }
        return '';
      };

      // 等待会话（避免过早请求导致 401 返回空列表）
      const waitForSession = async (retries = 15, interval = 200) => {
        for (let i = 0; i < retries; i++) {
          const t = getValidToken();
          if (t) {
            console.log(`🔐 获取到token (尝试 ${i + 1}/${retries}): ${t.substr(0, 10)}...`);
            return t;
          }
          await new Promise(r => setTimeout(r, interval));
        }
        return '';
      };

      let authToken = getValidToken();
      if (!authToken) {
        console.log('🔄 第一次获取token失败，等待登录状态...');
        authToken = await waitForSession();
      }

      if (!authToken) {
        console.warn('⚠️ 无可用会话 token，可能需要重新登录');
        // 尝试触发登录状态检查
        if (typeof window.checkLoginStatus === 'function') {
          console.log('🔄 尝试重新检查登录状态...');
          try {
            const loginOk = await window.checkLoginStatus();
            if (!loginOk) {
              console.log('❌ 登录状态检查失败，用户需要重新登录');
              return [];
            }
            // 重新获取token
            authToken = getValidToken();
          } catch (e) {
            console.warn('登录状态检查出错:', e);
          }
        }
        
      if (!authToken) {
        console.warn('⚠️ 最终无法获取有效token，尝试验证会话状态...');
        
        // 最后尝试：调用session验证API
        try {
          const sessionResponse = await fetch('/api/auth/session');
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            console.log('🔍 会话验证结果:', sessionData);
            
            if (sessionData.success && sessionData.data && !sessionData.data.authenticated) {
              console.log('❌ 会话已过期，需要重新登录');
              if (typeof window.checkLoginStatus === 'function') {
                window.checkLoginStatus();
              }
              return [];
            }
          }
        } catch (e) {
          console.warn('会话验证失败:', e);
        }
        
        console.warn('⚠️ 无法建立有效会话，返回空数组');
        return [];
      }
      }

      const apiUrl = '/api/shops';
      const headers = { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${authToken}`, 
        'X-Session-Id': authToken 
      };
      console.log(`📡 调用API: ${apiUrl}`, { 
        hasToken: !!authToken, 
        tokenLength: authToken.length,
        tokenPrefix: authToken.substr(0, 10) + '...'
      });

      const response = await fetch(apiUrl, { headers });
      if (response.status === 401) {
        console.warn('⚠️ 401 未授权，尝试调用 /api/auth/session 诊断');
        try {
          const diag = await fetch('/api/auth/session', { headers });
          if (diag.ok) {
            const j = await diag.json();
            console.log('🩺 会话诊断:', j);
            if (j.data && !j.data.authenticated) {
              console.log('❌ 会话确认已过期，清理本地存储并重定向登录');
              // 清理所有可能的token
              localStorage.removeItem('quicktalk_user');
              localStorage.removeItem('authToken');
              localStorage.removeItem('admin_token');
              localStorage.removeItem('qt_admin_token');
              localStorage.removeItem('qt_admin_user');
              
              // 重定向到登录页面
              setTimeout(() => {
                window.location.href = '/mobile/login';
              }, 1000);
              
              if (typeof showToast === 'function') {
                showToast('登录已过期，正在跳转到登录页面...', 'warning');
              }
              return [];
            }
          }
        } catch(e) { 
          console.warn('会话诊断失败:', e);
        }
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
