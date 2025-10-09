use anyhow::Result;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, Path, State,
    },
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Map, Value};
use std::{
    net::SocketAddr,
    sync::{Arc, Mutex},
};
use tokio::sync::mpsc;
use tower_http::{cors::CorsLayer, services::ServeDir};
use tracing::{error, info, warn};

mod auth;
mod database;
mod handlers;
mod jwt;
mod models;
mod services;
mod websocket;

use database::Database;
use models::{Customer, Session, WebSocketIncomingMessage, WebSocketMessage};
use services::chat::{ChatService, CustomerProfile, MessagePayload};
use websocket::ConnectionManager;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub connections: Arc<Mutex<ConnectionManager>>,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let db = Database::new("sqlite:customer_service.db").await?;
    let connections = Arc::new(Mutex::new(ConnectionManager::new()));

    let state = AppState { db, connections };

    let app = Router::new()
        .route("/", get(|| async { "Customer Service System API" }))
        .route("/health", get(health_check))
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/api/auth/register", post(handlers::auth::register))
        .route("/api/shops", get(handlers::shop::get_shops))
        .route("/api/shops", post(handlers::shop::create_shop))
        .route(
            "/api/shops/:shop_id/customers",
            get(handlers::customer::get_customers),
        )
        .route(
            "/api/sessions/:session_id/messages",
            get(handlers::message::get_messages),
        )
        .route(
            "/api/sessions/:session_id/messages",
            post(handlers::message::send_message),
        )
        .route("/api/upload", post(handlers::upload::handle_upload))
        .route("/ws/staff/:user_id", get(websocket_handler_staff))
        .route(
            "/ws/customer/:shop_ref/:customer_id",
            get(websocket_handler_customer),
        )
        .nest_service("/static", ServeDir::new("static"))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    info!("Customer Service System started on http://0.0.0.0:8080");

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}

async fn health_check() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "customer-service-backend",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

async fn websocket_handler_staff(
    Path(user_id): Path<i64>,
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
    info!("Staff WebSocket connection from: {}", addr);
    ws.on_upgrade(move |socket| handle_staff_socket(socket, state, user_id))
}

async fn websocket_handler_customer(
    Path((shop_ref, customer_code)): Path<(String, String)>,
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
    info!("Customer WebSocket connection from: {}", addr);
    match resolve_shop_id(&state, &shop_ref).await {
        Ok(shop_id) => {
            let state_for_ws = state.clone();
            ws.on_upgrade(move |socket| {
                handle_customer_socket(socket, state_for_ws, shop_id, customer_code)
            })
        }
        Err(response) => response,
    }
}

async fn resolve_shop_id(state: &AppState, shop_ref: &str) -> Result<i64, Response> {
    if let Ok(id) = shop_ref.parse::<i64>() {
        return Ok(id);
    }

    match state.db.get_shop_by_api_key(shop_ref).await {
        Ok(Some(shop)) => Ok(shop.id),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(json!({
                "error": "shop_not_found",
                "message": "No shop matches the provided identifier"
            })),
        )
            .into_response()),
        Err(err) => {
            error!("Failed to resolve shop identifier {}: {:?}", shop_ref, err);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "error": "shop_lookup_failed",
                    "message": "Unable to resolve shop identifier"
                })),
            )
                .into_response())
        }
    }
}

