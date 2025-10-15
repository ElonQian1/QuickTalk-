use axum::{
    extract::{Multipart, State},
    http::HeaderMap,
    Json,
};
use serde::Serialize;
use tokio::{fs, io::AsyncWriteExt};
use uuid::Uuid;

use std::path::PathBuf;

use crate::{auth::AuthUser, constants::upload_policy, error::AppError, AppState};

// 检查是否为语音文件类型
fn is_audio_file(content_type: &Option<String>, file_name: &str) -> bool {
    // 检查 MIME 类型
    if let Some(ct) = content_type {
        if upload_policy::AUDIO_TYPES.iter().any(|&audio_type| ct.starts_with(audio_type)) {
            return true;
        }
    }
    
    // 检查文件扩展名
    let file_name_lower = file_name.to_lowercase();
    file_name_lower.ends_with(".mp3") ||
    file_name_lower.ends_with(".wav") ||
    file_name_lower.ends_with(".ogg") ||
    file_name_lower.ends_with(".webm") ||
    file_name_lower.ends_with(".m4a") ||
    file_name_lower.ends_with(".aac")
}

// 从请求头检测协议
fn detect_protocol(headers: &HeaderMap) -> String {
    // 检查 X-Forwarded-Proto (常见的代理头)
    if let Some(proto) = headers.get("x-forwarded-proto") {
        if let Ok(proto_str) = proto.to_str() {
            return if proto_str.starts_with("https") {
                "https".to_string()
            } else {
                "http".to_string()
            };
        }
    }
    
    // 检查 X-Forwarded-SSL (另一种检查方式)
    if let Some(ssl) = headers.get("x-forwarded-ssl") {
        if let Ok(ssl_str) = ssl.to_str() {
            if ssl_str == "on" {
                return "https".to_string();
            }
        }
    }
    
    // 检查 X-Scheme
    if let Some(scheme) = headers.get("x-scheme") {
        if let Ok(scheme_str) = scheme.to_str() {
            return scheme_str.to_string();
        }
    }
    
    // 默认返回 http (这是本地开发的情况)
    "http".to_string()
}

#[derive(Serialize)]
pub struct UploadResponse {
    pub url: String,
    pub file_name: String,
    pub original_name: String,
    pub file_size: i64,
    pub message_type: String,
    pub content_type: Option<String>,
    pub shop_id: i64,
    pub customer_code: Option<String>,
}

struct UploadData {
    shop_id: i64,
    customer_code: Option<String>,
    message_type: String,
    original_name: String,
    content_type: Option<String>,
    data: Vec<u8>,
}

struct CustomerUploadData {
    api_key: String,
    customer_code: Option<String>,
    message_type: String,
    original_name: String,
    content_type: Option<String>,
    data: Vec<u8>,
}

// 提取公共的文件解析逻辑（管理员上传）
async fn parse_multipart(mut multipart: Multipart) -> Result<UploadData, AppError> {
    let mut shop_id: Option<i64> = None;
    let mut customer_code: Option<String> = None;
    let mut message_type = String::from("file");
    let mut original_name: Option<String> = None;
    let mut content_type: Option<String> = None;
    let mut data: Option<Vec<u8>> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| AppError::BadRequest("无效的表单数据".to_string()))?
    {
        let name = field.name().unwrap_or_default().to_string();
        match name.as_str() {
            "shopId" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| AppError::BadRequest("shopId 无效".to_string()))?;
                shop_id = value.parse::<i64>().ok();
            }
            "customerCode" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| AppError::BadRequest("customerCode 无效".to_string()))?;
                if !value.is_empty() {
                    customer_code = Some(value);
                }
            }
            "messageType" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| AppError::BadRequest("messageType 无效".to_string()))?;
                if !value.is_empty() {
                    message_type = value;
                }
            }
            "file" => {
                original_name = field.file_name().map(|s| s.to_string());
                content_type = field.content_type().map(|s| s.to_string());
                data = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|_| AppError::BadRequest("文件读取失败".to_string()))?
                        .to_vec(),
                );
            }
            _ => {}
        }
    }

    let shop_id = shop_id.ok_or(AppError::BadRequest("缺少 shopId".to_string()))?;
    let data = data.ok_or(AppError::BadRequest("缺少文件".to_string()))?;
    let original_name = original_name.unwrap_or_else(|| "upload.bin".to_string());

    // 如果消息类型为默认值，根据文件类型自动判断
    let final_message_type = if message_type == "file" && is_audio_file(&content_type, &original_name) {
        "voice".to_string()
    } else {
        message_type
    };

    Ok(UploadData {
        shop_id,
        customer_code,
        message_type: final_message_type,
        original_name,
        content_type,
        data,
    })
}

