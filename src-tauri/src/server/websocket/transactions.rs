use super::common::{db_error, CallError};
use crate::entities::{chargers, connectors, ocpp_transactions, sessions};
use chrono::Utc;
use rust_ocpp::v1_6::messages;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
};
use serde_json::{json, Value};
use uuid::Uuid;
pub(super) async fn update_status(
    db: &DatabaseConnection,
    charger_id: &str,
    request: messages::status_notification::StatusNotificationRequest,
) -> Result<(), CallError> {
    let now = request
        .timestamp
        .map(|value| value.to_rfc3339())
        .unwrap_or_else(|| Utc::now().to_rfc3339());
    if request.connector_id == 0 {
        return Ok(());
    }
    let status = serde_json::to_value(request.status)
        .unwrap_or(Value::Null)
        .as_str()
        .unwrap_or("Unavailable")
        .to_owned();
    let error = serde_json::to_value(request.error_code)
        .unwrap_or(Value::Null)
        .as_str()
        .unwrap_or("NoError")
        .to_owned();
    let connector_number = request.connector_id as i64;
    let existing_connector = connectors::Entity::find()
        .filter(connectors::Column::ChargerId.eq(charger_id))
        .filter(connectors::Column::ConnectorNumber.eq(connector_number))
        .one(db)
        .await
        .map_err(db_error)?;
    if existing_connector.is_none() {
        connectors::ActiveModel {
            id: Set(Uuid::now_v7().to_string()),
            charger_id: Set(charger_id.to_owned()),
            connector_number: Set(connector_number),
            connector_type: Set("[]".to_owned()),
            power_kw: Set(Some(0.0)),
            allowed_power_kw: Set(Some(22.0)),
            status: Set(status.clone()),
            error_code: Set(if error == "NoError" {
                None
            } else {
                Some(error.clone())
            }),
            status_updated_at: Set(Some(now.clone())),
        }
        .insert(db)
        .await
        .map_err(db_error)?;
        if let Some(model) = chargers::Entity::find_by_id(charger_id.to_owned())
            .one(db)
            .await
            .map_err(db_error)?
        {
            if connector_number > model.connector_count {
                let mut charger: chargers::ActiveModel = model.into();
                charger.connector_count = Set(connector_number);
                charger.updated_at = Set(now.clone());
                charger.update(db).await.map_err(db_error)?;
            }
        }
    }
    connectors::Entity::update_many()
        .col_expr(
            connectors::Column::Status,
            sea_orm::sea_query::Expr::value(status.clone()),
        )
        .col_expr(
            connectors::Column::ErrorCode,
            sea_orm::sea_query::Expr::value(if error == "NoError" {
                None::<String>
            } else {
                Some(error)
            }),
        )
        .col_expr(
            connectors::Column::StatusUpdatedAt,
            sea_orm::sea_query::Expr::value(now.clone()),
        )
        .filter(connectors::Column::ChargerId.eq(charger_id))
        .filter(connectors::Column::ConnectorNumber.eq(connector_number))
        .exec(db)
        .await
        .map_err(db_error)?;
    if matches!(
        status.as_str(),
        "Available" | "Finishing" | "Unavailable" | "Faulted"
    ) {
        if let Some(connector) = connectors::Entity::find()
            .filter(connectors::Column::ChargerId.eq(charger_id))
            .filter(connectors::Column::ConnectorNumber.eq(request.connector_id as i64))
            .one(db)
            .await
            .map_err(db_error)?
        {
            end_active_sessions_for_connectors(db, vec![connector.id], &now, "Other").await?;
        }
    }
    Ok(())
}

pub(super) async fn end_active_sessions_for_charger(
    db: &DatabaseConnection,
    charger_id: &str,
    ended_at: &str,
    stop_reason: &str,
) -> Result<(), CallError> {
    let connector_ids = connectors::Entity::find()
        .filter(connectors::Column::ChargerId.eq(charger_id))
        .all(db)
        .await
        .map_err(db_error)?
        .into_iter()
        .map(|connector| connector.id)
        .collect::<Vec<_>>();
    end_active_sessions_for_connectors(db, connector_ids, ended_at, stop_reason).await
}

pub(super) async fn end_active_sessions_for_connectors(
    db: &DatabaseConnection,
    connector_ids: Vec<String>,
    ended_at: &str,
    stop_reason: &str,
) -> Result<(), CallError> {
    if connector_ids.is_empty() {
        return Ok(());
    }
    let active_sessions = sessions::Entity::find()
        .filter(sessions::Column::ConnectorId.is_in(connector_ids))
        .filter(sessions::Column::EndedAt.is_null())
        .all(db)
        .await
        .map_err(db_error)?;
    for session in active_sessions {
        let mut active: sessions::ActiveModel = session.into();
        active.status = Set("Completed".into());
        active.ended_at = Set(Some(ended_at.to_owned()));
        active.stop_reason = Set(Some(stop_reason.to_owned()));
        active.updated_at = Set(ended_at.to_owned());
        active.update(db).await.map_err(db_error)?;
    }
    Ok(())
}