async fn handle_customer_socket(
    socket: WebSocket,
    state: AppState,
    shop_id: i64,
    customer_code: String,
) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    let connection_id = {
        let mut manager = state.connections.lock().unwrap();
        manager.add_customer_connection(shop_id, &customer_code, tx.clone())
    };

    info!(
        "Customer connection established: {} (shop: {}, customer: {})",
        connection_id, shop_id, customer_code
    );

    let welcome = WebSocketMessage {
        message_type: "system".to_string(),
        content: Some("欢迎使用客服系统！客服人员将为您服务。".to_string()),
        session_id: None,
        sender_id: None,
        sender_type: Some("system".to_string()),
        timestamp: Some(Utc::now()),
        metadata: Some(json!({
            "event": "welcome",
            "shopId": shop_id,
            "customerCode": customer_code
        })),
        file_url: None,
        file_name: None,
        file_size: None,
        media_duration: None,
    };

    if let Ok(payload) = serde_json::to_string(&welcome) {
        let _ = tx.send(Message::Text(payload));
    }

    let send_task = tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if sender.send(message).await.is_err() {
                break;
            }
        }
    });

    let chat_service = ChatService::new(&state);
    let mut customer: Option<Customer> = None;
    let mut session: Option<Session> = None;

    while let Some(result) = receiver.next().await {
        match result {
            Ok(Message::Text(text)) => {
                match serde_json::from_str::<WebSocketIncomingMessage>(&text) {
                    Ok(incoming) => {
                        if let Err(err) = handle_customer_ws_message(
                            &state,
                            &chat_service,
                            shop_id,
                            &customer_code,
                            &tx,
                            &mut customer,
                            &mut session,
                            incoming,
                        )
                        .await
                        {
                            warn!("Customer WS error: {err:?}");
                        }
                    }
                    Err(err) => warn!("Invalid customer payload: {err}"),
                }
            }
            Ok(Message::Close(_)) => {
                info!("Customer connection {} closed", connection_id);
                break;
            }
            Ok(Message::Ping(payload)) => {
                let _ = tx.send(Message::Pong(payload));
            }
            Ok(_) => {}
            Err(err) => {
                warn!("Customer connection error: {err}");
                break;
            }
        }
    }

    {
        let mut manager = state.connections.lock().unwrap();
        manager.remove_connection(&connection_id);
    }

    drop(tx);
    let _ = send_task.await;
}

async fn handle_staff_socket(socket: WebSocket, state: AppState, user_id: i64) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    let send_task = tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if sender.send(message).await.is_err() {
                break;
            }
        }
    });

    let chat_service = ChatService::new(&state);
    let mut connection_id: Option<String> = None;
    let mut active_shop: Option<i64> = None;

    while let Some(result) = receiver.next().await {
        match result {
            Ok(Message::Text(text)) => {
                match serde_json::from_str::<WebSocketIncomingMessage>(&text) {
                    Ok(incoming) => {
                        if let Err(err) = handle_staff_ws_message(
                            &state,
                            &chat_service,
                            user_id,
                            &tx,
                            &mut connection_id,
                            &mut active_shop,
                            incoming,
                        )
                        .await
                        {
                            warn!("Staff WS error: {err:?}");
                        }
                    }
                    Err(err) => warn!("Invalid staff payload: {err}"),
                }
            }
            Ok(Message::Close(_)) => {
                info!("Staff user {user_id} connection closing");
                break;
            }
            Ok(Message::Ping(payload)) => {
                let _ = tx.send(Message::Pong(payload));
            }
            Ok(_) => {}
            Err(err) => {
                warn!("Staff connection error: {err}");
                break;
            }
        }
    }

    if let Some(id) = connection_id {
        let mut manager = state.connections.lock().unwrap();
        manager.remove_connection(&id);
    }

    drop(tx);
    let _ = send_task.await;
}

