//! NextVisit Local Master Data Cache Module
//!
//! Provides atomic snapshot persistence, retrieval, and cache freshness tracking
//! for menu categories, menu items, dining areas, dining tables, and business settings.
//! Guarantees tenant isolation and atomic transactions.

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedMenuItemDto {
    pub id: String,
    pub business_id: String,
    pub category_id: String,
    pub name: String,
    pub description: Option<String>,
    pub price: f64,
    pub gst_percentage: f64,
    pub is_veg: bool,
    pub is_available: bool,
    pub display_order: i64,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedMenuCategoryDto {
    pub id: String,
    pub business_id: String,
    pub name: String,
    pub display_order: i64,
    pub is_active: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub items: Vec<CachedMenuItemDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedDiningTableDto {
    pub id: String,
    pub business_id: String,
    pub dining_area_id: String,
    pub table_name: String,
    pub capacity: i64,
    pub display_order: i64,
    pub is_active: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedDiningAreaDto {
    pub id: String,
    pub business_id: String,
    pub name: String,
    pub display_order: i64,
    pub color: Option<String>,
    pub is_active: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub tables: Vec<CachedDiningTableDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasterDataSnapshotPayload {
    pub business_id: String,
    pub device_id: String,
    pub server_time: String,
    pub menu_categories: Vec<CachedMenuCategoryDto>,
    pub dining_areas: Vec<CachedDiningAreaDto>,
    pub business_settings: Option<serde_json::Value>,
    #[serde(default)]
    pub device_order_sequence: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasterDataCacheResponse {
    pub business_id: String,
    pub cached_at: String,
    pub last_server_time: String,
    pub is_stale: bool,
    pub menu_categories: Vec<CachedMenuCategoryDto>,
    pub dining_areas: Vec<CachedDiningAreaDto>,
    pub business_settings: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStatusDto {
    pub business_id: String,
    pub device_id: Option<String>,
    pub last_sync_time: Option<String>,
    pub last_server_time: Option<String>,
    pub category_count: i64,
    pub item_count: i64,
    pub area_count: i64,
    pub table_count: i64,
    pub has_settings: bool,
    pub has_cache: bool,
}

/// Atomically replaces or updates the master data cache for a specific business.
///
/// Behavior guarantees:
/// - Validates complete snapshot upfront before any writes or deletions.
/// - Validates business identity, device identity, server_time, and relationship integrity.
/// - In full snapshot mode (`is_full_snapshot = true`), replaces cache for `business_id` atomically;
///   if `business_settings` is None, deletes any previous settings row explicitly.
/// - In delta mode (`is_full_snapshot = false`), upserts records and does not delete unseen rows.
/// - If a different device ID tries to push sync state without matching business, or if payload has tenant violations, aborts immediately.
/// - `sync_state` advances only in the same successful transaction as all record commits.
pub fn apply_master_data_snapshot(
    conn: &mut Connection,
    snapshot: &MasterDataSnapshotPayload,
    is_full_snapshot: bool,
) -> Result<(), String> {
    if snapshot.business_id.trim().is_empty() {
        return Err("Cannot apply master data snapshot with empty business_id".to_string());
    }
    if snapshot.device_id.trim().is_empty() {
        return Err("Cannot apply master data snapshot with empty device_id".to_string());
    }
    if snapshot.server_time.trim().is_empty() {
        return Err("Cannot apply master data snapshot with empty server_time".to_string());
    }

    let biz_id = &snapshot.business_id;

    // Upfront validation of all records and relationships before opening transaction
    for cat in &snapshot.menu_categories {
        if cat.business_id != *biz_id {
            return Err(format!(
                "Tenant violation: Category {} has business_id {} but snapshot business_id is {}",
                cat.id, cat.business_id, biz_id
            ));
        }
        if cat.id.trim().is_empty() {
            return Err("Category has empty id".to_string());
        }
        for item in &cat.items {
            if item.business_id != *biz_id {
                return Err(format!(
                    "Tenant violation: Item {} has business_id {} but snapshot business_id is {}",
                    item.id, item.business_id, biz_id
                ));
            }
            if item.id.trim().is_empty() {
                return Err("Item has empty id".to_string());
            }
            if item.category_id != cat.id {
                return Err(format!(
                    "Relationship violation: Item {} specifies category_id {} but is nested under category {}",
                    item.id, item.category_id, cat.id
                ));
            }
        }
    }

    for area in &snapshot.dining_areas {
        if area.business_id != *biz_id {
            return Err(format!(
                "Tenant violation: Dining Area {} has business_id {} but snapshot business_id is {}",
                area.id, area.business_id, biz_id
            ));
        }
        if area.id.trim().is_empty() {
            return Err("Dining Area has empty id".to_string());
        }
        for table in &area.tables {
            if table.business_id != *biz_id {
                return Err(format!(
                    "Tenant violation: Table {} has business_id {} but snapshot business_id is {}",
                    table.id, table.business_id, biz_id
                ));
            }
            if table.id.trim().is_empty() {
                return Err("Table has empty id".to_string());
            }
            if table.dining_area_id != area.id {
                return Err(format!(
                    "Relationship violation: Table {} specifies dining_area_id {} but is nested under area {}",
                    table.id, table.dining_area_id, area.id
                ));
            }
        }
    }

    let tx = conn
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|e| format!("Failed to start immediate transaction: {}", e))?;

    if is_full_snapshot {
        delete_existing_business_cache(&tx, biz_id)?;
    }

    // 1. Insert Menu Categories & Items
    for cat in &snapshot.menu_categories {
        tx.execute(
            "INSERT INTO cached_menu_categories (
                id, business_id, name, display_order, is_active, source_created_at, source_updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(id) DO UPDATE SET
                business_id = excluded.business_id,
                name = excluded.name,
                display_order = excluded.display_order,
                is_active = excluded.is_active,
                source_created_at = excluded.source_created_at,
                source_updated_at = excluded.source_updated_at,
                cached_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');",
            params![
                cat.id,
                cat.business_id,
                cat.name,
                cat.display_order,
                if cat.is_active { 1 } else { 0 },
                cat.created_at,
                cat.updated_at,
            ],
        )
        .map_err(|e| format!("Failed to insert category {}: {}", cat.id, e))?;

        for item in &cat.items {
            tx.execute(
                "INSERT INTO cached_menu_items (
                    id, business_id, category_id, name, description, price, gst_percentage,
                    is_veg, is_available, display_order, source_created_at, source_updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                ON CONFLICT(id) DO UPDATE SET
                    business_id = excluded.business_id,
                    category_id = excluded.category_id,
                    name = excluded.name,
                    description = excluded.description,
                    price = excluded.price,
                    gst_percentage = excluded.gst_percentage,
                    is_veg = excluded.is_veg,
                    is_available = excluded.is_available,
                    display_order = excluded.display_order,
                    source_created_at = excluded.source_created_at,
                    source_updated_at = excluded.source_updated_at,
                    cached_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');",
                params![
                    item.id,
                    item.business_id,
                    item.category_id,
                    item.name,
                    item.description,
                    item.price,
                    item.gst_percentage,
                    if item.is_veg { 1 } else { 0 },
                    if item.is_available { 1 } else { 0 },
                    item.display_order,
                    item.created_at,
                    item.updated_at,
                ],
            )
            .map_err(|e| format!("Failed to insert item {}: {}", item.id, e))?;
        }
    }

    // 2. Insert Dining Areas & Tables
    for area in &snapshot.dining_areas {
        tx.execute(
            "INSERT INTO cached_dining_areas (
                id, business_id, name, display_order, color, is_active, source_created_at, source_updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(id) DO UPDATE SET
                business_id = excluded.business_id,
                name = excluded.name,
                display_order = excluded.display_order,
                color = excluded.color,
                is_active = excluded.is_active,
                source_created_at = excluded.source_created_at,
                source_updated_at = excluded.source_updated_at,
                cached_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');",
            params![
                area.id,
                area.business_id,
                area.name,
                area.display_order,
                area.color,
                if area.is_active { 1 } else { 0 },
                area.created_at,
                area.updated_at,
            ],
        )
        .map_err(|e| format!("Failed to insert dining area {}: {}", area.id, e))?;

        for table in &area.tables {
            tx.execute(
                "INSERT INTO cached_dining_tables (
                    id, business_id, dining_area_id, table_name, capacity, display_order,
                    is_active, source_created_at, source_updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                ON CONFLICT(id) DO UPDATE SET
                    business_id = excluded.business_id,
                    dining_area_id = excluded.dining_area_id,
                    table_name = excluded.table_name,
                    capacity = excluded.capacity,
                    display_order = excluded.display_order,
                    is_active = excluded.is_active,
                    source_created_at = excluded.source_created_at,
                    source_updated_at = excluded.source_updated_at,
                    cached_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');",
                params![
                    table.id,
                    table.business_id,
                    table.dining_area_id,
                    table.table_name,
                    table.capacity,
                    table.display_order,
                    if table.is_active { 1 } else { 0 },
                    table.created_at,
                    table.updated_at,
                ],
            )
            .map_err(|e| format!("Failed to insert table {}: {}", table.id, e))?;
        }
    }

    // 3. Business Settings Snapshot Policy:
    // If settings are present, insert or update them.
    // If settings are None and is_full_snapshot is true, delete existing settings (already done in delete_existing_business_cache).
    if let Some(ref settings) = snapshot.business_settings {
        let settings_str = serde_json::to_string(settings)
            .map_err(|e| format!("Failed to serialize business settings JSON: {}", e))?;

        tx.execute(
            "INSERT INTO cached_business_settings (business_id, settings_json)
             VALUES (?1, ?2)
             ON CONFLICT(business_id) DO UPDATE SET
                settings_json = excluded.settings_json,
                cached_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');",
            params![biz_id, settings_str],
        )
        .map_err(|e| format!("Failed to insert business settings: {}", e))?;
    }

    // 4. Update sync state cursor only AFTER everything has succeeded in the same transaction
    tx.execute(
        "INSERT INTO sync_state (business_id, device_id, last_sync_time, last_server_time)
         VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?3)
         ON CONFLICT(business_id) DO UPDATE SET
            device_id = excluded.device_id,
            last_sync_time = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            last_server_time = excluded.last_server_time,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');",
        params![biz_id, snapshot.device_id, snapshot.server_time],
    )
    .map_err(|e| format!("Failed to update sync_state: {}", e))?;

    // 5. Seed order sequence counter in app_metadata if server provides a higher historical sequence
    if let Some(seq) = snapshot.device_order_sequence {
        if seq > 0 {
            let seq_key = format!("order_sequence:{}:{}", biz_id, snapshot.device_id);
            let current_seq: Option<i64> = tx
                .query_row(
                    "SELECT CAST(value AS INTEGER) FROM app_metadata WHERE key = ?1",
                    [&seq_key],
                    |r| r.get(0),
                )
                .optional()
                .unwrap_or(None);
            if current_seq.unwrap_or(0) < seq {
                tx.execute(
                    "INSERT INTO app_metadata(key, value) VALUES(?1, ?2)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
                    params![seq_key, seq.to_string()],
                )
                .map_err(|e| format!("Failed to seed order_sequence in app_metadata: {}", e))?;
            }
        }
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit master data transaction: {}", e))?;

    Ok(())
}

fn delete_existing_business_cache(tx: &Transaction, business_id: &str) -> Result<(), String> {
    // Delete in child-to-parent order to respect foreign key constraints
    tx.execute(
        "DELETE FROM cached_menu_items WHERE business_id = ?1;",
        params![business_id],
    )
    .map_err(|e| format!("Failed to clear cached_menu_items: {}", e))?;

    tx.execute(
        "DELETE FROM cached_menu_categories WHERE business_id = ?1;",
        params![business_id],
    )
    .map_err(|e| format!("Failed to clear cached_menu_categories: {}", e))?;

    tx.execute(
        "DELETE FROM cached_dining_tables WHERE business_id = ?1;",
        params![business_id],
    )
    .map_err(|e| format!("Failed to clear cached_dining_tables: {}", e))?;

    tx.execute(
        "DELETE FROM cached_dining_areas WHERE business_id = ?1;",
        params![business_id],
    )
    .map_err(|e| format!("Failed to clear cached_dining_areas: {}", e))?;

    tx.execute(
        "DELETE FROM cached_business_settings WHERE business_id = ?1;",
        params![business_id],
    )
    .map_err(|e| format!("Failed to clear cached_business_settings: {}", e))?;

    Ok(())
}

/// Reads the cached master data for a specific authenticated business.
/// Distinguishes between "no cache" (returns Ok(None)) and database/decoding failures (returns Err).
pub fn read_master_data_cache(
    conn: &Connection,
    business_id: &str,
) -> Result<Option<MasterDataCacheResponse>, String> {
    if business_id.trim().is_empty() {
        return Err("Cannot read master data cache with empty business_id".to_string());
    }

    // Check if sync_state exists for this business
    let sync_state: Option<(String, String)> = match conn.query_row(
        "SELECT last_sync_time, last_server_time FROM sync_state WHERE business_id = ?1;",
        params![business_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(s) => Some(s),
        Err(rusqlite::Error::QueryReturnedNoRows) => None,
        Err(e) => return Err(format!("Failed to query sync_state: {}", e)),
    };

    let (cached_at, last_server_time) = match sync_state {
        Some(s) => s,
        None => return Ok(None),
    };

    // 1. Read categories
    let mut cat_stmt = conn
        .prepare(
            "SELECT id, business_id, name, display_order, is_active, source_created_at, source_updated_at
             FROM cached_menu_categories
             WHERE business_id = ?1
             ORDER BY display_order ASC, name ASC;",
        )
        .map_err(|e| format!("Failed to prepare categories query: {}", e))?;

    let cat_rows = cat_stmt
        .query_map(params![business_id], |row| {
            Ok(CachedMenuCategoryDto {
                id: row.get(0)?,
                business_id: row.get(1)?,
                name: row.get(2)?,
                display_order: row.get(3)?,
                is_active: row.get::<_, i64>(4)? == 1,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                items: Vec::new(),
            })
        })
        .map_err(|e| format!("Failed to query categories: {}", e))?;

    let mut categories = Vec::new();
    for c in cat_rows {
        categories.push(c.map_err(|e| format!("Error decoding category row: {}", e))?);
    }

    // 2. Read items for each category
    let mut item_stmt = conn
        .prepare(
            "SELECT id, business_id, category_id, name, description, price, gst_percentage,
                    is_veg, is_available, display_order, source_created_at, source_updated_at
             FROM cached_menu_items
             WHERE business_id = ?1
             ORDER BY display_order ASC, name ASC;",
        )
        .map_err(|e| format!("Failed to prepare items query: {}", e))?;

    let item_rows = item_stmt
        .query_map(params![business_id], |row| {
            Ok(CachedMenuItemDto {
                id: row.get(0)?,
                business_id: row.get(1)?,
                category_id: row.get(2)?,
                name: row.get(3)?,
                description: row.get(4)?,
                price: row.get(5)?,
                gst_percentage: row.get(6)?,
                is_veg: row.get::<_, i64>(7)? == 1,
                is_available: row.get::<_, i64>(8)? == 1,
                display_order: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| format!("Failed to query items: {}", e))?;

    let mut items = Vec::new();
    for it in item_rows {
        items.push(it.map_err(|e| format!("Error decoding item row: {}", e))?);
    }

    for cat in &mut categories {
        cat.items = items
            .iter()
            .filter(|i| i.category_id == cat.id)
            .cloned()
            .collect();
    }

    // 3. Read dining areas
    let mut area_stmt = conn
        .prepare(
            "SELECT id, business_id, name, display_order, color, is_active, source_created_at, source_updated_at
             FROM cached_dining_areas
             WHERE business_id = ?1
             ORDER BY display_order ASC, name ASC;",
        )
        .map_err(|e| format!("Failed to prepare dining areas query: {}", e))?;

    let area_rows = area_stmt
        .query_map(params![business_id], |row| {
            Ok(CachedDiningAreaDto {
                id: row.get(0)?,
                business_id: row.get(1)?,
                name: row.get(2)?,
                display_order: row.get(3)?,
                color: row.get(4)?,
                is_active: row.get::<_, i64>(5)? == 1,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                tables: Vec::new(),
            })
        })
        .map_err(|e| format!("Failed to query dining areas: {}", e))?;

    let mut areas = Vec::new();
    for a in area_rows {
        areas.push(a.map_err(|e| format!("Error decoding dining area row: {}", e))?);
    }

    // 4. Read tables
    let mut table_stmt = conn
        .prepare(
            "SELECT id, business_id, dining_area_id, table_name, capacity, display_order,
                    is_active, source_created_at, source_updated_at
             FROM cached_dining_tables
             WHERE business_id = ?1
             ORDER BY display_order ASC, table_name ASC;",
        )
        .map_err(|e| format!("Failed to prepare tables query: {}", e))?;

    let table_rows = table_stmt
        .query_map(params![business_id], |row| {
            Ok(CachedDiningTableDto {
                id: row.get(0)?,
                business_id: row.get(1)?,
                dining_area_id: row.get(2)?,
                table_name: row.get(3)?,
                capacity: row.get(4)?,
                display_order: row.get(5)?,
                is_active: row.get::<_, i64>(6)? == 1,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to query tables: {}", e))?;

    let mut tables = Vec::new();
    for t in table_rows {
        tables.push(t.map_err(|e| format!("Error decoding table row: {}", e))?);
    }

    for area in &mut areas {
        area.tables = tables
            .iter()
            .filter(|t| t.dining_area_id == area.id)
            .cloned()
            .collect();
    }

    // 5. Read business settings
    let settings_json_str: Option<String> = match conn.query_row(
        "SELECT settings_json FROM cached_business_settings WHERE business_id = ?1;",
        params![business_id],
        |row| row.get(0),
    ) {
        Ok(s) => Some(s),
        Err(rusqlite::Error::QueryReturnedNoRows) => None,
        Err(e) => return Err(format!("Failed to query business settings: {}", e)),
    };

    let business_settings = match settings_json_str {
        Some(ref s) => Some(serde_json::from_str(s).map_err(|e| {
            format!(
                "Failed to decode cached business settings JSON: {}",
                e
            )
        })?),
        None => None,
    };

    Ok(Some(MasterDataCacheResponse {
        business_id: business_id.to_string(),
        cached_at,
        last_server_time,
        is_stale: false,
        menu_categories: categories,
        dining_areas: areas,
        business_settings,
    }))
}

/// Reads the high-level cache status and counts for an authenticated business.
pub fn get_cache_status(conn: &Connection, business_id: &str) -> Result<CacheStatusDto, String> {
    if business_id.trim().is_empty() {
        return Err("Cannot get cache status with empty business_id".to_string());
    }

    let sync_state: Option<(String, String, String)> = match conn.query_row(
        "SELECT device_id, last_sync_time, last_server_time FROM sync_state WHERE business_id = ?1;",
        params![business_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ) {
        Ok(s) => Some(s),
        Err(rusqlite::Error::QueryReturnedNoRows) => None,
        Err(e) => return Err(format!("Failed to query sync_state status: {}", e)),
    };

    let cat_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM cached_menu_categories WHERE business_id = ?1;",
            params![business_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count categories: {}", e))?;

    let item_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM cached_menu_items WHERE business_id = ?1;",
            params![business_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count items: {}", e))?;

    let area_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM cached_dining_areas WHERE business_id = ?1;",
            params![business_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count dining areas: {}", e))?;

    let table_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM cached_dining_tables WHERE business_id = ?1;",
            params![business_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count dining tables: {}", e))?;

    let has_settings: bool = match conn.query_row(
        "SELECT COUNT(*) FROM cached_business_settings WHERE business_id = ?1;",
        params![business_id],
        |row| row.get::<_, i64>(0),
    ) {
        Ok(c) => c > 0,
        Err(e) => return Err(format!("Failed to check cached business settings: {}", e)),
    };

    let has_cache = sync_state.is_some() || cat_count > 0 || area_count > 0 || has_settings;

    Ok(CacheStatusDto {
        business_id: business_id.to_string(),
        device_id: sync_state.as_ref().map(|s| s.0.clone()),
        last_sync_time: sync_state.as_ref().map(|s| s.1.clone()),
        last_server_time: sync_state.as_ref().map(|s| s.2.clone()),
        category_count: cat_count,
        item_count,
        area_count,
        table_count,
        has_settings,
        has_cache,
    })
}

// -----------------------------------------------------------------------------
// Tauri IPC Commands
// -----------------------------------------------------------------------------

#[tauri::command]
pub fn cache_save_master_data(
    app: tauri::AppHandle,
    snapshot: MasterDataSnapshotPayload,
    is_full_snapshot: bool,
) -> Result<(), String> {
    let db_path = crate::db::resolve_db_path(&app)?;
    let mut conn = crate::db::open_connection(&db_path)
        .map_err(|e| format!("Failed to open local database: {}", e))?;
    apply_master_data_snapshot(&mut conn, &snapshot, is_full_snapshot)
}

#[tauri::command]
pub fn cache_get_master_data(
    app: tauri::AppHandle,
    business_id: String,
) -> Result<Option<MasterDataCacheResponse>, String> {
    let db_path = crate::db::resolve_db_path(&app)?;
    let conn = crate::db::open_connection(&db_path)
        .map_err(|e| format!("Failed to open local database: {}", e))?;
    read_master_data_cache(&conn, &business_id)
}

#[tauri::command]
pub fn cache_get_status(
    app: tauri::AppHandle,
    business_id: String,
) -> Result<CacheStatusDto, String> {
    let db_path = crate::db::resolve_db_path(&app)?;
    let conn = crate::db::open_connection(&db_path)
        .map_err(|e| format!("Failed to open local database: {}", e))?;
    get_cache_status(&conn, &business_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{open_connection, run_migrations};
    use std::fs;
    use std::path::PathBuf;

    fn create_test_db(name: &str) -> (PathBuf, Connection) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(1);
        let path = std::env::temp_dir().join(format!("nextvisit_test_md_{}_{}.db", name, now));
        let mut conn = open_connection(&path).expect("Failed to open connection");
        run_migrations(&mut conn).expect("Failed to run migrations");
        (path, conn)
    }

    fn sample_snapshot(biz_id: &str) -> MasterDataSnapshotPayload {
        MasterDataSnapshotPayload {
            business_id: biz_id.to_string(),
            device_id: "dev-001".to_string(),
            server_time: "2026-10-17T12:00:00.000Z".to_string(),
            device_order_sequence: None,
            menu_categories: vec![CachedMenuCategoryDto {
                id: "cat-1".to_string(),
                business_id: biz_id.to_string(),
                name: "Starters".to_string(),
                display_order: 1,
                is_active: true,
                created_at: Some("2026-10-17T10:00:00.000Z".to_string()),
                updated_at: Some("2026-10-17T10:00:00.000Z".to_string()),
                items: vec![CachedMenuItemDto {
                    id: "item-1".to_string(),
                    business_id: biz_id.to_string(),
                    category_id: "cat-1".to_string(),
                    name: "Paneer Tikka".to_string(),
                    description: Some("Tandoori paneer".to_string()),
                    price: 250.0,
                    gst_percentage: 5.0,
                    is_veg: true,
                    is_available: true,
                    display_order: 1,
                    created_at: Some("2026-10-17T10:00:00.000Z".to_string()),
                    updated_at: Some("2026-10-17T10:00:00.000Z".to_string()),
                }],
            }],
            dining_areas: vec![CachedDiningAreaDto {
                id: "area-1".to_string(),
                business_id: biz_id.to_string(),
                name: "Main Hall".to_string(),
                display_order: 1,
                color: Some("#ff0000".to_string()),
                is_active: true,
                created_at: Some("2026-10-17T10:00:00.000Z".to_string()),
                updated_at: Some("2026-10-17T10:00:00.000Z".to_string()),
                tables: vec![CachedDiningTableDto {
                    id: "table-1".to_string(),
                    business_id: biz_id.to_string(),
                    dining_area_id: "area-1".to_string(),
                    table_name: "T1".to_string(),
                    capacity: 4,
                    display_order: 1,
                    is_active: true,
                    created_at: Some("2026-10-17T10:00:00.000Z".to_string()),
                    updated_at: Some("2026-10-17T10:00:00.000Z".to_string()),
                }],
            }],
            business_settings: Some(serde_json::json!({
                "currency": "INR",
                "enable_gst": true,
                "tax_percentage": 5.0
            })),
        }
    }

    #[test]
    fn test_master_data_cache_write_and_read() {
        let (db_path, mut conn) = create_test_db("write_read");
        let snapshot = sample_snapshot("biz-123");

        apply_master_data_snapshot(&mut conn, &snapshot, true).expect("Snapshot apply failed");

        let cached = read_master_data_cache(&conn, "biz-123")
            .expect("Read cache failed")
            .expect("Expected cached data");

        assert_eq!(cached.business_id, "biz-123");
        assert_eq!(cached.menu_categories.len(), 1);
        assert_eq!(cached.menu_categories[0].name, "Starters");
        assert_eq!(cached.menu_categories[0].items.len(), 1);
        assert_eq!(cached.menu_categories[0].items[0].name, "Paneer Tikka");
        assert_eq!(cached.dining_areas.len(), 1);
        assert_eq!(cached.dining_areas[0].tables.len(), 1);
        assert_eq!(cached.dining_areas[0].tables[0].table_name, "T1");

        let settings = cached.business_settings.expect("Settings missing");
        assert_eq!(settings["currency"], "INR");

        let status = get_cache_status(&conn, "biz-123").expect("Status check failed");
        assert!(status.has_cache);
        assert_eq!(status.category_count, 1);
        assert_eq!(status.item_count, 1);
        assert_eq!(status.area_count, 1);
        assert_eq!(status.table_count, 1);
        assert!(status.has_settings);

        drop(conn);
        let _ = fs::remove_file(&db_path);
    }

    #[test]
    fn test_atomic_rollback_on_failure() {
        let (db_path, mut conn) = create_test_db("rollback");

        // Seed with valid snapshot
        let snapshot1 = sample_snapshot("biz-123");
        apply_master_data_snapshot(&mut conn, &snapshot1, true).expect("Seed failed");

        // Attempt a bad snapshot with a tenant violation inside a nested item
        let mut bad_snapshot = sample_snapshot("biz-123");
        bad_snapshot.menu_categories[0].items[0].business_id = "biz-ATTACKER".to_string();

        let res = apply_master_data_snapshot(&mut conn, &bad_snapshot, true);
        assert!(res.is_err(), "Should fail on tenant mismatch");

        // Verify that prior cache remains completely intact and was not cleared
        let cached = read_master_data_cache(&conn, "biz-123")
            .expect("Read failed")
            .expect("Cache should exist");
        assert_eq!(cached.menu_categories.len(), 1);
        assert_eq!(cached.menu_categories[0].items[0].name, "Paneer Tikka");

        drop(conn);
        let _ = fs::remove_file(&db_path);
    }

    #[test]
    fn test_full_snapshot_replaces_stale_records() {
        let (db_path, mut conn) = create_test_db("full_replace");

        // Initial snapshot with 1 category and 1 item
        let snapshot1 = sample_snapshot("biz-123");
        apply_master_data_snapshot(&mut conn, &snapshot1, true).expect("First apply failed");

        // Second snapshot where the old category was removed and a new one exists
        let mut snapshot2 = sample_snapshot("biz-123");
        snapshot2.menu_categories[0].id = "cat-2".to_string();
        snapshot2.menu_categories[0].name = "Main Course".to_string();
        snapshot2.menu_categories[0].items[0].id = "item-2".to_string();
        snapshot2.menu_categories[0].items[0].category_id = "cat-2".to_string();
        snapshot2.menu_categories[0].items[0].name = "Butter Roti".to_string();

        apply_master_data_snapshot(&mut conn, &snapshot2, true).expect("Second apply failed");

        let cached = read_master_data_cache(&conn, "biz-123")
            .expect("Read failed")
            .expect("Cache should exist");

        // The stale "Starters" category and "Paneer Tikka" item must NOT exist
        assert_eq!(cached.menu_categories.len(), 1);
        assert_eq!(cached.menu_categories[0].id, "cat-2");
        assert_eq!(cached.menu_categories[0].name, "Main Course");
        assert_eq!(cached.menu_categories[0].items[0].name, "Butter Roti");

        drop(conn);
        let _ = fs::remove_file(&db_path);
    }

    #[test]
    fn test_incremental_delta_does_not_delete_unseen_records() {
        let (db_path, mut conn) = create_test_db("delta");

        // Initial snapshot
        let snapshot1 = sample_snapshot("biz-123");
        apply_master_data_snapshot(&mut conn, &snapshot1, true).expect("Initial apply failed");

        // Delta snapshot: contains only a new category and item, omitting the existing "Starters"
        let mut delta = sample_snapshot("biz-123");
        delta.menu_categories[0].id = "cat-new".to_string();
        delta.menu_categories[0].name = "Beverages".to_string();
        delta.menu_categories[0].items[0].id = "item-new".to_string();
        delta.menu_categories[0].items[0].category_id = "cat-new".to_string();
        delta.menu_categories[0].items[0].name = "Masala Chai".to_string();
        delta.dining_areas.clear(); // omitted from delta

        // Apply with is_full_snapshot = false
        apply_master_data_snapshot(&mut conn, &delta, false).expect("Delta apply failed");

        let cached = read_master_data_cache(&conn, "biz-123")
            .expect("Read failed")
            .expect("Cache should exist");

        // Both Starters AND Beverages must exist
        assert_eq!(cached.menu_categories.len(), 2);
        assert!(cached.menu_categories.iter().any(|c| c.name == "Starters"));
        assert!(cached.menu_categories.iter().any(|c| c.name == "Beverages"));

        // Dining areas must not have been deleted
        assert_eq!(cached.dining_areas.len(), 1);

        drop(conn);
        let _ = fs::remove_file(&db_path);
    }

    #[test]
    fn test_tenant_isolation_boundary() {
        let (db_path, mut conn) = create_test_db("tenant_iso");

        let snap_a = sample_snapshot("biz-AAA");
        let snap_b = sample_snapshot("biz-BBB");

        apply_master_data_snapshot(&mut conn, &snap_a, true).expect("Apply A failed");
        apply_master_data_snapshot(&mut conn, &snap_b, true).expect("Apply B failed");

        let cache_a = read_master_data_cache(&conn, "biz-AAA")
            .expect("Read A failed")
            .expect("Cache A missing");
        let cache_b = read_master_data_cache(&conn, "biz-BBB")
            .expect("Read B failed")
            .expect("Cache B missing");

        assert_eq!(cache_a.business_id, "biz-AAA");
        assert_eq!(cache_b.business_id, "biz-BBB");

        // Modify A, ensure B is untouched
        let mut snap_a2 = sample_snapshot("biz-AAA");
        snap_a2.menu_categories.clear();
        snap_a2.dining_areas.clear();
        apply_master_data_snapshot(&mut conn, &snap_a2, true).expect("Apply A2 failed");

        let cache_a_empty = read_master_data_cache(&conn, "biz-AAA").unwrap().unwrap();
        let cache_b_intact = read_master_data_cache(&conn, "biz-BBB").unwrap().unwrap();

        assert_eq!(cache_a_empty.menu_categories.len(), 0);
        assert_eq!(cache_b_intact.menu_categories.len(), 1);

        drop(conn);
        let _ = fs::remove_file(&db_path);
    }

    #[test]
    fn test_malformed_nested_relationship_rejection() {
        let (db_path, mut conn) = create_test_db("malformed_rel");

        let mut bad_snap = sample_snapshot("biz-123");
        // Nested item specifies a different category_id than its parent category
        bad_snap.menu_categories[0].items[0].category_id = "cat-DIFFERENT".to_string();

        let res = apply_master_data_snapshot(&mut conn, &bad_snap, true);
        assert!(res.is_err(), "Should reject mismatched category_id in item");
        let err = res.unwrap_err();
        assert!(err.contains("Relationship violation"));

        drop(conn);
        let _ = fs::remove_file(&db_path);
    }

    #[test]
    fn test_full_snapshot_removes_settings_when_none_provided() {
        let (db_path, mut conn) = create_test_db("settings_policy");

        // 1. Initial snapshot with settings
        let snap1 = sample_snapshot("biz-123");
        apply_master_data_snapshot(&mut conn, &snap1, true).expect("Apply 1 failed");
        let cache1 = read_master_data_cache(&conn, "biz-123").unwrap().unwrap();
        assert!(cache1.business_settings.is_some());

        // 2. Full snapshot with business_settings = None (explicit removal policy)
        let mut snap2 = sample_snapshot("biz-123");
        snap2.business_settings = None;
        apply_master_data_snapshot(&mut conn, &snap2, true).expect("Apply 2 failed");

        let cache2 = read_master_data_cache(&conn, "biz-123").unwrap().unwrap();
        assert!(
            cache2.business_settings.is_none(),
            "Full snapshot with None settings must remove stale settings"
        );

        drop(conn);
        let _ = fs::remove_file(&db_path);
    }

    #[test]
    fn test_read_cache_distinguishes_no_cache_from_corrupted_json() {
        let (db_path, mut conn) = create_test_db("json_corrupt");

        // Valid read before any sync state -> Ok(None)
        let no_cache = read_master_data_cache(&conn, "biz-nonexistent").unwrap();
        assert!(no_cache.is_none(), "Uncached business returns Ok(None)");

        // Apply a valid snapshot
        let snap = sample_snapshot("biz-123");
        apply_master_data_snapshot(&mut conn, &snap, true).expect("Apply failed");

        // Directly corrupt the settings_json column in SQLite
        conn.execute(
            "UPDATE cached_business_settings SET settings_json = 'INVALID_NOT_JSON{' WHERE business_id = 'biz-123';",
            [],
        )
        .expect("Update failed");

        // Now read_master_data_cache MUST return an Err, NOT Ok(None)
        let res = read_master_data_cache(&conn, "biz-123");
        assert!(res.is_err(), "Corrupted settings JSON must return Err");
        let err = res.unwrap_err();
        assert!(err.contains("Failed to decode cached business settings JSON"));

        drop(conn);
        let _ = fs::remove_file(&db_path);
    }
}

