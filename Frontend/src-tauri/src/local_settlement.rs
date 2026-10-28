//! Phase 7: Local POS settlement, payments, and receipt lifecycle for offline operation.

use crate::db::{open_connection, resolve_db_path};
use crate::local_orders::{money, now_iso, uuid_v4, LocalOrder, LocalOrderItem};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSettleInput {
    pub business_id: String,
    pub device_id: String,
    pub device_prefix: String,
    pub order_id: String, // Can be local_orders.id or local_orders.order_number
    pub phone: String,
    pub customer_name: Option<String>,
    pub payment_method: String, // "CASH", "UPI", "CARD", "SPLIT"
    pub discount_amount: Option<f64>,
    pub reference_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSettleResult {
    pub order_id: String,
    pub order_number: String,
    pub receipt_reference: String,
    pub business_id: String,
    pub table_id: String,
    pub customer_id: Option<String>,
    pub customer_name: String,
    pub customer_phone: String,
    pub payment_method: String,
    pub payment_status: String,
    pub subtotal: f64,
    pub tax_amount: f64,
    pub discount_amount: f64,
    pub total_amount: f64,
    pub earned_points: i64,
    pub new_loyalty_balance: i64,
    pub remaining_until_next_reward: i64,
    pub visit_id: String,
    pub whatsapp_receipt_sent: bool,
    pub whatsapp_receipt_text: String,
    pub is_offline: bool,
    pub recorded_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalPaymentRecord {
    pub id: String,
    pub order_id: String,
    pub business_id: String,
    pub device_id: String,
    pub payment_method: String,
    pub amount: f64,
    pub payment_status: String,
    pub receipt_reference: String,
    pub reference_note: Option<String>,
    pub customer_phone: Option<String>,
    pub customer_name: Option<String>,
    pub recorded_at: String,
}

fn validate_settle_input(input: &LocalSettleInput) -> Result<(), String> {
    if input.business_id.trim().is_empty() || input.device_id.trim().is_empty() {
        return Err("Business and registered device are required for local settlement.".into());
    }
    if input.order_id.trim().is_empty() {
        return Err("Order ID or order number is required for settlement.".into());
    }
    let digits_only: String = input.phone.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits_only.len() < 10 {
        return Err("A valid 10-digit customer phone number is required for settlement.".into());
    }
    let method = input.payment_method.trim().to_uppercase();
    if method != "CASH" && method != "UPI" && method != "CARD" && method != "SPLIT" {
        return Err(format!(
            "Unsupported payment method '{}'. Supported offline methods: CASH, UPI, CARD, SPLIT.",
            input.payment_method
        ));
    }
    if let Some(disc) = input.discount_amount {
        if !disc.is_finite() || disc < 0.0 {
            return Err("Discount amount cannot be negative or invalid.".into());
        }
    }
    Ok(())
}

pub fn settle_local_order(
    path: &Path,
    input: &LocalSettleInput,
) -> Result<LocalSettleResult, String> {
    validate_settle_input(input)?;

    let clean_phone: String = input.phone.chars().filter(|c| c.is_ascii_digit()).collect();
    let method = input.payment_method.trim().to_uppercase();

    // Truth Contract:
    // CASH can be confirmed offline (RECORDED_OFFLINE).
    // UPI / CARD cannot be verified without internet.
    // If cashier specifies a manual terminal reference note (e.g. EDC slip #), it is PENDING_VERIFICATION.
    // It must NEVER be fabricated as verified online payment (PAID).
    let (payment_status, reference_note) = match method.as_str() {
        "CASH" => ("RECORDED_OFFLINE".to_string(), input.reference_note.clone()),
        "UPI" | "CARD" => {
            let note = input
                .reference_note
                .as_ref()
                .map(|s| s.trim().to_string())
                .unwrap_or_default();
            if note.is_empty() {
                return Err(format!(
                    "Offline {} payment requires a manual transaction reference note from the physical EDC machine or customer app. Live online verification is unavailable while offline.",
                    method
                ));
            }
            ("PENDING_VERIFICATION".to_string(), Some(note))
        }
        "SPLIT" => {
            let note = input
                .reference_note
                .as_ref()
                .map(|s| s.trim().to_string())
                .unwrap_or_default();
            if note.is_empty() {
                return Err(
                    "Offline split payment requires a reference note detailing the payment breakdown (e.g., 'Cash 200, Card 300 [EDC #5678]')."
                        .to_string(),
                );
            }
            ("RECORDED_OFFLINE".to_string(), Some(note))
        }
        _ => unreachable!(),
    };

    let mut conn =
        open_connection(path).map_err(|e| format!("Cannot open local POS database: {e}"))?;
    let tx = conn
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|e| format!("Cannot start local settlement transaction: {e}"))?;

    // 1. Verify tenant binding
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
                return Err(
                    "Local POS tenant/device binding does not match the active session.".into(),
                );
            }
        }
    }

    // 2. Fetch the target order
    let target = input.order_id.trim();
    let order_row: Option<(String, String, String, Option<String>, String, f64, f64, f64, f64)> = tx
        .query_row(
            "SELECT id, order_number, table_id, customer_id, status, subtotal, tax_amount, discount_amount, total_amount
             FROM local_orders
             WHERE (id = ?1 OR order_number = ?1) AND business_id = ?2",
            params![target, input.business_id],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                    r.get(7)?,
                    r.get(8)?,
                ))
            },
        )
        .optional()
        .map_err(|e| format!("Database query error fetching local order: {e}"))?;

    let (
        order_id,
        order_number,
        table_id,
        customer_id,
        current_status,
        subtotal,
        tax_amount,
        current_discount,
        _total,
    ) = match order_row {
        Some(row) => row,
        None => {
            return Err(format!(
                "Local order '{}' not found for active business.",
                input.order_id
            ))
        }
    };

    // 3. Prevent duplicate settlements
    if current_status == "SERVED" || current_status == "CANCELLED" {
        return Err(format!(
            "Order '{}' is already {}.",
            order_number,
            current_status.to_lowercase()
        ));
    }

    let existing_payment: Option<String> = tx
        .query_row(
            "SELECT id FROM local_payments WHERE business_id = ?1 AND order_id = ?2",
            params![input.business_id, order_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| format!("Database error checking local_payments: {e}"))?;

    if existing_payment.is_some() {
        return Err(format!(
            "Order '{}' has already been settled and has a recorded payment.",
            order_number
        ));
    }

    // 4. Calculate discount & final total
    let final_discount = if let Some(disc) = input.discount_amount {
        let rounded = money(disc);
        if rounded > money(subtotal + tax_amount) {
            return Err(format!(
                "Discount of {} exceeds order payable amount of {}.",
                rounded,
                subtotal + tax_amount
            ));
        }
        rounded
    } else {
        current_discount
    };
    let final_total = money((subtotal + tax_amount - final_discount).max(0.0));

    // 5. Generate distinct local receipt reference
    // Distinguishes local POS receipts (REC-...) from cloud-assigned official tax invoices (INV-...)
    let receipt_reference = format!("REC-{}", order_number);

    let customer_name = input
        .customer_name
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| {
            let last4 = if clean_phone.len() >= 4 {
                &clean_phone[clean_phone.len() - 4..]
            } else {
                &clean_phone
            };
            format!("Customer {last4}")
        });

    let now = now_iso();
    let payment_id = uuid_v4();
    let client_tx_id = uuid_v4();
    let visit_id = format!("VIS-{}", &uuid_v4()[..8]);

    // 6. Update local_orders status to SERVED
    tx.execute(
        "UPDATE local_orders
         SET status = 'SERVED', discount_amount = ?1, total_amount = ?2, updated_at = ?3
         WHERE id = ?4",
        params![final_discount, final_total, now, order_id],
    )
    .map_err(|e| format!("Failed to update local order status: {e}"))?;

    // 7. Insert local_payments record
    tx.execute(
        "INSERT INTO local_payments (
            id, order_id, business_id, device_id, payment_method,
            amount, payment_status, receipt_reference, reference_note,
            customer_phone, customer_name, recorded_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            payment_id,
            order_id,
            input.business_id,
            input.device_id,
            method,
            final_total,
            payment_status,
            receipt_reference,
            reference_note,
            clean_phone,
            customer_name,
            now
        ],
    )
    .map_err(|e| format!("Failed to record local payment: {e}"))?;

    // 8. Create client_outbox transaction for backend SyncService SETTLE_ORDER
    let outbox_payload = serde_json::json!({
        "order_id": order_id,
        "settle_data": {
            "phone": clean_phone,
            "customer_name": customer_name,
            "payment_method": method,
            "discount_amount": final_discount,
            "receipt_reference": receipt_reference,
            "payment_status": payment_status,
            "reference_note": reference_note
        }
    });

    tx.execute(
        "INSERT INTO client_outbox (
            client_tx_id, business_id, device_id, operation_type,
            payload_json, status, created_at
         ) VALUES (?1, ?2, ?3, 'SETTLE_ORDER', ?4, 'PENDING', ?5)",
        params![
            client_tx_id,
            input.business_id,
            input.device_id,
            outbox_payload.to_string(),
            now
        ],
    )
    .map_err(|e| format!("Failed to queue settlement outbox transaction: {e}"))?;

    // 9. Free table in local cache if present
    let _ = tx.execute(
        "UPDATE cached_dining_tables SET status = 'AVAILABLE' WHERE id = ?1 AND business_id = ?2",
        params![table_id, input.business_id],
    );

    tx.commit()
        .map_err(|e| format!("Failed to commit local settlement transaction: {e}"))?;

    let whatsapp_receipt_text = format!(
        "Hi {},\n\nThank you for dining with us! ❤️\n\nYour payment of ₹{:.2} has been recorded ({}).\n\nReceipt Ref: {}\nOrder No: {}\n(Cloud Tax Invoice Pending Sync)\n\nThank you!",
        customer_name, final_total, payment_status, receipt_reference, order_number
    );

    Ok(LocalSettleResult {
        order_id,
        order_number,
        receipt_reference,
        business_id: input.business_id.clone(),
        table_id,
        customer_id,
        customer_name,
        customer_phone: clean_phone,
        payment_method: method,
        payment_status,
        subtotal,
        tax_amount,
        discount_amount: final_discount,
        total_amount: final_total,
        earned_points: 0, // Loyalty points confirmed when synced online
        new_loyalty_balance: 0,
        remaining_until_next_reward: 100,
        visit_id,
        whatsapp_receipt_sent: false,
        whatsapp_receipt_text,
        is_offline: true,
        recorded_at: now,
    })
}

