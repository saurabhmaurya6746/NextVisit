# Architecture Specification: Local SQLite Persistence & Migration Foundation (Phase 4 Design)

**Document Status:** PROPOSED — awaiting user review  
**Author / Auditor:** Antigravity (Advanced Agentic Architecture & Security Audit)  
**Date:** 2026-10-17  
**Target Repository:** `NextVisit` (`C:\Users\hp\Desktop\Major Project\Nextvisit`)  
**Target Platform:** Windows POS (Tauri v2 Desktop Shell) & Future Android Handhelds  

---

## 1. Executive Summary & Core Architectural Choice

Phase 4 specifies the **foundational local SQLite persistence and migration mechanism** for the NextVisit Windows POS.

### 1.1 Scope Guardrail: Foundation Only
**Phase 4 is strictly limited to establishing the local SQLite engine and versioned schema migration runner.**  
- Offline order creation and cart editing are deferred to **Phase 6**.
- Offline settlement and cash payments are deferred to **Phase 7**.
- The background outbox sync worker and cloud push engine are deferred to **Phase 8**.
- Phase 4 delivers the local database infrastructure (connection management, WAL configuration, migration runner, and table creation) without altering current online order workflows.

### 1.2 Core Recommendation: Rust Native SQLite Manager via Narrow Tauri Commands
Rather than exposing raw, unconstrained SQL queries directly to the frontend via generic client plugins, we specify a **Rust-native SQLite Manager** in the Tauri application layer (`src-tauri`), exposed through **domain-specific Tauri IPC commands**:
1. **Domain-Specific IPC Boundaries:** The frontend invokes structured operations (e.g., `db_init_schema`, `db_get_metadata`), preventing arbitrary SQL execution or accidental multi-statement corruption from the webview context.
2. **Atomic Migrations:** Each schema migration executes in an isolated transaction (`BEGIN IMMEDIATE ... COMMIT`) managed directly in Rust.
3. **Safe Backup & Quarantine Recovery:** Rust manages SQLite WAL mode (`PRAGMA journal_mode = WAL`), checkpoints, and safe file quarantine if corruption is detected.
4. **Platform Parity:** Rust code in `src-tauri` compiles for Windows (`x86_64-pc-windows-msvc`) and future Android (`aarch64-linux-android`), avoiding platform-dependent web storage quirks.

---

## 2. Current Implementation State Inventory (Verified vs. Proposed)

Based on direct source inspection of the repository checkout:

| Component | Status in Codebase | Source Reference |
| :--- | :--- | :--- |
| **Tauri Desktop Shell** | **CONFIRMED PRESENT.** Tauri v2.12.4 with Rust 1.99.1 toolchain. Built `app.exe`, MSI, and NSIS installers. | `Frontend/src-tauri/Cargo.toml`, `Frontend/src-tauri/tauri.conf.json` |
| **Frontend Storage** | **CONFIRMED PRESENT.** Uses browser `localStorage` and `sessionStorage` for mock order stores (`orders-store.ts`), theme, signup drafts, and guest visit tokens. | `Frontend/src/lib/orders-store.ts`, `Frontend/src/lib/auth.ts`, `Frontend/src/components/qr-order-view.tsx` |
| **Existing POS API** | **CONFIRMED PRESENT.** Real backend API client for orders (`orders-api.ts`), tables (`tables-api.ts`), and menu (`menu-api.ts`). | `Frontend/src/lib/orders-api.ts` |
| **Backend Sync Engine** | **CONFIRMED PRESENT.** `POST /api/v1/sync/push` (atomic execution, SHA-256 idempotency check, device prefix verification) & `GET /api/v1/sync/pull` (delta sync). | `Backend/app/services/sync_service.py`, `Backend/app/api/v1/sync/router.py` |
| **Local SQLite Database** | **ABSENT.** No SQLite database, plugin, or Rust DB interface currently exists in `Frontend/src-tauri/`. | Confirmed via `Frontend/src-tauri/Cargo.toml` and directory listing. |
| **Local Migration Runner** | **ABSENT.** No migration runner exists for local embedded storage. | Confirmed via file inspection. |
| **Local Outbox Queue** | **ABSENT.** No durable queue for offline mutations exists in frontend or desktop shell. | Confirmed via file inspection. |
| **Local Backup / Restore** | **ABSENT.** No automated backup or corruption recovery exists. | Confirmed via file inspection. |

---

## 3. SQLite Integration Options Comparison

