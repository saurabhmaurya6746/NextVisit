//! NextVisit Local SQLite Foundation & Migration Manager
//!
//! Provides a durable local SQLite connection lifecycle with:
//! - Supported path resolution under the application's local data directory
//! - WAL mode (`PRAGMA journal_mode = WAL`) and foreign key enforcement
//! - Sequential, atomic, checksummed schema migrations
//! - Safe corruption quarantine preserving .db, .db-wal, and .db-shm sidecars
//! - Zero raw SQL execution exposed to the WebView

use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Result of database initialization and health check.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbHealthStatus {
    pub initialized: bool,
    pub db_path: String,
    pub current_version: i64,
    pub migrations_applied: usize,
    pub wal_mode: bool,
    pub foreign_keys_enabled: bool,
    pub quarantined: bool,
    pub quarantine_path: Option<String>,
}

/// Represents an embedded migration definition.
#[derive(Debug, Clone)]
pub struct Migration {
    pub version: i64,
    pub name: &'static str,
    pub sql: &'static str,
}

/// Embedded migrations list in strict sequential order.
pub const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "001_initial_foundation",
        sql: include_str!("../migrations/001_initial_foundation.sql"),
    },
    Migration {
        version: 2,
        name: "002_master_data_cache",
        sql: include_str!("../migrations/002_master_data_cache.sql"),
    },
    Migration {
        version: 3,
        name: "003_local_orders",
        sql: include_str!("../migrations/003_local_orders.sql"),
    },
    Migration {
        version: 4,
        name: "004_offline_settlement",
        sql: include_str!("../migrations/004_offline_settlement.sql"),
    },
    Migration {
        version: 5,
        name: "005_durable_sync_outbox",
        sql: include_str!("../migrations/005_durable_sync_outbox.sql"),
    },
];

/// Calculates the SHA-256 hex checksum of a migration's SQL content.
pub fn calculate_checksum(sql: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(sql.as_bytes());
    let hash = hasher.finalize();
    hash.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Resolves the canonical database path inside the application data directory.
/// Uses Tauri's supported app_local_data_dir resolver.
pub fn resolve_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to resolve app local data directory: {}", e))?;

    let data_dir = base_dir.join("data");
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to create database directory {:?}: {}", data_dir, e))?;
    }

    Ok(data_dir.join("pos_local.db"))
}

/// Configures PRAGMAs on every new SQLite connection:
/// - Foreign keys enabled
/// - WAL journal mode
/// - Synchronous NORMAL (optimized for WAL durability while eliminating full-disk-flush stalls)
pub fn configure_connection(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA busy_timeout = 5000;",
    )?;
    Ok(())
}

/// Opens a connection to the specified database path and configures PRAGMAs.
pub fn open_connection(path: &Path) -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    configure_connection(&conn)?;
    Ok(conn)
}

/// Runs a fast integrity check on the database.
pub fn check_integrity(conn: &Connection) -> bool {
    let result: Result<String, _> = conn.query_row("PRAGMA quick_check(1);", [], |row| row.get(0));
    match result {
        Ok(ref val) if val == "ok" => true,
        _ => false,
    }
}

