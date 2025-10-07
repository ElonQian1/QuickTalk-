// 在 src/api/react_routes.rs - React 版本路由处理

use axum::{response::Html, http::StatusCode};

// 添加 React 版本的移动端管理页面路由
pub async fn serve_react_mobile_admin() -> Result<Html<String>, StatusCode> {
    // 重定向到 React 开发服务器 (开发环境)
    // 生产环境中这里会服务 React 构建后的文件
    Ok(Html(format!(r#"
<!DOCTYPE html>
<html>
<head>
    <title>QuickTalk - React 版本</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script>
        // 开发环境重定向到 React 开发服务器
        if (window.location.hostname === 'localhost' && window.location.port === '3030') {{
            window.location.href = 'http://localhost:5173/mobile/admin';
        }}
    </script>
</head>
<body>
    <div style="padding: 20px; text-align: center; font-family: Arial;">
        <h2>🚀 QuickTalk React 版本</h2>
        <p>正在重定向到 React 开发服务器...</p>
        <p><a href="http://localhost:5173/mobile/admin">点击这里手动跳转</a></p>
        <hr>
        <p><a href="/mobile/admin/legacy">返回旧版本</a></p>
    </div>
</body>
</html>
    "#)))
}

// 为旧版本创建备用路由
pub async fn serve_legacy_mobile_admin() -> Html<String> {
    // 这里调用原来的 mobile admin 服务
    crate::web::serve_mobile_admin().await
}