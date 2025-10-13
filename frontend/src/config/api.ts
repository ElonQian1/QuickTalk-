// 统一 Axios 实例与基础配置
// 基于 CRA 的 proxy: 开发走相对路径即可，生产可用环境变量
// 可配置环境变量：REACT_APP_API_BASE

import axios from 'axios';

// 自动检测API基础地址
const getApiBase = (): string => {
  // 优先使用环境变量
  if (process.env.REACT_APP_API_BASE) {
    return process.env.REACT_APP_API_BASE;
  }
  
  // 在浏览器环境中，自动使用当前域名和端口
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    // 如果是标准HTTP/HTTPS端口，直接使用当前地址
    if (window.location.port === '8080' || window.location.port === '8443') {
      return `${protocol}//${hostname}:${window.location.port}`;
    }
    // 否则默认使用8080端口
    return `${protocol}//${hostname}:8080`;
  }
  
  // 服务端渲染或其他环境的后备地址
  return 'http://localhost:8080';
};

export const API_BASE = getApiBase();

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
          console.log('✅ [api] 已添加Authorization头到请求:', config.method, config.url);
        } else {
          console.warn('⚠️ [api] localStorage中找不到token');
        }
      } else {
        console.warn('⚠️ [api] localStorage中找不到auth-storage');
      }
    } catch (e) {
      console.error('❌ [api] 读取认证信息失败:', e);
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
      // 检查是否是上传相关的请求，给予更友好的提示
      const isUploadRequest = err?.config?.url?.includes('/upload') || 
                             err?.config?.headers?.['Content-Type']?.includes('multipart/form-data');
      
      if (isUploadRequest) {
        // 对于上传请求，不直接跳转，而是抛出错误让组件处理
        console.error('[auth] Upload request failed: 401 Unauthorized');
        return Promise.reject(err);
      }
      
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
