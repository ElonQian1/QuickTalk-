use axum::{
    extract::{State, Path, Json},
    http::StatusCode,
    response::Json as AxumJson,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::info;
use sqlx::Row;

use crate::bootstrap::app_state::AppState;
use crate::types::ApiResponse;
use crate::types::dto::embed::GenerateCodeResponse;

#[derive(Deserialize)]
pub struct GenerateCodeRequest {
    pub platform: String, // "html", "react", "php", "python"
    pub customization: Option<HashMap<String, String>>,
}

pub async fn generate_integration_code(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
    Json(payload): Json<GenerateCodeRequest>,
) -> Result<AxumJson<ApiResponse<GenerateCodeResponse>>, StatusCode> {
    // 获取店铺的API密钥
    let shop_api_key = match sqlx::query("SELECT api_key FROM shops WHERE id = ?")
        .bind(&shop_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => row.get::<String, _>("api_key"),
        Err(_) => return Err(StatusCode::NOT_FOUND),
    };

    let (code, instructions) = match payload.platform.as_str() {
        "html" => generate_html_integration(&shop_api_key, &shop_id, &payload.customization),
        "react" => generate_react_integration(&shop_api_key, &shop_id, &payload.customization),
        "php" => generate_php_integration(&shop_api_key, &shop_id, &payload.customization),
        "python" => generate_python_integration(&shop_api_key, &shop_id, &payload.customization),
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    info!("Generated {} integration code for shop {}", payload.platform, shop_id);
    
    Ok(AxumJson(ApiResponse {
        success: true,
        data: Some(GenerateCodeResponse {
            platform: payload.platform,
            code,
            instructions,
        }),
        message: "Integration code generated successfully".to_string(),
    }))
}


fn generate_html_integration(api_key: &str, shop_id: &str, customization: &Option<HashMap<String, String>>) -> (String, String) {
    let widget_color = customization.as_ref()
        .and_then(|c| c.get("color"))
        .map(|s| s.as_str())
        .unwrap_or("#007bff");
    
    let position = customization.as_ref()
        .and_then(|c| c.get("position"))
        .map(|s| s.as_str())
        .unwrap_or("bottom-right");

    let position_prop = if position.contains("right") { "right" } else { "left" };

    let code = format!(r#"<!-- QuickTalk Chat Widget -->
<div id="quicktalk-widget"></div>
<script>
(function() {{
    // Widget configuration
    const config = {{
        apiKey: '{}',
        shopId: '{}',
        serverUrl: 'ws://localhost:3030/ws',
        theme: {{
            primaryColor: '{}',
            position: '{}'
        }}
    }};

    // Create chat widget
    const widget = document.createElement('div');
    widget.id = 'quicktalk-chat-widget';
    widget.style.cssText = `
        position: fixed;
        {}: 20px;
        bottom: 20px;
        width: 350px;
        height: 500px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 10000;
        display: none;
        flex-direction: column;
    `;

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.innerHTML = '💬';
    toggleBtn.style.cssText = `
        position: fixed;
        {}: 20px;
        bottom: 20px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: {};
        color: white;
        border: none;
        font-size: 24px;
        cursor: pointer;
        z-index: 10001;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    `;

    // WebSocket connection
    let ws = null;
    function connectWebSocket() {{
        ws = new WebSocket(config.serverUrl);
        ws.onopen = function() {{
            ws.send(JSON.stringify({{
                type: 'auth',
                apiKey: config.apiKey,
                shopId: config.shopId
            }}));
        }};
        ws.onmessage = function(event) {{
            const data = JSON.parse(event.data);
            // Handle incoming messages
            displayMessage(data);
        }};
    }}

    function displayMessage(message) {{
        // Add message to chat widget
        console.log('New message:', message);
    }}

    // Toggle widget visibility
    let isWidgetVisible = false;
    toggleBtn.onclick = function() {{
        isWidgetVisible = !isWidgetVisible;
        widget.style.display = isWidgetVisible ? 'flex' : 'none';
    }};

    document.body.appendChild(toggleBtn);
    document.body.appendChild(widget);

    connectWebSocket();
}})();
</script>"#, 
    api_key, 
    shop_id, 
    widget_color, 
    position,
    position_prop,
    position_prop,
    widget_color
    );

    let instructions = "将此代码片段粘贴到您网站的 </body> 标签之前。".to_string();
    (code, instructions)
}

fn generate_react_integration(api_key: &str, shop_id: &str, customization: &Option<HashMap<String, String>>) -> (String, String) {
    let widget_color = customization.as_ref().and_then(|c| c.get("color")).map(|s| s.as_str()).unwrap_or("#007bff");
    let position = customization.as_ref().and_then(|c| c.get("position")).map(|s| s.as_str()).unwrap_or("bottom-right");

    let position_prop = if position.contains("right") { "right" } else { "left" };

    let code = format!(r#"import React, {{ useEffect, useState }} from 'react';

const QuickTalkWidget = () => {{
    const [messages, setMessages] = useState([]);
    const [ws, setWs] = useState(null);
    const [isOpen, setIsOpen] = useState(false);

    const config = {{
        apiKey: '{}',
        shopId: '{}',
        serverUrl: 'ws://localhost:3030/ws',
        theme: {{
            primaryColor: '{}',
            position: '{}'
        }}
    }};

    useEffect(() => {{
        const socket = new WebSocket(config.serverUrl);
        socket.onopen = () => {{
            socket.send(JSON.stringify({{ type: 'auth', apiKey: config.apiKey, shopId: config.shopId }}));
        }};
        socket.onmessage = (event) => {{
            const data = JSON.parse(event.data);
            setMessages(prev => [...prev, data]);
        }};
        setWs(socket);

        return () => socket.close();
    }}, []);

    const positionStyles = {{
        position: 'fixed',
        bottom: '20px',
        {}: '20px',
        zIndex: 10000
    }};

    return (
        <div style={{{{...positionStyles}}}}>
            {{isOpen && (
                <div style={{{{ 
                    width: '350px', 
                    height: '500px', 
                    background: 'white', 
                    borderRadius: '10px', 
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    display: 'flex',
                    flexDirection: 'column'
                }}}}>
                    {{/* Chat content goes here */}}
                </div>
            )}}
            <button 
                onClick={{() => setIsOpen(!isOpen)}}
                style={{{{ 
                    width: '60px', 
                    height: '60px', 
                    borderRadius: '50%', 
                    background: config.theme.primaryColor, 
                    color: 'white', 
                    border: 'none', 
                    fontSize: '24px', 
                    cursor: 'pointer',
                    marginTop: '10px',
                    float: '{}'
                }}}}
            >
                💬
            </button>
        </div>
    );
}};

export default QuickTalkWidget;
"#, 
    api_key, 
    shop_id, 
    widget_color, 
    position,
    position_prop,
    position_prop
    );

    let instructions = "1. 将此组件导入您的React应用。\n2. 在您的主布局文件中渲染 <QuickTalkWidget />。".to_string();
    (code, instructions)
}

fn generate_php_integration(api_key: &str, shop_id: &str, _customization: &Option<HashMap<String, String>>) -> (String, String) {
    let code = format!(r#"<?php
function get_customer_jwt($customer_id, $customer_name, $secret_key) {{
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode(['id' => $customer_id, 'name' => $customer_name, 'exp' => time() + 3600]);
    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret_key, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}}

$shop_id = '{}';
$api_key = '{}'; // 这是您的店铺API密钥
$customer_id = 'CUSTOMER_123'; // 替换为您的用户ID
$customer_name = 'John Doe'; // 替换为您的用户名

// 重要：在生产环境中，api_key 应作为安全密钥用于生成JWT，而不是直接暴露给前端
$jwt = get_customer_jwt($customer_id, $customer_name, $api_key);
?>

<!-- 在您的HTML中 -->
<script>
    const customerToken = '<?php echo $jwt; ?>';
    // 在初始化WebSocket连接时使用此token
</script>
"#, shop_id, api_key);

    let instructions = "在您的PHP后端，使用此函数为登录用户生成JWT。然后将JWT传递给前端，用于WebSocket身份验证。".to_string();
    (code, instructions)
}

fn generate_python_integration(api_key: &str, shop_id: &str, _customization: &Option<HashMap<String, String>>) -> (String, String) {
    let code = format!(r#"import jwt
import time

SHOP_ID = '{}'
API_KEY = '{}' # 这是您的店铺API密钥

def create_customer_jwt(customer_id, customer_name):
    payload = {{
        'id': customer_id,
        'name': customer_name,
        'exp': int(time.time()) + 3600 # 1小时后过期
    }}
    token = jwt.encode(payload, API_KEY, algorithm='HS256')
    return token

# 为您的登录用户生成token
customer_id = 'CUSTOMER_456'
customer_name = 'Jane Doe'
customer_token = create_customer_jwt(customer_id, customer_name)

print(f"Shop ID: {{SHOP_ID}}")
print(f"Customer Token: {{customer_token}}")
"#, shop_id, api_key);

    let instructions = "在您的Python后端（例如Flask或Django），使用此函数为登录用户生成JWT。然后将JWT传递给前端，用于WebSocket身份验证。".to_string();
    (code, instructions)
}
