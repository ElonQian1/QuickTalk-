use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use std::fmt;

#[derive(Debug, Serialize)]
pub struct ErrorBody<'a> {
    pub code: &'a str,
    pub message: &'a str,
}

#[derive(Debug)]
pub enum AppError {
    Unauthorized,
    Forbidden,
    NotFound,
    BadRequest(String),
    Internal(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Unauthorized => write!(f, "Unauthorized"),
            AppError::Forbidden => write!(f, "Forbidden"),
            AppError::NotFound => write!(f, "Resource not found"),
            AppError::BadRequest(msg) => write!(f, "Bad request: {}", msg),
            AppError::Internal(msg) => write!(f, "Internal error: {}", msg),
        }
    }
}

impl std::error::Error for AppError {}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        match &self {
            AppError::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                Json(ErrorBody {
                    code: "UNAUTHORIZED",
                    message: "Unauthorized",
                }),
            )
                .into_response(),
            AppError::Forbidden => (
                StatusCode::FORBIDDEN,
                Json(ErrorBody {
                    code: "FORBIDDEN",
                    message: "Forbidden",
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
