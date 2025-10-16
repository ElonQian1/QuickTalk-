// 统一 Axios 实例与基础配置
// 基于 CRA 的 proxy: 开发走相对路径即可，生产可用环境变量
// 可配置环境变量：REACT_APP_API_BASE

import axios from 'axios';

// 智能检测API基础地址
const getApiBase = (): string => {
  // 优先使用环境变量
  if (process.env.REACT_APP_API_BASE) {
    return process.env.REACT_APP_API_BASE;
  }
  
  // 在浏览器环境中，智能检测服务器地址
  if (typeof window !== 'undefined') {
    const { hostname, protocol, port } = window.location;
    
    // 🥇 优先级1: 使用当前页面的IP地址
    // 如果当前页面不是localhost，说明是通过IP访问的
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      // 检测当前是否在标准服务器端口
      if (port === '8443' || port === '8444') {
        return `https://${hostname}:${port}`;
      }
      if (port === '8080') {
        return `http://${hostname}:8080`;
      }
      
      // 根据当前协议智能选择端口
      if (protocol === 'https:') {
        return `https://${hostname}:8443`;
      } else {
        return `http://${hostname}:8080`;
      }
    }
    
    // 🥈 优先级2: 生产服务器地址
    // 当页面在localhost时，尝试连接生产服务器
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // 开发环境检测：前端在3000端口说明是开发模式
      if (port === '3000') {
        // 开发时优先尝试生产服务器，再尝试本地
        console.log('🔍 开发模式检测到，将尝试连接生产服务器');
        return 'https://43.139.82.12:8443';
      }
      
      // 其他情况也尝试生产服务器
      return 'https://43.139.82.12:8443';
    }
  }
  
  // 🥉 优先级3: 兜底使用本地开发地址
  return 'http://localhost:8080';
};

export const API_BASE = getApiBase();

// 服务器健康检查和自动降级
const serverUrls = [
  // 按优先级排序的服务器列表
  API_BASE,
  'https://43.139.82.12:8443',
  'http://localhost:8080'
];

// 去重处理
const uniqueServerUrls = Array.from(new Set(serverUrls));

console.log('🚀 API配置初始化:');
console.log('📍 主要服务器:', API_BASE);
console.log('🔄 备用服务器列表:', uniqueServerUrls);

// 健康检查函数
const checkServerHealth = async (url: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.log(`❌ 服务器 ${url} 不可用:`, error);
    return false;
  }
};

// 获取可用的服务器
let availableServerUrl = API_BASE;
let isHealthCheckDone = false;

const findAvailableServer = async (): Promise<string> => {
  if (isHealthCheckDone) {
    return availableServerUrl;
  }
  
  console.log('🔍 开始服务器健康检查...');
  
  for (const url of uniqueServerUrls) {
    console.log(`🔍 检查服务器: ${url}`);
    const isHealthy = await checkServerHealth(url);
    if (isHealthy) {
      console.log(`✅ 服务器可用: ${url}`);
      availableServerUrl = url;
      isHealthCheckDone = true;
      return url;
    }
  }
  
  console.warn('⚠️ 所有服务器都不可用，使用默认配置');
  isHealthCheckDone = true;
  return API_BASE;
};

// 创建动态API实例
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 15000,
});

// 动态更新baseURL的拦截器
api.interceptors.request.use(async (config) => {
  // 动态获取可用服务器
  const serverUrl = await findAvailableServer();
  if (serverUrl !== API_BASE) {
    console.log(`🔄 切换到可用服务器: ${serverUrl}`);
    config.baseURL = serverUrl;
  }
  // 判断是否是不需要认证的公开端点（登录、注册等）
  const isPublicEndpoint = config.url?.includes('/auth/login') || 
                           config.url?.includes('/auth/register') ||
                           config.url?.includes('/health');
  
  // 若调用方已显式设置，则不覆盖
  const hasAuth = !!(config.headers && (config.headers as any)['Authorization']);
  if (!hasAuth && !isPublicEndpoint && typeof window !== 'undefined') {
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
          // 仅在非公开端点时警告
          console.warn('⚠️ [api] localStorage中找不到token');
        }
      } else {
        // 仅在非公开端点时警告
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
