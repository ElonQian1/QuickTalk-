use axum::{extract::Multipart, response::Json};
use chrono::Utc;
use std::path::PathBuf;
use std::sync::Arc;
use uuid::Uuid;

use crate::bootstrap::app_state::AppState;
use crate::types::ApiResponse;
use crate::api::errors::ApiError;

pub async fn upload_file(
    axum::extract::State(_state): axum::extract::State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<serde_json::Value>>, ApiError> {
    let mut uploaded_files = Vec::new();

    while let Some(field) = multipart.next_field().await.map_err(|e| { tracing::error!(error=%e, "multipart read failed"); ApiError::bad_request("表单解析失败") })? {
        let _name = field.name().unwrap_or("file").to_string();
        let filename = field.file_name().unwrap_or("unknown").to_string();
        let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
    let data = field.bytes().await.map_err(|e| { tracing::error!(error=%e, "read field bytes failed"); ApiError::bad_request("文件读取失败") })?;

        // 创建上传目录
        let upload_dir = PathBuf::from("../uploads");
        tokio::fs::create_dir_all(&upload_dir)
            .await
            .map_err(|e| { tracing::error!(error=%e, dir=%upload_dir.display(), "create upload dir failed"); ApiError::internal("创建上传目录失败") })?;

        // 生成唯一文件名
        let file_extension = filename.split('.').last().unwrap_or("bin");
        let unique_filename = format!(
            "{}_{}.{}",
            Uuid::new_v4(),
            chrono::Utc::now().timestamp(),
            file_extension
        );
        let file_path = upload_dir.join(&unique_filename);

        // 保存文件
        tokio::fs::write(&file_path, &data)
            .await
            .map_err(|e| { tracing::error!(error=%e, path=%file_path.display(), "write file failed"); ApiError::internal("写入文件失败") })?;

        tracing::info!(
            original = %filename,
            stored = %unique_filename,
            size = data.len(),
            "File uploaded"
        );

        uploaded_files.push(serde_json::json!({
            "original_name": filename,
            "stored_name": unique_filename,
            "size": data.len(),
            "content_type": content_type,
            "url": format!("/uploads/{}", unique_filename),
            "upload_time": Utc::now()
        }));
    }

    if uploaded_files.is_empty() {
        return Err(ApiError::bad_request("未选择文件"));
    }

    Ok(Json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({
            "files": uploaded_files,
            "count": uploaded_files.len()
        })),
        message: "Files uploaded successfully".to_string(),
    }))
}

pub async fn list_uploaded_files() -> Result<Json<ApiResponse<Vec<serde_json::Value>>>, ApiError> {
    let upload_dir = PathBuf::from("../uploads");

    if !upload_dir.exists() {
        return Ok(Json(ApiResponse {
            success: true,
            data: Some(Vec::new()),
            message: "No uploads directory found".to_string(),
        }));
    }

    let mut files = Vec::new();
    let mut dir = tokio::fs::read_dir(upload_dir)
        .await
        .map_err(|e| { tracing::error!(error=%e, "read_dir failed"); ApiError::internal("读取目录失败") })?;

    while let Some(entry) = dir.next_entry().await.map_err(|e| { tracing::error!(error=%e, "read_dir entry failed"); ApiError::internal("读取文件条目失败") })? {
        if let Ok(metadata) = entry.metadata().await {
            if metadata.is_file() {
                let filename = entry.file_name().to_string_lossy().to_string();
                files.push(serde_json::json!({
                    "name": filename,
                    "size": metadata.len(),
                    "url": format!("/uploads/{}", filename),
                    "modified": metadata
                        .modified()
                        .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                }));
            }
        }
    }

    Ok(Json(ApiResponse {
        success: true,
        data: Some(files),
        message: "Files listed successfully".to_string(),
    }))
}
