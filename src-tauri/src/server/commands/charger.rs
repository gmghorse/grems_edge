use crate::{entities::chargers as charger_entity, AppState};
use sea_orm::{ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, QueryFilter};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use super::connector::Connector;
use crate::entities::connectors as connector_entity;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Charger {
    #[serde(default)]
    pub id: String,
    pub ocpp_identity: String,
    pub serial_number: String,
    pub vendor: Option<String>,
    pub model: Option<String>,
    pub firmware_version: Option<String>,
    #[serde(skip_serializing, default)]
    pub auth_password: Option<String>,
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
    pub vendor: Option<String>,
    pub model: Option<String>,
    pub auth_password: Option<String>,
    pub name: Option<String>,
    pub connector_count: Option<i64>,
    pub connector_types: Option<String>,
    #[serde(default)]
    pub connectors: Option<Vec<Connector>>,
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
            auth_password: None,
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
            vendor: Option::from(m.vendor),
            model: Option::from(m.model),
            auth_password: None,
            name: Option::from(m.name),
            connector_types: Option::from(m.connector_types),
            connector_count: Option::from(m.connector_count),
            connectors: None,
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
    state: State<'_, AppState>,
) -> Result<Charger, String> {
    // serde_json::from_str::<serde_json::Value>(&charger.connector_types)
    //     .map_err(|e| format!("connector_types is not valid JSON: {e}"))?;
    println!("Creating charger");
    let new_charger = charger_entity::ActiveModel {
        id: Set(Uuid::now_v7().to_string()),
        ocpp_identity: Set(charger.ocpp_identity),
        serial_number: Set(charger.serial_number),
        vendor: Set(charger.vendor),
        model: Set(charger.model),
        firmware_version: Set(charger.firmware_version),
        auth_password_hash: Set(charger.auth_password.map(|password| hash_password(&password)).transpose()?),
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
        ..Default::default()
    };
    let inserted = new_charger.insert(&state.db).await.map_err(|e| {
        println!("{}", e.to_string());
        e.to_string()
    })?;
    println!("Charger created");
    // let created = futures::future::try_join_all(connectors.into_iter().map(|mut c| {
    //     c.charger_id = inserted.id.clone();
    //     create_connector(c, state.db.clone())
    // }))
    // .await?;
    Ok(Charger::from(inserted))
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
        .ok_or_else(|| "Charger not found at all".to_string())?;

    let mut active: charger_entity::ActiveModel = model.into();

    if let Some(name) = charger.name {
        active.name = Set(name);
    }

    if let Some(password) = charger.auth_password.filter(|password| !password.is_empty()) {
        active.auth_password_hash = Set(Some(hash_password(&password)?));
    }

    if let Some(types) = charger.connector_types.as_ref() {
        serde_json::from_str::<serde_json::Value>(types)
            .map_err(|e| format!("connector_types is not valid JSON: {e}"))?;
        active.connector_types = Set(types.clone());
    }

    let active = active.update(&state.db).await.map_err(|e| e.to_string())?;
    if let Some(connectors) = charger.connectors {
        for connector in connectors {
            let model = connector_entity::Entity::find()
                .filter(connector_entity::Column::ChargerId.eq(active.id.clone()))
                .filter(connector_entity::Column::ConnectorNumber.eq(connector.connector_number))
                .one(&state.db)
                .await
                .map_err(|e| e.to_string())?
                .ok_or_else(|| format!("Connector {} not found", connector.connector_number))?;
            let mut connector_active: connector_entity::ActiveModel = model.into();
            connector_active.connector_type = Set(connector.connector_type);
            connector_active
                .update(&state.db)
                .await
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(active.into())
}

fn hash_password(password: &str) -> Result<String, String> {
    use argon2::{
        password_hash::{PasswordHasher, SaltString},
        Argon2,
    };
    use rand::rngs::OsRng;

    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|error| format!("Failed to hash password: {error}"))
}
