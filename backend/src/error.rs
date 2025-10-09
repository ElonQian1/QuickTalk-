use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ErrorBody<'a> {
    pub code: &'a str,
    pub message: &'a str,
}

#[derive(Debug)]
pub enum AppError {
    Unauthorized,
    NotFound,
    BadRequest(&'static str),
    Internal(&'static str),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        match self {
            AppError::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                Json(ErrorBody {
                    code: "UNAUTHORIZED",
                    message: "Unauthorized",
                }),
            )
                .into_response(),
            AppError::NotFound => (
                StatusCode::NOT_FOUND,
                Json(ErrorBody {
                    code: "NOT_FOUND",
                    message: "Resource not found",
                }),
            )
                .into_response(),
            AppError::BadRequest(msg) => (
                StatusCode::BAD_REQUEST,
                Json(ErrorBody {
                    code: "BAD_REQUEST",
                    message: msg,
                }),
            )
                .into_response(),
            AppError::Internal(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorBody {
                    code: "INTERNAL_ERROR",
                    message: msg,
                }),
            )
                .into_response(),
        }
    }
}