/// Quarantines the database and its WAL/SHM sidecars into a timestamped quarantine directory.
/// Ensures all file locks are released by caller before invoking this.
///
/// Behavior guarantees:
/// - Fails safely if the database file exists but cannot be moved.
/// - If any existing sidecar (-wal or -shm) exists but cannot be moved, fails safely with an explicit error.
/// - Resolves collision by appending a monotonic counter if the destination folder already exists.
/// - Returns safe diagnostic context without secrets or PII.
pub fn quarantine_corrupt_db(db_path: &Path) -> Result<PathBuf, String> {
    if !db_path.exists() {
        return Err(format!(
            "Cannot quarantine non-existent database file: {:?}",
            db_path.file_name().unwrap_or_default()
        ));
    }

    let parent = db_path.parent().unwrap_or_else(|| Path::new("."));
    let quarantine_base = parent.parent().unwrap_or(parent).join("quarantine");

    fs::create_dir_all(&quarantine_base)
        .map_err(|e| format!("Failed to create base quarantine directory: {}", e))?;

    let now_str = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    // Collision-safe directory resolution
    let mut target_dir = quarantine_base.join(format!("pos_corrupt_{}", now_str));
    let mut counter = 1;
    while target_dir.exists() {
        target_dir = quarantine_base.join(format!("pos_corrupt_{}_{}", now_str, counter));
        counter += 1;
    }

    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create quarantine destination directory: {}", e))?;

    let file_stem = db_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("pos_local.db");
    let wal_name = format!("{}-wal", file_stem);
    let shm_name = format!("{}-shm", file_stem);

    let main_dst = target_dir.join(file_stem);
    let wal_src = parent.join(&wal_name);
    let wal_dst = target_dir.join(&wal_name);
    let shm_src = parent.join(&shm_name);
    let shm_dst = target_dir.join(&shm_name);

    // 1. Move the primary database file
    fs::rename(db_path, &main_dst).map_err(|e| {
        format!(
            "Failed to quarantine primary database file {:?}: {}",
            file_stem, e
        )
    })?;

    // 2. Move existing sidecars; if moving any existing sidecar fails, do not proceed silently
    if wal_src.exists() {
        if let Err(e) = fs::rename(&wal_src, &wal_dst) {
            return Err(format!(
                "Failed to quarantine WAL sidecar {:?}: {}",
                wal_name, e
            ));
        }
    }

    if shm_src.exists() {
        if let Err(e) = fs::rename(&shm_src, &shm_dst) {
            return Err(format!(
                "Failed to quarantine SHM sidecar {:?}: {}",
                shm_name, e
            ));
        }
    }

    Ok(target_dir)
}

/// Runs the sequential, atomic, checksummed schema migrations against an injected migration slice.
pub fn run_migrations_with(
    conn: &mut Connection,
    migrations: &[Migration],
) -> Result<(i64, usize), String> {
    // 1. Ensure schema_migrations table exists
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            checksum TEXT NOT NULL
        );",
        [],
    )
    .map_err(|e| format!("Failed to create schema_migrations table: {}", e))?;

    // 2. Fetch applied migrations, failing strictly on any decoding or query error
    let applied: Vec<(i64, String)> = {
        let mut stmt = conn
            .prepare("SELECT version, checksum FROM schema_migrations ORDER BY version ASC;")
            .map_err(|e| format!("Failed to prepare migrations query: {}", e))?;

        let rows = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| format!("Failed to query schema_migrations: {}", e))?;

        let mut collected = Vec::new();
        for row_res in rows {
            let row = row_res.map_err(|e| format!("Corrupted row in schema_migrations: {}", e))?;
            collected.push(row);
        }
        collected
    };

    let mut applied_count = 0;
    let mut latest_version = 0;

    // 3. Verify already-applied migrations for checksum mismatch and unrecognized versions
    for (v, checksum) in &applied {
        match migrations.iter().find(|m| m.version == *v) {
            Some(m) => {
                let current_checksum = calculate_checksum(m.sql);
                if current_checksum != *checksum {
                    return Err(format!(
                        "Checksum mismatch for migration {} ({}). Recorded: {}, Expected: {}. Aborting startup.",
                        m.version, m.name, checksum, current_checksum
                    ));
                }
            }
            None => {
                return Err(format!(
                    "Unrecognized applied migration version {} detected in schema_migrations. This local database may have been modified by a newer software version or corrupted. Aborting startup.",
                    v
                ));
            }
        }
        if *v > latest_version {
            latest_version = *v;
        }
    }

    // 4. Apply pending migrations sequentially in isolated immediate transactions
    for m in migrations {
        if applied.iter().any(|(v, _)| *v == m.version) {
            continue;
        }

        let checksum = calculate_checksum(m.sql);
        let tx = conn
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(|e| format!("Failed to begin migration transaction for {}: {}", m.name, e))?;

        tx.execute_batch(m.sql)
            .map_err(|e| format!("Failed to execute SQL for migration {}: {}", m.name, e))?;

        tx.execute(
            "INSERT INTO schema_migrations (version, name, checksum) VALUES (?1, ?2, ?3);",
            rusqlite::params![m.version, m.name, checksum],
        )
        .map_err(|e| format!("Failed to record migration {}: {}", m.name, e))?;

        tx.commit()
            .map_err(|e| format!("Failed to commit migration {}: {}", m.name, e))?;

        applied_count += 1;
        latest_version = m.version;
    }

    Ok((latest_version, applied_count))
}

