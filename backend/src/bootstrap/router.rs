use axum::{Router};
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::{cors::CorsLayer, services::ServeDir, trace::TraceLayer};

use crate::bootstrap::app_state::AppState;
use crate::api;
use crate::web;
use crate::ws;
use crate::api::admin::{admin_login, admin_register, get_account_stats, recover_super_admin, admin_logout, admin_change_password, admin_me, admin_update_profile};
use crate::api::conversations::{get_conversations, get_messages, get_message_by_id, search_conversations, create_conversation, get_conversation_details, update_conversation_status, get_conversation_summary, send_message, update_message, delete_message, mark_conversation_read};
use crate::api::ddd_conversations::send_message_handler;
use crate::api::events::replay_events;
use crate::api::uploads::{upload_file, list_uploaded_files};
use crate::api::employees::{
    get_employees, add_employee, remove_employee, update_employee_role, search_users,
    get_user_profile, invite_employee, get_employee_invitations, accept_invitation,
    reject_invitation,
};
use crate::api::integrations::generate_integration_code;
use crate::api::payments::{generate_activation_payment_qr, get_activation_order_status, mock_activation_payment_success};
use crate::api::shops::{
    search_shops, check_domain, delete_shop, rotate_api_key, get_shops, create_shop, update_shop, get_shop_details,
    approve_shop, reject_shop, activate_shop, deactivate_shop, create_shop_activation_order, debug_shops
};
use crate::api::workbench::get_workbench_summary;
use crate::api::user::{
    get_current_user_profile, update_user_profile, change_password_proxy,
    get_notification_settings, update_notification_settings, dashboard_stats
};
use crate::auth::auth_session_info;
use crate::api::system::{fix_shop_owners, validate_shop_data_integrity, clean_test_data, force_clean_shops, reset_database, create_test_user, state_summary, whoami, diagnose_owner_mismatch};
use axum::routing::{get, post, delete, put};

