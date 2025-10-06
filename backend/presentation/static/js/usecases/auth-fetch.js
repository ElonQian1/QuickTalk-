/**
 * auth-fetch.js - 轻量级HTTP请求适配器
 * 
 * 🔄 已重构为统一认证系统的适配器
 * - 保持原有API兼容性
 * - 委托认证功能给 AuthHelper
 * - 减少代码重复
 * 
 * @deprecated 推荐直接使用统一系统
 * @version 3.0 - 统一认证版本
 */
(function(){
  'use strict';
  if (window.AuthFetch) return; // 幂等

  // 创建共享的 APIClient 实例
  const getAPIClient = () => {
    if (!window._authFetchClient) {
      const APIClient = window.APIClient || class {
        constructor() { this.baseURL = ''; }
        getAuthHeaders() { 
          // 委托给统一认证系统
          if (window.AuthHelper && window.AuthHelper.getHeaders) {
            return window.AuthHelper.getHeaders();
          }
          return this._fallbackGetAuthHeaders(); 
        }
        _fallbackGetAuthHeaders() {
          const token = getAuthToken();
          const headers = { 'Accept': 'application/json' };
          if (token) headers['Authorization'] = 'Bearer ' + token;
          return headers;
        }
        async request(url, options = {}) { return this._fallbackRequest(url, options); }
        async _fallbackRequest(url, options) {
          const headers = { ...this.getAuthHeaders(), ...options.headers };
          const response = await fetch(url, { ...options, headers });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return await response.json();
        }
      };
      
      window._authFetchClient = new APIClient({ debug: false });
    }
    return window._authFetchClient;
  };

  function getAuthToken(){
    // 委托给统一认证系统
    if (window.AuthHelper && window.AuthHelper.getToken) {
      return window.AuthHelper.getToken();
    }
    
    // 降级处理
    if (window.getAuthToken && typeof window.getAuthToken === 'function') {
      return window.getAuthToken();
    }
    
    try {
      const savedUser = localStorage.getItem('quicktalk_user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        return userData.token || userData.session_id || '';
      }
    } catch(e) {}
    return '';
  }

  function buildAuthHeaders(extra){
    const client = getAPIClient();
    return { ...client.getAuthHeaders(), ...extra };
  }

  async function safeJsonFetch(url, opts){
    try {
      const client = getAPIClient();
      const data = await client.request(url, opts);
      return { ok: true, status: 200, data };
    } catch(error) {
      return { 
        ok: false, 
        status: error.status || 0,
        error: error.message || 'REQUEST_FAILED',
        networkError: error.name === 'TypeError',
        detail: error 
      };
    }
  }

  window.AuthFetch = { buildAuthHeaders, safeJsonFetch };
  console.log('🔄 auth-fetch.js 已重构为 APIClient 适配器');
})();