/// Runs the embedded sequential, atomic, checksummed schema migrations.
pub fn run_migrations(conn: &mut Connection) -> Result<(i64, usize), String> {
    run_migrations_with(conn, MIGRATIONS)
}

/// Initializes the local SQLite database at `db_path`:
/// - Tests integrity; if corrupt, quarantines and reinitializes
/// - Configures WAL & foreign keys
/// - Applies pending migrations idempotently
pub fn initialize_database(db_path: &Path) -> Result<DbHealthStatus, String> {
    let mut quarantined = false;
    let mut quarantine_path = None;

    if db_path.exists() {
        let is_ok = match open_connection(db_path) {
            Ok(conn) => check_integrity(&conn),
            Err(_) => false,
        };

        if !is_ok {
            log::warn!("Database integrity check failed for {:?}. Quarantining...", db_path);
            let q_dir = quarantine_corrupt_db(db_path)?;
            quarantined = true;
            quarantine_path = Some(q_dir.to_string_lossy().to_string());
        }
    }

    let mut conn = open_connection(db_path)
        .map_err(|e| format!("Failed to open SQLite database at {:?}: {}", db_path, e))?;

    let (current_version, newly_applied) = run_migrations(&mut conn)?;

    let journal_mode: String = conn
        .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
        .unwrap_or_else(|_| "unknown".to_string());

    let fk_status: i32 = conn
        .query_row("PRAGMA foreign_keys;", [], |row| row.get(0))
        .unwrap_or(0);

    Ok(DbHealthStatus {
        initialized: true,
        db_path: db_path.to_string_lossy().to_string(),
        current_version,
        migrations_applied: newly_applied,
        wal_mode: journal_mode.to_uppercase() == "WAL",
        foreign_keys_enabled: fk_status == 1,
        quarantined,
        quarantine_path,
    })
}

