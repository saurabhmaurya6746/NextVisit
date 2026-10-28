-- Phase 6: durable local POS orders and a stable pending sync envelope.
CREATE TABLE IF NOT EXISTS local_orders (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    order_number TEXT NOT NULL,
    table_id TEXT NOT NULL,
    customer_id TEXT,
    order_source TEXT NOT NULL DEFAULT 'POS',
    status TEXT NOT NULL DEFAULT 'OPEN',
    subtotal REAL NOT NULL CHECK(subtotal >= 0),
    tax_amount REAL NOT NULL CHECK(tax_amount >= 0),
    discount_amount REAL NOT NULL CHECK(discount_amount >= 0),
    total_amount REAL NOT NULL CHECK(total_amount >= 0),
    notes TEXT,
    sync_status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(business_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_local_orders_business_created
    ON local_orders(business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS local_order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES local_orders(id) ON DELETE CASCADE,
    menu_item_id TEXT,
    item_name TEXT NOT NULL,
    unit_price REAL NOT NULL CHECK(unit_price >= 0),
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    tax_rate REAL NOT NULL CHECK(tax_rate >= 0),
    discount REAL NOT NULL CHECK(discount >= 0),
    subtotal REAL NOT NULL CHECK(subtotal >= 0),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS client_outbox (
    client_tx_id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_outbox_pending
    ON client_outbox(business_id, status, created_at);
