// WebSocket 连接封装
// 通过环境变量 REACT_APP_WS_PORT / REACT_APP_WS_BASE 自定义
// 开发环境默认使用后端 8080 端口 (HTTP/WS)，生产环境使用 HTTPS/WSS。

const HOST = window.location.hostname;
// 开发环境使用 WS 协议和 8080 端口，避免证书问题
// 生产环境使用 WSS 协议和 8443 端口
const isDev = window.location.port === '3000';
const PROTOCOL = isDev ? 'ws' : 'wss';
const DEFAULT_PORT = isDev ? '8080' : (process.env.REACT_APP_WS_PORT || '8443');

export function staffSocket(userId: string) {
  return new WebSocket(`${PROTOCOL}://${HOST}:${DEFAULT_PORT}/ws/staff/${userId}`);
}

export function customerSocket(shopId: string | number, customerId: string | number) {
  return new WebSocket(`${PROTOCOL}://${HOST}:${DEFAULT_PORT}/ws/customer/${shopId}/${customerId}`);
}
