// http-utils.js — HTTP 相关工具
// 提供：getAuthToken, safeJson

(function(){
  'use strict';

  window.getAuthToken = function getAuthToken() {
    try {
      const savedUser = localStorage.getItem('quicktalk_user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        return userData.token || '';
      }
    } catch (error) {
      console.error('获取认证token失败:', error);
    }
    return localStorage.getItem('admin_token') || '';
  };

  window.safeJson = async function safeJson(resp) {
    try { return await resp.json(); } catch (_) { return null; }
  };
})();
