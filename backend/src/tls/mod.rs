// TLS 模块 - 为项目提供独立的HTTPS支持
// Purpose: 模块化TLS配置和证书管理
// Input: 证书文件路径、环境变量配置
// Output: TLS服务器配置、证书管理功能
// Errors: 证书读取失败、TLS配置错误

pub mod cert_manager;
pub mod config;
#[cfg(feature = "https")]
pub mod acme;

pub use cert_manager::*;
pub use config::*;

/// TLS模块版本信息
#[allow(dead_code)]
pub const TLS_MODULE_VERSION: &str = "1.0.0";

/// 检查TLS模块是否可用
#[allow(dead_code)]
pub fn is_tls_available() -> bool {
    cfg!(feature = "https")
}

/// 获取TLS模块信息
#[allow(dead_code)]
pub fn get_tls_info() -> String {
    format!(
        "TLS模块 v{} - 状态: {}",
        TLS_MODULE_VERSION,
        if is_tls_available() { "可用" } else { "未启用" }
    )
}