| Evaluation Dimension | Option 1: Generic Tauri SQL Plugin (`tauri-plugin-sql`) | Option 2: Rust-Native SQLite Manager via Domain IPC (Recommended) | Option 3: Browser IndexedDB (`idb` / `Dexie.js`) |
| :--- | :--- | :--- | :--- |
| **Windows & Android Compatibility** | Supported via plugin crate. | **Fully native.** Same Rust code compiles for Windows & Android. | Runs inside WebView. Subject to browser quota eviction. |
| **Transaction & WAL Safety** | Multi-statement transactions over IPC require careful client orchestration; connection pooling can interleave statements. | **Superior.** Full control over `BEGIN IMMEDIATE`, WAL checkpointing, and `PRAGMA synchronous = NORMAL` inside Rust. | No atomic cross-store transactions; no true WAL or crash-proof durability. |
| **Capability & Permissions** | Requires broad permissions in `capabilities/default.json` (`sql:allow-execute`, `sql:allow-select`). | **Strict & Secure.** Exposes only narrow domain commands. No raw SQL execution from webview. | Web origin boundary only. No native Windows file security. |
| **Type Safety & Coupling** | Weak. Frontend constructs raw SQL strings; schema changes break frontend silently. | **Strong (via IPC schemas).** Rust serializes typed structs to TypeScript interfaces via serde/ts-rs or manual IPC definitions. *(Note: Rust and TS do not share types automatically without explicit code generation).* | Strong in TS, but disconnected from native Rust layer. |
| **Backup & Recovery** | Limited. Plugin does not expose SQLite backup APIs or file rotation hooks. | **Fully Feasible.** Direct access to native SQLite backup, WAL checkpoints, and file rotation on `SQLITE_CORRUPT`. | Impossible to perform native filesystem backups or disk-level recovery. |
| **MSRV & Maintenance** | Requires keeping plugin version in sync with Tauri core. | **Minimal.** Direct dependency on standard `rusqlite` crate (bundled SQLite). | Zero native dependencies. |

### Recommendation Rationale
We recommend **Option 2 (Rust-Native SQLite Manager via `rusqlite` bundled)**. A native Rust manager guarantees that database initialization, WAL settings, and schema migrations run with ACID durability before the webview even mounts, and prevents raw SQL string injection from client scripts.

---

## 4. Versioned Local SQLite Schema Specification

The local database will reside in the Windows user application directory:  
`%LOCALAPPDATA%\NextVisit\data\pos_local.db`

### 4.1 Phase 4 Foundation Tables (Implemented in Phase 4)

#### 1. `schema_migrations`
Tracks executed local schema migrations.
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    checksum TEXT NOT NULL
);
```

#### 2. `app_metadata`
Stores terminal identity, active business binding, registered device prefix, and sync state.
```sql
CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
```
*Key-value records:*
- `schema_version`: (e.g. `"1"`)
- `business_id`: UUID of the authenticated restaurant tenant.
- `device_id`: UUID of this POS terminal issued during registration.
- `device_prefix`: Terminal prefix for order numbering (e.g. `"D1"`, `"POS01"`).
- `last_sync_timestamp`: ISO 8601 UTC timestamp of last successful pull.
- `sync_cursor`: Cursor token for paginated delta pulls.

#### 3. `client_outbox`
Foundation schema for the offline mutation queue (table created in Phase 4; queueing and flushing integrated in Phases 6–8).
```sql
CREATE TABLE IF NOT EXISTS client_outbox (
    client_tx_id TEXT PRIMARY KEY,               -- UUID v4 generated locally
    business_id TEXT NOT NULL,                  -- Tenant isolation check
    device_id TEXT NOT NULL,                    -- Registered device UUID
    operation_type TEXT NOT NULL,               -- 'CREATE_ORDER', 'SETTLE_ORDER', 'DIRECT_SALE'
    payload_json TEXT NOT NULL,                 -- Canonical JSON payload
    payload_hash TEXT NOT NULL,                 -- SHA-256 hash of (operation_type + payload)
    status TEXT NOT NULL DEFAULT 'PENDING',     -- 'PENDING', 'SENDING', 'COMMITTED', 'CONFLICT', 'FAILED'
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    http_status_code INTEGER,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);

CREATE INDEX IF NOT EXISTS ix_outbox_status_created ON client_outbox(status, created_at ASC);
CREATE INDEX IF NOT EXISTS ix_outbox_business ON client_outbox(business_id);
```

#### 4. `server_id_map`
Maintains bidirectional mapping between client-generated temporary IDs and server-confirmed permanent IDs.
```sql
CREATE TABLE IF NOT EXISTS server_id_map (
    entity_type TEXT NOT NULL,                  -- 'ORDER', 'ORDER_ITEM', 'CUSTOMER', 'PAYMENT'
    local_id TEXT NOT NULL,                     -- Local UUID
    server_id TEXT NOT NULL,                    -- Backend UUID
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    PRIMARY KEY (entity_type, local_id)
);

