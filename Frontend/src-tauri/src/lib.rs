pub mod db;
pub mod master_data;
pub mod local_orders;
pub mod local_settlement;
pub mod sync;
pub mod printer;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Initialize local SQLite database and verify schema migrations
      let db_path = db::resolve_db_path(app.handle())
        .map_err(|e| format!("Failed to resolve database path: {}", e))?;
      let health = db::initialize_database(&db_path)
        .map_err(|e| format!("Failed to initialize local SQLite database: {}", e))?;
      log::info!(
        "Local SQLite initialized successfully: path={}, version={}, applied={}, wal={}",
        health.db_path,
        health.current_version,
        health.migrations_applied,
        health.wal_mode
      );

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        db::db_get_health,
        master_data::cache_save_master_data,
        master_data::cache_get_master_data,
        master_data::cache_get_status,
        local_orders::order_create_local,
        local_settlement::order_settle_local,
        local_settlement::order_get_local,
        local_settlement::order_list_local,
        sync::outbox_reset_in_flight,
        sync::outbox_get_pending_batch,
        sync::outbox_mark_sending,
        sync::outbox_acknowledge_item,
        sync::outbox_retry_item,
        sync::outbox_get_summary,
        sync::outbox_list_items,
        printer::printer_list_system,
        printer::printer_print_receipt,
        printer::printer_print_test
    ])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