pub(super) async fn start_transaction(
    db: &DatabaseConnection,
    charger_id: &str,
    request: messages::start_transaction::StartTransactionRequest,
) -> Result<Value, CallError> {
    let connector = connectors::Entity::find()
        .filter(connectors::Column::ChargerId.eq(charger_id))
        .filter(connectors::Column::ConnectorNumber.eq(request.connector_id as i64))
        .one(db)
        .await
        .map_err(db_error)?;
    let Some(connector) = connector else {
        return Ok(json!({"transactionId":0,"idTagInfo":{"status":"Invalid"}}));
    };
    let now = request.timestamp.to_rfc3339();
    let session_id = Uuid::now_v7().to_string();
    let session = sessions::ActiveModel {
        id: Set(session_id.clone()),
        connector_id: Set(connector.id.clone()),
        origin: Set("charger".into()),
        billable: Set(1),
        hold_id: Set(None),
        command_id: Set(None),
        id_tag: Set(Some(request.id_tag)),
        ocpp_transaction_id: Set(None),
        status: Set("Charging".into()),
        tariff_id: Set(None),
        rate_snapshot_minor_per_kwh: Set(None),
        currency: Set(None),
        meter_start_wh: Set(Some(request.meter_start as i64)),
        meter_stop_wh: Set(None),
        energy_wh: Set(Some(0)),
        last_energy_wh: Set(Some(0)),
        last_power_w: Set(None),
        last_reading_at: Set(Some(now.clone())),
        started_at: Set(Some(now.clone())),
        ended_at: Set(None),
        stop_reason: Set(None),
        overshoot_wh: Set(0),
        created_at: Set(now.clone()),
        updated_at: Set(now.clone()),
    };
    session.insert(db).await.map_err(db_error)?;
    let tx = ocpp_transactions::ActiveModel {
        transaction_id: Default::default(),
        session_id: Set(session_id.clone()),
    }
    .insert(db)
    .await
    .map_err(db_error)?;
    let mut active: sessions::ActiveModel = sessions::Entity::find_by_id(session_id)
        .one(db)
        .await
        .map_err(db_error)?
        .ok_or_else(|| {
            (
                "InternalError".into(),
                "Created session could not be reloaded".into(),
                json!({}),
            )
        })?
        .into();
    active.ocpp_transaction_id = Set(Some(tx.transaction_id));
    active.update(db).await.map_err(db_error)?;
    connectors::Entity::update_many()
        .col_expr(
            connectors::Column::Status,
            sea_orm::sea_query::Expr::value("Charging".to_owned()),
        )
        .col_expr(
            connectors::Column::StatusUpdatedAt,
            sea_orm::sea_query::Expr::value(now),
        )
        .filter(connectors::Column::Id.eq(connector.id))
        .exec(db)
        .await
        .map_err(db_error)?;
    Ok(json!({"transactionId":tx.transaction_id,"idTagInfo":{"status":"Accepted"}}))
}

pub(super) async fn stop_transaction(
    db: &DatabaseConnection,
    request: messages::stop_transaction::StopTransactionRequest,
) -> Result<(), CallError> {
    let tx = ocpp_transactions::Entity::find_by_id(request.transaction_id as i64)
        .one(db)
        .await
        .map_err(db_error)?;
    let Some(tx) = tx else {
        return Ok(());
    };
    let session = sessions::Entity::find_by_id(tx.session_id)
        .one(db)
        .await
        .map_err(db_error)?;
    let Some(session) = session else {
        return Ok(());
    };
    let connector_id = session.connector_id.clone();
    let mut active: sessions::ActiveModel = session.into();
    let ended = request.timestamp.to_rfc3339();
    let start = active.meter_start_wh.clone().unwrap().unwrap_or_default();
    active.status = Set("Completed".into());
    active.meter_stop_wh = Set(Some(request.meter_stop as i64));
    active.energy_wh = Set(Some((request.meter_stop as i64 - start).max(0)));
    active.ended_at = Set(Some(ended.clone()));
    active.stop_reason = Set(request.reason.map(|r| {
        serde_json::to_value(r)
            .unwrap_or(Value::Null)
            .as_str()
            .unwrap_or("Other")
            .to_owned()
    }));
    active.updated_at = Set(ended.clone());
    active.update(db).await.map_err(db_error)?;
    connectors::Entity::update_many()
        .col_expr(
            connectors::Column::Status,
            sea_orm::sea_query::Expr::value("Available".to_owned()),
        )
        .col_expr(
            connectors::Column::StatusUpdatedAt,
            sea_orm::sea_query::Expr::value(ended),
        )
        .filter(connectors::Column::Id.eq(connector_id))
        .exec(db)
        .await
        .map_err(db_error)?;
    Ok(())
}
