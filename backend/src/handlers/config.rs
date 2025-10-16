use axum::{
    extract::{ConnectInfo, State},
    response::Json,
    http::HeaderMap,
};
use serde_json::{json, Value};
use std::net::{SocketAddr, IpAddr};

use crate::AppState;

/// 获取服务器真实IP地址
/// 通过检测网络接口获取服务器的实际IP
fn get_server_real_ip() -> Option<IpAddr> {
    // 方法1: 尝试连接外部地址来确定本机出口IP
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(local_addr) = socket.local_addr() {
                let ip = local_addr.ip();
                // 排除回环地址和局域网地址
                if !ip.is_loopback() && !is_private_ip(&ip) {
                    return Some(ip);
                }
            }
        }
    }
    
    // 方法2: 简化版本 - 只检查一些常见的公网IP
    // 在真实环境中，通常会有专门的服务来检测公网IP
    println!("💡 提示: 无法自动检测公网IP，建议手动配置");
    
    None
}

/// 检查是否为私有IP地址
fn is_private_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(ipv4) => {
            let octets = ipv4.octets();
            // 10.0.0.0/8
            octets[0] == 10 ||
            // 172.16.0.0/12
            (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31) ||
            // 192.168.0.0/16
            (octets[0] == 192 && octets[1] == 168)
        }
        IpAddr::V6(_) => false, // 简化处理，暂不考虑IPv6私有地址
    }
}

/// 智能推断服务器最佳访问地址
fn determine_best_server_address(
    server_host: &str,
    server_port: &str,
    protocol: &str,
    host_from_header: &Option<String>,
    forwarded_host: &Option<String>,
    public_domain: &Option<String>,
    public_ip: &Option<String>,
    client_addr: SocketAddr,
) -> String {
    // 🥇 优先级1: 代理转发的主机信息（生产环境）
    if let Some(ref forwarded) = forwarded_host {
        return format!("{}://{}", protocol, forwarded);
    }
    
    // 🥈 优先级2: 请求头中的主机信息
    if let Some(ref host) = host_from_header {
        return format!("{}://{}", protocol, host);
    }
    
    // 🥉 优先级3: 手动配置的公网域名
    if let Some(ref domain) = public_domain {
        return format!("{}://{}", protocol, domain);
    }
    
    // 🏅 优先级4: 手动配置的公网IP
    if let Some(ref ip) = public_ip {
        return format!("{}://{}:{}", protocol, ip, server_port);
    }
    
    // 🏆 优先级5: 0.0.0.0的智能处理
    if server_host == "0.0.0.0" {
        // 5a. 检测客户端连接类型
        if client_addr.ip().is_loopback() {
            // 本地连接，使用localhost
            return format!("{}://localhost:{}", protocol, server_port);
        }
        
        // 5b. 尝试获取服务器真实IP
        if let Some(real_ip) = get_server_real_ip() {
            return format!("{}://{}:{}", protocol, real_ip, server_port);
        }
        
        // 5c. 安全回退
        return format!("{}://localhost:{}", protocol, server_port);
    }
    
    // 🎯 默认: 使用配置的主机和端口
    format!("{}://{}:{}", protocol, server_host, server_port)
}

/// 获取服务器配置信息
/// 返回当前服务器的地址信息，供前端自动配置使用
pub async fn get_server_config(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    State(_state): State<AppState>,
) -> Json<Value> {
    // 获取环境变量配置
    let server_host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "localhost".to_string());
    let server_port = std::env::var("SERVER_PORT").unwrap_or_else(|_| "8080".to_string());
    
    // 获取公网配置（优先域名，其次IP）
    let public_domain = std::env::var("PUBLIC_DOMAIN").ok();
    let public_ip = std::env::var("PUBLIC_IP").ok();
    
    // 尝试从请求头获取实际的主机信息
    let host_from_header = headers
        .get("host")
        .and_then(|h| h.to_str().ok())
        .map(|h| h.to_string());
    
    // 尝试从X-Forwarded-Host获取代理后的主机信息
    let forwarded_host = headers
        .get("x-forwarded-host")
        .and_then(|h| h.to_str().ok())
        .map(|h| h.to_string());
    
    // 获取协议信息
    // 优先检查 X-Forwarded-Proto（代理环境），然后检查端口（8443 = HTTPS）
    let protocol = if headers
        .get("x-forwarded-proto")
        .and_then(|h| h.to_str().ok())
        .map(|p| p == "https")
        .unwrap_or(false)
    {
        "https"
    } else if server_port == "8443" || server_port == "443" {
        // 🔒 端口 8443/443 通常表示 HTTPS/TLS 连接
        "https"
    } else if let Some(ref host) = host_from_header {
        // 检查 Host 头中是否包含 HTTPS 端口
        if host.ends_with(":8443") || host.ends_with(":443") {
            "https"
        } else {
            "http"
        }
    } else {
        "http"
    };
    
    // 智能推断最佳服务器地址
    let best_server_url = determine_best_server_address(
        &server_host,
        &server_port,
        protocol,
        &host_from_header,
        &forwarded_host,
        &public_domain,
        &public_ip,
        addr,
    );
    
    // 生成WebSocket URL
    let ws_protocol = if protocol == "https" { "wss" } else { "ws" };
    let ws_url = best_server_url.replace(protocol, ws_protocol);
    
    // 获取服务器真实IP用于诊断
    let detected_server_ip = get_server_real_ip();
    
    Json(json!({
        "version": "1.3.1",
        "serverUrl": best_server_url,
        "wsUrl": ws_url,
        "config": {
            "protocol": protocol,
            "wsProtocol": ws_protocol,
            "configuredHost": server_host,
            "configuredPort": server_port,
            "detectedHost": host_from_header,
            "forwardedHost": forwarded_host,
            "publicDomain": public_domain,
            "publicIp": public_ip,
            "detectedServerIp": detected_server_ip.map(|ip| ip.to_string()),
            "clientIp": addr.ip().to_string(),
            "isLocalConnection": addr.ip().is_loopback()
        },
        "endpoints": {
            "api": format!("{}/api", best_server_url),
            "websocket": {
                "customer": format!("{}/ws/customer", ws_url),
                "staff": format!("{}/ws/staff", ws_url)
            },
            "upload": format!("{}/api/customer/upload", best_server_url)
        },
        "timestamp": chrono::Utc::now().timestamp(),
        "debugInfo": {
            "addressResolutionMethod": if forwarded_host.is_some() {
                "proxy-forwarded"
            } else if host_from_header.is_some() {
                "http-host-header"
            } else if public_domain.is_some() {
                "configured-domain"
            } else if public_ip.is_some() {
                "configured-ip"
            } else if server_host == "0.0.0.0" {
                "auto-detected-ip"
            } else {
                "configured-host"
            }
        }
    }))
}

/// 获取SDK版本信息（兼容现有版本检查）
pub async fn get_sdk_version() -> Json<Value> {
    Json(json!({
        "version": "1.3.1",
        "buildTime": chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string(),
        "features": [
            "auto-server-detection",
            "multi-protocol-support",
            "proxy-aware",
            "voice-messages",
            "file-upload"
        ]
    }))
}