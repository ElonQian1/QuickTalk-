use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Starting simple HTTP server on http://localhost:8080");
    
    let listener = TcpListener::bind("127.0.0.1:8080").await?;
    
    loop {
        let (stream, addr) = listener.accept().await?;
        println!("New connection from: {}", addr);
        
        tokio::spawn(handle_connection(stream));
    }
}

async fn handle_connection(mut stream: TcpStream) {
    let mut buffer = [0; 1024];
    
    if let Ok(n) = stream.read(&mut buffer).await {
        let request = String::from_utf8_lossy(&buffer[..n]);
        println!("Request: {}", request.lines().next().unwrap_or(""));
        
        let response = if request.starts_with("GET / ") {
            create_response("200 OK", "text/plain", "Customer Service Backend is running!")
        } else if request.starts_with("GET /api/") {
            let json_response = r#"{"status": "ok", "message": "API is working"}"#;
            create_response("200 OK", "application/json", json_response)
        } else if request.starts_with("OPTIONS") {
            create_cors_response()
        } else {
            create_response("404 Not Found", "text/plain", "Not Found")
        };
        
        let _ = stream.write_all(response.as_bytes()).await;
    }
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