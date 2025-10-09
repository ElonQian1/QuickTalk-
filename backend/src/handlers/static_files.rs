use axum::{
    extract::Path,
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
};
use tokio::fs;

pub async fn serve_static_file(Path(file_path): Path<String>) -> impl IntoResponse {
    let static_dir = std::path::Path::new("static");
    let full_path = static_dir.join(&file_path);
    
    // 安全检查：防止路径遍历攻击
    if !full_path.starts_with(static_dir) {
        return (StatusCode::FORBIDDEN, "Forbidden").into_response();
    }
    
    match fs::read(&full_path).await {
        Ok(contents) => {
            let mut headers = HeaderMap::new();
            
            // 根据文件扩展名设置正确的 Content-Type 和 charset
            if let Some(extension) = full_path.extension() {
                let content_type = match extension.to_str() {
                    Some("js") => "text/javascript; charset=utf-8",
                    Some("css") => "text/css; charset=utf-8",
                    Some("html") => "text/html; charset=utf-8",
                    Some("json") => "application/json; charset=utf-8",
                    Some("svg") => "image/svg+xml; charset=utf-8",
                    Some("ico") => "image/x-icon",
                    Some("png") => "image/png",
                    Some("jpg") | Some("jpeg") => "image/jpeg",
                    Some("gif") => "image/gif",
                    _ => "application/octet-stream",
                };
                
                headers.insert(header::CONTENT_TYPE, content_type.parse().unwrap());
            }
            
            // 添加缓存控制头
            headers.insert(header::CACHE_CONTROL, "public, max-age=3600".parse().unwrap());
            
            (headers, contents).into_response()
        }
        Err(_) => (StatusCode::NOT_FOUND, "File not found").into_response(),
    }
}