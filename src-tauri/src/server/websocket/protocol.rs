use super::{
    common::{call_error, db_error, decode, log_message, CallError},
    meter_values::save_meter_values,
    transactions::{start_transaction, stop_transaction, update_status},
};
use crate::entities::{chargers, connectors, ocpp_transactions, sessions};
use chrono::Utc;
use rust_ocpp::v1_6::messages;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
pub(super) async fn handle_text_message(
    text: &str,
    charger_id: &str,
    db: &DatabaseConnection,
    app: &AppHandle,
    boot_accepted: &mut bool,
) -> Option<String> {
    let frame: Value = match serde_json::from_str(text) {
        Ok(frame) => frame,
        Err(error) => {
            eprintln!("Invalid OCPP JSON frame: {error}");
            return None;
        }
    };
    let Some(parts) = frame.as_array() else {
        eprintln!("Invalid OCPP-J frame: expected an array");
        return None;
    };
    if parts.first().and_then(Value::as_u64) != Some(2) {
        eprintln!("Ignoring charger frame that is not an OCPP-J CALL");
        return None;
    }
    let message_id = parts.get(1).and_then(Value::as_str).unwrap_or_default();
    let action = parts.get(2).and_then(Value::as_str).unwrap_or_default();
    let payload = parts.get(3).cloned().unwrap_or(Value::Null);
    if message_id.is_empty() || action.is_empty() || !payload.is_object() {
        return Some(call_error(
            message_id,
            "FormationViolation",
            "CALL must include message id, action, and object payload",
            json!({}),
        ));
    }
    if !*boot_accepted && action != "BootNotification" {
        return Some(call_error(
            message_id,
            "FormationViolation",
            "BootNotification must be the first OCPP request after connecting",
            json!({}),
        ));
    }
    log_message(
        db,
        charger_id,
        "charger_to_server",
        action,
        message_id,
        &payload,
    )
    .await;

    let result = dispatch(action, &payload, charger_id, db).await;
    let changes_live_state = matches!(
        action,
        "BootNotification"
            | "Heartbeat"
            | "MeterValues"
            | "StartTransaction"
            | "StatusNotification"
            | "StopTransaction"
    );
    let accepted_boot = action != "BootNotification"
        || result
            .as_ref()
            .map(|response| response["status"] == "Accepted")
            .unwrap_or(false);
    if result.is_ok() && changes_live_state && accepted_boot {
        let session_update = if action == "MeterValues" {
            live_meter_update(db, &payload).await
        } else {
            None
        };
        if let Err(error) = app.emit(
            "charger-state-updated",
            json!({"chargerId":charger_id,"action":action,"sessionUpdate":session_update}),
        ) {
            eprintln!("Failed to notify the app about charger state: {error}");
        }
    }
    let reply = match result {
        Ok(response) => json!([3, message_id, response]).to_string(),
        Err((code, description, details)) => call_error(message_id, &code, &description, details),
    };
    if action == "BootNotification"
        && serde_json::from_str::<Value>(&reply)
            .ok()
            .is_some_and(|frame| {
                frame
                    .get(2)
                    .is_some_and(|payload| payload["status"] == "Accepted")
            })
    {
        *boot_accepted = true;
    }
    if let Ok(reply_frame) = serde_json::from_str::<Value>(&reply) {
        let reply_action = if reply_frame[0] == 3 {
            format!("{action}.conf")
        } else {
            "CALLERROR".to_owned()
        };
        log_message(
            db,
            charger_id,
            "server_to_charger",
            &reply_action,
            message_id,
            &reply_frame,
        )
        .await;
    }
    Some(reply)
}

pub(super) async fn live_meter_update(db: &DatabaseConnection, payload: &Value) -> Option<Value> {
    let transaction_id = payload.get("transactionId")?.as_i64()?;
    let transaction = ocpp_transactions::Entity::find_by_id(transaction_id)
        .one(db)
        .await
        .ok()??;
    let session = sessions::Entity::find_by_id(transaction.session_id)
        .one(db)
        .await
        .ok()??;
    let energy_wh = session
        .energy_wh
        .or(session.last_energy_wh)
        .unwrap_or_default();
    let power_w = session.last_power_w.unwrap_or_default();
    let currency = session.currency.unwrap_or_default();
    let cost_value = session
        .rate_snapshot_minor_per_kwh
        .map(|rate| energy_wh as f64 / 1000.0 * rate / 100.0);
    let cost = cost_value
        .map(|amount| format!("{currency} {amount:.2}"))
        .unwrap_or_else(|| "—".into());
    Some(json!({
        "id": session.id,
        "last_energy_wh": energy_wh,
        "last_power_w": power_w,
        "last_reading_at": session.last_reading_at.unwrap_or_default(),
        "energy": format!("{:.3} kWh", energy_wh as f64 / 1000.0),
        "power": if power_w > 0 { format!("{:.2} kW", power_w as f64 / 1000.0) } else { "—".into() },
        "cost_value": cost_value,
        "cost": cost,
    }))
}

