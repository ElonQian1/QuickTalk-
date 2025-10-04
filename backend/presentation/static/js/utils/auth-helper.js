/**
 * auth-helper.js
 * 职责: 统一授权token获取，避免各模块重复实现getAuthToken逻辑
 * 提供单一可靠的授权入口，支持token刷新、过期检测、降级处理
 */
(function(){
  'use strict';
  
  const TOKEN_KEY = 'authToken';
  const TOKEN_REFRESH_KEY = 'refreshToken';
  let _cachedToken = null;
  let _tokenExpiry = null;
  
  // 获取授权token（主入口）
  function getAuthToken() {
    // 1. 检查内存缓存
    if (_cachedToken && _tokenExpiry && Date.now() < _tokenExpiry) {
      return _cachedToken;
    }
    
    // 2. 从localStorage获取
    try {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) {
        _cachedToken = stored;
        // 简单过期检测（可选，基于JWT payload或独立存储）
        const expiry = localStorage.getItem('tokenExpiry');
        if (expiry && Date.now() < parseInt(expiry)) {
          _tokenExpiry = parseInt(expiry);
          return _cachedToken;
        }
      }
    } catch(e) {
      console.warn('[AuthHelper] localStorage读取失败:', e);
    }
    
    // 3. 降级：尝试全局兜底
    if (typeof window.getAuthToken === 'function' && window.getAuthToken !== getAuthToken) {
      console.warn('[AuthHelper] 使用全局兜底getAuthToken');
      return window.getAuthToken();
    }
    
    // 4. 最终降级：空字符串（避免undefined导致API调用失败）
    console.error('[AuthHelper] 无法获取有效token，返回空字符串');
    return '';
  }
  
  // 设置token（登录后调用）
  function setAuthToken(token, expiryMs = null) {
    _cachedToken = token;
    if (expiryMs) {
      _tokenExpiry = Date.now() + expiryMs;
      try {
        localStorage.setItem('tokenExpiry', _tokenExpiry.toString());
      } catch(e) {}
    }
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch(e) {
      console.warn('[AuthHelper] localStorage写入失败:', e);
    }
  }
  
  // 清除token（登出时调用）
  function clearAuthToken() {
    _cachedToken = null;
    _tokenExpiry = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('tokenExpiry');
    } catch(e) {}
  }
  
  // 检查是否已登录
  function isAuthenticated() {
    const token = getAuthToken();
    return token && token.length > 0;
  }
  
  // 获取授权请求头（便利方法）
  function getAuthHeaders() {
    const token = getAuthToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
  
  // 暴露到全局
  window.AuthHelper = {
    getToken: getAuthToken,
    setToken: setAuthToken,
    clearToken: clearAuthToken,
    isAuthenticated: isAuthenticated,
    getHeaders: getAuthHeaders
  };
  
  // 向后兼容：保持全局getAuthToken可用
  if (!window.getAuthToken) {
    window.getAuthToken = getAuthToken;
  }
  
  console.log('✅ 授权助手已加载 (auth-helper.js)');
})();