/// Fetches a single local order with its items from local SQLite.
pub fn get_local_order(
    path: &Path,
    business_id: &str,
    order_id_or_number: &str,
) -> Result<LocalOrder, String> {
    let conn =
        open_connection(path).map_err(|e| format!("Cannot open local POS database: {e}"))?;
    let target = order_id_or_number.trim();

    let order_opt = conn
        .query_row(
            "SELECT id, business_id, table_id, customer_id, order_number, order_source,
                    status, subtotal, tax_amount, discount_amount, total_amount,
                    notes, sync_status, created_at, updated_at
             FROM local_orders
             WHERE (id = ?1 OR order_number = ?1) AND business_id = ?2",
            params![target, business_id],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, Option<String>>(3)?,
                    r.get::<_, String>(4)?,
                    r.get::<_, String>(5)?,
                    r.get::<_, String>(6)?,
                    r.get::<_, f64>(7)?,
                    r.get::<_, f64>(8)?,
                    r.get::<_, f64>(9)?,
                    r.get::<_, f64>(10)?,
                    r.get::<_, Option<String>>(11)?,
                    r.get::<_, String>(12)?,
                    r.get::<_, String>(13)?,
                    r.get::<_, String>(14)?,
                ))
            },
        )
        .optional()
        .map_err(|e| format!("Query error fetching local order: {e}"))?;

    let (
        id,
        biz_id,
        table_id,
        cust_id,
        order_number,
        order_source,
        status,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        notes,
        sync_status,
        created_at,
        updated_at,
    ) = match order_opt {
        Some(o) => o,
        None => return Err(format!("Local order '{order_id_or_number}' not found.")),
    };

    let mut stmt = conn
        .prepare(
            "SELECT id, order_id, menu_item_id, item_name, unit_price, quantity,
                    tax_rate, discount, subtotal, notes
             FROM local_order_items
             WHERE order_id = ?1",
        )
        .map_err(|e| format!("Prepare error for items query: {e}"))?;

    let items_rows = stmt
        .query_map([&id], |r| {
            Ok(LocalOrderItem {
                id: r.get(0)?,
                order_id: r.get(1)?,
                menu_item_id: r.get(2)?,
                service_id: None,
                item_name: r.get(3)?,
                unit_price: r.get(4)?,
                quantity: r.get(5)?,
                tax_rate: r.get(6)?,
                discount: r.get(7)?,
                subtotal: r.get(8)?,
                notes: r.get(9)?,
                created_at: created_at.clone(),
                updated_at: updated_at.clone(),
            })
        })
        .map_err(|e| format!("Query error reading items: {e}"))?;

    let mut items = Vec::new();
    for i in items_rows {
        items.push(i.map_err(|e| format!("Item read error: {e}"))?);
    }

    Ok(LocalOrder {
        id,
        business_id: biz_id,
        table_id,
        customer_id: cust_id,
        customer: None,
        order_number,
        order_source,
        status,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        notes,
        visit_token: None,
        created_by: None,
        items,
        created_at,
        updated_at,
        sync_status,
    })
}

