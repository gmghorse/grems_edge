use crate::entities::connectors as connector_entity;
use sea_orm::{ActiveModelTrait, ActiveValue::Set, DatabaseConnection, EntityTrait};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Connector {
    pub id: String,
    pub charger_id: String,
    pub connector_number: i64,
    pub connector_type: String,
    pub power_kw: f64,
    pub allowed_power_kw: f64,
    pub status: String,
    pub error_code: Option<String>,
    pub status_updated_at: Option<String>,
}
impl From<connector_entity::Model> for Connector {
    fn from(m: connector_entity::Model) -> Self {
        Self {
            id: m.id,
            charger_id: m.charger_id,
            connector_type: m.connector_type,
            connector_number: m.connector_number,
            power_kw: m.power_kw.unwrap_or_default(),
            allowed_power_kw: m.allowed_power_kw.unwrap_or_default(),
            status: m.status,
            error_code: m.error_code,
            status_updated_at: m.status_updated_at,
        }
    }
}
pub(super) async fn load_connectors(db: &DatabaseConnection) -> Result<Vec<Connector>, String> {
    connector_entity::Entity::find()
        .all(db)
        .await
        .map(|rows| rows.into_iter().map(Into::into).collect())
        .map_err(|e| e.to_string())
}
pub(super) async fn create_connector(
    connector: Connector,
    db: DatabaseConnection,
) -> Result<Connector, String> {
    let model = connector_entity::ActiveModel {
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
    model
        .insert(&db)
        .await
        .map(Into::into)
        .map_err(|e| e.to_string())
}
