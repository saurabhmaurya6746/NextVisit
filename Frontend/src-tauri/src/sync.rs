use std::time::{SystemTime, UNIX_EPOCH};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::db::{open_connection, resolve_db_path};
use crate::local_orders::now_iso;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutboxItem {
    pub client_tx_id: String,
    pub business_id: String,
    pub device_id: String,
    pub operation_type: String,
    pub payload_json: String,
    pub status: String, // 'PENDING', 'SENDING', 'COMMITTED', 'FAILED', 'CONFLICT'
    pub retry_count: i64,
    pub last_error: Option<String>,
    pub next_retry_at: Option<String>,
    pub updated_at: Option<String>,
    pub last_http_status: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutboxSummary {
    pub business_id: String,
    pub total_count: i64,
    pub pending_count: i64,
    pub sending_count: i64,
    pub committed_count: i64,
    pub failed_count: i64,
    pub conflict_count: i64,
    pub oldest_pending_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcknowledgeItemInput {
    pub business_id: String,
    pub client_tx_id: String,
    pub outcome: String, // "COMMITTED" (or "SUCCESS", "ALREADY_COMMITTED"), "CONFLICT", "FAILED", "RETRY"
    pub error: Option<String>,
    pub http_status: Option<i64>,
    pub backoff_secs: Option<i64>,
    #[serde(default)]
    pub response_data: Option<serde_json::Value>,
}

/// Computes an ISO-8601 UTC timestamp offset by the given number of seconds.
pub fn offset_now_iso(seconds: i64) -> String {
    let now = SystemTime::now();
    let target = if seconds >= 0 {
        now.checked_add(std::time::Duration::from_secs(seconds as u64)).unwrap_or(now)
    } else {
        now.checked_sub(std::time::Duration::from_secs((-seconds) as u64)).unwrap_or(now)
    };
    let ms = target.duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let secs = (ms / 1000) as i64;
    let millis = (ms % 1000) as u32;
    let days = secs.div_euclid(86400);
    let day_secs = secs.rem_euclid(86400);

    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    let (year, month, day) = (y + if m <= 2 { 1 } else { 0 }, m, d);

    format!("{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{millis:03}Z", day_secs / 3600, (day_secs % 3600) / 60, day_secs % 60)
}

/// Resets any outbox items stuck in 'SENDING' state back to 'PENDING'.
/// Called on application startup and when the sync worker initializes to recover
/// from unexpected app or system crashes during a sync push.
pub fn reset_in_flight(conn: &mut Connection, business_id: &str) -> Result<usize, String> {
    let now = now_iso();
    let changed = conn
        .execute(
            "UPDATE client_outbox
             SET status = 'PENDING', updated_at = ?1
             WHERE business_id = ?2 AND status = 'SENDING'",
            params![now, business_id],
        )
        .map_err(|e| format!("Failed to reset in-flight outbox items: {e}"))?;
    Ok(changed)
}

/// Retrieves a batch of pending outbox items that are ready to sync.
/// Respects next_retry_at backoff schedules.
pub fn get_pending_batch(
    conn: &Connection,
    business_id: &str,
    limit: i64,
) -> Result<Vec<OutboxItem>, String> {
    let now = now_iso();
    let mut stmt = conn
        .prepare(
            "SELECT client_tx_id, business_id, device_id, operation_type, payload_json,
                    status, retry_count, last_error, next_retry_at, updated_at,
                    last_http_status, created_at
             FROM client_outbox
             WHERE business_id = ?1
               AND status = 'PENDING'
               AND (next_retry_at IS NULL OR next_retry_at <= ?2)
             ORDER BY created_at ASC
             LIMIT ?3",
        )
        .map_err(|e| format!("Failed to prepare pending outbox query: {e}"))?;

    let rows = stmt
        .query_map(params![business_id, now, limit], |r| {
            Ok(OutboxItem {
                client_tx_id: r.get(0)?,
                business_id: r.get(1)?,
                device_id: r.get(2)?,
                operation_type: r.get(3)?,
                payload_json: r.get(4)?,
                status: r.get(5)?,
                retry_count: r.get(6)?,
                last_error: r.get(7)?,
                next_retry_at: r.get(8)?,
                updated_at: r.get(9)?,
                last_http_status: r.get(10)?,
                created_at: r.get(11)?,
            })
        })
        .map_err(|e| format!("Failed to execute pending outbox query: {e}"))?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|e| format!("Error mapping outbox row: {e}"))?);
    }
    Ok(items)
}

