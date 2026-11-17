use super::protocol::handle_text_message;
use crate::entities::chargers;
use actix_web::{
    http::header::{AUTHORIZATION, SEC_WEBSOCKET_PROTOCOL},
    web, App, Error, HttpRequest, HttpServer,
};
use actix_ws::Message;
use chrono::Utc;
use futures_util::StreamExt;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use serde_json::json;
use tauri::{AppHandle, Emitter};
pub(super) async fn charger_ws(
    req: HttpRequest,
    body: web::Payload,
    db: web::Data<DatabaseConnection>,
    app: web::Data<AppHandle>,
) -> Result<actix_web::HttpResponse, Error> {
    let identity = req
        .match_info()
        .get("charger_id")
        .unwrap_or_default()
        .to_owned();
    let Some(charger) = chargers::Entity::find()
        .filter(chargers::Column::OcppIdentity.eq(identity.clone()))
        .one(db.get_ref())
        .await
        .map_err(actix_web::error::ErrorInternalServerError)?
    else {
        return Ok(actix_web::HttpResponse::NotFound().finish());
    };
    if charger.is_active != 1 {
        return Ok(actix_web::HttpResponse::Forbidden().finish());
    }
    if let Some(password_hash) = charger.auth_password_hash.as_deref() {
        use argon2::{password_hash::PasswordHash, Argon2, PasswordVerifier};
        use base64::{engine::general_purpose::STANDARD, Engine as _};

        let valid_credentials = req
            .headers()
            .get(AUTHORIZATION)
            .and_then(|header| header.to_str().ok())
            .and_then(|header| {
                let (scheme, encoded) = header.split_once(' ')?;
                scheme.eq_ignore_ascii_case("Basic").then_some(encoded)
            })
            .and_then(|encoded| STANDARD.decode(encoded).ok())
            .and_then(|decoded| String::from_utf8(decoded).ok())
            .and_then(|credentials| {
                let (username, password) = credentials.split_once(':')?;
                if username != charger.ocpp_identity.as_str() {
                    return None;
                }
                let parsed_hash = PasswordHash::new(password_hash).ok()?;
                Some(Argon2::default().verify_password(password.as_bytes(), &parsed_hash).is_ok())
            })
            .unwrap_or(false);
        if !valid_credentials {
            return Ok(actix_web::HttpResponse::Unauthorized().finish());
        }
    }
    let supports_ocpp_16 = req.headers().get_all(SEC_WEBSOCKET_PROTOCOL).any(|header| {
        header.to_str().ok().is_some_and(|value| {
            value
                .split(',')
                .any(|protocol| protocol.trim() == "ocpp1.6")
        })
    });
    if !supports_ocpp_16 {
        return Ok(actix_web::HttpResponse::BadRequest().body("OCPP 1.6J subprotocol required"));
    }

    let charger_id = charger.id;
    let (response, mut session, mut stream) =
        actix_ws::handle_with_protocols(&req, body, &["ocpp1.6"])?;
    actix_web::rt::spawn(async move {
        let mut boot_accepted = false;
        while let Some(Ok(message)) = stream.next().await {
            match message {
                Message::Text(text) => {
                    if let Some(reply) = handle_text_message(
                        &text,
                        &charger_id,
                        db.get_ref(),
                        app.get_ref(),
                        &mut boot_accepted,
                    )
                    .await
                    {
                        if session.text(reply).await.is_err() {
                            break;
                        }
                    }
                }
                Message::Ping(bytes) => {
                    let _ = session.pong(&bytes).await;
                }
                Message::Close(reason) => {
                    let _ = session.close(reason).await;
                    break;
                }
                _ => {}
            }
        }
        let now = Utc::now().to_rfc3339();
        // if let Err(error) =
        //     end_active_sessions_for_charger(db.get_ref(), &charger_id, &now, "Other").await
        // {
        //     eprintln!("Failed to close sessions for disconnected charger: {error:?}");
        // }
        let _ = chargers::Entity::update_many()
            .col_expr(
                chargers::Column::IsOnline,
                sea_orm::sea_query::Expr::value(0),
            )
            .col_expr(
                chargers::Column::UpdatedAt,
                sea_orm::sea_query::Expr::value(now),
            )
            .filter(chargers::Column::Id.eq(charger_id.clone()))
            .exec(db.get_ref())
            .await;
        let _ = app.emit(
            "charger-state-updated",
            json!({"chargerId":charger_id,"action":"Disconnected"}),
        );
    });

    Ok(response)
}

pub async fn start_server(db: DatabaseConnection, app: AppHandle) -> std::io::Result<()> {
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(db.clone()))
            .app_data(web::Data::new(app.clone()))
            .route("/ocpp/{charger_id}", web::get().to(charger_ws))
    })
    .bind(("0.0.0.0", 9000))?
    .run()
    .await
}
