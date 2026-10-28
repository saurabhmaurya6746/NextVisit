# Architecture Specification: Offline Settlement, Payments & Receipt Lifecycle (Phase 7)

**Document Status:** IMPLEMENTED & VERIFIED  
**Phase:** Phase 7 (Settlement, payment, invoice lifecycle)  
**Date:** 2026-10-18  
**Author / Implementer:** Antigravity  
**Target Repository:** `NextVisit` (`C:\Users\hp\Desktop\Major Project\Nextvisit`)  

---

## 1. Executive Summary & Core Requirements

Phase 7 establishes the settlement, payment recording, and receipt lifecycle for offline operation on the NextVisit Windows Desktop POS (and future mobile terminals).

### Acceptance Criteria Addressed:
1. **Explicit Offline Settlement Modeling:** Offline cash payments are recorded as `RECORDED_OFFLINE` with a pending sync status.
2. **Online Payment Truth Contract:** Online payments (UPI, Card) cannot be verified while disconnected. Staff can only record an offline reference note (e.g., physical EDC slip number or transaction reference), marked as `PENDING_VERIFICATION`. The POS never fabricates a verified `PAID` state for unverified online channels.
3. **Duplicate Prevention:** Double settlements and duplicate payment records are strictly prevented at both the local database level (`local_payments` unique constraint on `[business_id, order_id]`) and the application logic level (`status = 'SERVED'`).
4. **Receipt vs. Invoice Traceability:** Local receipt reference (`REC-{order_number}`) is explicitly decoupled from server-assigned tax invoice numbers (`INV-...`).
5. **Repeated Sync Idempotency:** The backend `SyncService` deduplicates replayed sync transactions via SHA-256 payload hashing and `client_tx_id` idempotency registry, returning `ALREADY_COMMITTED` without duplicating visits or loyalty points. Subsequent settlement attempts on an already served order are rejected with HTTP 400.

---

## 2. Payment Truth Contract & Payment Channels

| Payment Channel | Offline Support | Local Payment Status | Required Metadata | Behavior on Cloud Sync (Phase 8) |
| :--- | :--- | :--- | :--- | :--- |
| **Cash** | **Full** | `RECORDED_OFFLINE` | Phone (10 digits), customer name | Converted by backend `OrderService` to confirmed `PAID` visit. |
| **Card (EDC Terminal)** | **Manual Reference Only** | `PENDING_VERIFICATION` | Physical EDC slip # / authorization code | Stored in visit record with reference note for cashier audit. |
| **UPI** | **Manual Reference Only** | `PENDING_VERIFICATION` | Customer UTR / counter soundbox confirmation reference | Stored in visit record with reference note for bank reconciliation. |
| **Split Payment** | **Full** | `RECORDED_OFFLINE` / `PENDING_VERIFICATION` | Reference note detailing exact payment breakdown (e.g., `Cash 300, Card 200 [EDC #456]`) | Processed with combined breakdown. |
| **Refunds** | **Prohibited / Cash Only** | N/A | Offline gateway refunds are strictly prohibited without live gateway connectivity. Cash refunds require manager override. | Defer online gateway refunds to internet reconnection. |

### Invariant: Non-Fabrication of Payment Confirmation
Under no circumstances will the offline POS terminal claim that an online UPI QR transaction or credit card gateway transaction has been verified with the bank/gateway while disconnected. The UI clearly denotes `PENDING_VERIFICATION` and local receipt status.

---

## 3. Local SQLite Schema (Migration 004)

Migration `004_offline_settlement.sql` adds the durable `local_payments` table:

```sql
CREATE TABLE IF NOT EXISTS local_payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES local_orders(id) ON DELETE CASCADE,
    business_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    payment_method TEXT NOT NULL, -- 'CASH', 'UPI', 'CARD', 'SPLIT'
    amount REAL NOT NULL CHECK(amount >= 0),
    payment_status TEXT NOT NULL, -- 'RECORDED_OFFLINE', 'PENDING_VERIFICATION'
    receipt_reference TEXT NOT NULL UNIQUE,
    reference_note TEXT,
    customer_phone TEXT,
    customer_name TEXT,
    recorded_at TEXT NOT NULL,
    UNIQUE(business_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_local_payments_biz_order
    ON local_payments(business_id, order_id);
```

