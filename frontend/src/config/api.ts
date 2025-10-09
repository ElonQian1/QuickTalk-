// 统一 Axios 实例与基础配置
// 基于 CRA 的 proxy: 开发走相对路径即可，生产可用环境变量
// 可配置环境变量：REACT_APP_API_BASE

import axios from 'axios';

export const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8080';

export const api = axios.create({
  baseURL: API_BASE, // '' => 相对 => dev server 代理到后端 8080
  withCredentials: false,
  timeout: 15000,
});

// 在每次请求前尝试自动注入 Authorization，避免持久化恢复的竞态
api.interceptors.request.use((config) => {
  // 若调用方已显式设置，则不覆盖
  const hasAuth = !!(config.headers && (config.headers as any)['Authorization']);
  if (!hasAuth && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('auth-storage');
      if (raw) {
        const parsed = JSON.parse(raw);
        const token = parsed?.state?.token as string | undefined;
        if (token) {
          (config.headers ||= {});
          (config.headers as any)['Authorization'] = `Bearer ${token}`;
        }
      }
    } catch {
      // ignore JSON/Storage errors
    }
  }
  if (process.env.NODE_ENV !== 'production') {
    try {
      const auth = (config.headers as any)?.['Authorization'];
      if (!auth) {
        // eslint-disable-next-line no-console
        console.debug('[api] request without Authorization:', config.method, config.url);
      } else {
        // 仅打印前后 6 位，避免泄露完整 token
        const prefix = String(auth).slice(0, 14);
        const suffix = String(auth).slice(-6);
        // eslint-disable-next-line no-console
        console.debug(`[api] request with Authorization: ${prefix}...${suffix}`, config.method, config.url);
      }
    } catch {}
  }
  return config;
});

// 全局响应处理（这里简单打印，可扩展）
api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    // 统一处理 401：清理本地登录状态并跳回登录
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('auth-storage');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            parsed.state = {
              isAuthenticated: false,
              user: null,
              token: null,
            };
            window.localStorage.setItem('auth-storage', JSON.stringify(parsed));
          }
        }
      } catch {}
      // 移除默认头，避免后续请求继续携带旧 token
      delete (api.defaults.headers as any)?.common?.['Authorization'];
      // 回到登录页
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(err);
  }
);

export function setAuthToken(token?: string) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}