pub(super) async fn dispatch(
    action: &str,
    payload: &Value,
    charger_id: &str,
    db: &DatabaseConnection,
) -> Result<Value, CallError> {
    match action {
        "Authorize" => {
            let _: messages::authorize::AuthorizeRequest = decode(payload)?;
            Ok(json!({"idTagInfo":{"status":"Accepted"}}))
        }
        "BootNotification" => {
            let request: messages::boot_notification::BootNotificationRequest = decode(payload)?;
            let now = Utc::now().to_rfc3339();
            let model = chargers::Entity::find_by_id(charger_id)
                .one(db)
                .await
                .map_err(db_error)?
                .ok_or_else(|| {
                    (
                        "InternalError".into(),
                        "Registered charger disappeared during boot".into(),
                        json!({}),
                    )
                })?;
            let vendor_missing = model.vendor.as_deref().map_or(true, str::is_empty);
            let model_missing = model.model.as_deref().map_or(true, str::is_empty);
            let serial_missing = model.serial_number.is_empty();
            let firmware_missing = model
                .firmware_version
                .as_deref()
                .map_or(true, str::is_empty);
            let serial = request.charge_point_serial_number.as_deref();
            let mismatch =
                model.vendor.as_deref().is_some_and(|stored| {
                    !stored.is_empty() && stored != request.charge_point_vendor
                }) || model.model.as_deref().is_some_and(|stored| {
                    !stored.is_empty() && stored != request.charge_point_model
                }) || serial.is_some_and(|reported| {
                    !model.serial_number.is_empty() && model.serial_number != reported
                }) || request.firmware_version.as_deref().is_some_and(|reported| {
                    model
                        .firmware_version
                        .as_deref()
                        .is_some_and(|stored| !stored.is_empty() && stored != reported)
                });
            if mismatch {
                return Ok(json!({
                    "currentTime": now,
                    "interval": 300,
                    "status": "Rejected"
                }));
            }
            let mut charger: chargers::ActiveModel = model.into();
            charger.is_online = Set(1);
            if vendor_missing {
                charger.vendor = Set(Some(request.charge_point_vendor));
            }
            if model_missing {
                charger.model = Set(Some(request.charge_point_model));
            }
            charger.last_heartbeat_at = Set(Some(now.clone()));
            if let Some(serial) = request.charge_point_serial_number {
                if serial_missing {
                    charger.serial_number = Set(serial);
                }
            }
            if let Some(firmware) = request.firmware_version {
                if firmware_missing {
                    charger.firmware_version = Set(Some(firmware));
                }
            }
            charger.last_boot_at = Set(Some(now.clone()));
            charger.updated_at = Set(now.clone());
            charger.update(db).await.map_err(db_error)?;
            // Connector state is persisted across app restarts, but may no
            // longer reflect the charger after it reconnects. Start from a
            // safe idle display until fresh StatusNotifications arrive.

            connectors::Entity::update_many()
                .col_expr(
                    connectors::Column::Status,
                    sea_orm::sea_query::Expr::value("Available".to_owned()),
                )
                .col_expr(
                    connectors::Column::PowerKw,
                    sea_orm::sea_query::Expr::value(0.0_f64),
                )
                .col_expr(
                    connectors::Column::StatusUpdatedAt,
                    sea_orm::sea_query::Expr::value(now.clone()),
                )
                .filter(connectors::Column::ChargerId.eq(charger_id))
                .exec(db)
                .await
                .map_err(db_error)?;
            Ok(json!({"currentTime":now,"interval":60,"status":"Accepted"}))
        }
        "DataTransfer" => {
            let request: messages::data_transfer::DataTransferRequest = decode(payload)?;
            let status = if request.vendor_string.eq_ignore_ascii_case("grems") {
                "Accepted"
            } else {
                "UnknownVendorId"
            };
            Ok(json!({"status":status}))
        }
        "DiagnosticsStatusNotification" => {
            let _: messages::diagnostics_status_notification::DiagnosticsStatusNotificationRequest =
                decode(payload)?;
            Ok(json!({}))
        }
        "FirmwareStatusNotification" => {
            let _: messages::firmware_status_notification::FirmwareStatusNotificationRequest =
                decode(payload)?;
            Ok(json!({}))
        }
        "Heartbeat" => {
            let _: messages::heart_beat::HeartbeatRequest = decode(payload)?;
            let now = Utc::now().to_rfc3339();
            chargers::Entity::update_many()
                .col_expr(
                    chargers::Column::IsOnline,
                    sea_orm::sea_query::Expr::value(1),
                )
                .col_expr(
                    chargers::Column::LastHeartbeatAt,
                    sea_orm::sea_query::Expr::value(now.clone()),
                )
                .filter(chargers::Column::Id.eq(charger_id))
                .exec(db)
                .await
                .map_err(db_error)?;
            Ok(json!({"currentTime":now}))
        }
        "MeterValues" => {
            let request: messages::meter_values::MeterValuesRequest = decode(payload)?;
            save_meter_values(db, charger_id, &request).await?;
            Ok(json!({}))
        }
        "StartTransaction" => {
            let request: messages::start_transaction::StartTransactionRequest = decode(payload)?;
            start_transaction(db, charger_id, request).await
        }
        "StatusNotification" => {
            let request: messages::status_notification::StatusNotificationRequest =
                decode(payload)?;
            update_status(db, charger_id, request).await?;
            Ok(json!({}))
        }
        "StopTransaction" => {
            let request: messages::stop_transaction::StopTransactionRequest = decode(payload)?;
            stop_transaction(db, request).await?;
            Ok(json!({}))
        }
        _ => Err((
            "NotImplemented".into(),
            format!("OCPP 1.6 action {action} is not supported"),
            json!({}),
        )),
    }
}
