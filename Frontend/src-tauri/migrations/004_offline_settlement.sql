-- Phase 7: Offline Settlement, Local Payments, and Receipt References
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
