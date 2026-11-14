use sea_orm::{Database, DatabaseConnection};
use tauri::Manager;
mod entities;
mod server;

pub struct AppState {
    pub db: DatabaseConnection,
}

#[tauri::command]
fn app_ready(app: tauri::AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let url = "sqlite://grems_edge.db";
            let db = tauri::async_runtime::block_on(Database::connect(url))?;
            let server_db = db.clone();
            let server_app = app.handle().clone();
            tauri::async_runtime::spawn_blocking(move || {
                if let Err(error) = actix_web::rt::System::new()
                    .block_on(crate::server::start_server(server_db, server_app))
                {
                    eprintln!("OCPP WebSocket server stopped: {error}");
                }
            });
            app.manage(AppState { db });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            app_ready,
            server::commands::charger::create_charger,
            server::commands::charger::update_charger,
            server::commands::charger::load_chargers,
            server::commands::session::load_sessions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// sea-orm-cli generate entity -u "sqlite://src-tauri/grems_edge.db?mode=ro" -o src-tauri/src/entities -t connectors
