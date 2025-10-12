// TLS 模块 - 为项目提供独立的HTTPS支持
// Purpose: 模块化TLS配置和证书管理
// Input: 证书文件路径、环境变量配置
// Output: TLS服务器配置、证书管理功能
// Errors: 证书读取失败、TLS配置错误

pub mod cert_manager;
pub mod config;

pub use cert_manager::CertManager;
pub use config::TlsConfig;