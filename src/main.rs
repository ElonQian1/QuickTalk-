use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, broadcast};
use warp::Filter;
use warp::ws::{Message, WebSocket};
use serde::{Deserialize, Serialize};
use futures_util::{SinkExt, StreamExt};
use uuid::Uuid;

// 消息类型定义
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum ChatMessage {
    #[serde(rename = "user_connect")]
    UserConnect {
        #[serde(rename = "userId")]
        user_id: String,
        timestamp: u64,
    },
    #[serde(rename = "user_message")]
    UserMessage {
        #[serde(rename = "userId")]
        user_id: String,
        message: String,
        timestamp: u64,
    },
    #[serde(rename = "staff_message")]
    StaffMessage {
        #[serde(rename = "userId")]
        user_id: String,
        message: String,
        #[serde(rename = "staffName")]
        staff_name: String,
        timestamp: u64,
    },
    #[serde(rename = "system_notification")]
    SystemNotification {
        message: String,
        timestamp: u64,
    },
    #[serde(rename = "staff_typing")]
    StaffTyping {
        #[serde(rename = "userId")]
        user_id: String,
        #[serde(rename = "staffName")]
        staff_name: String,
    },
    #[serde(rename = "staff_stop_typing")]
    StaffStopTyping {
        #[serde(rename = "userId")]
        user_id: String,
    },
}

// 用户连接信息
#[derive(Debug, Clone)]
struct UserConnection {
    id: String,
    sender: broadcast::Sender<ChatMessage>,
}

// 全局状态
type Users = Arc<Mutex<HashMap<String, UserConnection>>>;

#[tokio::main]
async fn main() {
    // 初始化日志
    pretty_env_logger::init();

    // 创建用户连接存储
    let users: Users = Arc::new(Mutex::new(HashMap::new()));

    // 静态文件路由
    let static_files = warp::path::end()
        .and(warp::fs::file("static/index.html"))
        .or(warp::fs::dir("static"));

    // WebSocket 路由
    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(with_users(users.clone()))
        .map(|ws: warp::ws::Ws, users| {
            ws.on_upgrade(move |socket| handle_websocket(socket, users))
        });

    // 客服管理界面路由
    let admin_route = warp::path("admin")
        .and(warp::path::end())
        .and(warp::fs::file("static/admin.html"));

    // 合并所有路由
    let routes = static_files
        .or(ws_route)
        .or(admin_route)
        .with(warp::cors().allow_any_origin());

    println!("🚀 服务器启动在 http://localhost:3030");
    println!("📁 静态文件: http://localhost:3030");
    println!("👨‍💼 客服管理: http://localhost:3030/admin");
    println!("🔌 WebSocket: ws://localhost:3030/ws");

    warp::serve(routes)
        .run(([0, 0, 0, 0], 3030))
        .await;
}

fn with_users(users: Users) -> impl Filter<Extract = (Users,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || users.clone())
}

