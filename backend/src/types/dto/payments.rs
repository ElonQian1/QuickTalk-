use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[allow(dead_code)]
#[derive(Deserialize, Debug, Clone)]
pub struct CreatePaymentOrderRequest { pub shop_id: String, pub payment_method: String, pub subscription_type: String, pub subscription_duration: i32, pub amount: f64, pub currency: Option<String> }

#[derive(Deserialize, Debug, Clone)]
pub struct ActivationPaymentRequest { pub payment_method: String }

#[allow(dead_code)]
#[derive(Deserialize, Debug, Clone)]
pub struct NewPayment { pub shop_id: String, pub amount: f64, pub currency: String }

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ActivationOrderResponse { pub order_id: String, pub shop_id: String, pub shop_name: String, pub order_number: String, pub amount: f64, pub currency: String, pub expires_at: DateTime<Utc> }

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ActivationQRResponse { pub order_id: String, pub qr_code_url: String, pub amount: f64, pub payment_method: String }

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ActivationOrderStatusResponse { pub order: crate::types::entities::ActivationOrder }
