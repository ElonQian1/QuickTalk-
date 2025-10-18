use axum::{
    extract::Path,
    http::{header, HeaderMap, StatusCode, Uri},
    response::IntoResponse,
};
use tokio::fs;

pub async fn serve_static_file(Path(file_path): Path<String>) -> impl IntoResponse {
    let static_dir = std::path::Path::new("static");
    
    // 首先尝试直接路径 (对于 /static/js/main.js -> static/static/js/main.js)
    let nested_path = static_dir.join("static").join(&file_path);
    if nested_path.exists() && nested_path.starts_with(static_dir) {
        match fs::read(&nested_path).await {
            Ok(contents) => {
                let mut headers = HeaderMap::new();
                
                if let Some(extension) = nested_path.extension() {
                    let content_type = match extension.to_str() {
                        Some("js") => "text/javascript; charset=utf-8",
                        Some("css") => "text/css; charset=utf-8",
                        Some("html") => "text/html; charset=utf-8",
                        Some("json") => "application/json; charset=utf-8",
                        Some("mp3") => "audio/mpeg",
                        Some("wav") => "audio/wav",
                        Some("svg") => "image/svg+xml; charset=utf-8",
                        Some("ico") => "image/x-icon",
                        Some("png") => "image/png",
                        Some("jpg") | Some("jpeg") => "image/jpeg",
                        Some("gif") => "image/gif",
                        _ => "application/octet-stream",
                    };
                    headers.insert(header::CONTENT_TYPE, content_type.parse().unwrap());
                }
                
                headers.insert(header::CACHE_CONTROL, "public, max-age=3600".parse().unwrap());
                return (headers, contents).into_response();
            }
            Err(_) => {}
        }
    }
    
    // 回退：尝试直接路径
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
                    Some("mp3") => "audio/mpeg",
                    Some("wav") => "audio/wav",
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

pub async fn serve_favicon() -> impl IntoResponse {
    let favicon_path = std::path::Path::new("static/favicon.ico");
    
    match fs::read(favicon_path).await {
        Ok(contents) => {
            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, "image/x-icon".parse().unwrap());
            headers.insert(header::CACHE_CONTROL, "public, max-age=86400".parse().unwrap());
            (headers, contents).into_response()
        }
        Err(_) => (StatusCode::NOT_FOUND, "Favicon not found").into_response(),
    }
}

pub async fn serve_robots() -> impl IntoResponse {
    let robots_path = std::path::Path::new("static/robots.txt");
    
    match fs::read_to_string(robots_path).await {
        Ok(contents) => {
            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, "text/plain; charset=utf-8".parse().unwrap());
            headers.insert(header::CACHE_CONTROL, "public, max-age=86400".parse().unwrap());
            (headers, contents).into_response()
        }
        Err(_) => {
            // 如果文件不存在，返回默认的robots.txt
            let default_robots = "User-agent: *\nAllow: /\n";
            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, "text/plain; charset=utf-8".parse().unwrap());
            (headers, default_robots).into_response()
        }
    }
}

pub async fn serve_index() -> impl IntoResponse {
    let index_path = std::path::Path::new("static/index.html");
    
    match fs::read_to_string(index_path).await {
        Ok(contents) => {
            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, "text/html; charset=utf-8".parse().unwrap());
            headers.insert(header::CACHE_CONTROL, "public, max-age=3600".parse().unwrap());
            (headers, contents).into_response()
        }
        Err(_) => (StatusCode::NOT_FOUND, "Index page not found").into_response(),
    }
}

pub async fn serve_favicon_svg() -> impl IntoResponse {
    let favicon_path = std::path::Path::new("static/favicon.svg");
    
    match fs::read(favicon_path).await {
        Ok(contents) => {
            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, "image/svg+xml".parse().unwrap());
            headers.insert(header::CACHE_CONTROL, "public, max-age=86400".parse().unwrap());
            (headers, contents).into_response()
        }
        Err(_) => (StatusCode::NOT_FOUND, "Favicon SVG not found").into_response(),
    }
}

pub async fn serve_manifest() -> impl IntoResponse {
    let manifest_path = std::path::Path::new("static/manifest.json");
    
    match fs::read_to_string(manifest_path).await {
        Ok(contents) => {
            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, "application/json".parse().unwrap());
            headers.insert(header::CACHE_CONTROL, "public, max-age=86400".parse().unwrap());
            (headers, contents).into_response()
        }
        Err(_) => (StatusCode::NOT_FOUND, "Manifest not found").into_response(),
    }
}

// SPA fallback - 用于处理React Router等单页应用的路由
pub async fn serve_spa_fallback(uri: axum::http::Uri) -> impl IntoResponse {
    let path = uri.path();
    
    // 如果是API或WebSocket路径，返回404
    if path.starts_with("/api") || path.starts_with("/ws") {
        return (StatusCode::NOT_FOUND, "API endpoint not found").into_response();
    }
    
    // 尝试直接从static目录提供文件
    let static_dir = std::path::Path::new("static");
    let file_path = static_dir.join(path.trim_start_matches('/'));
    
    if file_path.exists() && file_path.starts_with(static_dir) {
        match fs::read(&file_path).await {
            Ok(contents) => {
                let mut headers = HeaderMap::new();
                
                if let Some(extension) = file_path.extension() {
                    let content_type = match extension.to_str() {
                        Some("js") => "text/javascript; charset=utf-8",
                        Some("css") => "text/css; charset=utf-8",
                        Some("html") => "text/html; charset=utf-8",
                        Some("json") => "application/json; charset=utf-8",
                        Some("mp3") => "audio/mpeg",
                        Some("wav") => "audio/wav",
                        Some("svg") => "image/svg+xml",
                        Some("ico") => "image/x-icon",
                        Some("png") => "image/png",
                        Some("jpg") | Some("jpeg") => "image/jpeg",
                        Some("gif") => "image/gif",
                        _ => "application/octet-stream",
                    };
                    headers.insert(header::CONTENT_TYPE, content_type.parse().unwrap());
                }
                
                headers.insert(header::CACHE_CONTROL, "public, max-age=3600".parse().unwrap());
                return (headers, contents).into_response();
            }
            Err(_) => {}
        }
    }
    
    // 对于其他路径，返回index.html（SPA路由）
    let index_path = std::path::Path::new("static/index.html");
    match fs::read_to_string(index_path).await {
        Ok(contents) => {
            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, "text/html; charset=utf-8".parse().unwrap());
            (headers, contents).into_response()
        }
        Err(_) => (StatusCode::NOT_FOUND, "Index page not found").into_response(),
    }
}