### Constraints & Invariants:
1. `UNIQUE(business_id, order_id)`: Guarantees that a single order cannot have multiple conflicting settlement records in SQLite.
2. `receipt_reference TEXT NOT NULL UNIQUE`: Guarantees deterministic, collision-resistant receipt identification across devices.

---

## 4. Numbering & Identifier Strategy

To prevent confusion between client-side offline receipts and official cloud tax invoices:

1. **Order Number:** `ORD-{device_prefix}-{seq:06d}` (e.g., `ORD-POS01-000004`).
2. **Local Receipt Reference:** `REC-{order_number}` (e.g., `REC-ORD-POS01-000004`).
   - Clearly stamped on physical receipts and printed invoices as `Receipt Ref (POS)`.
   - Distinct from tax invoices.
3. **Official Cloud Tax Invoice:** `INV-...` (assigned sequentially by cloud database upon sync).
   - Offline receipts display `INV-(Pending Sync)`.

---

## 5. Settlement Atomic State Machine (Rust Engine)

```
[ OPEN ] ──( Settle Request )──> [ Validate Input & Tenant ]
                                       │
                         [ Check local_payments & status ]
                         ┌─────────────┴─────────────┐
                    (Already Settled)           (Not Settled)
                         │                           │
                   [ Reject Err ]             [ BEGIN IMMEDIATE ]
                                                     │
                                            [ Update local_orders ]
                                            status = 'SERVED'
                                            discount_amount = final_discount
                                            total_amount = final_total
                                                     │
                                            [ Insert local_payments ]
                                            payment_status = RECORDED_OFFLINE
                                            receipt_reference = REC-...
                                                     │
                                            [ Insert client_outbox ]
                                            op = 'SETTLE_ORDER'
                                                     │
                                            [ Update cached_tables ]
                                            status = 'AVAILABLE'
                                                     │
                                                 [ COMMIT ]
```

---

## 6. Cloud Push Sync Contract (SETTLE_ORDER)

When connectivity returns (Phase 8), `client_outbox` pushes the following transaction:

```json
{
  "client_tx_id": "8fa3919e-...",
  "operation_type": "SETTLE_ORDER",
  "payload": {
    "order_id": "7ca1239b-...",
    "settle_data": {
      "phone": "9876543210",
      "customer_name": "Rahul Kumar",
      "payment_method": "CASH",
      "discount_amount": 0.0,
      "receipt_reference": "REC-ORD-POS01-000004",
      "payment_status": "RECORDED_OFFLINE",
      "reference_note": null
    }
  }
}
```

### Backend Deduplication:
1. **First push:** Backend creates `Visit`, transitions order to `SERVED`, awards loyalty points, commits `SyncTransaction`.
2. **Replayed push (same `client_tx_id`):** `SyncService` returns `ALREADY_COMMITTED` with the original cached response. No duplicate visit or points.
3. **Conflicting push (different `client_tx_id` on same order):** Backend rejects with HTTP 400 (`"Order is already served"`), which the sync worker flags as resolved.

---

## 7. Automated Test Verification Matrix

| Component | Test File | Test Name | Result |
| :--- | :--- | :--- | :--- |
| **Rust Desktop** | `local_settlement.rs` | `test_offline_cash_settlement_lifecycle` | **PASSED** |
| **Rust Desktop** | `local_settlement.rs` | `test_duplicate_settlement_prevented` | **PASSED** |
| **Rust Desktop** | `local_settlement.rs` | `test_offline_upi_card_payment_truth_contract` | **PASSED** |
| **Rust Desktop** | `local_settlement.rs` | `test_settle_nonexistent_order_fails` | **PASSED** |
| **Rust Desktop** | `db.rs` | `test_fresh_database_creation_and_pragmas` (4 migrations, 12 tables) | **PASSED** |
| **Rust Desktop** | `db.rs` | `test_migration_runner_idempotency` | **PASSED** |
| **Rust Desktop** | `db.rs` | `test_migration_from_v1_to_v2_cache_tables` | **PASSED** |
| **FastAPI Backend** | `test_idempotency_and_sync.py` | `test_sync_push_settle_order_offline_lifecycle` | **PASSED** |
| **FastAPI Backend** | `test_idempotency_and_sync.py` | `test_cross_tenant_settle_order_rejected` | **PASSED** |
| **Frontend SPA** | `npm run build` | Vite build & TypeScript check (Vite v8.1.5 + React 19) | **PASSED** |
