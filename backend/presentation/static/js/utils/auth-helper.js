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
    
    // 2. 从localStorage获取（支持多种存储格式）
    try {
      // 2.1 优先从quicktalk_user获取（移动端格式）
      const quicktalkUser = localStorage.getItem('quicktalk_user');
      if (quicktalkUser) {
        const userData = JSON.parse(quicktalkUser);
        if (userData.token) {
          _cachedToken = userData.token;
          // 可选：基于登录时间估算过期时间
          if (userData.loginTime) {
            const loginTime = new Date(userData.loginTime).getTime();
            const estimatedExpiry = loginTime + (24 * 60 * 60 * 1000); // 24小时
            if (Date.now() < estimatedExpiry) {
              _tokenExpiry = estimatedExpiry;
              return _cachedToken;
            }
          } else {
            return _cachedToken; // 没有过期信息，直接返回
          }
        }
      }
      
      // 2.2 兜底：从标准authToken获取
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) {
        _cachedToken = stored;
        // 简单过期检测（可选，基于JWT payload或独立存储）
        const expiry = localStorage.getItem('tokenExpiry');
        if (expiry && Date.now() < parseInt(expiry)) {
          _tokenExpiry = parseInt(expiry);
          return _cachedToken;
        }
        return _cachedToken;
      }
      
      // 2.3 其他兜底token位置
      const fallbackTokens = [
        localStorage.getItem('admin_token'),
        localStorage.getItem('qt_admin_token')
      ];
      
      for (const token of fallbackTokens) {
        if (token && token.length > 10) {
          _cachedToken = token;
          return token;
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
      // 1. 更新标准authToken
      localStorage.setItem(TOKEN_KEY, token);
      
      // 2. 同步更新quicktalk_user中的token（移动端兼容）
      const quicktalkUser = localStorage.getItem('quicktalk_user');
      if (quicktalkUser) {
        try {
          const userData = JSON.parse(quicktalkUser);
          userData.token = token;
          userData.lastTokenUpdate = new Date().toISOString();
          localStorage.setItem('quicktalk_user', JSON.stringify(userData));
          console.log('[AuthHelper] 已同步更新quicktalk_user中的token');
        } catch(e) {
          console.warn('[AuthHelper] 更新quicktalk_user失败:', e);
        }
      }
      
      // 3. 兼容性更新
      localStorage.setItem('admin_token', token);
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
    return token ? { 
      'Authorization': `Bearer ${token}`,
      'X-Session-Id': token,  // 后端SessionExtractor需要这个头
      'Content-Type': 'application/json'
    } : {
      'Content-Type': 'application/json'
    };
  }
  
  // 调试工具：检查所有token来源
  function debugAuthStatus() {
    console.log('🔍 [AuthHelper] 认证状态调试:');
    console.log('- 内存缓存:', _cachedToken ? `${_cachedToken.substr(0, 10)}... (${_cachedToken.length}字符)` : 'null');
    console.log('- 缓存过期时间:', _tokenExpiry ? new Date(_tokenExpiry).toLocaleString() : 'null');
    
    // 检查所有可能的token存储位置
    try {
      const quicktalkUser = localStorage.getItem('quicktalk_user');
      if (quicktalkUser) {
        const data = JSON.parse(quicktalkUser);
        console.log('- quicktalk_user.token:', data.token ? `${data.token.substr(0, 10)}... (${data.token.length}字符)` : 'null');
      } else {
        console.log('- quicktalk_user: null');
      }
    } catch(e) {
      console.log('- quicktalk_user: 解析错误', e.message);
    }
    
    console.log('- authToken:', localStorage.getItem('authToken') || 'null');
    console.log('- admin_token:', localStorage.getItem('admin_token') || 'null');
    console.log('- qt_admin_token:', localStorage.getItem('qt_admin_token') || 'null');
    
    // 测试当前获取结果
    const currentToken = getAuthToken();
    console.log('- 当前getAuthToken()结果:', currentToken ? `${currentToken.substr(0, 10)}... (${currentToken.length}字符)` : 'null');
    
    return {
      hasToken: !!currentToken,
      tokenLength: currentToken.length,
      isExpired: _tokenExpiry ? Date.now() > _tokenExpiry : false
    };
  }

  // 暴露到全局
  window.AuthHelper = {
    getToken: getAuthToken,
    setToken: setAuthToken,
    clearToken: clearAuthToken,
    isAuthenticated: isAuthenticated,
    getHeaders: getAuthHeaders,
    debugStatus: debugAuthStatus
  };
  
  // 向后兼容：保持全局getAuthToken可用
  if (!window.getAuthToken) {
    window.getAuthToken = getAuthToken;
  }
  
  // 全局调试命令
  window.debugAuth = debugAuthStatus;
  
  console.log('✅ 授权助手已加载 (auth-helper.js)，调试命令: window.debugAuth()');
})();