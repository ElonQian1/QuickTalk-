// http-utils.js — HTTP 相关工具
// 提供：getAuthToken, safeJson

(function(){
  'use strict';

  window.getAuthToken = function getAuthToken() {
    try {
      // 优先从用户数据中获取token
      const savedUser = localStorage.getItem('quicktalk_user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        if (userData.token) {
          return userData.token;
        }
        if (userData.session_id) {
          return userData.session_id;
        }
      }
      
      // 兜底：尝试其他token存储位置
      const fallbackTokens = [
        localStorage.getItem('authToken'),
        localStorage.getItem('admin_token'), 
        localStorage.getItem('qt_admin_token')
      ];
      
      for (const token of fallbackTokens) {
        if (token && token.length > 10) {
          return token;
        }
      }
    } catch (error) {
      console.error('获取认证token失败:', error);
    }
    return '';
  };

  window.safeJson = async function safeJson(resp) {
    try { return await resp.json(); } catch (_) { return null; }
  };
})();