/// Lists all local orders for the business, most recent first.
pub fn list_local_orders(path: &Path, business_id: &str) -> Result<Vec<LocalOrder>, String> {
    let conn =
        open_connection(path).map_err(|e| format!("Cannot open local POS database: {e}"))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, order_number FROM local_orders
             WHERE business_id = ?1
             ORDER BY created_at DESC",
        )
        .map_err(|e| format!("Failed to prepare list_local_orders query: {e}"))?;

    let ids = stmt
        .query_map([business_id], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
        })
        .map_err(|e| format!("Query error listing local orders: {e}"))?;

    let mut orders = Vec::new();
    for row in ids {
        let (id, _) = row.map_err(|e| format!("Row read error: {e}"))?;
        if let Ok(order) = get_local_order(path, business_id, &id) {
            orders.push(order);
        }
    }
    Ok(orders)
}

#[tauri::command]
pub async fn order_settle_local(
    app: AppHandle,
    input: LocalSettleInput,
) -> Result<LocalSettleResult, String> {
    let path = resolve_db_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || settle_local_order(&path, &input))
        .await
        .map_err(|e| format!("Local settlement task failed: {e}"))?
}

#[tauri::command]
pub async fn order_get_local(
    app: AppHandle,
    business_id: String,
    order_id: String,
) -> Result<LocalOrder, String> {
    let path = resolve_db_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || get_local_order(&path, &business_id, &order_id))
        .await
        .map_err(|e| format!("Local order query task failed: {e}"))?
}

