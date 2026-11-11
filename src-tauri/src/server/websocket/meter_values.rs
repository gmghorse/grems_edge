use super::common::{db_error, CallError};
use crate::entities::{connectors, ocpp_transactions, sessions};
use rust_ocpp::v1_6::messages;
use sea_orm::{ActiveModelTrait, ActiveValue::Set, DatabaseConnection, EntityTrait};
use serde_json::Value;
pub(super) async fn save_meter_values(
    db: &DatabaseConnection,
    charger_id: &str,
    request: &messages::meter_values::MeterValuesRequest,
) -> Result<(), CallError> {
    let Some(transaction_id) = request.transaction_id else {
        return Ok(());
    };
    let Some(tx) = ocpp_transactions::Entity::find_by_id(transaction_id as i64)
        .one(db)
        .await
        .map_err(db_error)?
    else {
        return Ok(());
    };
    // Keep the canonical OCPP sample in the message log; typed scalar columns are updated when their measurand is recognized.
    let session = sessions::Entity::find_by_id(tx.session_id)
        .one(db)
        .await
        .map_err(db_error)?;
    let Some(session) = session else {
        return Ok(());
    };
    let Some(connector) = connectors::Entity::find_by_id(session.connector_id.clone())
        .one(db)
        .await
        .map_err(db_error)?
    else {
        return Ok(());
    };
    if connector.charger_id != charger_id {
        return Ok(());
    }
    let mut energy_register_wh = None;
    let mut energy_interval_wh = 0_i64;
    let mut has_energy_interval = false;
    let mut power_w = None;
    let mut latest_reading_at = None;
    for value in &request.meter_value {
        latest_reading_at = Some(value.timestamp.to_rfc3339());
        for sample in &value.sampled_value {
            let measurand = sample
                .measurand
                .as_ref()
                .map(|m| {
                    serde_json::to_value(m)
                        .unwrap_or(Value::Null)
                        .as_str()
                        .unwrap_or("")
                        .to_owned()
                })
                .unwrap_or_else(|| "Energy.Active.Import.Register".into());
            let number = sample.value.parse::<f64>().ok();
            let unit = sample
                .unit
                .as_ref()
                .and_then(|unit| serde_json::to_value(unit).ok())
                .and_then(|unit| unit.as_str().map(str::to_owned))
                .unwrap_or_default();
            match (measurand.as_str(), number) {
                ("Energy.Active.Import.Register", Some(n)) => {
                    let reading = (n * if unit == "kWh" { 1000.0 } else { 1.0 }).round() as i64;
                    energy_register_wh = Some(reading);
                }
                ("Energy.Active.Import.Interval", Some(n)) => {
                    let reading = (n * if unit == "kWh" { 1000.0 } else { 1.0 }).round() as i64;
                    energy_interval_wh += reading;
                    has_energy_interval = true;
                }
                ("Power.Active.Import", Some(n)) => {
                    let reading = (n * if unit == "kW" { 1000.0 } else { 1.0 }).round() as i64;
                    power_w = Some(reading);
                }
                _ => {}
            }
        }
    }
    if energy_register_wh.is_some() || power_w.is_some() {
        let current_energy = session
            .energy_wh
            .or(session.last_energy_wh)
            .unwrap_or_default();
        let meter_start_wh = session.meter_start_wh.unwrap_or_default();
        let mut update: sessions::ActiveModel = session.into();
        let session_energy = energy_register_wh
            .map(|reading| (reading - meter_start_wh).max(0))
            .or_else(|| has_energy_interval.then_some(current_energy + energy_interval_wh));
        if let Some(energy) = session_energy {
            update.energy_wh = Set(Some(energy));
            update.last_energy_wh = Set(Some(energy));
        }
        if let Some(power) = power_w {
            update.last_power_w = Set(Some(power));
        }
        if let Some(reading_at) = latest_reading_at {
            update.last_reading_at = Set(Some(reading_at));
        }
        update.update(db).await.map_err(db_error)?;
    }
    Ok(())
}
