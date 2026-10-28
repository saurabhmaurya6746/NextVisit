-- NextVisit POS Local SQLite Foundation Schema
-- Migration 001: Initial Foundation Tables
-- Note: Limited strictly to Phase 4 foundation metadata.
-- Domain tables (menu, tables, orders, outbox, payments) are deferred to Phases 5-8.

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    checksum TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