async fn handle_customer_ws_message(
    state: &AppState,
    chat_service: &ChatService<'_>,
    shop_id: i64,
    customer_code: &str,
    outbound: &mpsc::UnboundedSender<Message>,
    customer: &mut Option<Customer>,
    session: &mut Option<Session>,
    incoming: WebSocketIncomingMessage,
) -> Result<()> {
    let meta_ref = incoming.metadata.as_ref();

    match incoming.message_type.as_str() {
        "auth" => {
            let (name, email, avatar, ip, user_agent) = extract_customer_profile(meta_ref);
            let profile = CustomerProfile {
                name: name.as_deref(),
                email: email.as_deref(),
                avatar: avatar.as_deref(),
                ip: ip.as_deref(),
                user_agent: user_agent.as_deref(),
            };

            let (cust, sess) = chat_service
                .ensure_customer_session(shop_id, customer_code, profile)
                .await?;

            *customer = Some(cust.clone());
            *session = Some(sess.clone());

            let auth_success = WebSocketMessage {
                message_type: "auth_success".to_string(),
                content: Some("认证成功，欢迎使用客服系统".to_string()),
                session_id: Some(sess.id),
                sender_id: None,
                sender_type: Some("system".to_string()),
                timestamp: Some(Utc::now()),
                metadata: Some(json!({
                    "sessionId": sess.id,
                    "customerId": cust.id,
                    "customerCode": cust.customer_id,
                    "shopId": shop_id
                })),
                file_url: None,
                file_name: None,
                file_size: None,
                media_duration: None,
            };

            if let Ok(payload) = serde_json::to_string(&auth_success) {
                let _ = outbound.send(Message::Text(payload));
            }

            let mut manager = state.connections.lock().unwrap();
            manager.broadcast_to_staff(shop_id, &auth_success);
        }
        "send_message" => {
            let (cust, sess) =
                ensure_customer_context(chat_service, shop_id, customer_code, customer, session)
                    .await?;

            let message_type = extract_message_kind(meta_ref);
            let mut metadata = incoming
                .metadata
                .clone()
                .unwrap_or_else(|| Value::Object(Map::new()));

            if let Value::Object(ref mut map) = metadata {
                map.insert("customerId".to_string(), json!(cust.id));
                map.insert("customerCode".to_string(), json!(cust.customer_id));
                map.insert("shopId".to_string(), json!(shop_id));
            }

            let payload = MessagePayload {
                content: incoming.content.clone(),
                message_type,
                file_url: incoming.file_url.clone(),
                file_name: incoming.file_name.clone(),
                file_size: incoming.file_size,
                media_duration: incoming.media_duration,
                metadata: Some(metadata),
            };

            let persisted = chat_service
                .persist_customer_message(shop_id, &cust, &sess, payload)
                .await?;

            if let Ok(payload) = serde_json::to_string(&persisted.ws_message) {
                let _ = outbound.send(Message::Text(payload.clone()));
            }

            let mut manager = state.connections.lock().unwrap();
            manager.broadcast_to_staff(shop_id, &persisted.ws_message);
        }
        "typing" => {
            if let Some(sess) = session.as_ref() {
                let mut metadata = incoming
                    .metadata
                    .clone()
                    .unwrap_or_else(|| Value::Object(Map::new()));

                if let Value::Object(ref mut map) = metadata {
                    if let Some(ref cust) = customer.as_ref() {
                        map.insert("customerId".to_string(), json!(cust.id));
                        map.insert("customerCode".to_string(), json!(cust.customer_id.clone()));
                    }
                    map.insert("shopId".to_string(), json!(shop_id));
                }

                let typing_message = WebSocketMessage {
                    message_type: "typing".to_string(),
                    content: incoming.content.clone(),
                    session_id: Some(sess.id),
                    sender_id: customer.as_ref().map(|c| c.id),
                    sender_type: Some("customer".to_string()),
                    timestamp: Some(Utc::now()),
                    metadata: Some(metadata),
                    file_url: None,
                    file_name: None,
                    file_size: None,
                    media_duration: None,
                };

                let mut manager = state.connections.lock().unwrap();
                manager.broadcast_to_staff(shop_id, &typing_message);
            }
        }
        other => {
            warn!("Unsupported customer message type: {other}");
        }
    }

    Ok(())
}

