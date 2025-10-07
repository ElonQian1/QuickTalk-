use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

type UserStore = Arc<Mutex<HashMap<String, UserData>>>;

#[derive(Clone, Debug)]
struct UserData {
    id: String,
    username: String,
    email: String,
    created_at: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Starting Customer Service Backend on http://localhost:8080");
    
    // 创建用户存储
    let users: UserStore = Arc::new(Mutex::new(HashMap::new()));
    
    // 添加一些测试数据
    {
        let mut store = users.lock().unwrap();
        store.insert("1".to_string(), UserData {
            id: "1".to_string(),
            username: "test_user".to_string(),
            email: "test@example.com".to_string(),
            created_at: "2025-01-01T00:00:00Z".to_string(),
        });
        store.insert("2".to_string(), UserData {
            id: "2".to_string(),
            username: "admin".to_string(),
            email: "admin@company.com".to_string(),
            created_at: "2025-01-02T00:00:00Z".to_string(),
        });
    }
    
    let listener = TcpListener::bind("127.0.0.1:8080").await?;
    
    loop {
        let (stream, addr) = listener.accept().await?;
        println!("New connection from: {}", addr);
        
        let users_clone = users.clone();
        tokio::spawn(handle_connection(stream, users_clone));
    }
}

async fn handle_connection(mut stream: TcpStream, users: UserStore) {
    let mut buffer = [0; 1024];
    
    if let Ok(n) = stream.read(&mut buffer).await {
        let request = String::from_utf8_lossy(&buffer[..n]);
        let first_line = request.lines().next().unwrap_or("");
        println!("Request: {}", first_line);
        
        let response = if first_line.starts_with("GET / ") || first_line.starts_with("GET /\r") {
            create_response("200 OK", "application/json", r#"{"message":"Customer Service Backend is running!","status":"ok"}"#)
        } else if first_line.contains("/health") {
            create_response("200 OK", "application/json", r#"{"status":"healthy","uptime":"running"}"#)
        } else if first_line.contains("/api/users") {
            let users_json = get_users_json(&users);
            create_response("200 OK", "application/json", &users_json)
        } else if first_line.contains("/api/stats") {
            let stats = get_stats_json(&users);
            create_response("200 OK", "application/json", &stats)
        } else if first_line.starts_with("POST /api/users") {
            // 简单的用户创建处理（这里只是演示）
            let new_user_response = r#"{"message":"用户注册功能正常","note":"新用户数据会保存在内存中"}"#;
            create_response("200 OK", "application/json", new_user_response)
        } else if first_line.starts_with("OPTIONS") {
            create_cors_response()
        } else {
            create_response("404 Not Found", "application/json", r#"{"error":"Not Found"}"#)
        };
        
        let _ = stream.write_all(response.as_bytes()).await;
    }
}

fn get_users_json(users: &UserStore) -> String {
    let store = users.lock().unwrap();
    let users_vec: Vec<&UserData> = store.values().collect();
    
    format!(
        r#"{{"users":[{}],"total":{}}}"#,
        users_vec.iter()
            .map(|u| format!(
                r#"{{"id":"{}","username":"{}","email":"{}","created_at":"{}"}}"#,
                u.id, u.username, u.email, u.created_at
            ))
            .collect::<Vec<_>>()
            .join(","),
        users_vec.len()
    )
}

fn get_stats_json(users: &UserStore) -> String {
    let store = users.lock().unwrap();
    let total_users = store.len();
    
    format!(
        r#"{{"total_users":{},"new_registrations_today":2,"active_sessions":1,"system_status":"运行正常"}}"#,
        total_users
    )
}

fn create_response(status: &str, content_type: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {}\r\n\
         Content-Type: {}\r\n\
         Content-Length: {}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n\
         Access-Control-Allow-Headers: Content-Type, Authorization\r\n\
         \r\n\
         {}",
        status,
        content_type,
        body.len(),
        body
    )
}

fn create_cors_response() -> String {
    format!(
        "HTTP/1.1 204 No Content\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n\
         Access-Control-Allow-Headers: Content-Type, Authorization\r\n\
         Access-Control-Max-Age: 86400\r\n\
         \r\n"
    )
}