CREATE INDEX IF NOT EXISTS ix_id_map_server ON server_id_map(entity_type, server_id);
```

#### 5. `sync_conflicts`
Records rejected or conflicting transactions for operator resolution.
```sql
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id TEXT PRIMARY KEY,                        -- UUID v4
    client_tx_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    local_record_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    conflict_reason TEXT NOT NULL,
    local_payload TEXT NOT NULL,
    server_response TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN',        -- 'OPEN', 'RESOLVED_OVERWRITE', 'RESOLVED_DISCARD'
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    resolved_at DATETIME
);
```

---

### 4.2 Deferred Domain Tables (Schema Prepared in Initial Migration; Functionality Deferred to Later Phases)

The following tables are included in the initial migration script for schema completeness, but their business logic, UI bindings, and write operations are strictly deferred:

- `cached_menu_categories` & `cached_menu_items` (Deferred to **Phase 5: Master Data Cache**).
- `cached_dining_areas` & `cached_dining_tables` (Deferred to **Phase 5: Master Data Cache**).
- `local_orders` & `local_order_items` (Deferred to **Phase 6: Offline Order Entry**).
- `local_payments` (Deferred to **Phase 7: Offline Settlement**).

```sql
-- Cached Master Data (Phase 5)
CREATE TABLE IF NOT EXISTS cached_menu_categories (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS cached_menu_items (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    tax_rate REAL NOT NULL DEFAULT 0.0,
    is_veg INTEGER NOT NULL DEFAULT 1,
    is_available INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(category_id) REFERENCES cached_menu_categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cached_dining_areas (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS cached_dining_tables (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    dining_area_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'AVAILABLE',
    current_order_id TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(dining_area_id) REFERENCES cached_dining_areas(id) ON DELETE CASCADE
);

-- Local Orders & Items (Phase 6)
CREATE TABLE IF NOT EXISTS local_orders (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    table_id TEXT NOT NULL,
    order_number TEXT NOT NULL UNIQUE,
    order_source TEXT NOT NULL DEFAULT 'POS',
    status TEXT NOT NULL DEFAULT 'OPEN',
    customer_id TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    subtotal REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);

CREATE TABLE IF NOT EXISTS local_order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    menu_item_id TEXT,
    item_name TEXT NOT NULL,
    unit_price REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    tax_rate REAL NOT NULL DEFAULT 0.0,
    discount REAL NOT NULL DEFAULT 0.0,
    subtotal REAL NOT NULL,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    FOREIGN KEY(order_id) REFERENCES local_orders(id) ON DELETE CASCADE
);

-- Local Payments (Phase 7)
CREATE TABLE IF NOT EXISTS local_payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    business_id TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_status TEXT NOT NULL,
    reference_note TEXT,
    recorded_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    FOREIGN KEY(order_id) REFERENCES local_orders(id) ON DELETE CASCADE
);
```

---

## 5. Migration, Backup & Practical Corruption Quarantine Policy

### 5.1 Migration Runner Strategy
- **Embedded Migration Definitions:** Numbered SQL migration files embedded in the Rust binary via `include_str!` (e.g. `migrations/001_initial_schema.sql`).
- **Atomic Execution:** Each migration runs inside a dedicated SQLite transaction:
  ```sql
  BEGIN IMMEDIATE;
  -- Run migration statements
  INSERT INTO schema_migrations (version, name, checksum) VALUES (1, 'initial_schema', '<sha256>');
  COMMIT;
  ```
- **Transaction Rollback:** If any statement in a migration fails, the transaction rolls back cleanly, and the application halts startup with an explicit diagnostic log rather than running with an inconsistent partial schema.

### 5.2 Backup & Consistency Policy
- **Prohibited:** Never copy active SQLite files (`pos_local.db`) using raw filesystem file-copy commands while the database connection is open, as WAL and shared memory (`-shm`, `-wal`) files will produce an inconsistent or corrupt snapshot.
- **Online Backup API:** Use SQLite's native C Backup API (`sqlite3_backup_*`) to stream consistent snapshots to disk while the database is online.
- **Backup Schedule:**
  - Automated snapshot taken on terminal startup.
  - Daily scheduled snapshot: `%LOCALAPPDATA%\NextVisit\backups\pos_backup_YYYYMMDD.db`.
  - Retention: Keep the latest 7 daily snapshots.

### 5.3 Practical Corruption Quarantine & Diagnostic Recovery
If SQLite reports `SQLITE_CORRUPT`, `SQLITE_NOTADB`, or unrecoverable disk I/O errors during integrity checks (`PRAGMA integrity_check`):

1. **Immediate Connection Shutdown:** Close all active database handles to release file locks.
2. **Quarantine All Related Files:** Move the entire database triad (`pos_local.db`, `pos_local.db-wal`, `pos_local.db-shm`) into an isolated diagnostic folder:
   ```text
   %LOCALAPPDATA%\NextVisit\quarantine\pos_corrupt_<TIMESTAMP>\
   ├── pos_local.db
   ├── pos_local.db-wal
   └── pos_local.db-shm
   ```
   *Rationale:* Preserving the WAL and SHM files alongside the main database ensures that forensic diagnostic tools or developer inspection can attempt offline analysis without active file overwrites.
3. **Database Restoration / Reinitialization:**
   - **If a valid local backup exists:** Validate the latest backup (`PRAGMA quick_check`) and restore it.
   - **If no valid backup exists:** Initialize a fresh database and execute migrations.
4. **Honest Operator Communication:**
   - The application **must never falsely claim** that damaged unsynced data was automatically preserved.
   - The UI surfaces a prominent, persistent warning:  
     > **"Local Database Error:** The local database was corrupted and has been quarantined for technical diagnosis. A clean database has been initialized. Any offline orders that were not yet synced to the cloud may be unrecoverable. Please review today's physical KOT receipts and contact support."
5. **Incident Audit Log:** Write an event to `%LOCALAPPDATA%\NextVisit\logs\corruption_<TIMESTAMP>.log` with error codes, timestamp, and quarantined file paths.

---

## 6. Scope Boundaries & Implementation Acceptance Criteria

### 6.1 Strict Scope Boundaries for Phase 4
| In Scope for Phase 4 Implementation | Explicitly Excluded (Deferred to Later Phases) |
| :--- | :--- |
| Adding SQLite dependencies to `Cargo.toml`. | Offline order creation, item addition, or cart editing (Phase 6). |
| Creating database connection manager in `src-tauri` with WAL mode. | Offline bill settlement, cash recording, or payment UI (Phase 7). |
| Implementing the `schema_migrations` runner. | Master data caching and delta pull synchronization (Phase 5). |
| Executing migration 001 to create foundation tables. | Background outbox queue worker and cloud push network sync (Phase 8). |
| Implementing diagnostic quarantine logic for corrupted files. | Thermal printer drivers and ESC/POS integration (Phase 9). |
| Automated integration tests for migration runner and database creation. | Android compilation or mobile-specific packaging (Phase 10). |

### 6.2 Acceptance Criteria for Phase 4 Implementation
1. **Fresh Install:** On clean launch, the application creates `%LOCALAPPDATA%\NextVisit\data\pos_local.db`, sets `PRAGMA journal_mode = WAL`, and applies migration 001.
2. **Migration Idempotency:** Running the migration runner on an already up-to-date database completes with zero changes and logs no errors.
3. **Migration Rollback:** A test migration containing an invalid SQL statement rolls back completely; `schema_migrations` does not record the failed version.
4. **Quarantine on Corruption:** Simulating a corrupt database file (e.g. writing garbage bytes into the file header) causes the manager to quarantine `.db`, `-wal`, and `-shm` to the quarantine folder and reinitialize a fresh, healthy database.
5. **Zero Regression:** The existing web application, online POS ordering, and unrelated modules (salon, school, CRM) continue functioning normally without errors.

---

## 7. Dependencies & Technical Spike Items

### 7.1 Local Dependency Verification Status

| Dependency | Purpose | Status in Local Checkout | Verification Plan |
| :--- | :--- | :--- | :--- |
| **`uuid`** | Unique local IDs | **CONFIRMED.** Version `1.28.0` is already locked in `Cargo.lock` (line 3714). | Ready to use with features `["v4", "serde"]`. |
| **`sha2`** | Payload hashing | **CONFIRMED.** Version `0.10.9` is already locked in `Cargo.lock` (line 2820). | Ready to use. |
| **`rusqlite`** | SQLite engine | **ABSENT FROM LOCAL CACHE.** Version and feature compatibility must be verified in an implementation spike. | *To verify in implementation spike:* Test `rusqlite = { version = "0.32", features = ["bundled", "backup", "uuid", "chrono"] }` against the active Rust compiler (`1.99.1`). |

### 7.2 Tauri Capability & Permissions
- When native IPC commands are added to `src-tauri/src/lib.rs`, they are registered via `.invoke_handler(tauri::generate_handler![...])`.
- Custom domain IPC commands do not require external Tauri plugin permissions in `capabilities/default.json`.

---

## 8. Conclusion & Next Steps
This design specification establishes a strictly bounded, durable SQLite foundation.  
- Document Status: **PROPOSED — awaiting user review.**
- No application code, manifests, lockfiles, or databases were modified in this phase.
- Upon user approval of this design, proceed to **Phase 4 Implementation** to add the SQLite dependencies, write the migration runner, and verify with automated tests.
