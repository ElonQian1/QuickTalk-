// WebSocket 连接封装
// 通过环境变量 REACT_APP_WS_PORT / REACT_APP_WS_BASE 自定义
// 开发环境默认使用后端 8080 端口 (HTTP/WS)，生产环境使用 HTTPS/WSS。

const DEFAULT_PORT = process.env.REACT_APP_WS_PORT || '8080';
const HOST = window.location.hostname;
// 开发环境使用 WS 协议，避免证书问题
const PROTOCOL = window.location.port === '3000' ? 'ws' : 'wss';

export function staffSocket(userId: string) {
  return new WebSocket(`${PROTOCOL}://${HOST}:${DEFAULT_PORT}/ws/staff/${userId}`);
}

export function customerSocket(shopId: string | number, customerId: string | number) {
  return new WebSocket(`${PROTOCOL}://${HOST}:${DEFAULT_PORT}/ws/customer/${shopId}/${customerId}`);
}
