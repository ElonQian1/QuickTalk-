/**
 * auth-fetch.js
 * 统一封装：鉴权头构造 + JSON 请求 + 错误包装 + 状态检查
 * 仅关注 HTTP 请求，不耦合具体业务 UI；由上层决定错误提示。
 */
(function(){
  'use strict';
  if (window.AuthFetch) return; // 幂等

  function getAuthToken(){
    if (window.getAuthToken && typeof window.getAuthToken === 'function') return window.getAuthToken();
    if (window.AuthHelper && typeof window.AuthHelper.getToken === 'function') return window.AuthHelper.getToken();
    return '';
  }

  function buildAuthHeaders(extra){
    const token = getAuthToken();
    const base = { 'Accept': 'application/json' };
    if (token) base['Authorization'] = 'Bearer ' + token;
    return Object.assign(base, extra || {});
  }

  async function safeJsonFetch(url, opts){
    const finalOpts = Object.assign({ method: 'GET' }, opts || {});
    finalOpts.headers = buildAuthHeaders(finalOpts.headers);
    let res;
    try { res = await fetch(url, finalOpts); } catch(e){
      return { ok: false, networkError: true, status: 0, error: 'NETWORK_ERROR', detail: e };
    }
    let data = null;
    try { data = await res.json(); } catch(e){ data = null; }
    const ok = res.ok && data && (data.success !== false);
    return {
      ok,
      status: res.status,
      raw: res,
      data: data && (data.data !== undefined ? data.data : data),
      error: ok ? null : (data && (data.error || data.message) || ('HTTP_' + res.status)),
    };
  }

  window.AuthFetch = { buildAuthHeaders, safeJsonFetch };
  console.log('✅ auth-fetch.js 加载完成');
})();
