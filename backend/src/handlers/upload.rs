use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use tokio::{fs, io::AsyncWriteExt};
use uuid::Uuid;

use std::path::PathBuf;

use crate::AppState;

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

pub async fn handle_upload(
    State(_state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, StatusCode> {
    let mut shop_id: Option<i64> = None;
    let mut customer_code: Option<String> = None;
    let mut message_type = String::from("file");
    let mut original_name: Option<String> = None;
    let mut content_type: Option<String> = None;
    let mut data: Option<Vec<u8>> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?
    {
        let name = field.name().unwrap_or_default().to_string();
        match name.as_str() {
            "shopId" => {
                let value = field.text().await.map_err(|_| StatusCode::BAD_REQUEST)?;
                shop_id = value.parse::<i64>().ok();
            }
            "customerCode" => {
                let value = field.text().await.map_err(|_| StatusCode::BAD_REQUEST)?;
                customer_code = Some(value);
            }
            "messageType" => {
                let value = field.text().await.map_err(|_| StatusCode::BAD_REQUEST)?;
                if !value.is_empty() {
                    message_type = value;
                }
            }
            "file" => {
                original_name = field.file_name().map(|v| v.to_string());
                content_type = field.content_type().map(|v| v.to_string());
                let bytes = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;
                data = Some(bytes.to_vec());
            }
            _ => {
                // ignore other fields
            }
        }
    }

    let shop_id = shop_id.ok_or(StatusCode::BAD_REQUEST)?;
    let data = data.ok_or(StatusCode::BAD_REQUEST)?;

    let file_size = data.len() as i64;
    if file_size == 0 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let original_name = original_name.unwrap_or_else(|| "upload.bin".to_string());
    let extension = std::path::Path::new(&original_name)
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
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    target_path.push(&generated_name);

    let mut file = fs::File::create(&target_path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    file.write_all(&data)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let relative_path = format!("uploads/{}/{}", shop_id, generated_name);
    let public_url = format!("/static/{}", relative_path);

    Ok(Json(UploadResponse {
        url: public_url,
        file_name: generated_name,
        original_name,
        file_size,
        message_type,
        content_type,
        shop_id,
        customer_code,
    }))
}