/// Atomically transitions the given client_tx_ids from 'PENDING' to 'SENDING'.
pub fn mark_sending(
    conn: &mut Connection,
    business_id: &str,
    tx_ids: &[String],
) -> Result<(), String> {
    if tx_ids.is_empty() {
        return Ok(());
    }
    let now = now_iso();
    let tx = conn
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|e| format!("Failed to start mark_sending transaction: {e}"))?;

    for id in tx_ids {
        tx.execute(
            "UPDATE client_outbox
             SET status = 'SENDING', updated_at = ?1
             WHERE business_id = ?2 AND client_tx_id = ?3 AND status = 'PENDING'",
            params![now, business_id, id],
        )
        .map_err(|e| format!("Failed to mark tx {id} as SENDING: {e}"))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit mark_sending transaction: {e}"))?;
    Ok(())
}

/// Atomically acknowledges the outcome of a single outbox transaction.
/// If committed, safely transitions the corresponding local order sync_status to 'SYNCED'.
pub fn acknowledge_item(
    conn: &mut Connection,
    input: &AcknowledgeItemInput,
) -> Result<(), String> {
    let now = now_iso();
    let tx = conn
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|e| format!("Failed to start acknowledge_item transaction: {e}"))?;

    // 1. Fetch current transaction record
    let row_data: Option<(String, String)> = tx
        .query_row(
            "SELECT operation_type, payload_json FROM client_outbox
             WHERE business_id = ?1 AND client_tx_id = ?2",
            params![input.business_id, input.client_tx_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(|e| format!("Database error fetching outbox item: {e}"))?;

    let (op_type, payload_json) = match row_data {
        Some(d) => d,
        None => return Err(format!("Outbox item '{}' not found", input.client_tx_id)),
    };

    let outcome_upper = input.outcome.trim().to_uppercase();

    match outcome_upper.as_str() {
        "COMMITTED" | "SUCCESS" | "ALREADY_COMMITTED" => {
            // Update outbox row to COMMITTED
            tx.execute(
                "UPDATE client_outbox
                 SET status = 'COMMITTED',
                     last_error = NULL,
                     last_http_status = ?1,
                     next_retry_at = NULL,
                     updated_at = ?2
                 WHERE business_id = ?3 AND client_tx_id = ?4",
                params![input.http_status.unwrap_or(200), now, input.business_id, input.client_tx_id],
            )
            .map_err(|e| format!("Failed to update outbox to COMMITTED: {e}"))?;

            // Transition local order sync_status to SYNCED
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&payload_json) {
                if op_type == "CREATE_ORDER" {
                    if let Some(order_id) = v.get("client_order_id").and_then(|s| s.as_str()) {
                        // Check if server remapped the order_number on sequence collision
                        let server_order_num = input
                            .response_data
                            .as_ref()
                            .and_then(|d| d.get("order_number").and_then(|s| s.as_str()))
                            .filter(|s| !s.trim().is_empty());

                        if let Some(new_num) = server_order_num {
                            // Atomically update local_orders with server remapped order_number
                            tx.execute(
                                "UPDATE local_orders
                                 SET sync_status = 'SYNCED', order_number = ?1, updated_at = ?2
                                 WHERE id = ?3 AND business_id = ?4",
                                params![new_num, now, order_id, input.business_id],
                            )
                            .map_err(|e| format!("Failed to update local order {order_id} with server order_number: {e}"))?;

                            let new_receipt_ref = format!("REC-{new_num}");

                            // Atomically update local_payments receipt_reference
                            tx.execute(
                                "UPDATE local_payments
                                 SET receipt_reference = ?1
                                 WHERE order_id = ?2 AND business_id = ?3",
                                params![new_receipt_ref, order_id, input.business_id],
                            )
                            .map_err(|e| format!("Failed to update local payment receipt_reference for order {order_id}: {e}"))?;

                            // Atomically update any pending SETTLE_ORDER in client_outbox for this order
                            let mut stmt = tx.prepare(
                                "SELECT client_tx_id, payload_json FROM client_outbox
                                 WHERE business_id = ?1 AND operation_type = 'SETTLE_ORDER' AND status = 'PENDING'",
                            ).map_err(|e| e.to_string())?;

                            let settle_rows: Vec<(String, String)> = stmt
                                .query_map(params![input.business_id], |r| Ok((r.get(0)?, r.get(1)?)))
                                .map_err(|e| e.to_string())?
                                .filter_map(|r| r.ok())
                                .collect();

                            for (s_tx_id, s_payload_str) in settle_rows {
                                if let Ok(mut s_val) = serde_json::from_str::<serde_json::Value>(&s_payload_str) {
                                    if s_val.get("order_id").and_then(|s| s.as_str()) == Some(order_id) {
                                        if let Some(s_data) = s_val.get_mut("settle_data") {
                                            s_data["receipt_reference"] = serde_json::json!(new_receipt_ref);
                                            let updated_payload = s_val.to_string();
                                            tx.execute(
                                                "UPDATE client_outbox
                                                 SET payload_json = ?1, updated_at = ?2
                                                 WHERE client_tx_id = ?3 AND business_id = ?4",
                                                params![updated_payload, now, s_tx_id, input.business_id],
                                            ).map_err(|e| format!("Failed to update settle outbox payload: {e}"))?;
                                        }
                                    }
                                }
                            }
                        } else {
                            tx.execute(
                                "UPDATE local_orders
                                 SET sync_status = 'SYNCED', updated_at = ?1
                                 WHERE id = ?2 AND business_id = ?3",
                                params![now, order_id, input.business_id],
                            )
                            .map_err(|e| format!("Failed to mark local order {order_id} SYNCED: {e}"))?;
                        }
                    }
                } else if op_type == "SETTLE_ORDER" {
                    if let Some(order_id) = v.get("order_id").and_then(|s| s.as_str()) {
                        tx.execute(
                            "UPDATE local_orders
                             SET sync_status = 'SYNCED', updated_at = ?1
                             WHERE id = ?2 AND business_id = ?3",
                            params![now, order_id, input.business_id],
                        )
                        .map_err(|e| format!("Failed to mark local order {order_id} SYNCED: {e}"))?;
                    }
                }
            }
        }
        "CONFLICT" => {
            // Mark conflict; do not retry automatically without operator review
            tx.execute(
                "UPDATE client_outbox
                 SET status = 'CONFLICT',
                     last_error = ?1,
                     last_http_status = ?2,
                     updated_at = ?3
                 WHERE business_id = ?4 AND client_tx_id = ?5",
                params![input.error, input.http_status.unwrap_or(409), now, input.business_id, input.client_tx_id],
            )
            .map_err(|e| format!("Failed to update outbox to CONFLICT: {e}"))?;
        }
        "FAILED" => {
            // Permanent failure (e.g. 400 validation error); increment retry_count but mark FAILED
            tx.execute(
                "UPDATE client_outbox
                 SET status = 'FAILED',
                     retry_count = retry_count + 1,
                     last_error = ?1,
                     last_http_status = ?2,
                     updated_at = ?3
                 WHERE business_id = ?4 AND client_tx_id = ?5",
                params![input.error, input.http_status.unwrap_or(400), now, input.business_id, input.client_tx_id],
            )
            .map_err(|e| format!("Failed to update outbox to FAILED: {e}"))?;
        }
        "RETRY" => {
            // Transient failure; schedule retry with bounded exponential backoff
            let secs = input.backoff_secs.unwrap_or(5).clamp(1, 300);
            let next_retry = offset_now_iso(secs);

            tx.execute(
                "UPDATE client_outbox
                 SET status = 'PENDING',
                     retry_count = retry_count + 1,
                     next_retry_at = ?1,
                     last_error = ?2,
                     last_http_status = ?3,
                     updated_at = ?4
                 WHERE business_id = ?5 AND client_tx_id = ?6",
                params![next_retry, input.error, input.http_status, now, input.business_id, input.client_tx_id],
            )
            .map_err(|e| format!("Failed to schedule outbox RETRY: {e}"))?;
        }
        other => return Err(format!("Unknown acknowledge outcome '{other}'")),
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit acknowledge_item transaction: {e}"))?;
    Ok(())
}

/// Operator manual action: resets a failed or conflicted item back to 'PENDING' for immediate retry.
pub fn retry_item(
    conn: &mut Connection,
    business_id: &str,
    client_tx_id: &str,
) -> Result<(), String> {
    let now = now_iso();
    let updated = conn
        .execute(
            "UPDATE client_outbox
             SET status = 'PENDING',
                 retry_count = 0,
                 next_retry_at = NULL,
                 last_error = NULL,
                 updated_at = ?1
             WHERE business_id = ?2 AND client_tx_id = ?3",
            params![now, business_id, client_tx_id],
        )
        .map_err(|e| format!("Failed to retry outbox item: {e}"))?;

    if updated == 0 {
        return Err(format!("Outbox item '{client_tx_id}' not found for business"));
    }
    Ok(())
}

/// Retrieves an aggregate status summary of the local outbox.
pub fn get_summary(
    conn: &Connection,
    business_id: &str,
) -> Result<OutboxSummary, String> {
    let total_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM client_outbox WHERE business_id = ?1",
            params![business_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Error counting total outbox items: {e}"))?;

    let pending_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM client_outbox WHERE business_id = ?1 AND status = 'PENDING'",
            params![business_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Error counting pending outbox items: {e}"))?;

    let sending_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM client_outbox WHERE business_id = ?1 AND status = 'SENDING'",
            params![business_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Error counting sending outbox items: {e}"))?;

    let committed_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM client_outbox WHERE business_id = ?1 AND status = 'COMMITTED'",
            params![business_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Error counting committed outbox items: {e}"))?;

    let failed_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM client_outbox WHERE business_id = ?1 AND status = 'FAILED'",
            params![business_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Error counting failed outbox items: {e}"))?;

    let conflict_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM client_outbox WHERE business_id = ?1 AND status = 'CONFLICT'",
            params![business_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Error counting conflict outbox items: {e}"))?;

    let oldest_pending_at: Option<String> = conn
        .query_row(
            "SELECT min(created_at) FROM client_outbox WHERE business_id = ?1 AND status = 'PENDING'",
            params![business_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| format!("Error finding oldest pending outbox item: {e}"))?
        .flatten();

    Ok(OutboxSummary {
        business_id: business_id.to_string(),
        total_count,
        pending_count,
        sending_count,
        committed_count,
        failed_count,
        conflict_count,
        oldest_pending_at,
    })
}

/// Lists outbox records with optional status filter for the operator UI.
pub fn list_items(
    conn: &Connection,
    business_id: &str,
    status_filter: Option<&str>,
    limit: i64,
) -> Result<Vec<OutboxItem>, String> {
    let clean_filter = status_filter
        .map(|s| s.trim().to_uppercase())
        .filter(|s| !s.is_empty() && s != "ALL");

    let mut items = Vec::new();

    if let Some(st) = clean_filter {
        let mut stmt = conn
            .prepare(
                "SELECT client_tx_id, business_id, device_id, operation_type, payload_json,
                        status, retry_count, last_error, next_retry_at, updated_at,
                        last_http_status, created_at
                 FROM client_outbox
                 WHERE business_id = ?1 AND status = ?2
                 ORDER BY created_at DESC
                 LIMIT ?3",
            )
            .map_err(|e| format!("Failed to prepare list_items filtered: {e}"))?;

        let rows = stmt
            .query_map(params![business_id, st, limit], |r| {
                Ok(OutboxItem {
                    client_tx_id: r.get(0)?,
                    business_id: r.get(1)?,
                    device_id: r.get(2)?,
                    operation_type: r.get(3)?,
                    payload_json: r.get(4)?,
                    status: r.get(5)?,
                    retry_count: r.get(6)?,
                    last_error: r.get(7)?,
                    next_retry_at: r.get(8)?,
                    updated_at: r.get(9)?,
                    last_http_status: r.get(10)?,
                    created_at: r.get(11)?,
                })
            })
            .map_err(|e| format!("Failed to execute list_items filtered: {e}"))?;

        for row in rows {
            items.push(row.map_err(|e| format!("Error reading outbox row: {e}"))?);
        }
    } else {
        let mut stmt = conn
            .prepare(
                "SELECT client_tx_id, business_id, device_id, operation_type, payload_json,
                        status, retry_count, last_error, next_retry_at, updated_at,
                        last_http_status, created_at
                 FROM client_outbox
                 WHERE business_id = ?1
                 ORDER BY created_at DESC
                 LIMIT ?2",
            )
            .map_err(|e| format!("Failed to prepare list_items all: {e}"))?;

        let rows = stmt
            .query_map(params![business_id, limit], |r| {
                Ok(OutboxItem {
                    client_tx_id: r.get(0)?,
                    business_id: r.get(1)?,
                    device_id: r.get(2)?,
                    operation_type: r.get(3)?,
                    payload_json: r.get(4)?,
                    status: r.get(5)?,
                    retry_count: r.get(6)?,
                    last_error: r.get(7)?,
                    next_retry_at: r.get(8)?,
                    updated_at: r.get(9)?,
                    last_http_status: r.get(10)?,
                    created_at: r.get(11)?,
                })
            })
            .map_err(|e| format!("Failed to execute list_items all: {e}"))?;

        for row in rows {
            items.push(row.map_err(|e| format!("Error reading outbox row: {e}"))?);
        }
    }

    Ok(items)
}

// ---------------------------------------------------------------------------
// Tauri IPC Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn outbox_reset_in_flight(
    app: AppHandle,
    business_id: String,
) -> Result<usize, String> {
    let path = resolve_db_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut conn = open_connection(&path).map_err(|e| format!("Cannot open DB: {e}"))?;
        reset_in_flight(&mut conn, &business_id)
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn outbox_get_pending_batch(
    app: AppHandle,
    business_id: String,
    limit: i64,
) -> Result<Vec<OutboxItem>, String> {
    let path = resolve_db_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(&path).map_err(|e| format!("Cannot open DB: {e}"))?;
        get_pending_batch(&conn, &business_id, limit)
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn outbox_mark_sending(
    app: AppHandle,
    business_id: String,
    tx_ids: Vec<String>,
) -> Result<(), String> {
    let path = resolve_db_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut conn = open_connection(&path).map_err(|e| format!("Cannot open DB: {e}"))?;
        mark_sending(&mut conn, &business_id, &tx_ids)
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn outbox_acknowledge_item(
    app: AppHandle,
    input: AcknowledgeItemInput,
) -> Result<(), String> {
    let path = resolve_db_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut conn = open_connection(&path).map_err(|e| format!("Cannot open DB: {e}"))?;
        acknowledge_item(&mut conn, &input)
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn outbox_retry_item(
    app: AppHandle,
    business_id: String,
    client_tx_id: String,
) -> Result<(), String> {
    let path = resolve_db_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut conn = open_connection(&path).map_err(|e| format!("Cannot open DB: {e}"))?;
        retry_item(&mut conn, &business_id, &client_tx_id)
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn outbox_get_summary(
    app: AppHandle,
    business_id: String,
) -> Result<OutboxSummary, String> {
    let path = resolve_db_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(&path).map_err(|e| format!("Cannot open DB: {e}"))?;
        get_summary(&conn, &business_id)
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn outbox_list_items(
    app: AppHandle,
    business_id: String,
    status_filter: Option<String>,
    limit: i64,
) -> Result<Vec<OutboxItem>, String> {
    let path = resolve_db_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(&path).map_err(|e| format!("Cannot open DB: {e}"))?;
        list_items(&conn, &business_id, status_filter.as_deref(), limit)
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::initialize_database;
    use std::{fs, path::PathBuf};

    fn test_db() -> PathBuf {
        let id = format!("sync_test_{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos());
        let path = std::env::temp_dir().join(format!("{id}.db"));
        initialize_database(&path).expect("initialize_database failed");
        path
    }

    #[test]
    fn test_outbox_queue_lifecycle_and_acknowledgement() {
        let db_path = test_db();
        let mut conn = open_connection(&db_path).unwrap();
        let biz = "biz_sync_1";
        let dev = "dev_pos_01";
        let tx1 = "tx_001";
        let order_id = "ord_001";

        // Insert local order
        conn.execute(
            "INSERT INTO local_orders (id, business_id, device_id, order_number, table_id, status, subtotal, tax_amount, discount_amount, total_amount, sync_status, created_at, updated_at)
             VALUES (?1, ?2, ?3, 'ORD-POS01-000001', 'tbl_1', 'OPEN', 100.0, 5.0, 0.0, 105.0, 'PENDING', '2026-10-19T10:00:00.000Z', '2026-10-19T10:00:00.000Z')",
            params![order_id, biz, dev],
        ).unwrap();

        let payload = serde_json::json!({
            "client_order_id": order_id,
            "order_number": "ORD-POS01-000001"
        }).to_string();

        // Insert into outbox
        conn.execute(
            "INSERT INTO client_outbox (client_tx_id, business_id, device_id, operation_type, payload_json, status, created_at)
             VALUES (?1, ?2, ?3, 'CREATE_ORDER', ?4, 'PENDING', '2026-10-19T10:00:00.000Z')",
            params![tx1, biz, dev, payload],
        ).unwrap();

        // 1. Check summary
        let summary = get_summary(&conn, biz).unwrap();
        assert_eq!(summary.total_count, 1);
        assert_eq!(summary.pending_count, 1);
        assert_eq!(summary.committed_count, 0);

        // 2. Fetch pending batch
        let batch = get_pending_batch(&conn, biz, 10).unwrap();
        assert_eq!(batch.len(), 1);
        assert_eq!(batch[0].client_tx_id, tx1);

        // 3. Mark sending
        mark_sending(&mut conn, biz, &[tx1.to_string()]).unwrap();
        let batch_after_sending = get_pending_batch(&conn, biz, 10).unwrap();
        assert_eq!(batch_after_sending.len(), 0);

        let summary2 = get_summary(&conn, biz).unwrap();
        assert_eq!(summary2.sending_count, 1);

        // 4. Test crash recovery: reset_in_flight
        let recovered = reset_in_flight(&mut conn, biz).unwrap();
        assert_eq!(recovered, 1);
        let batch_recovered = get_pending_batch(&conn, biz, 10).unwrap();
        assert_eq!(batch_recovered.len(), 1);

        // 5. Mark sending again and acknowledge as COMMITTED
        mark_sending(&mut conn, biz, &[tx1.to_string()]).unwrap();
        acknowledge_item(&mut conn, &AcknowledgeItemInput {
            business_id: biz.to_string(),
            client_tx_id: tx1.to_string(),
            outcome: "COMMITTED".to_string(),
            error: None,
            http_status: Some(200),
            backoff_secs: None,
            response_data: None,
        }).unwrap();

        // 6. Verify local order sync_status transitioned to SYNCED
        let order_sync_status: String = conn.query_row(
            "SELECT sync_status FROM local_orders WHERE id = ?1",
            params![order_id],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(order_sync_status, "SYNCED");

        let summary3 = get_summary(&conn, biz).unwrap();
        assert_eq!(summary3.committed_count, 1);
        assert_eq!(summary3.pending_count, 0);

        let _ = fs::remove_file(&db_path);
    }

    #[test]
    fn test_outbox_retry_backoff_and_manual_retry() {
        let db_path = test_db();
        let mut conn = open_connection(&db_path).unwrap();
        let biz = "biz_sync_2";
        let dev = "dev_pos_02";
        let tx2 = "tx_002";

        conn.execute(
            "INSERT INTO client_outbox (client_tx_id, business_id, device_id, operation_type, payload_json, status, created_at)
             VALUES (?1, ?2, ?3, 'SETTLE_ORDER', '{}', 'PENDING', '2026-10-19T10:00:00.000Z')",
            params![tx2, biz, dev],
        ).unwrap();

        // Simulate transient network failure with backoff schedule (100 seconds in future)
        acknowledge_item(&mut conn, &AcknowledgeItemInput {
            business_id: biz.to_string(),
            client_tx_id: tx2.to_string(),
            outcome: "RETRY".to_string(),
            error: Some("503 Service Unavailable".to_string()),
            http_status: Some(503),
            backoff_secs: Some(100),
            response_data: None,
        }).unwrap();

        // It should NOT be returned by get_pending_batch right now because next_retry_at is in the future
        let pending = get_pending_batch(&conn, biz, 10).unwrap();
        assert_eq!(pending.len(), 0);

        // Operator triggers manual retry
        retry_item(&mut conn, biz, tx2).unwrap();

        // Now it is immediately ready in pending batch!
        let pending_after = get_pending_batch(&conn, biz, 10).unwrap();
        assert_eq!(pending_after.len(), 1);
        assert_eq!(pending_after[0].retry_count, 0);
        assert_eq!(pending_after[0].last_error, None);

        let _ = fs::remove_file(&db_path);
    }

    #[test]
    fn test_conflict_and_failed_states_do_not_silently_drop() {
        let db_path = test_db();
        let mut conn = open_connection(&db_path).unwrap();
        let biz = "biz_sync_3";
        let dev = "dev_pos_03";
        let tx_conflict = "tx_conf";
        let tx_fail = "tx_fail";

        conn.execute(
            "INSERT INTO client_outbox (client_tx_id, business_id, device_id, operation_type, payload_json, status, created_at)
             VALUES (?1, ?2, ?3, 'CREATE_ORDER', '{}', 'PENDING', '2026-10-19T10:00:00.000Z')",
            params![tx_conflict, biz, dev],
        ).unwrap();

        conn.execute(
            "INSERT INTO client_outbox (client_tx_id, business_id, device_id, operation_type, payload_json, status, created_at)
             VALUES (?1, ?2, ?3, 'CREATE_ORDER', '{}', 'PENDING', '2026-10-19T10:00:01.000Z')",
            params![tx_fail, biz, dev],
        ).unwrap();

        // Mark conflict
        acknowledge_item(&mut conn, &AcknowledgeItemInput {
            business_id: biz.to_string(),
            client_tx_id: tx_conflict.to_string(),
            outcome: "CONFLICT".to_string(),
            error: Some("Hash mismatch for existing transaction".to_string()),
            http_status: Some(409),
            backoff_secs: None,
            response_data: None,
        }).unwrap();

        // Mark failed
        acknowledge_item(&mut conn, &AcknowledgeItemInput {
            business_id: biz.to_string(),
            client_tx_id: tx_fail.to_string(),
            outcome: "FAILED".to_string(),
            error: Some("422 Unprocessable Entity".to_string()),
            http_status: Some(422),
            backoff_secs: None,
            response_data: None,
        }).unwrap();

        // Neither is returned in pending batch
        let pending = get_pending_batch(&conn, biz, 10).unwrap();
        assert_eq!(pending.len(), 0);

        // Both are visible in summary and listed items for operator review
        let summary = get_summary(&conn, biz).unwrap();
        assert_eq!(summary.conflict_count, 1);
        assert_eq!(summary.failed_count, 1);

        let list_conflict = list_items(&conn, biz, Some("CONFLICT"), 10).unwrap();
        assert_eq!(list_conflict.len(), 1);
        assert_eq!(list_conflict[0].last_error.as_deref(), Some("Hash mismatch for existing transaction"));

        let _ = fs::remove_file(&db_path);
    }

    #[test]
    fn test_order_number_remapping_on_sync_acknowledgement() {
        let db_path = test_db();
        let mut conn = open_connection(&db_path).unwrap();
        let biz = "biz_remap_1";
        let dev = "dev_pos_01";
        let order_id = "local-ord-uuid-001";
        let tx_create = "tx_create_001";
        let tx_settle = "tx_settle_001";
        let orig_order_num = "ORD-POS01-000001";
        let remapped_order_num = "ORD-POS01-000002";
        let orig_receipt_ref = "REC-ORD-POS01-000001";
        let expected_receipt_ref = "REC-ORD-POS01-000002";

        // 1. Insert local order
        conn.execute(
            "INSERT INTO local_orders (id, business_id, device_id, order_number, table_id, order_source, status, subtotal, tax_amount, discount_amount, total_amount, sync_status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 'table-1', 'POS', 'OPEN', 100.0, 5.0, 0.0, 105.0, 'PENDING', '2026-10-26T10:00:00.000Z', '2026-10-26T10:00:00.000Z')",
            params![order_id, biz, dev, orig_order_num],
        ).unwrap();

        // 2. Insert local payment
        conn.execute(
            "INSERT INTO local_payments (id, order_id, business_id, device_id, payment_method, amount, payment_status, receipt_reference, recorded_at)
             VALUES ('pay-001', ?1, ?2, ?3, 'CASH', 105.0, 'PAID', ?4, '2026-10-26T10:05:00.000Z')",
            params![order_id, biz, dev, orig_receipt_ref],
        ).unwrap();

        // 3. Insert CREATE_ORDER into outbox
        let create_payload = serde_json::json!({
            "client_order_id": order_id,
            "order_number": orig_order_num,
        }).to_string();
        conn.execute(
            "INSERT INTO client_outbox (client_tx_id, business_id, device_id, operation_type, payload_json, status, created_at)
             VALUES (?1, ?2, ?3, 'CREATE_ORDER', ?4, 'PENDING', '2026-10-26T10:00:00.000Z')",
            params![tx_create, biz, dev, create_payload],
        ).unwrap();

        // 4. Insert SETTLE_ORDER into outbox
        let settle_payload = serde_json::json!({
            "order_id": order_id,
            "settle_data": {
                "receipt_reference": orig_receipt_ref,
                "payment_method": "CASH"
            }
        }).to_string();
        conn.execute(
            "INSERT INTO client_outbox (client_tx_id, business_id, device_id, operation_type, payload_json, status, created_at)
             VALUES (?1, ?2, ?3, 'SETTLE_ORDER', ?4, 'PENDING', '2026-10-26T10:05:00.000Z')",
            params![tx_settle, biz, dev, settle_payload],
        ).unwrap();

        // 5. Acknowledge CREATE_ORDER with server remapped order_number
        let server_resp_data = serde_json::json!({
            "id": "server-ord-uuid-999",
            "order_number": remapped_order_num,
            "status": "OPEN",
        });

        acknowledge_item(&mut conn, &AcknowledgeItemInput {
            business_id: biz.to_string(),
            client_tx_id: tx_create.to_string(),
            outcome: "COMMITTED".to_string(),
            error: None,
            http_status: Some(200),
            backoff_secs: None,
            response_data: Some(server_resp_data),
        }).unwrap();

        // Verify local_orders was updated with remapped order_number and SYNCED status
        let (saved_num, sync_stat): (String, String) = conn.query_row(
            "SELECT order_number, sync_status FROM local_orders WHERE id = ?1",
            [order_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).unwrap();
        assert_eq!(saved_num, remapped_order_num);
        assert_eq!(sync_stat, "SYNCED");

        // Verify local_payments was updated with new receipt_reference
        let saved_receipt: String = conn.query_row(
            "SELECT receipt_reference FROM local_payments WHERE order_id = ?1",
            [order_id],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(saved_receipt, expected_receipt_ref);

        // Verify pending SETTLE_ORDER in client_outbox had its payload updated
        let updated_settle_json: String = conn.query_row(
            "SELECT payload_json FROM client_outbox WHERE client_tx_id = ?1",
            [tx_settle],
            |r| r.get(0),
        ).unwrap();
        let parsed_settle: serde_json::Value = serde_json::from_str(&updated_settle_json).unwrap();
        assert_eq!(parsed_settle["settle_data"]["receipt_reference"], expected_receipt_ref);

        let _ = fs::remove_file(&db_path);
    }
}
