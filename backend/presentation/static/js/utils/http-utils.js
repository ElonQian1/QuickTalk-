/**
 * http-utils.js - HTTP工具函数集合
 * 
 * 🔄 已重构：保持核心工具函数，与 APIClient 协同工作
 * - 认证token获取逻辑
 * - JSON安全解析
 * - 与 APIClient 无缝集成
 * 
 * @version 2.0 - 重构版本
 */
(function(){
  'use strict';

  /**
   * 统一的认证token获取函数
   * 被 APIClient 和其他模块复用
   */
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

  /**
   * 安全的JSON解析函数
   */
  window.safeJson = async function safeJson(resp) {
    try { 
      return await resp.json(); 
    } catch (_) { 
      return null; 
    }
  };

  /**
   * 快速HTTP请求函数（委托给APIClient）
   */
  window.quickFetch = function quickFetch(url, options = {}) {
    // 如果 APIClient 可用，委托给它
    if (window.APIClient) {
      const client = new window.APIClient({ debug: false });
      return client.request(url, options);
    }
    
    // 降级处理：使用原生fetch
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    
    const token = window.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers }
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await window.safeJson(response) || await response.text();
    });
  };

  console.log('🔧 http-utils.js 已重构 - 与 APIClient 协同工作');
})();