// 客户端上传的文件解析逻辑（使用 API Key）
async fn parse_customer_multipart(mut multipart: Multipart) -> Result<CustomerUploadData, AppError> {
    tracing::info!("开始解析客户上传的multipart数据");
    
    let mut api_key: Option<String> = None;
    let mut customer_code: Option<String> = None;
    let mut message_type = String::from("file");
    let mut original_name: Option<String> = None;
    let mut content_type: Option<String> = None;
    let mut data: Option<Vec<u8>> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| {
            tracing::error!("读取multipart字段失败: {}", e);
            AppError::BadRequest("无效的表单数据".to_string())
        })?
    {
        let name = field.name().unwrap_or_default().to_string();
        tracing::info!("处理字段: {}", name);
        
        match name.as_str() {
            "shopId" | "apiKey" => {
                let value = field
                    .text()
                    .await
                    .map_err(|e| {
                        tracing::error!("读取shopId/apiKey字段失败: {}", e);
                        AppError::BadRequest("shopId/apiKey 无效".to_string())
                    })?;
                tracing::info!("读取到shopId/apiKey: {}", value);
                api_key = Some(value);
            }
            "customerCode" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| AppError::BadRequest("customerCode 无效".to_string()))?;
                if !value.is_empty() {
                    customer_code = Some(value);
                }
            }
            "messageType" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| AppError::BadRequest("messageType 无效".to_string()))?;
                if !value.is_empty() {
                    message_type = value;
                }
            }
            "file" => {
                original_name = field.file_name().map(|s| s.to_string());
                content_type = field.content_type().map(|s| s.to_string());
                data = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|_| AppError::BadRequest("文件读取失败".to_string()))?
                        .to_vec(),
                );
            }
            _ => {}
        }
    }

    let api_key = api_key.ok_or_else(|| {
        tracing::error!("上传请求缺少 shopId 字段");
        AppError::BadRequest("缺少 shopId".to_string())
    })?;
    let data = data.ok_or_else(|| {
        tracing::error!("上传请求缺少文件数据");
        AppError::BadRequest("缺少文件".to_string())
    })?;
    let original_name = original_name.unwrap_or_else(|| "upload.bin".to_string());
    
    // 如果消息类型为默认值，根据文件类型自动判断
    let final_message_type = if message_type == "file" && is_audio_file(&content_type, &original_name) {
        "voice".to_string()
    } else {
        message_type
    };
    
    tracing::info!("准备创建CustomerUploadData: api_key={}, data_size={}, original_name={}, message_type={}", 
                   api_key, data.len(), original_name, final_message_type);

    Ok(CustomerUploadData {
        api_key,
        customer_code,
        message_type: final_message_type,
        original_name,
        content_type,
        data,
    })
}

// 提取公共的文件保存逻辑
async fn save_file_with_shop_id(shop_id: i64, data: &[u8], original_name: &str, _content_type: &Option<String>) -> Result<String, AppError> {
    let file_size = data.len() as i64;
    tracing::info!("开始保存文件: shop_id={}, file_size={}, original_name={}", shop_id, file_size, original_name);
    
    // 允许空文件上传 - 移除空文件检查
    // if file_size == 0 {
    //     tracing::error!("尝试上传空文件: {}", original_name);
    //     return Err(AppError::BadRequest("空文件".to_string()));
    // }

    // 基础安全：仅限制文件大小，允许所有文件类型和空文件
    if file_size > upload_policy::MAX_SIZE_BYTES {
        tracing::error!("文件过大: {} bytes > {} bytes ({})", file_size, upload_policy::MAX_SIZE_BYTES, original_name);
        return Err(AppError::BadRequest("文件过大，超过 10MB".to_string()));
    }
    
    // 移除文件类型限制 - 允许上传任何类型的文件
    // 注释掉原来的文件类型检查：
    // if let Some(ct) = content_type {
    //     if !upload_policy::ALLOWED_PREFIX
    //         .iter()
    //         .any(|&a| ct.starts_with(a))
    //     {
    //         return Err(AppError::BadRequest("不支持的文件类型".to_string()));
    //     }
    // }

    // 选择文件命名策略：保留原始文件名（安全处理）+ UUID前缀避免冲突
    let safe_original_name = original_name
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == '_')
        .collect::<String>();
    
    let uuid_prefix = Uuid::new_v4().to_string();
    let short_uuid = &uuid_prefix[..8];
    
    let generated_name = if safe_original_name.is_empty() {
        uuid_prefix
    } else {
        format!("{}_{}", short_uuid, safe_original_name)
    };

    let mut target_path = PathBuf::from("static");
    target_path.push("uploads");
    target_path.push(shop_id.to_string());

    fs::create_dir_all(&target_path)
        .await
        .map_err(|_| AppError::Internal("创建目录失败".to_string()))?;

    target_path.push(&generated_name);

    let mut file = fs::File::create(&target_path)
        .await
        .map_err(|_| AppError::Internal("创建文件失败".to_string()))?;

    file.write_all(data)
        .await
        .map_err(|_| AppError::Internal("写入文件失败".to_string()))?;

    Ok(generated_name)
}

