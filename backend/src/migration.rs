//! Migration bridge module
//! 
//! 重新导出 migration crate，使其可以在 main.rs 中使用

// 提供一个桥接模块，若需要可在此添加自定义包装；暂不重新导出全部以避免路径混淆
pub use ::migration::Migrator;

