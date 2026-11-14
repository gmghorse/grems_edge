use crate::{entities::chargers as charger_entity, AppState};
use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use super::connector::{create_connector, Connector};

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

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChargerUpdate {
    pub id: String,
    pub serial_number: Option<String>,
    pub vendor: Option<String>,
    pub model: Option<String>,
    pub auth_password_hash: Option<String>,
    pub name: Option<String>,
    pub connector_count: Option<i64>,
    pub connector_types: Option<String>,
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

impl From<charger_entity::Model> for ChargerUpdate {
    fn from(m: charger_entity::Model) -> Self {
        Self {
            id: m.id,
            serial_number: Option::from(m.serial_number),
            vendor: Option::from(m.vendor),
            model: Option::from(m.model),
            auth_password_hash: Option::from(m.auth_password_hash),
            name: Option::from(m.name),
            connector_types: Option::from(m.connector_types),
            connector_count: Option::from(m.connector_count),
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
    let connectors = super::connector::load_connectors(&state.db).await?;
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
            record.connectors.push(connector);
        }
    }
    let mut records = records.into_values().collect::<Vec<_>>();
    for record in &mut records {
        record.connectors.sort_by_key(|c| c.connector_number);
    }
    records.sort_by(|a, b| a.charger.name.cmp(&b.charger.name));
    Ok(records)
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
    let inserted = new_charger
        .insert(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    let created = futures::future::try_join_all(connectors.into_iter().map(|mut c| {
        c.charger_id = inserted.id.clone();
        create_connector(c, state.db.clone())
    }))
    .await?;
    Ok((inserted.into(), created))
}

#[tauri::command]
pub async fn update_charger(
    charger: ChargerUpdate,
    state: State<'_, AppState>,
) -> Result<Charger, String> {
    println!("got here");
    let model = charger_entity::Entity::find_by_id(charger.id.clone())
        .one(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Charger not found".to_string())?;

    let mut active: charger_entity::ActiveModel = model.into();

    if let Some(name) = charger.name {
        active.name = Set(name);
    }

    let active = active.update(&state.db).await.map_err(|e| e.to_string())?;
    Ok(active.into())
}