async fn handle_staff_ws_message(
    state: &AppState,
    chat_service: &ChatService<'_>,
    user_id: i64,
    outbound: &mpsc::UnboundedSender<Message>,
    connection_id: &mut Option<String>,
    active_shop: &mut Option<i64>,
    incoming: WebSocketIncomingMessage,
) -> Result<()> {
    let meta_ref = incoming.metadata.as_ref();

    match incoming.message_type.as_str() {
        "auth" => {
            let Some(shop_id) = extract_shop_id(meta_ref) else {
                warn!("Staff auth missing shop_id");
                return Ok(());
            };

            if connection_id.is_none() {
                let mut manager = state.connections.lock().unwrap();
                let id = manager.add_staff_connection(user_id, shop_id, outbound.clone());
                *connection_id = Some(id);
            }

            *active_shop = Some(shop_id);

            let auth_success = WebSocketMessage {
                message_type: "auth_success".to_string(),
                content: Some("客服认证成功".to_string()),
                session_id: None,
                sender_id: Some(user_id),
                sender_type: Some("staff".to_string()),
                timestamp: Some(Utc::now()),
                metadata: Some(json!({
                    "shopId": shop_id,
                    "userId": user_id
                })),
                file_url: None,
                file_name: None,
                file_size: None,
                media_duration: None,
            };

            if let Ok(payload) = serde_json::to_string(&auth_success) {
                let _ = outbound.send(Message::Text(payload));
            }
        }
        "send_message" => {
            let Some(session_id) = incoming.session_id else {
                warn!("Staff send_message missing session_id");
                return Ok(());
            };

            let (session, customer) = chat_service.resolve_session(session_id).await?;

            let message_type = extract_message_kind(meta_ref);
            let mut metadata = incoming
                .metadata
                .clone()
                .unwrap_or_else(|| Value::Object(Map::new()));

            if let Value::Object(ref mut map) = metadata {
                map.insert("customerId".to_string(), json!(customer.id));
                map.insert("customerCode".to_string(), json!(customer.customer_id));
                map.insert("shopId".to_string(), json!(session.shop_id));
                map.insert("staffId".to_string(), json!(user_id));
            }

            let payload = MessagePayload {
                content: incoming.content.clone(),
                message_type,
                file_url: incoming.file_url.clone(),
                file_name: incoming.file_name.clone(),
                file_size: incoming.file_size,
                media_duration: incoming.media_duration,
                metadata: Some(metadata),
            };

            let persisted = chat_service
                .persist_staff_message(&session, user_id, payload, &customer)
                .await?;

            let mut manager = state.connections.lock().unwrap();
            manager.send_to_customer(
                session.shop_id,
                &customer.customer_id,
                &persisted.ws_message,
            );
            manager.broadcast_to_staff(session.shop_id, &persisted.ws_message);
        }
        "typing" => {
            if let Some(session_id) = incoming.session_id {
                let (session, customer) = chat_service.resolve_session(session_id).await?;

                let mut metadata = incoming
                    .metadata
                    .clone()
                    .unwrap_or_else(|| Value::Object(Map::new()));

                if let Value::Object(ref mut map) = metadata {
                    map.insert("customerId".to_string(), json!(customer.id));
                    map.insert("customerCode".to_string(), json!(customer.customer_id));
                    map.insert("shopId".to_string(), json!(session.shop_id));
                    map.insert("staffId".to_string(), json!(user_id));
                }

                let typing_message = WebSocketMessage {
                    message_type: "typing".to_string(),
                    content: incoming.content.clone(),
                    session_id: Some(session_id),
                    sender_id: Some(user_id),
                    sender_type: Some("staff".to_string()),
                    timestamp: Some(Utc::now()),
                    metadata: Some(metadata),
                    file_url: None,
                    file_name: None,
                    file_size: None,
                    media_duration: None,
                };

                let mut manager = state.connections.lock().unwrap();
                manager.send_to_customer(session.shop_id, &customer.customer_id, &typing_message);
                manager.broadcast_to_staff(session.shop_id, &typing_message);
            }
        }
        other => {
            warn!("Unsupported staff message type: {other}");
        }
    }

    Ok(())
}

async fn ensure_customer_context(
    chat_service: &ChatService<'_>,
    shop_id: i64,
    customer_code: &str,
    customer: &mut Option<Customer>,
    session: &mut Option<Session>,
) -> Result<(Customer, Session)> {
    if let (Some(cust), Some(sess)) = (customer.clone(), session.clone()) {
        return Ok((cust, sess));
    }

    let profile = CustomerProfile::default();
    let (cust, sess) = chat_service
        .ensure_customer_session(shop_id, customer_code, profile)
        .await?;

    *customer = Some(cust.clone());
    *session = Some(sess.clone());
    Ok((cust, sess))
}

fn extract_customer_profile(
    metadata: Option<&Value>,
) -> (
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
) {
    let name = metadata
        .and_then(|value| value.get("customerName"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let email = metadata
        .and_then(|value| value.get("customerEmail"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let avatar = metadata
        .and_then(|value| value.get("customerAvatar"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let ip = metadata
        .and_then(|value| value.get("ipAddress"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let agent = metadata
        .and_then(|value| value.get("userAgent"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    (name, email, avatar, ip, agent)
}

fn extract_message_kind(metadata: Option<&Value>) -> String {
    metadata
        .and_then(|value| value.get("messageType"))
        .and_then(|value| value.as_str())
        .filter(|val| !val.is_empty())
        .map(|val| val.to_string())
        .unwrap_or_else(|| "text".to_string())
}

fn extract_shop_id(metadata: Option<&Value>) -> Option<i64> {
    metadata
        .and_then(|value| value.get("shopId"))
        .and_then(value_to_i64)
}

fn value_to_i64(value: &Value) -> Option<i64> {
    match value {
        Value::Number(num) => num.as_i64(),
        Value::String(text) => text.parse::<i64>().ok(),
        _ => None,
    }
}