async fn handle_websocket(websocket: WebSocket, users: Users) {
    let (mut ws_sender, mut ws_receiver) = websocket.split();
    let (tx, mut rx) = broadcast::channel(100);
    
    let user_id = Uuid::new_v4().to_string();
    
    // 存储用户连接
    {
        let mut users_lock = users.lock().await;
        users_lock.insert(user_id.clone(), UserConnection {
            id: user_id.clone(),
            sender: tx.clone(),
        });
    }
    
    println!("🔗 新用户连接: {}", user_id);

    // 发送欢迎消息
    let welcome_msg = ChatMessage::SystemNotification {
        message: "欢迎使用在线客服！我们的客服人员将很快为您服务。".to_string(),
        timestamp: chrono::Utc::now().timestamp_millis() as u64,
    };
    
    if let Ok(msg_json) = serde_json::to_string(&welcome_msg) {
        let _ = ws_sender.send(Message::text(msg_json)).await;
    }

    // 处理发送消息的任务
    let users_for_sender = users.clone();
    let sender_task = tokio::task::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if let Ok(msg_json) = serde_json::to_string(&msg) {
                if ws_sender.send(Message::text(msg_json)).await.is_err() {
                    break;
                }
            }
        }
    });

    // 处理接收消息的任务
    let users_for_receiver = users.clone();
    let user_id_for_receiver = user_id.clone();
    let receiver_task = tokio::task::spawn(async move {
        while let Some(result) = ws_receiver.next().await {
            match result {
                Ok(msg) => {
                    if let Ok(text) = msg.to_str() {
                        if let Err(e) = handle_message(text, &user_id_for_receiver, &users_for_receiver).await {
                            eprintln!("处理消息错误: {}", e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("WebSocket 错误: {}", e);
                    break;
                }
            }
        }
    });

    // 等待任务完成
    tokio::select! {
        _ = sender_task => {},
        _ = receiver_task => {},
    }

    // 清理用户连接
    {
        let mut users_lock = users.lock().await;
        users_lock.remove(&user_id);
    }
    
    println!("🔌 用户断开连接: {}", user_id);
}

async fn handle_message(text: &str, user_id: &str, users: &Users) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let message: ChatMessage = serde_json::from_str(text)?;
    
    match message {
        ChatMessage::UserConnect { user_id: uid, timestamp: _ } => {
            println!("👤 用户 {} 已连接", uid);
            
            // 通知所有客服有新用户连接
            broadcast_to_all_staff(&ChatMessage::SystemNotification {
                message: format!("新用户 {} 已连接", uid),
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
            }, users).await;
        }
        
        ChatMessage::UserMessage { user_id: uid, message: msg, timestamp: _ } => {
            println!("💬 用户 {} 发送消息: {}", uid, msg);
            
            // 模拟客服自动回复（在实际应用中，这应该转发给真实的客服）
            let auto_reply = generate_auto_reply(&msg);
            
            // 延迟一下模拟客服思考时间
            tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
            
            // 发送客服回复
            let staff_reply = ChatMessage::StaffMessage {
                user_id: uid.clone(),
                message: auto_reply,
                staff_name: "小助手".to_string(),
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
            };
            
            send_to_user(&uid, &staff_reply, users).await;
        }
        
        _ => {
            println!("🔄 收到其他类型消息: {:?}", message);
        }
    }
    
    Ok(())
}

async fn send_to_user(user_id: &str, message: &ChatMessage, users: &Users) {
    let users_lock = users.lock().await;
    if let Some(user) = users_lock.get(user_id) {
        let _ = user.sender.send(message.clone());
    }
}

async fn broadcast_to_all_staff(message: &ChatMessage, users: &Users) {
    // 在实际应用中，这里应该只发送给客服人员
    // 目前为了演示，我们跳过这个功能
    println!("📢 广播给客服: {:?}", message);
}

fn generate_auto_reply(user_message: &str) -> String {
    let message_lower = user_message.to_lowercase();
    
    if message_lower.contains("你好") || message_lower.contains("hello") || message_lower.contains("hi") {
        "您好！欢迎咨询，请问有什么可以帮助您的吗？".to_string()
    } else if message_lower.contains("价格") || message_lower.contains("多少钱") || message_lower.contains("费用") {
        "关于价格问题，我们有多种套餐可供选择。请稍等，我为您查询具体的价格信息。".to_string()
    } else if message_lower.contains("技术") || message_lower.contains("问题") || message_lower.contains("bug") {
        "我理解您遇到了技术问题。请详细描述一下具体情况，我会尽快为您提供解决方案。".to_string()
    } else if message_lower.contains("联系") || message_lower.contains("电话") || message_lower.contains("邮箱") {
        "您可以通过以下方式联系我们：\n📞 客服热线：400-123-4567\n📧 邮箱：service@example.com\n⏰ 服务时间：9:00-18:00".to_string()
    } else if message_lower.contains("谢谢") || message_lower.contains("感谢") {
        "不客气！很高兴能为您提供帮助。如果还有其他问题，随时联系我们。".to_string()
    } else if message_lower.contains("再见") || message_lower.contains("拜拜") {
        "感谢您的咨询！祝您生活愉快，再见！".to_string()
    } else {
        "我收到了您的消息，正在为您查询相关信息，请稍等片刻...".to_string()
    }
}
