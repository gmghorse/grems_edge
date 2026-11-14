use crate::{
    entities::{
        chargers as charger_entity, connectors as connector_entity, sessions as session_entity,
    },
    AppState,
};
use sea_orm::EntityTrait;
use serde::Serialize;
use tauri::State;

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
        .map(|c| (c.id, (c.ocpp_identity, c.name)))
        .collect::<std::collections::HashMap<_, _>>();
    let connector_lookup = connectors
        .into_iter()
        .map(|c| (c.id.clone(), c))
        .collect::<std::collections::HashMap<_, _>>();
    let mut result = sessions
        .into_iter()
        .map(|session| {
            let connector = connector_lookup.get(&session.connector_id);
            let (identity, name) = connector
                .and_then(|c| charger_details.get(&c.charger_id))
                .cloned()
                .unwrap_or_else(|| ("Unknown charger".into(), String::new()));
            let start = session
                .started_at
                .clone()
                .unwrap_or_else(|| session.created_at.clone());
            let end = session
                .ended_at
                .clone()
                .or_else(|| session.last_reading_at.clone())
                .unwrap_or_else(|| start.clone());
            let duration = chrono::DateTime::parse_from_rfc3339(&end)
                .ok()
                .zip(chrono::DateTime::parse_from_rfc3339(&start).ok())
                .map(|(e, s)| (e - s).num_seconds().max(0))
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
                .map(|r| energy_kwh * r / 100.0);
            let currency = session.currency.clone().unwrap_or_default();
            let live =
                session.status.eq_ignore_ascii_case("Charging") || session.ended_at.is_none();
            LiveSession {
                id: session.id,
                charger: format!("{} · {}", identity, name),
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
                start_time: start.clone(),
                end_time: end,
                meter_start_wh: session.meter_start_wh.unwrap_or_default(),
                currency: currency.clone(),
                last_energy_wh: energy_wh,
                last_power_w: power_w,
                last_reading_at: session.last_reading_at.unwrap_or_default(),
                time: start,
                duration: format!("{} min", duration / 60),
                energy: format!("{energy_kwh:.3} kWh"),
                power: if power_w > 0 {
                    format!("{:.2} kW", power_w as f64 / 1000.0)
                } else {
                    "—".into()
                },
                cost: cost
                    .map(|v| format!("{currency} {v:.2}"))
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
