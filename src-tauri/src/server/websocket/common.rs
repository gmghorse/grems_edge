use crate::entities::ocpp_message_log;
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ActiveValue::Set, DatabaseConnection};
use serde::de::DeserializeOwned;
use serde_json::{json, Value};
pub(super) type CallError = (String, String, Value);

pub(super) fn call_error(id: &str, code: &str, description: &str, details: Value) -> String {
    json!([4, id, code, description, details]).to_string()
}

pub(super) async fn log_message(
    db: &DatabaseConnection,
    charger_id: &str,
    direction: &str,
    action: &str,
    message_id: &str,
    payload: &Value,
) {
    let _ = ocpp_message_log::ActiveModel {
        id: Default::default(),
        charger_id: Set(Some(charger_id.to_owned())),
        direction: Set(direction.to_owned()),
        action: Set(Some(action.to_owned())),
        message_id: Set(Some(message_id.to_owned())),
        payload: Set(Some(payload.to_string())),
        logged_at: Set(Utc::now().to_rfc3339()),
    }
    .insert(db)
    .await;
}

pub(super) fn decode<T: DeserializeOwned>(payload: &Value) -> Result<T, CallError> {
    serde_json::from_value(payload.clone()).map_err(|error| {
        (
            "FormationViolation".into(),
            "Request payload does not match the OCPP 1.6 schema".into(),
            json!({"error": error.to_string()}),
        )
    })
}

pub(super) fn db_error(error: sea_orm::DbErr) -> CallError {
    (
        "InternalError".into(),
        "Failed to persist charger message".into(),
        json!({"error":error.to_string()}),
    )
}
