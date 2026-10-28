//! Atomic local POS order creation for the Phase 6 desktop offline path.

use crate::db::{open_connection, resolve_db_path};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalOrderItemInput {
    pub menu_item_id: Option<String>,
    pub item_name: String,
    pub unit_price: f64,
    pub quantity: i64,
    pub tax_rate: f64,
    pub discount: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalOrderInput {
    pub business_id: String,
    pub device_id: String,
    pub device_prefix: String,
    pub table_id: String,
    pub customer_id: Option<String>,
    pub notes: Option<String>,
    pub items: Vec<LocalOrderItemInput>,
    #[serde(default)]
    pub client_order_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalOrderItem {
    pub id: String,
    pub order_id: String,
    pub menu_item_id: Option<String>,
    pub service_id: Option<String>,
    pub item_name: String,
    pub unit_price: f64,
    pub quantity: i64,
    pub tax_rate: f64,
    pub discount: f64,
    pub subtotal: f64,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalOrder {
    pub id: String,
    pub business_id: String,
    pub table_id: String,
    pub customer_id: Option<String>,
    pub customer: Option<serde_json::Value>,
    pub order_number: String,
    pub order_source: String,
    pub status: String,
    pub subtotal: f64,
    pub tax_amount: f64,
    pub discount_amount: f64,
    pub total_amount: f64,
    pub notes: Option<String>,
    pub visit_token: Option<String>,
    pub created_by: Option<String>,
    pub items: Vec<LocalOrderItem>,
    pub created_at: String,
    pub updated_at: String,
    pub sync_status: String,
}

pub(crate) fn uuid_v4() -> String {
    let mut bytes = [0u8; 16];
    getrandom_fill(&mut bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let h = bytes.iter().map(|b| format!("{b:02x}")).collect::<String>();
    format!("{}-{}-{}-{}-{}", &h[0..8], &h[8..12], &h[12..16], &h[16..20], &h[20..32])
}

fn getrandom_fill(bytes: &mut [u8]) {
    // UUID uniqueness uses OS entropy, with a time/hash fallback only if unavailable.
    if let Ok(mut file) = std::fs::File::open("/dev/urandom") {
        use std::io::Read;
        if file.read_exact(bytes).is_ok() { return; }
    }
    #[cfg(windows)]
    unsafe {
        use std::ffi::c_void;
        #[link(name = "bcrypt")]
        extern "system" { fn BCryptGenRandom(h: *mut c_void, p: *mut u8, n: u32, f: u32) -> i32; }
        if BCryptGenRandom(std::ptr::null_mut(), bytes.as_mut_ptr(), bytes.len() as u32, 2) >= 0 { return; }
    }
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let mut hasher = Sha256::new();
    hasher.update(nanos.to_le_bytes());
    hasher.update(format!("{:?}", std::thread::current().id()));
    let digest = hasher.finalize();
    bytes.copy_from_slice(&digest[..bytes.len()]);
}

pub(crate) fn now_iso() -> String {
    // Millisecond UTC timestamp, compatible with backend ISO-8601 parsing.
    let ms = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let secs = (ms / 1000) as i64;
    let millis = (ms % 1000) as u32;
    let days = secs.div_euclid(86400);
    let day_secs = secs.rem_euclid(86400);
    let (year, month, day) = civil_from_days(days);
    format!("{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{millis:03}Z", day_secs / 3600, (day_secs % 3600) / 60, day_secs % 60)
}

fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe/1460 + doe/36524 - doe/146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365*yoe + yoe/4 - yoe/100);
    let mp = (5*doy + 2)/153;
    let d = doy - (153*mp+2)/5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    (y + if m <= 2 { 1 } else { 0 }, m, d)
}

fn validate(input: &LocalOrderInput) -> Result<(), String> {
    if input.business_id.trim().is_empty() || input.device_id.trim().is_empty() || input.table_id.trim().is_empty() {
        return Err("Business, registered device, and table are required for offline orders.".into());
    }
    let prefix = input.device_prefix.trim();
    if prefix.is_empty() || prefix.len() > 10 || !prefix.bytes().all(|b| b.is_ascii_uppercase() || b.is_ascii_digit()) {
        return Err("A valid registered device prefix is required for offline order numbering.".into());
    }
    if input.items.is_empty() { return Err("Cannot create an order with an empty cart.".into()); }
    for item in &input.items {
        if item.item_name.trim().is_empty() || item.quantity <= 0 || !item.unit_price.is_finite() || item.unit_price < 0.0 || !item.tax_rate.is_finite() || item.tax_rate < 0.0 || !item.discount.is_finite() || item.discount < 0.0 {
            return Err("Order contains an invalid item, price, quantity, tax, or discount.".into());
        }
        if item.discount > item.unit_price * item.quantity as f64 {
            return Err(format!("Discount exceeds the item amount for {}.", item.item_name));
        }
    }
    Ok(())
}

pub(crate) fn money(value: f64) -> f64 { (value * 100.0).round() / 100.0 }

pub fn create_local_order(path: &std::path::Path, input: &LocalOrderInput) -> Result<LocalOrder, String> {
    validate(input)?;
    let mut conn = open_connection(path).map_err(|e| format!("Cannot open local POS database: {e}"))?;
    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate).map_err(|e| format!("Cannot start local order transaction: {e}"))?;

    let sync_binding: Option<(String, Option<String>)> = tx
        .query_row(
            "SELECT business_id, device_id FROM sync_state WHERE business_id = ?1",
            [&input.business_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(|e| format!("Database error reading sync_state: {e}"))?;

    if let Some((biz, dev_opt)) = sync_binding {
        if biz != input.business_id {
            return Err("Local POS tenant binding does not match the active session.".into());
        }
        if let Some(dev) = dev_opt {
            if !dev.trim().is_empty() && dev != input.device_id {
                return Err("Local POS tenant/device binding does not match the active session.".into());
            }
        }
    }

    let seq_key = format!("order_sequence:{}:{}", input.business_id, input.device_id);
    let current: Option<i64> = tx.query_row("SELECT CAST(value AS INTEGER) FROM app_metadata WHERE key=?1", [&seq_key], |r| r.get(0)).optional().map_err(|e| e.to_string())?;
    let mut seq = current.unwrap_or(0);
    if seq == 0 {
        let prefix_pattern = format!("ORD-{}-%", input.device_prefix);
        let max_local: Option<String> = tx.query_row(
            "SELECT order_number FROM local_orders WHERE business_id = ?1 AND order_number LIKE ?2 ORDER BY order_number DESC LIMIT 1",
            params![&input.business_id, &prefix_pattern],
            |r| r.get(0),
        ).optional().unwrap_or(None);
        if let Some(ref max_num) = max_local {
            if let Some(digits) = max_num.strip_prefix(&format!("ORD-{}-", input.device_prefix)) {
                if let Ok(num) = digits.parse::<i64>() {
                    seq = seq.max(num);
                }
            }
        }
    }
    seq += 1;
    let order_number = format!("ORD-{}-{seq:06}", input.device_prefix);
    let order_id = input
        .client_order_id
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(uuid_v4);

    // If this client_order_id is already in local SQLite (e.g. repeated fallback or retry), return it idempotently
    let existing_local: Option<LocalOrder> = tx
        .query_row(
            "SELECT id, business_id, table_id, customer_id, order_number, order_source, status, subtotal, tax_amount, discount_amount, total_amount, notes, created_at, updated_at, sync_status FROM local_orders WHERE id = ?1",
            [&order_id],
            |r| {
                Ok(LocalOrder {
                    id: r.get(0)?,
                    business_id: r.get(1)?,
                    table_id: r.get(2)?,
                    customer_id: r.get(3)?,
                    customer: None,
                    order_number: r.get(4)?,
                    order_source: r.get(5)?,
                    status: r.get(6)?,
                    subtotal: r.get(7)?,
                    tax_amount: r.get(8)?,
                    discount_amount: r.get(9)?,
                    total_amount: r.get(10)?,
                    notes: r.get(11)?,
                    visit_token: None,
                    created_by: None,
                    items: vec![],
                    created_at: r.get(12)?,
                    updated_at: r.get(13)?,
                    sync_status: r.get(14)?,
                })
            },
        )
        .optional()
        .map_err(|e| format!("Database error checking existing local order: {e}"))?;

    if let Some(existing) = existing_local {
        return Ok(existing);
    }

    let tx_id = uuid_v4();
    let now = now_iso();

    let mut subtotal = 0.0;
    let mut tax = 0.0;
    let mut items = Vec::with_capacity(input.items.len());
    for raw in &input.items {
        let line_base = money(raw.unit_price * raw.quantity as f64 - raw.discount);
        let line_tax = money(line_base * raw.tax_rate / 100.0);
        subtotal += line_base;
        tax += line_tax;
        items.push(LocalOrderItem {
            id: uuid_v4(), order_id: order_id.clone(), menu_item_id: raw.menu_item_id.clone(), service_id: None,
            item_name: raw.item_name.clone(), unit_price: money(raw.unit_price), quantity: raw.quantity,
            tax_rate: raw.tax_rate, discount: money(raw.discount), subtotal: line_base,
            notes: raw.notes.clone(), created_at: now.clone(), updated_at: now.clone(),
        });
    }
    subtotal = money(subtotal);
    tax = money(tax);
    let total = money(subtotal + tax);
    let payload = serde_json::json!({
        "client_order_id": order_id, "order_number": order_number, "table_id": input.table_id,
        "customer_id": input.customer_id, "order_source": "POS", "status": "OPEN",
        "subtotal": subtotal, "tax_amount": tax, "discount_amount": 0.0, "total_amount": total,
        "notes": input.notes, "items": items, "device_id": input.device_id, "created_at": now,
    });

    tx.execute("INSERT INTO app_metadata(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')", params![seq_key, seq.to_string()]).map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO local_orders(id,business_id,device_id,order_number,table_id,customer_id,order_source,status,subtotal,tax_amount,discount_amount,total_amount,notes,sync_status,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,'POS','OPEN',?7,?8,0,?9,?10,'PENDING',?11,?11)", params![order_id,input.business_id,input.device_id,order_number,input.table_id,input.customer_id,subtotal,tax,total,input.notes,now]).map_err(|e| e.to_string())?;
    for item in &items {
        tx.execute("INSERT INTO local_order_items(id,order_id,menu_item_id,item_name,unit_price,quantity,tax_rate,discount,subtotal,notes) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)", params![item.id,item.order_id,item.menu_item_id,item.item_name,item.unit_price,item.quantity,item.tax_rate,item.discount,item.subtotal,item.notes]).map_err(|e| e.to_string())?;
    }
    tx.execute("INSERT INTO client_outbox(client_tx_id,business_id,device_id,operation_type,payload_json,status,created_at) VALUES(?1,?2,?3,'CREATE_ORDER',?4,'PENDING',?5)", params![tx_id,input.business_id,input.device_id,payload.to_string(),now]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| format!("Failed to commit local order: {e}"))?;

    Ok(LocalOrder { id: order_id, business_id: input.business_id.clone(), table_id: input.table_id.clone(), customer_id: input.customer_id.clone(), customer: None, order_number, order_source: "POS".into(), status: "OPEN".into(), subtotal, tax_amount: tax, discount_amount: 0.0, total_amount: total, notes: input.notes.clone(), visit_token: None, created_by: None, items, created_at: now.clone(), updated_at: now, sync_status: "PENDING".into() })
}

#[tauri::command]
pub async fn order_create_local(
    app: AppHandle,
    input: LocalOrderInput,
) -> Result<LocalOrder, String> {
    let path = resolve_db_path(&app)?;
    // SQLite uses synchronous rusqlite calls. Keep them off Tauri's command/UI
    // thread so a database lock or slow disk cannot leave the WebView frozen
    // with the Place Order spinner running indefinitely.
    tauri::async_runtime::spawn_blocking(move || create_local_order(&path, &input))
        .await
        .map_err(|e| format!("Local order task failed: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::initialize_database;
    use std::{fs, path::PathBuf};

    fn db() -> PathBuf {
        let p = std::env::temp_dir().join(format!("nv_order_{}.db", uuid_v4()));
        initialize_database(&p).unwrap(); p
    }
    fn sample() -> LocalOrderInput {
        LocalOrderInput { business_id: "biz-1".into(), device_id: "dev-1".into(), device_prefix: "POS01".into(), table_id: "table-1".into(), customer_id: None, notes: None, items: vec![LocalOrderItemInput { menu_item_id: Some("menu-1".into()), item_name: "Tea".into(), unit_price: 10.0, quantity: 2, tax_rate: 5.0, discount: 0.0, notes: None }], client_order_id: None }
    }
    #[test]
    fn creates_order_items_and_outbox_atomically_with_stable_ids() {
        let path = db();
        let order = create_local_order(&path, &sample()).unwrap();
        assert_eq!(order.order_number, "ORD-POS01-000001");
        assert_eq!((order.subtotal, order.tax_amount, order.total_amount), (20.0, 1.0, 21.0));
        assert_eq!(order.sync_status, "PENDING");
        let conn = open_connection(&path).unwrap();
        let counts: (i64,i64,i64) = conn.query_row("SELECT (SELECT count(*) FROM local_orders),(SELECT count(*) FROM local_order_items),(SELECT count(*) FROM client_outbox)", [], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?))).unwrap();
        assert_eq!(counts, (1,1,1));
        let second = create_local_order(&path, &sample()).unwrap();
        assert_ne!(order.id, second.id);
        assert_ne!(order.items[0].id, second.items[0].id);
        assert_eq!(second.order_number, "ORD-POS01-000002");
        drop(conn); let _ = fs::remove_file(path);
    }
    #[test]
    fn rejects_invalid_order_without_persisting_anything() {
        let path = db(); let mut input = sample(); input.items[0].quantity = 0;
        assert!(create_local_order(&path, &input).is_err());
        let conn = open_connection(&path).unwrap();
        let count: i64 = conn.query_row("SELECT count(*) FROM local_orders", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 0); drop(conn); let _ = fs::remove_file(path);
    }
}
