-- NextVisit POS Local SQLite Master Data Cache Schema
-- Migration 002: Master Data Cache Tables
-- Caches: menu categories, menu items, dining areas, dining tables, business settings, and sync cursor.

CREATE TABLE IF NOT EXISTS cached_menu_categories (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    source_created_at TEXT,
    source_updated_at TEXT,
    cached_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_cached_menu_categories_biz ON cached_menu_categories(business_id);

CREATE TABLE IF NOT EXISTS cached_menu_items (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    gst_percentage REAL NOT NULL DEFAULT 0.0,
    is_veg INTEGER NOT NULL DEFAULT 1,
    is_available INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 0,
    source_created_at TEXT,
    source_updated_at TEXT,
    cached_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY(category_id) REFERENCES cached_menu_categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cached_menu_items_biz ON cached_menu_items(business_id);
CREATE INDEX IF NOT EXISTS idx_cached_menu_items_cat ON cached_menu_items(category_id);

CREATE TABLE IF NOT EXISTS cached_dining_areas (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    color TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    source_created_at TEXT,
    source_updated_at TEXT,
    cached_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_cached_dining_areas_biz ON cached_dining_areas(business_id);

CREATE TABLE IF NOT EXISTS cached_dining_tables (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    dining_area_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    source_created_at TEXT,
    source_updated_at TEXT,
    cached_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY(dining_area_id) REFERENCES cached_dining_areas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cached_dining_tables_biz ON cached_dining_tables(business_id);
CREATE INDEX IF NOT EXISTS idx_cached_dining_tables_area ON cached_dining_tables(dining_area_id);

CREATE TABLE IF NOT EXISTS cached_business_settings (
    business_id TEXT PRIMARY KEY,
    settings_json TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sync_state (
    business_id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    last_sync_time TEXT NOT NULL,
    last_server_time TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
