use axum::{
    extract::{Multipart, State},
    Json,
};
use serde::Serialize;
use tokio::{fs, io::AsyncWriteExt};
use uuid::Uuid;

use std::path::PathBuf;

use crate::{auth::AuthUser, constants::upload_policy, error::AppError, AppState};

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
        .map_err(|_| AppError::BadRequest("无效的表单数据"))?
    {
        let name = field.name().unwrap_or_default().to_string();
        match name.as_str() {
            "shopId" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| AppError::BadRequest("shopId 无效"))?;
                shop_id = value.parse::<i64>().ok();
            }
            "customerCode" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| AppError::BadRequest("customerCode 无效"))?;
                if !value.is_empty() {
                    customer_code = Some(value);
                }
            }
            "messageType" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| AppError::BadRequest("messageType 无效"))?;
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
                        .map_err(|_| AppError::BadRequest("文件读取失败"))?
                        .to_vec(),
                );
            }
            _ => {}
        }
    }

    let shop_id = shop_id.ok_or(AppError::BadRequest("缺少 shopId"))?;
    let data = data.ok_or(AppError::BadRequest("缺少文件"))?;
    let original_name = original_name.unwrap_or_else(|| "upload.bin".to_string());

    Ok(UploadData {
        shop_id,
        customer_code,
        message_type,
        original_name,
        content_type,
        data,
    })
}

// 客户端上传的文件解析逻辑（使用 API Key）
async fn parse_customer_multipart(mut multipart: Multipart) -> Result<CustomerUploadData, AppError> {
    let mut api_key: Option<String> = None;
    let mut customer_code: Option<String> = None;
    let mut message_type = String::from("file");
    let mut original_name: Option<String> = None;
    let mut content_type: Option<String> = None;
    let mut data: Option<Vec<u8>> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| AppError::BadRequest("无效的表单数据"))?
    {
        let name = field.name().unwrap_or_default().to_string();
        match name.as_str() {
            "shopId" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| AppError::BadRequest("shopId 无效"))?;
                api_key = Some(value);
            }
            "customerCode" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| AppError::BadRequest("customerCode 无效"))?;
                if !value.is_empty() {
                    customer_code = Some(value);
                }
            }
            "messageType" => {
                let value = field
                    .text()
                    .await
                    .map_err(|_| AppError::BadRequest("messageType 无效"))?;
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
                        .map_err(|_| AppError::BadRequest("文件读取失败"))?
                        .to_vec(),
                );
            }
            _ => {}
        }
    }

    let api_key = api_key.ok_or(AppError::BadRequest("缺少 shopId"))?;
    let data = data.ok_or(AppError::BadRequest("缺少文件"))?;
    let original_name = original_name.unwrap_or_else(|| "upload.bin".to_string());

    Ok(CustomerUploadData {
        api_key,
        customer_code,
        message_type,
        original_name,
        content_type,
        data,
    })
}

// 提取公共的文件保存逻辑
async fn save_file_with_shop_id(shop_id: i64, data: &[u8], original_name: &str, content_type: &Option<String>) -> Result<String, AppError> {
    let file_size = data.len() as i64;
    if file_size == 0 {
        return Err(AppError::BadRequest("空文件"));
    }

    // 基础安全：限制大小和常见类型
    if file_size > upload_policy::MAX_SIZE_BYTES {
        return Err(AppError::BadRequest("文件过大，超过 10MB"));
    }
    if let Some(ct) = content_type {
        if !upload_policy::ALLOWED_PREFIX
            .iter()
            .any(|&a| ct.starts_with(a))
        {
            return Err(AppError::BadRequest("不支持的文件类型"));
        }
    }

    let extension = std::path::Path::new(original_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");
    let generated_name = if extension.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        format!("{}.{}", Uuid::new_v4(), extension)
    };

    let mut target_path = PathBuf::from("static");
    target_path.push("uploads");
    target_path.push(shop_id.to_string());

    fs::create_dir_all(&target_path)
        .await
        .map_err(|_| AppError::Internal("创建目录失败"))?;

    target_path.push(&generated_name);

    let mut file = fs::File::create(&target_path)
        .await
        .map_err(|_| AppError::Internal("创建文件失败"))?;

    file.write_all(data)
        .await
        .map_err(|_| AppError::Internal("写入文件失败"))?;

    Ok(generated_name)
}

// 原有的 save_file 函数，使用 UploadData
async fn save_file(upload_data: &UploadData) -> Result<String, AppError> {
    save_file_with_shop_id(upload_data.shop_id, &upload_data.data, &upload_data.original_name, &upload_data.content_type).await
}

pub async fn handle_upload(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    multipart: Multipart,
) -> Result<Json<UploadResponse>, AppError> {
    let upload_data = parse_multipart(multipart).await?;
    
    // 多租户校验：仅店主可上传该店铺相关文件
    if let Some(shop) = state
        .db
        .get_shop_by_id(upload_data.shop_id)
        .await
        .map_err(|_| AppError::Internal("查询店铺失败"))?
    {
        if shop.owner_id != user_id {
            return Err(AppError::Unauthorized);
        }
    } else {
        return Err(AppError::NotFound);
    }
    
    let generated_name = save_file(&upload_data).await?;
    
    // 构建完整的服务器URL，而不是相对路径
    let server_host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "localhost".to_string());
    let server_port = std::env::var("SERVER_PORT").unwrap_or_else(|_| "8080".to_string());
    let base_url = if server_host == "0.0.0.0" {
        format!("http://localhost:{}", server_port)
    } else {
        format!("http://{}:{}", server_host, server_port)
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
    multipart: Multipart,
) -> Result<Json<UploadResponse>, AppError> {
    tracing::info!("收到客户端上传请求");
    
    let upload_data = parse_customer_multipart(multipart).await?;
    tracing::info!("解析上传数据成功: api_key={}, original_name={}", upload_data.api_key, upload_data.original_name);
    
    // 根据 API Key 查找店铺 ID
    let shop = state
        .db
        .get_shop_by_api_key(&upload_data.api_key)
        .await
        .map_err(|e| {
            tracing::error!("查询店铺失败: {}", e);
            AppError::Internal("查询店铺失败")
        })?
        .ok_or_else(|| {
            tracing::error!("未找到店铺: api_key={}", upload_data.api_key);
            AppError::NotFound
        })?;
    
    tracing::info!("找到店铺: id={}, name={}", shop.id, shop.shop_name);

    let generated_name = save_file_with_shop_id(shop.id, &upload_data.data, &upload_data.original_name, &upload_data.content_type).await?;
    
    // 构建完整的服务器URL，而不是相对路径
    let server_host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "localhost".to_string());
    let server_port = std::env::var("SERVER_PORT").unwrap_or_else(|_| "8080".to_string());
    let base_url = if server_host == "0.0.0.0" {
        format!("http://localhost:{}", server_port)
    } else {
        format!("http://{}:{}", server_host, server_port)
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
        shop_id: shop.id,
        customer_code: upload_data.customer_code,
    }))
}