#[tauri::command]
pub async fn order_list_local(
    app: AppHandle,
    business_id: String,
) -> Result<Vec<LocalOrder>, String> {
    let path = resolve_db_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || list_local_orders(&path, &business_id))
        .await
        .map_err(|e| format!("Local order list task failed: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::initialize_database;
    use crate::local_orders::{create_local_order, LocalOrderInput, LocalOrderItemInput};
    use std::{fs, path::PathBuf};

    fn test_db() -> PathBuf {
        let p = std::env::temp_dir().join(format!("nv_settle_{}.db", uuid_v4()));
        initialize_database(&p).unwrap();
        p
    }

    fn sample_order(path: &Path, biz: &str, dev: &str, prefix: &str) -> LocalOrder {
        let input = LocalOrderInput {
            business_id: biz.into(),
            device_id: dev.into(),
            device_prefix: prefix.into(),
            table_id: "table-1".into(),
            customer_id: None,
            notes: None,
            client_order_id: None,
            items: vec![LocalOrderItemInput {
                menu_item_id: Some("item-1".into()),
                item_name: "Biryani".into(),
                unit_price: 250.0,
                quantity: 2,
                tax_rate: 5.0,
                discount: 0.0,
                notes: None,
            }],
        };
        create_local_order(path, &input).unwrap()
    }

    #[test]
    fn test_offline_cash_settlement_lifecycle() {
        let path = test_db();
        let order = sample_order(&path, "biz-1", "dev-1", "POS01");
        assert_eq!(order.status, "OPEN");

        let settle_input = LocalSettleInput {
            business_id: "biz-1".into(),
            device_id: "dev-1".into(),
            device_prefix: "POS01".into(),
            order_id: order.id.clone(),
            phone: "9876543210".into(),
            customer_name: Some("Rahul Kumar".into()),
            payment_method: "CASH".into(),
            discount_amount: Some(25.0),
            reference_note: None,
        };

        let result = settle_local_order(&path, &settle_input).unwrap();
        assert_eq!(result.order_number, "ORD-POS01-000001");
        assert_eq!(result.receipt_reference, "REC-ORD-POS01-000001");
        assert_eq!(result.payment_status, "RECORDED_OFFLINE");
        assert_eq!(result.payment_method, "CASH");
        assert_eq!(result.customer_phone, "9876543210");
        assert_eq!(result.customer_name, "Rahul Kumar");
        // Subtotal = 500.0, Tax = 25.0, Discount = 25.0 -> Total = 500.0
        assert_eq!(result.subtotal, 500.0);
        assert_eq!(result.tax_amount, 25.0);
        assert_eq!(result.discount_amount, 25.0);
        assert_eq!(result.total_amount, 500.0);
        assert!(result.is_offline);

        // Verify order status in DB is SERVED
        let updated_order = get_local_order(&path, "biz-1", &order.id).unwrap();
        assert_eq!(updated_order.status, "SERVED");
        assert_eq!(updated_order.total_amount, 500.0);

        // Verify client_outbox contains SETTLE_ORDER transaction
        let conn = open_connection(&path).unwrap();
        let (outbox_count, op_type): (i64, String) = conn
            .query_row(
                "SELECT count(*), operation_type FROM client_outbox WHERE operation_type = 'SETTLE_ORDER'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(outbox_count, 1);
        assert_eq!(op_type, "SETTLE_ORDER");

        // Verify local_payments row
        let (pay_method, pay_status, pay_amount, pay_receipt): (String, String, f64, String) = conn
            .query_row(
                "SELECT payment_method, payment_status, amount, receipt_reference FROM local_payments WHERE order_id = ?1",
                [&order.id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .unwrap();
        assert_eq!(pay_method, "CASH");
        assert_eq!(pay_status, "RECORDED_OFFLINE");
        assert_eq!(pay_amount, 500.0);
        assert_eq!(pay_receipt, "REC-ORD-POS01-000001");

        drop(conn);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn test_duplicate_settlement_prevented() {
        let path = test_db();
        let order = sample_order(&path, "biz-1", "dev-1", "POS01");

        let settle_input = LocalSettleInput {
            business_id: "biz-1".into(),
            device_id: "dev-1".into(),
            device_prefix: "POS01".into(),
            order_id: order.id.clone(),
            phone: "9876543210".into(),
            customer_name: None,
            payment_method: "CASH".into(),
            discount_amount: None,
            reference_note: None,
        };

        // First settlement succeeds
        assert!(settle_local_order(&path, &settle_input).is_ok());

        // Repeated settlement attempt MUST be rejected
        let second_attempt = settle_local_order(&path, &settle_input);
        assert!(second_attempt.is_err());
        let err = second_attempt.unwrap_err();
        assert!(
            err.contains("already served") || err.contains("already been settled"),
            "Error was: {err}"
        );

        let _ = fs::remove_file(path);
    }

    #[test]
    fn test_offline_upi_card_payment_truth_contract() {
        let path = test_db();
        let order = sample_order(&path, "biz-1", "dev-1", "POS01");

        // 1. UPI settlement without reference note must be rejected
        let upi_without_note = LocalSettleInput {
            business_id: "biz-1".into(),
            device_id: "dev-1".into(),
            device_prefix: "POS01".into(),
            order_id: order.id.clone(),
            phone: "9876543210".into(),
            customer_name: None,
            payment_method: "UPI".into(),
            discount_amount: None,
            reference_note: None,
        };
        let res_no_note = settle_local_order(&path, &upi_without_note);
        assert!(res_no_note.is_err());
        assert!(res_no_note
            .unwrap_err()
            .contains("requires a manual transaction reference note"));

        // 2. UPI settlement with reference note succeeds with PENDING_VERIFICATION (not fabricated PAID)
        let upi_with_note = LocalSettleInput {
            business_id: "biz-1".into(),
            device_id: "dev-1".into(),
            device_prefix: "POS01".into(),
            order_id: order.id.clone(),
            phone: "9876543210".into(),
            customer_name: None,
            payment_method: "UPI".into(),
            discount_amount: None,
            reference_note: Some("UTR: 329104889212 (Customer verified)".into()),
        };
        let res_with_note = settle_local_order(&path, &upi_with_note).unwrap();
        assert_eq!(res_with_note.payment_status, "PENDING_VERIFICATION");
        assert_eq!(res_with_note.payment_method, "UPI");

        let _ = fs::remove_file(path);
    }

    #[test]
    fn test_settle_nonexistent_order_fails() {
        let path = test_db();
        let settle_input = LocalSettleInput {
            business_id: "biz-1".into(),
            device_id: "dev-1".into(),
            device_prefix: "POS01".into(),
            order_id: "ORD-POS01-999999".into(),
            phone: "9876543210".into(),
            customer_name: None,
            payment_method: "CASH".into(),
            discount_amount: None,
            reference_note: None,
        };
        let res = settle_local_order(&path, &settle_input);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("not found"));
        let _ = fs::remove_file(path);
    }
}
