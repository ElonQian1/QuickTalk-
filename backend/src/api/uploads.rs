use axum::extract::Multipart;
use chrono::Utc;
use std::path::PathBuf;
use std::sync::Arc;
use uuid::Uuid;

use crate::bootstrap::app_state::AppState;
use crate::api::errors::{ApiError, ApiResult, success};

pub async fn upload_file(
    axum::extract::State(_state): axum::extract::State<Arc<AppState>>,
    mut multipart: Multipart,
) -> ApiResult<serde_json::Value> {
    let mut uploaded_files = Vec::new();

    while let Some(field) = multipart.next_field().await.map_err(|e| super::errors::db_helpers::handle_multipart_error(e))? {
        let _name = field.name().unwrap_or("file").to_string();
        let filename = field.file_name().unwrap_or("unknown").to_string();
        let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
    let data = field.bytes().await.map_err(|e| super::errors::db_helpers::handle_file_bytes_error(e))?;

        // 创建上传目录
        let upload_dir = PathBuf::from("../uploads");
        tokio::fs::create_dir_all(&upload_dir)
            .await
            .map_err(|e| super::errors::db_helpers::handle_dir_creation_error(e, &upload_dir.display().to_string()))?;

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
            .map_err(|e| super::errors::db_helpers::handle_file_write_error(e, &file_path.display().to_string()))?;

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

    success(serde_json::json!({
        "files": uploaded_files,
        "count": uploaded_files.len()
    }), "Files uploaded successfully")
}

pub async fn list_uploaded_files() -> ApiResult<Vec<serde_json::Value>> {
    let upload_dir = PathBuf::from("../uploads");

    if !upload_dir.exists() {
        return super::response_helpers::success_empty_array("No uploads directory found");
    }

    let mut files = Vec::new();
    let mut dir = tokio::fs::read_dir(upload_dir)
        .await
        .map_err(|e| super::errors::db_helpers::handle_dir_read_error(e))?;

    while let Some(entry) = dir.next_entry().await.map_err(|e| super::errors::db_helpers::handle_file_entry_error(e))? {
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

    success(files, "Files listed successfully")
}
