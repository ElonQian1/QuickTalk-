// 统一 Axios 实例与基础配置
// 基于 CRA 的 proxy: 开发走相对路径即可，生产可用环境变量
// 可配置环境变量：REACT_APP_API_BASE

import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8080';

export const api = axios.create({
  baseURL: API_BASE, // '' => 相对 => dev server 代理到后端 8080
  withCredentials: false,
  timeout: 15000,
});

// 全局响应处理（这里简单打印，可扩展）
api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    // 可在此做统一错误 toast / 401 处理
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
