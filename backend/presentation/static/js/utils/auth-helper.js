/**
 * auth-helper.js - 重构为统一系统适配器
 * 委托认证功能给 UnifiedSessionManager 和 http-utils.js
 */
(function(){
  'use strict';
  
  // 获取授权token - 委托给统一系统
  function getAuthToken() {
    // 优先使用 UnifiedSessionManager
    if (window.unifiedSessionManager && window.unifiedSessionManager.getAuthToken) {
      return window.unifiedSessionManager.getAuthToken();
    }
    
    // 委托给 http-utils.js
    if (window.getAuthToken && window.getAuthToken !== getAuthToken) {
      return window.getAuthToken();
    }
    
    // 降级处理
    try {
      const quicktalkUser = localStorage.getItem('quicktalk_user');
      if (quicktalkUser) {
        const userData = JSON.parse(quicktalkUser);
        if (userData.token) return userData.token;
      }
      return localStorage.getItem('authToken') || '';
    } catch (error) {
      return '';
    }
  }

  // 获取认证头部
  function getAuthHeaders() {
    const token = getAuthToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // 暴露接口
  window.AuthHelper = {
    getToken: getAuthToken,
    getHeaders: getAuthHeaders
  };

  // 向下兼容
  if (!window.getAuthToken) {
    window.getAuthToken = getAuthToken;
  }

  console.log('🔧 AuthHelper 适配器已加载');
})();