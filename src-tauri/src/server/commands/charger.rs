use crate::entities::sessions as session_entity;
use crate::{
    entities::chargers as charger_entity, entities::connectors as connector_entity, AppState,
};
use sea_orm::{ActiveModelTrait, ActiveValue::Set, DatabaseConnection, EntityTrait};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

/// A row from the `chargers` table in `grems_edge.db`.
///
/// `is_active` and `is_online` are SQLite INTEGER flags (0 or 1), and
/// `connector_types` is the JSON text stored in that column.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Charger {
    #[serde(default)]
    pub id: String,
    pub ocpp_identity: String,
    pub serial_number: String,
    pub vendor: Option<String>,
    pub model: Option<String>,
    pub firmware_version: Option<String>,
    pub auth_password_hash: Option<String>,
    pub is_active: i64,
    pub is_online: i64,
    pub last_heartbeat_at: Option<String>,
    pub last_boot_at: Option<String>,
    pub stop_latency_ms: i64,
    pub updated_at: String,
    pub name: String,
    pub connector_count: i64,
    pub connector_types: String,
    pub power: Option<f64>,
}

impl From<charger_entity::Model> for Charger {
    fn from(m: charger_entity::Model) -> Self {
        Self {
            id: m.id,
            ocpp_identity: m.ocpp_identity,
            serial_number: m.serial_number,
            vendor: m.vendor,
            model: m.model,
            firmware_version: m.firmware_version,
            auth_password_hash: m.auth_password_hash,
            is_active: m.is_active,
            is_online: m.is_online,
            last_heartbeat_at: m.last_heartbeat_at,
            last_boot_at: m.last_boot_at,
            stop_latency_ms: m.stop_latency_ms,
            updated_at: m.updated_at,
            name: m.name,
            connector_count: m.connector_count,
            connector_types: m.connector_types,
            power: m.power,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChargerWithConnectors {
    pub charger: Charger,
    pub connectors: Vec<Connector>,
}

#[tauri::command]
pub async fn load_chargers(
    state: State<'_, AppState>,
) -> Result<Vec<ChargerWithConnectors>, String> {
    let chargers = charger_entity::Entity::find()
        .all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    let connectors = connector_entity::Entity::find()
        .all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    let mut records = chargers
        .into_iter()
        .map(|charger| {
            let id = charger.id.clone();
            (
                id,
                ChargerWithConnectors {
                    charger: charger.into(),
                    connectors: Vec::new(),
                },
            )
        })
        .collect::<std::collections::HashMap<_, _>>();
    for connector in connectors {
        if let Some(record) = records.get_mut(&connector.charger_id) {
            record.connectors.push(connector.into());
        }
    }
    let mut records = records.into_values().collect::<Vec<_>>();
    for record in &mut records {
        record
            .connectors
            .sort_by_key(|connector| connector.connector_number);
    }
    records.sort_by(|a, b| a.charger.name.cmp(&b.charger.name));
    Ok(records)
}

#[derive(Clone, Debug, Serialize)]
pub struct LiveSession {
    pub id: String,
    pub charger: String,
    pub connector_id: String,
    pub connector_number: i64,
    pub user: String,
    pub origin: String,
    pub hold_id: String,
    pub command_id: String,
    pub billable: bool,
    pub ocpp_transaction_id: String,
    pub tariff_id: String,
    pub rate_snapshot_minor_per_kwh: f64,
    pub start_time: String,
    pub end_time: String,
    pub meter_start_wh: i64,
    pub currency: String,
    pub last_energy_wh: i64,
    pub last_power_w: i64,
    pub last_reading_at: String,
    pub time: String,
    pub duration: String,
    pub energy: String,
    pub power: String,
    pub cost: String,
    pub cost_value: Option<f64>,
    pub status: String,
    pub stop_reason: String,
    pub overshoot_wh: i64,
}

#[tauri::command]
pub async fn load_sessions(state: State<'_, AppState>) -> Result<Vec<LiveSession>, String> {
    let sessions = session_entity::Entity::find()
        .all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    let connectors = connector_entity::Entity::find()
        .all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    let chargers = charger_entity::Entity::find()
        .all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    let charger_details = chargers
        .into_iter()
        .map(|charger| (charger.id, (charger.ocpp_identity, charger.name)))
        .collect::<std::collections::HashMap<_, _>>();
    let connector_lookup = connectors
        .into_iter()
        .map(|connector| (connector.id.clone(), connector))
        .collect::<std::collections::HashMap<_, _>>();

    let mut result = sessions
        .into_iter()
        .map(|session| {
            let connector = connector_lookup.get(&session.connector_id);
            let (charger_identity, charger_name) = connector
                .and_then(|c| charger_details.get(&c.charger_id))
                .cloned()
                .unwrap_or_else(|| ("Unknown charger".into(), String::new()));
            let start_time = session
                .started_at
                .clone()
                .unwrap_or_else(|| session.created_at.clone());
            let end_time = session
                .ended_at
                .clone()
                .or_else(|| session.last_reading_at.clone())
                .unwrap_or_else(|| start_time.clone());
            let duration_secs = chrono::DateTime::parse_from_rfc3339(&end_time)
                .ok()
                .zip(chrono::DateTime::parse_from_rfc3339(&start_time).ok())
                .map(|(end, start)| (end - start).num_seconds().max(0))
                .unwrap_or(0);
            let energy_wh = session
                .energy_wh
                .or(session.last_energy_wh)
                .unwrap_or_default();
            let power_w = session.last_power_w.unwrap_or_default();
            let energy_kwh = energy_wh as f64 / 1000.0;
            let rate = session.rate_snapshot_minor_per_kwh.unwrap_or_default();
            let cost = session
                .rate_snapshot_minor_per_kwh
                .map(|rate| energy_kwh * rate / 100.0);
            let currency = session.currency.clone().unwrap_or_default();
            let live =
                session.status.eq_ignore_ascii_case("Charging") || session.ended_at.is_none();
            LiveSession {
                id: session.id,
                charger: format!("{} · {}", charger_identity, charger_name),
                connector_id: session.connector_id,
                connector_number: connector.map(|c| c.connector_number).unwrap_or_default(),
                user: session.id_tag.unwrap_or_default(),
                origin: session.origin,
                hold_id: session.hold_id.unwrap_or_default(),
                command_id: session.command_id.unwrap_or_default(),
                billable: session.billable != 0,
                ocpp_transaction_id: session
                    .ocpp_transaction_id
                    .map(|id| id.to_string())
                    .unwrap_or_default(),
                tariff_id: session.tariff_id.unwrap_or_default(),
                rate_snapshot_minor_per_kwh: rate,
                start_time: start_time.clone(),
                end_time,
                meter_start_wh: session.meter_start_wh.unwrap_or_default(),
                currency: currency.clone(),
                last_energy_wh: energy_wh,
                last_power_w: power_w,
                last_reading_at: session.last_reading_at.unwrap_or_default(),
                time: start_time,
                duration: format!("{} min", duration_secs / 60),
                energy: format!("{energy_kwh:.3} kWh"),
                power: if power_w > 0 {
                    format!("{:.2} kW", power_w as f64 / 1000.0)
                } else {
                    "—".into()
                },
                cost: cost
                    .map(|amount| format!("{currency} {amount:.2}"))
                    .unwrap_or_else(|| "—".into()),
                cost_value: cost,
                status: if live {
                    "Active".into()
                } else {
                    "Completed".into()
                },
                stop_reason: session.stop_reason.unwrap_or_else(|| "None".into()),
                overshoot_wh: session.overshoot_wh,
            }
        })
        .collect::<Vec<_>>();
    result.sort_by(|a, b| b.start_time.cmp(&a.start_time));
    Ok(result)
}

#[tauri::command]
pub async fn create_charger(
    charger: Charger,
    connectors: Vec<Connector>,
    state: State<'_, AppState>,
) -> Result<(Charger, Vec<Connector>), String> {
    serde_json::from_str::<serde_json::Value>(&charger.connector_types)
        .map_err(|e| format!("connector_types is not valid JSON: {e}"))?;
    let new_charger = charger_entity::ActiveModel {
        id: Set(Uuid::now_v7().to_string()),
        ocpp_identity: Set(charger.ocpp_identity),
        serial_number: Set(charger.serial_number),
        vendor: Set(charger.vendor),
        model: Set(charger.model),
        firmware_version: Set(charger.firmware_version),
        auth_password_hash: Set(charger.auth_password_hash),
        is_active: Set(charger.is_active),
        is_online: Set(charger.is_online),
        last_heartbeat_at: Set(charger.last_heartbeat_at),
        last_boot_at: Set(charger.last_boot_at),
        stop_latency_ms: Set(charger.stop_latency_ms),
        updated_at: Set(charger.updated_at),
        name: Set(charger.name),
        connector_count: Set(charger.connector_count),
        connector_types: Set(charger.connector_types),
        power: Set(charger.power),
    };
    let inserted_charger = new_charger
        .insert(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let created_connectors = futures::future::try_join_all(
        connectors
            .into_iter()
            .map(|mut connector| {
                connector.charger_id = inserted_charger.id.clone();
                connector
            })
            .map(|connector| create_connector(connector, state.db.clone())),
    );
    Ok((inserted_charger.into(), created_connectors.await?))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Connector {
    id: String,
    charger_id: String,
    connector_number: i64,
    connector_type: String,
    power_kw: f64,
    allowed_power_kw: f64,
    status: String,
    error_code: Option<String>,
    status_updated_at: Option<String>,
}
impl From<connector_entity::Model> for Connector {
    fn from(m: connector_entity::Model) -> Self {
        Self {
            id: m.id,
            charger_id: m.charger_id,
            connector_type: m.connector_type,
            connector_number: Some(m.connector_number).unwrap(),
            power_kw: m.power_kw.unwrap_or_default(),
            allowed_power_kw: m.allowed_power_kw.unwrap_or_default(),
            status: m.status,
            error_code: m.error_code,
            status_updated_at: m.status_updated_at,
        }
    }
}

async fn create_connector(
    connector: Connector,
    db: DatabaseConnection,
) -> Result<Connector, String> {
    let new_connector = connector_entity::ActiveModel {
        id: Set(Uuid::now_v7().to_string()),
        charger_id: Set(connector.charger_id),
        connector_number: Set(connector.connector_number),
        connector_type: Set(connector.connector_type),
        power_kw: Set(Some(connector.power_kw)),
        allowed_power_kw: Set(Some(connector.allowed_power_kw)),
        status: Set(connector.status),
        error_code: Set(connector.error_code),
        status_updated_at: Set(connector.status_updated_at),
    };
    let inserted_connector = new_connector.insert(&db).await.map_err(|e| e.to_string())?;
    Ok(inserted_connector.into())
}