// 原有的 save_file 函数，使用 UploadData
async fn save_file(upload_data: &UploadData) -> Result<String, AppError> {
    save_file_with_shop_id(upload_data.shop_id, &upload_data.data, &upload_data.original_name, &upload_data.content_type).await
}

pub async fn handle_upload(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    headers: HeaderMap,
    multipart: Multipart,
) -> Result<Json<UploadResponse>, AppError> {
    let upload_data = parse_multipart(multipart).await?;
    
    // 多租户校验：仅店主可上传该店铺相关文件
    if let Some(shop) = state
        .shop_service
        .get_shop_by_id(upload_data.shop_id as i32)
        .await
        .map_err(|_| AppError::Internal("查询店铺失败".to_string()))?
    {
        match shop.owner_id {
            Some(owner_id) if owner_id == user_id as i32 => {},
            _ => return Err(AppError::Unauthorized),
        }
    } else {
        return Err(AppError::NotFound);
    }
    
    let generated_name = save_file(&upload_data).await?;
    
    // 动态检测协议并构建完整的服务器URL
    let protocol = detect_protocol(&headers);
    let server_host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "localhost".to_string());
    let server_port = std::env::var("SERVER_PORT").unwrap_or_else(|_| "8080".to_string());
    let base_url = if server_host == "0.0.0.0" {
        format!("{}://localhost:{}", protocol, server_port)
    } else {
        format!("{}://{}:{}", protocol, server_host, server_port)
    };
    let url = format!("{}/static/uploads/{}/{}", base_url, upload_data.shop_id, generated_name);

    Ok(Json(UploadResponse {
        url,
        file_name: generated_name,
        original_name: upload_data.original_name,
        file_size: upload_data.data.len() as i64,
        message_type: upload_data.message_type,
        content_type: upload_data.content_type,
        shop_id: upload_data.shop_id,
        customer_code: upload_data.customer_code,
    }))
}

// 客户端上传处理函数（无需认证）
pub async fn handle_customer_upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    multipart: Multipart,
) -> Result<Json<UploadResponse>, AppError> {
    tracing::info!("收到客户端上传请求");
    
    let upload_data = parse_customer_multipart(multipart).await?;
    tracing::info!("解析上传数据成功: api_key={}, original_name={}", upload_data.api_key, upload_data.original_name);
    
    // 根据 shopId 或 API Key 查找店铺
    let shop = if upload_data.api_key.chars().all(|c| c.is_ascii_digit()) {
        // 如果是纯数字，当作店铺ID处理
        let shop_id: i64 = upload_data.api_key.parse()
            .map_err(|_| AppError::BadRequest("无效的店铺ID".to_string()))?;
        state
            .shop_service
            .get_shop_by_id(shop_id as i32)
            .await
            .map_err(|e| {
                tracing::error!("查询店铺失败: {}", e);
                AppError::Internal("查询店铺失败".to_string())
            })?
            .ok_or_else(|| {
                tracing::error!("未找到店铺: shop_id={}", shop_id);
                AppError::NotFound
            })?
    } else {
        // 否则当作API key处理
        crate::repositories::ShopRepository::find_by_api_key(&state.db_connection, &upload_data.api_key)
            .await
            .map_err(|e| {
                tracing::error!("查询店铺失败: {}", e);
                AppError::Internal("查询店铺失败".to_string())
            })?
            .ok_or_else(|| {
                tracing::error!("未找到店铺: api_key={}", upload_data.api_key);
                AppError::NotFound
            })?
    };
    
    tracing::info!("找到店铺: id={}, name={}", shop.id, shop.shop_name);

    let generated_name = save_file_with_shop_id(shop.id.into(), &upload_data.data, &upload_data.original_name, &upload_data.content_type).await?;
    
    // 动态检测协议并构建完整的服务器URL
    let protocol = detect_protocol(&headers);
    let server_host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "localhost".to_string());
    let server_port = std::env::var("SERVER_PORT").unwrap_or_else(|_| "8080".to_string());
    let base_url = if server_host == "0.0.0.0" {
        format!("{}://localhost:{}", protocol, server_port)
    } else {
        format!("{}://{}:{}", protocol, server_host, server_port)
    };
    let url = format!("{}/static/uploads/{}/{}", base_url, shop.id, generated_name);
    
    tracing::info!("文件保存成功: url={}", url);

    Ok(Json(UploadResponse {
        url,
        file_name: generated_name,
        original_name: upload_data.original_name,
        file_size: upload_data.data.len() as i64,
        message_type: upload_data.message_type,
        content_type: upload_data.content_type,
        shop_id: shop.id.into(),
        customer_code: upload_data.customer_code,
    }))
}