pub async fn build_app(db: SqlitePool) -> Router {
    let (message_sender, _) = broadcast::channel(100);
    let state = Arc::new(AppState::new(db, message_sender));

    Router::new()
        .route("/", get(web::serve_index))
        .route("/admin", get(web::serve_admin))
        .route("/mobile/admin", get(web::serve_mobile_admin))
        .route("/mobile/admin/react", get(crate::api::react_routes::serve_react_mobile_admin))
        .route("/mobile/admin/legacy", get(crate::api::react_routes::serve_legacy_mobile_admin))
    .route("/mobile/dashboard", get(web::serve_mobile_dashboard))
        .route("/mobile/login", get(web::serve_mobile_login))
        .route("/ws", get(ws::websocket_handler))
        .route("/api/health", get(api::health::health_check))
        .route("/embed/config/:shop_id", get(api::health::get_embed_config))
        .route("/embed/service.js", get(web::serve_embed_service))
        .route("/embed/styles.css", get(web::serve_embed_styles))
        .route("/api/shops", get(get_shops).post(create_shop))
    .route("/api/shops/debug", get(debug_shops))
    .route("/api/shops/orphans", get(api::shops::list_orphan_shops))
    .route("/api/shops/reassign-owner", post(api::shops::reassign_shop_owner))
        .route("/api/shops/search", get(search_shops))
        .route("/api/shops/check-domain", get(check_domain))
        .route("/api/shops/:id", get(get_shop_details).put(update_shop).delete(delete_shop))
        .route("/api/shops/:id/rotate-api-key", post(rotate_api_key))
        .route("/api/shops/:id/approve", post(approve_shop))
        .route("/api/shops/:id/reject", post(reject_shop))
        .route("/api/shops/:id/activate", post(activate_shop))
        .route("/api/shops/:id/deactivate", post(deactivate_shop))
        .route("/api/shops/:id/activation-order", post(create_shop_activation_order))
        .route("/api/shops/:shop_id/employees", get(get_employees).post(add_employee))
        .route("/api/shops/:shop_id/employees/:employee_id", delete(remove_employee).put(update_employee_role))
        .route("/api/users/search", get(search_users))
        .route("/api/users/:user_id", get(get_user_profile))
        .route("/api/shops/:shop_id/invitations", get(get_employee_invitations).post(invite_employee))
        .route("/api/invitations/:token/accept", post(accept_invitation))
        .route("/api/invitations/:token/reject", post(reject_invitation))
        .route("/api/integrations/generate", post(generate_integration_code))
    .route("/api/payments/activation/qr", post(generate_activation_payment_qr))
    .route("/api/payments/activation/status", get(get_activation_order_status))
    .route("/api/payments/activation/mock-success", post(mock_activation_payment_success))
    // 前端兼容路由（推荐使用 activation-orders/:order_id/* 形式，与 Path(order_id) 匹配）
    .route("/api/activation-orders/:order_id/qrcode", post(generate_activation_payment_qr))
    .route("/api/activation-orders/:order_id/status", get(get_activation_order_status))
    .route("/api/activation-orders/:order_id/mock-success", post(mock_activation_payment_success))
        .route("/api/conversations", get(get_conversations).post(create_conversation))
        .route("/api/conversations/search", get(search_conversations))
        .route("/api/conversations/:id", get(get_conversation_details))
        .route("/api/conversations/:id/messages", get(get_messages).post(send_message))
        // DDD 风格的 API 端点
        .route("/api/ddd/conversations/:id/messages", post(send_message_handler))
    .route("/api/messages/:message_id", get(get_message_by_id))
        .route("/api/conversations/:id/messages/:message_id", put(update_message).delete(delete_message))
        .route("/api/conversations/:id/status", put(update_conversation_status))
        .route("/api/conversations/:id/summary", get(get_conversation_summary))
        .route("/api/conversations/:id/read", post(mark_conversation_read))
    .route("/api/events/replay", get(replay_events))
        .route("/api/workbench/summary", get(get_workbench_summary))
    // 兼容旧前端：用户信息与仪表盘
    .route("/api/user/profile", get(get_current_user_profile).put(update_user_profile))
    .route("/api/user/change-password", post(change_password_proxy))
    .route("/api/user/notification-settings", get(get_notification_settings).put(update_notification_settings))
    .route("/api/dashboard/stats", get(dashboard_stats))
        .route("/api/upload", post(upload_file))
        .route("/api/uploads", get(list_uploaded_files))
        .route("/api/admin/login", post(admin_login))
    .route("/api/admin/register", post(admin_register))
    .route("/api/admin/logout", post(admin_logout))
        .route("/api/admin/stats", get(get_account_stats))
    .route("/api/admin/change-password", post(admin_change_password))
    .route("/api/auth/change-password", post(admin_change_password))
        .route("/api/admin/me", get(admin_me))
        .route("/api/auth/me", get(admin_me))
    .route("/api/auth/session", get(auth_session_info))
        .route("/api/admin/profile", post(admin_update_profile))
        .route("/api/auth/profile", post(admin_update_profile))
        .route("/api/admin/recover-super-admin", post(recover_super_admin))
        .route("/api/system/fix-owners", post(fix_shop_owners))
        .route("/api/system/validate", get(validate_shop_data_integrity))
    .route("/api/system/state-summary", get(state_summary))
    .route("/api/system/whoami", get(whoami))
    .route("/api/system/diagnose-owner", get(diagnose_owner_mismatch))
        .route("/api/system/clean-test-data", post(clean_test_data))
        .route("/api/system/force-clean-shops", post(force_clean_shops))
        .route("/api/system/reset-database", post(reset_database))
        .route("/api/system/create-test-user", post(create_test_user))
        .route("/api/auth/login", post(admin_login))
    .route("/api/auth/register", post(admin_register))
    .route("/api/auth/logout", post(admin_logout))
        .nest_service("/css", ServeDir::new("presentation/static/css"))
        .nest_service("/js", ServeDir::new("presentation/static/js"))
        .nest_service("/assets", ServeDir::new("presentation/static/assets"))
        .nest_service("/static", ServeDir::new("presentation/static"))
        .nest_service("/uploads", ServeDir::new("uploads"))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