/// Tauri IPC command: Returns the local database initialization status and health metadata.
#[tauri::command]
pub fn db_get_health(app: AppHandle) -> Result<DbHealthStatus, String> {
    let db_path = resolve_db_path(&app)?;
    initialize_database(&db_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_dir(prefix: &str) -> PathBuf {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(1);
        let path = std::env::temp_dir().join(format!("nextvisit_test_{}_{}", prefix, now));
        let _ = fs::create_dir_all(&path);
        path
    }

    #[test]
    fn test_fresh_database_creation_and_pragmas() {
        let temp_dir = create_test_dir("fresh");
        let db_path = temp_dir.join("test_fresh.db");

        let status = initialize_database(&db_path).expect("Initialization failed");
        assert!(status.initialized);
        assert_eq!(status.current_version, 5);
        assert_eq!(status.migrations_applied, 5);
        assert!(status.wal_mode);
        assert!(status.foreign_keys_enabled);
        assert!(!status.quarantined);

        // Verify tables exist
        let conn = open_connection(&db_path).expect("Failed to open connection");
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN (
                    'schema_migrations', 'app_metadata', 'cached_menu_categories',
                    'cached_menu_items', 'cached_dining_areas', 'cached_dining_tables',
                    'cached_business_settings', 'sync_state', 'local_orders',
                    'local_order_items', 'client_outbox', 'local_payments'
                );",
                [],
                |row| row.get(0),
            )
            .expect("Failed to query tables");
        assert_eq!(count, 12);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_migration_runner_idempotency() {
        let temp_dir = create_test_dir("idempotent");
        let db_path = temp_dir.join("test_idempotent.db");

        // First run: applies all 5 migrations
        let status1 = initialize_database(&db_path).expect("First init failed");
        assert_eq!(status1.migrations_applied, 5);
        assert_eq!(status1.current_version, 5);

        // Second run: zero migrations applied, remains at version 5
        let status2 = initialize_database(&db_path).expect("Second init failed");
        assert_eq!(status2.migrations_applied, 0);
        assert_eq!(status2.current_version, 5);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_migration_runner_real_rollback_on_failure() {
        let temp_dir = create_test_dir("runner_rollback");
        let db_path = temp_dir.join("test_runner_rollback.db");

        let mut conn = open_connection(&db_path).expect("Failed to open connection");

        // Define a test migration set:
        // Migration 1: valid table creation
        // Migration 2: valid table creation followed by invalid SQL
        let test_migrations = [
            Migration {
                version: 1,
                name: "001_valid_base",
                sql: "CREATE TABLE table_one (id INTEGER PRIMARY KEY, note TEXT);",
            },
            Migration {
                version: 2,
                name: "002_failing_migration",
                sql: "CREATE TABLE table_two (id INTEGER PRIMARY KEY); INVALID SQL SYNTAX HERE;",
            },
        ];

        // First apply migration 1 only
        let (ver1, applied1) =
            run_migrations_with(&mut conn, &test_migrations[0..1]).expect("Migration 1 failed");
        assert_eq!(ver1, 1);
        assert_eq!(applied1, 1);

        // Verify table_one exists
        let t1_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='table_one';",
                [],
                |row| row.get(0),
            )
            .expect("Query failed");
        assert_eq!(t1_exists, 1);

        // Now run runner with both migrations (attempting to apply migration 2)
        let res = run_migrations_with(&mut conn, &test_migrations);
        assert!(res.is_err(), "Migration 2 should fail");
        let err_msg = res.unwrap_err();
        assert!(
            err_msg.contains("Failed to execute SQL for migration 002_failing_migration"),
            "Error was: {}",
            err_msg
        );

        // Verify:
        // 1. table_two was rolled back
        let t2_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='table_two';",
                [],
                |row| row.get(0),
            )
            .expect("Query failed");
        assert_eq!(t2_exists, 0, "table_two should have been rolled back");

        // 2. schema_migrations did NOT record version 2
        let v2_recorded: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version=2;",
                [],
                |row| row.get(0),
            )
            .expect("Query failed");
        assert_eq!(v2_recorded, 0, "version 2 should not be recorded");

        // 3. earlier migration 1 remains intact
        let v1_recorded: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version=1;",
                [],
                |row| row.get(0),
            )
            .expect("Query failed");
        assert_eq!(v1_recorded, 1, "version 1 should remain recorded");

        drop(conn);
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_unknown_migration_version_rejection() {
        let temp_dir = create_test_dir("unknown_ver");
        let db_path = temp_dir.join("test_unknown_ver.db");

        let mut conn = open_connection(&db_path).expect("Failed to open connection");
        conn.execute(
            "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT, checksum TEXT);",
            [],
        )
        .expect("Table create failed");

        // Insert an unknown migration version 999
        conn.execute(
            "INSERT INTO schema_migrations (version, name, checksum) VALUES (999, 'future_migration', 'somehash');",
            [],
        )
        .expect("Insert failed");

        let res = run_migrations(&mut conn);
        assert!(res.is_err());
        let err_msg = res.unwrap_err();
        assert!(
            err_msg.contains("Unrecognized applied migration version 999"),
            "Error was: {}",
            err_msg
        );

        drop(conn);
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_corrupted_migration_row_rejection() {
        let temp_dir = create_test_dir("corrupt_row");
        let db_path = temp_dir.join("test_corrupt_row.db");

        let mut conn = open_connection(&db_path).expect("Failed to open connection");
        conn.execute(
            "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT, checksum TEXT);",
            [],
        )
        .expect("Table create failed");

        // Insert a row where checksum is NULL (violating type expectation or decoding)
        conn.execute(
            "INSERT INTO schema_migrations (version, name, checksum) VALUES (1, 'bad_row', NULL);",
            [],
        )
        .expect("Insert failed");

        let res = run_migrations(&mut conn);
        assert!(res.is_err());
        let err_msg = res.unwrap_err();
        assert!(
            err_msg.contains("Corrupted row in schema_migrations"),
            "Error was: {}",
            err_msg
        );

        drop(conn);
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_checksum_mismatch_rejection() {
        let temp_dir = create_test_dir("checksum");
        let db_path = temp_dir.join("test_checksum.db");

        let mut conn = open_connection(&db_path).expect("Failed to open connection");
        conn.execute(
            "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT, checksum TEXT);",
            [],
        )
        .expect("Table create failed");

        // Artificially insert migration 1 with an incorrect checksum
        conn.execute(
            "INSERT INTO schema_migrations (version, name, checksum) VALUES (1, '001_initial_foundation', 'corrupt_hash');",
            [],
        )
        .expect("Insert failed");

        let res = run_migrations(&mut conn);
        assert!(res.is_err());
        let err_msg = res.unwrap_err();
        assert!(err_msg.contains("Checksum mismatch"));

        drop(conn);
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_quarantine_success_with_all_sidecars() {
        let temp_dir = create_test_dir("quarantine_all");
        let data_dir = temp_dir.join("data");
        fs::create_dir_all(&data_dir).expect("Create data dir failed");
        let db_path = data_dir.join("pos_local.db");
        let wal_path = data_dir.join("pos_local.db-wal");
        let shm_path = data_dir.join("pos_local.db-shm");

        fs::write(&db_path, b"dummy db content").expect("Write db failed");
        fs::write(&wal_path, b"dummy wal content").expect("Write wal failed");
        fs::write(&shm_path, b"dummy shm content").expect("Write shm failed");

        let q_dir = quarantine_corrupt_db(&db_path).expect("Quarantine failed");
        assert!(q_dir.exists());

        // Check original files no longer exist at original path
        assert!(!db_path.exists());
        assert!(!wal_path.exists());
        assert!(!shm_path.exists());

        // Check files exist in quarantine dir
        assert!(q_dir.join("pos_local.db").exists());
        assert!(q_dir.join("pos_local.db-wal").exists());
        assert!(q_dir.join("pos_local.db-shm").exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_quarantine_destination_collision_resolution() {
        let temp_dir = create_test_dir("quarantine_collision");
        let data_dir = temp_dir.join("data");
        let quarantine_base = temp_dir.join("quarantine");
        fs::create_dir_all(&data_dir).expect("Create data dir failed");
        fs::create_dir_all(&quarantine_base).expect("Create quarantine base failed");

        let db_path = data_dir.join("pos_local.db");
        fs::write(&db_path, b"db 1").expect("Write db failed");

        // First quarantine
        let q_dir1 = quarantine_corrupt_db(&db_path).expect("Quarantine 1 failed");
        assert!(q_dir1.exists());
        assert!(q_dir1.join("pos_local.db").exists());

        // Recreate db at same path and quarantine immediately (which might produce same timestamp)
        fs::write(&db_path, b"db 2").expect("Write db 2 failed");
        let q_dir2 = quarantine_corrupt_db(&db_path).expect("Quarantine 2 failed");
        assert!(q_dir2.exists());
        assert!(q_dir2.join("pos_local.db").exists());

        // Either directory name has a suffix or timestamp differed; but both must exist without overwriting
        assert_ne!(q_dir1, q_dir2);
        assert_eq!(
            fs::read_to_string(q_dir1.join("pos_local.db")).unwrap(),
            "db 1"
        );
        assert_eq!(
            fs::read_to_string(q_dir2.join("pos_local.db")).unwrap(),
            "db 2"
        );

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_quarantine_fails_if_main_db_cannot_be_quarantined() {
        let temp_dir = create_test_dir("lock_main");
        let data_dir = temp_dir.join("data");
        fs::create_dir_all(&data_dir).expect("Create data dir failed");
        let db_path = data_dir.join("pos_local.db");
        fs::write(&db_path, b"db content").expect("Write db failed");

        // Test non-existent file failure
        let non_existent = data_dir.join("does_not_exist.db");
        let res_missing = quarantine_corrupt_db(&non_existent);
        assert!(res_missing.is_err());
        assert!(res_missing
            .unwrap_err()
            .contains("Cannot quarantine non-existent database file"));

        // Test Windows filesystem unmovable file handling:
        // By setting file permissions to read-only or locking with sharing restrictions:
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            // On Windows, opening with share_mode 0 denies read, write, and delete/rename to all other operations
            let locked_file = std::fs::OpenOptions::new()
                .read(true)
                .write(true)
                .share_mode(0) // Deny all sharing, including delete/rename
                .open(&db_path);

            if let Ok(handle) = locked_file {
                let res = quarantine_corrupt_db(&db_path);
                assert!(
                    res.is_err(),
                    "Quarantine must return explicit error when Windows denies move"
                );
                let err_msg = res.unwrap_err();
                assert!(
                    err_msg.contains("Failed to quarantine primary database file"),
                    "Error was: {}",
                    err_msg
                );

                // Ensure file handle is released and original file was NOT deleted or overwritten
                drop(handle);
                assert!(db_path.exists());
            }
        }

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_quarantine_fails_if_sidecar_cannot_be_quarantined() {
        let temp_dir = create_test_dir("lock_sidecar");
        let data_dir = temp_dir.join("data");
        fs::create_dir_all(&data_dir).expect("Create data dir failed");
        let db_path = data_dir.join("pos_local.db");
        let wal_path = data_dir.join("pos_local.db-wal");
        fs::write(&db_path, b"db content").expect("Write db failed");
        fs::write(&wal_path, b"wal content").expect("Write wal failed");

        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            // Lock the WAL file exclusively (share_mode 0 denies rename/delete)
            let wal_file = std::fs::OpenOptions::new()
                .read(true)
                .write(true)
                .share_mode(0)
                .open(&wal_path);

            if let Ok(handle) = wal_file {
                let res = quarantine_corrupt_db(&db_path);
                assert!(
                    res.is_err(),
                    "Quarantine must fail when WAL sidecar cannot be moved"
                );
                let err_msg = res.unwrap_err();
                assert!(
                    err_msg.contains("Failed to quarantine WAL sidecar"),
                    "Error was: {}",
                    err_msg
                );

                drop(handle);
                // WAL file was NOT deleted or lost
                assert!(wal_path.exists());
            }
        }

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_migration_from_v1_to_v2_cache_tables() {
        let temp_dir = create_test_dir("migrate_v1_v2");
        let db_path = temp_dir.join("test_migrate.db");

        let mut conn = open_connection(&db_path).expect("Failed to open connection");

        // Run only Migration 1 first
        let (ver1, applied1) =
            run_migrations_with(&mut conn, &MIGRATIONS[0..1]).expect("Migration 1 failed");
        assert_eq!(ver1, 1);
        assert_eq!(applied1, 1);

        // Verify only foundation tables exist
        let count_v1: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('schema_migrations', 'app_metadata');",
                [],
                |row| row.get(0),
            )
            .expect("Failed to query v1 tables");
        assert_eq!(count_v1, 2);

        // Run Migration 2
        let (ver2, applied2) =
            run_migrations_with(&mut conn, &MIGRATIONS[0..2]).expect("Migration 2 failed");
        assert_eq!(ver2, 2);
        assert_eq!(applied2, 1);

        // Verify all 8 tables exist
        let count_v2: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN (
                    'schema_migrations', 'app_metadata', 'cached_menu_categories',
                    'cached_menu_items', 'cached_dining_areas', 'cached_dining_tables',
                    'cached_business_settings', 'sync_state'
                );",
                [],
                |row| row.get(0),
            )
            .expect("Failed to query v2 tables");
        assert_eq!(count_v2, 8);

        // Run full migrations (should apply Migration 3, 4 & 5)
        let (ver_full, applied_full) = run_migrations(&mut conn).expect("Remaining migrations failed");
        assert_eq!(ver_full, 5);
        assert_eq!(applied_full, 3);

        let count_v4: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN (
                    'schema_migrations', 'app_metadata', 'cached_menu_categories',
                    'cached_menu_items', 'cached_dining_areas', 'cached_dining_tables',
                    'cached_business_settings', 'sync_state', 'local_orders',
                    'local_order_items', 'client_outbox', 'local_payments'
                );",
                [],
                |row| row.get(0),
            )
            .expect("Failed to query v4 tables");
        assert_eq!(count_v4, 12);

        drop(conn);
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
