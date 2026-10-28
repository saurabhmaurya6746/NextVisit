# Phase 12 — Pilot, Regression, Packaging, and Release Runbook

## Status

**In progress — release preparation is documented; end-to-end pilot evidence is still pending.**

The Antigravity Phase 11 report records 14 LAN tests, 57 backend tests, 33 Rust tests, and a frontend build as passing. Those reported results have not been rerun in this Phase 12 turn. The physical Android/LAN pilot, release installer smoke test, and backup/restore exercise remain unchecked. Do not describe the product as release-ready until the required checks have evidence.

| Area | Status | Evidence / remaining work |
|---|---|---|
| Phase 11 automated checks | Needs review | Prior report only; rerun in the combined verification session. |
| Android debug package | Built; install pending | ARM64 APK built on 2026-10-23 with test API URL `http://10.192.39.162:8001`; phone install deferred until device is connected and authorized via ADB (authorization steps documented below). Rebuild if the laptop IP changes. |
| Windows installer | Built; smoke test pending | Fresh NSIS setup (`nextvisit-pos_0.1.0_x64-setup.exe`, 3,817,604 bytes) and MSI package (`nextvisit-pos_0.1.0_x64_en-US.msi`, 6,082,560 bytes) packaged from current source on 2026-10-23 using cached NSIS and WiX tools. Installation and smoke test deferred to combined test session. |
| LAN two-device pilot | Not run | Requires two Android devices and Windows on the same private network. |
| Backup and restore | Needs review | Server backup/restore and local SQLite recovery are not proven by a UI workflow. |
| Printer disconnect/fallback | Not run | No physical printer is available; test browser/PDF fallback and mark hardware acceptance pending. |
| Full cross-module regression | Not run | Run the matrix below before any production rollout. |

## Build evidence captured on 2026-10-23

- Android command: `npx @tauri-apps/cli android build --debug --apk --target aarch64`, with `VITE_API_BASE_URL=http://10.192.39.162:8001`. Result: **passed**, one universal debug APK produced at the path below (296,227,779 bytes; SHA-256 `756AA8BB264D0F9F12C267CED428A2B80D1A8FD113210F338E740A623538D236`, timestamp `2026-10-23 18:46:37`). It has not been installed on a phone yet.
- Windows NSIS bundle command: `npx tauri build --bundles nsis`, with `VITE_API_BASE_URL=http://127.0.0.1:8001`. Result: **passed**, produced `Frontend/src-tauri/target/release/bundle/nsis/nextvisit-pos_0.1.0_x64-setup.exe` (3,817,604 bytes; SHA-256 `936E148A89A4ECFF5DAEE2E26E9571CFFEBDDB3C8BAD1DE7A7CE2B6C3C0A9A81`, timestamp `2026-10-23 20:13:16`).
- Windows MSI bundle command: `npx tauri build --bundles msi`, with `VITE_API_BASE_URL=http://127.0.0.1:8001`. Result: **passed**, produced `Frontend/src-tauri/target/release/bundle/msi/nextvisit-pos_0.1.0_x64_en-US.msi` (6,082,560 bytes; SHA-256 `DA8A2B22394164DEC50381C5433284EE8279BDB1FEE5F4168FC1F4DCAB1B8878`, timestamp `2026-10-23 20:16:08`).
- Windows executable artifact: `Frontend/src-tauri/target/release/app.exe` (12,710,400 bytes, timestamp `2026-10-23 20:16:00`).
- Toolchain notes: NSIS uses cached tools at `C:\Users\hp\AppData\Local\tauri\NSIS\makensis.exe` (v3.13); WiX uses cached tools at `C:\Users\hp\AppData\Local\tauri\WixTools314\` (v3.14). The earlier download failure was resolved using the cached toolsets.
- The frontend bundler reported its existing large-chunk advisory; Rust reported two existing unused `doc_title` variables in printer code. These did not stop the Android APK or Windows installer builds.
- No Phase 12 end-to-end or regression tests were run in this turn, as the combined pilot test session is intentionally deferred.

## Safe test environment

- Use the isolated PostgreSQL database `nextvisit_test` for all pilot tests. Never aim a test run at `nextvisit_db`.
  Example test backend startup command from `Backend` in PowerShell:
  ```powershell
  $env:DATABASE_URL = "postgresql://<PGUSER>:<PGPASSWORD>@localhost:5432/nextvisit_test"
  uvicorn app.main:app --host 0.0.0.0 --port 8001
  ```
- Keep production credentials and tokens out of screenshots, logs, and support reports.
- For phone-to-Windows LAN testing, bind the test backend to `0.0.0.0:8001`, keep Windows and phones on the same private Wi-Fi/hotspot, and use the Windows host's current private IPv4 address. Do not expose this development backend through router port forwarding or a public network.
- The Android debug package must use `VITE_API_BASE_URL=http://<WINDOWS-LAN-IP>:8001` for this LAN test. `localhost` on Android refers to the phone itself. Rebuild if the Windows LAN address changes. Debug cleartext HTTP is for this isolated test only; public release must use HTTPS.
- Before creating test orders, verify the app is logged into the intended test tenant and the top-bar endpoint/network status is the expected one.

## Build and update

### Android pilot package

#### Option A: Hosted Services Build (Recommended for Cloud/Hosted Pilot)
Build target connecting directly to the hosted Render services:
```powershell
cd Frontend
$env:JAVA_HOME = "C:\Program Files\Java\jdk-22"
$env:ANDROID_HOME = "C:\Users\hp\AppData\Local\Android\Sdk"
$env:VITE_API_BASE_URL = "https://nextvisit-backend.onrender.com"
$env:VITE_FRONTEND_URL = "https://nextvisit-frontend.onrender.com"
npx @tauri-apps/cli android build --debug --apk --target aarch64
```

#### Option B: Local LAN Test Package
From `Frontend` in PowerShell, set the local LAN test address for isolated offline/LAN coordinator testing:
```powershell
cd Frontend
$env:JAVA_HOME = "C:\Program Files\Java\jdk-22"
$env:ANDROID_HOME = "C:\Users\hp\AppData\Local\Android\Sdk"
$env:VITE_API_BASE_URL = "http://<WINDOWS-LAN-IP>:8001"
npx @tauri-apps/cli android build --debug --apk --target aarch64
```

Expected artifact:

```text
Frontend/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

#### ADB Device Installation & Authorization Steps

1. Connect the Android phone via USB cable to the PC.
2. Ensure **Developer options** -> **USB debugging** is enabled on the phone.
3. If prompt doesn't appear, check the phone's USB notification and change mode from *Charging only* to *File Transfer / MTP*.
4. Unlock the phone screen. A modal **"Allow USB debugging?"** will appear with the PC's RSA key fingerprint.
5. Check **"Always allow from this computer"** and tap **"Allow"**.
6. In PowerShell, check device connection:
   ```powershell
   adb devices
   ```
   The device state must transition from `unauthorized` to `device`.
   - If device is not listed: Verify data-capable USB cable and ensure manufacturer ADB drivers are installed.
   - If device remains `unauthorized`: Run `adb kill-server`, on phone tap *Developer options -> Revoke USB debugging authorizations*, and reconnect USB cable.
7. Install APK as an update so the existing local SQLite data is preserved:
   ```powershell
   adb install -r "Frontend/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk"
   ```

Do not uninstall or clear app storage during offline-order tests. Those actions can remove the device's local database and unsynced outbox.

### Windows pilot installer

From `Frontend` in PowerShell, target the isolated local test backend and choose the desired bundle target:

```powershell
# For NSIS standalone setup installer (.exe):
$env:VITE_API_BASE_URL = "http://127.0.0.1:8001"
npx tauri build --bundles nsis

# For MSI Windows Installer package (.msi):
$env:VITE_API_BASE_URL = "http://127.0.0.1:8001"
npx tauri build --bundles msi
```

Expected artifacts:
- NSIS Setup: `Frontend/src-tauri/target/release/bundle/nsis/nextvisit-pos_0.1.0_x64-setup.exe`
- MSI Package: `Frontend/src-tauri/target/release/bundle/msi/nextvisit-pos_0.1.0_x64_en-US.msi`
- Raw Executable: `Frontend/src-tauri/target/release/app.exe`

Install the freshly built package and verify the displayed app version and login before the pilot. This configuration is for local QA only, not for public deployment.

### Routine update sequence

1. Confirm all devices are online and their outboxes show zero pending, syncing, failed, and conflict items.
2. Take a database backup using the normal PostgreSQL operations for the selected environment.
3. Close the desktop app before updating it. Install the new package over the existing installation; do not remove app data.
4. Install Android updates with `adb install -r` or the approved store/update channel; do not clear app data.
5. Start the matching backend and verify login, master-data load, and sync status before resuming order entry.

## Backup and restore boundaries

### PostgreSQL server data

Use the organization's approved PostgreSQL backup process and verify restoration into a separate recovery database before relying on it. The following PowerShell template uses standard PostgreSQL client tools and environment variables; fill connection settings from the approved secret store, not this document or shell history. The backup account should have read/backup access only.

```powershell
# Example is for the isolated pilot database. Set PGHOST, PGPORT, PGUSER,
# and PGPASSFILE from the approved test-environment configuration first.
$env:PGDATABASE = "nextvisit_test"
$backupRoot = "C:\NextVisitBackups"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $backupRoot "nextvisit_test-$stamp.dump"
pg_dump --format=custom --no-owner --file $backupFile $env:PGDATABASE
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed; do not use this backup" }
pg_restore --list $backupFile | Select-Object -First 10
```

Store the dump on an encrypted drive with access restricted to authorized staff. Keep at least one copy separate from the laptop. To verify recovery, create a **new, uniquely named recovery database** and restore there; never point restore commands at `nextvisit_db` or overwrite the source database:

```powershell
$restoreDb = "nextvisit_restore_YYYYMMDD_HHMMSS" # replace with a unique name
createdb --template=template0 $restoreDb
if ($LASTEXITCODE -ne 0) { throw "Recovery database creation failed" }
pg_restore --no-owner --exit-on-error --dbname $restoreDb $backupFile
if ($LASTEXITCODE -ne 0) { throw "Restore failed; keep the dump and recovery DB for diagnosis" }
psql --dbname $restoreDb --command "SELECT current_database();"
psql --dbname $restoreDb --command "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"
```

A backup is not verified until restore completes and important test records/counts have been checked. This procedure was documented, **not executed** in this turn. Never restore a test backup over `nextvisit_db`.

### Local POS SQLite data

The app stores local POS data in `pos_local.db` under Tauri's app-local data directory (`data/`); Windows installs typically resolve below `%LOCALAPPDATA%\com.nextvisit.pos\data\`. The database uses SQLite WAL mode. There is currently no operator-facing local backup/restore workflow documented or verified.

- Before any planned device reset or reinstall, reconnect and confirm the outbox is fully synced. Do not uninstall/clear app storage while offline or while outbox rows are pending.
- For a Windows forensic copy, close the POS app first and preserve `pos_local.db` together with any existing `pos_local.db-wal` and `pos_local.db-shm` files. Example copy (set a destination on an encrypted/restricted drive first):

  ```powershell
  $sourceDir = Join-Path $env:LOCALAPPDATA "com.nextvisit.pos\data"
  $backupDir = "D:\NextVisitBackups\pos-local-YYYYMMDD-HHMMSS" # choose a unique folder
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  Get-ChildItem -LiteralPath $sourceDir -Filter "pos_local.db*" -File |
    Copy-Item -Destination $backupDir
  ```

  Restore only with the POS closed: first copy the current `data` folder to a separate recovery folder, then copy the preserved `pos_local.db*` files back together. Do not manually edit the database. This is a manual forensic/recovery procedure, not a verified operator feature.
- Android app data is sandboxed. This runbook does not claim a supported manual Android database restore. If an Android device is lost, cleared, or corrupted while it has unsynced orders, preserve any available app diagnostics and reconcile against receipts/KOTs before continuing.
- If corruption recovery moves a database into a `quarantine/pos_corrupt_<timestamp>` directory, preserve that directory for support; do not delete it or replace files until a verified recovery copy exists.

## Combined end-to-end pilot matrix

Run this matrix in the isolated test environment and record date, app/backend build, device prefix, expected result, actual result, and evidence for every row. Use fresh, clearly labeled test orders; do not repeatedly submit after an ambiguous timeout.

| Check | Procedure | Expected result | Status |
|---|---|---|---|
| Online login/master data | Start the test backend, log in, load menu/tables, and wait for sync. | Login succeeds; cached menu/tables load; no unexpected outbox errors. | Not run |
| Online order and settlement | Create one test order, settle by cash, open its detail/receipt. | One order and one payment; correct total/status/reference. | Not run |
| Internet loss and local order | Keep LAN available, disable only internet/WAN, create one order. | Order saves locally; a pending outbox item is visible; no indefinite spinner. | Not run |
| App restart with pending work | Close/reopen the app while a test outbox item is pending. | Local order remains visible and eligible for retry; no duplicate order. | Not run |
| LAN pairing and authorization | Pair both Android devices with separate short-lived codes; attempt one unauthorized claim. | Paired devices receive scoped access; expired/reused/unpaired claims are rejected. | Not run |
| Two-device concurrent orders | Create distinct orders at nearly the same time from Device A and B. | Both commit once; device-prefixed order numbers do not collide; permitted updates appear across devices. | Not run |
| Settlement retry/idempotency | Submit a cash settlement, interrupt/retry once using the same transaction ID. | Exactly one payment/visit/points result; retry reports committed/already committed. | Not run |
| Coordinator/server downtime | Stop the Windows backend during an order attempt, then restart it. | Unacknowledged work stays queued; committed data and pairing survive restart; retry does not duplicate. | Not run |
| Android network disconnect | Toggle phone Wi-Fi off/on while local work is pending. | The UI reports offline/queued state and resumes relay when connectivity returns. | Not run |
| Migration/upgrade | Install the update over a test install with existing local orders/outbox. | Existing local data remains readable; migrations apply once; no unexpected loss. | Not run |
| Backup and restore | Back up test PostgreSQL data; restore into a separate recovery DB and verify records. | Restore is usable and test records reconcile. Local Android restore remains unsupported unless separately implemented. | Not run |
| Printer disconnect | With no printer available, attempt receipt/print fallback. | Order/payment remains intact and browser/PDF fallback is available; physical printer acceptance stays pending. | Not run |
| Existing restaurant flows | Recheck menu, tables, QR orders, staff orders, customers, reports, and shared navigation touched by the release. | No regression in the previously working flows. | Not run |
| Internet restored | Re-enable internet after LAN/offline work and press Sync Now if needed. | Outbox drains without duplicate cloud orders/payments; final status is synced or has a specific actionable error. | Not run |

## Stop and recovery rules

- If order submission stays in a spinner state or times out, stop submitting and inspect the local outbox before retrying.
- If an outbox item is `FAILED` or `CONFLICT`, capture its transaction ID and sanitized error, preserve the local database, and do not delete/recreate the order to work around it.
- If a device shows a different business or device identity than the test setup, stop the pilot and correct the environment before creating more records.
- If a restore or migration fails, keep the original backup and quarantine files unchanged and restore only into a separate recovery database/device.
- Do not promote the debug APK or local-HTTP Windows installer to public users. Public release requires a signed release artifact, HTTPS service configuration, store policy declarations, support/privacy information, and a passed pilot review.

## Support handoff template

Collect only:

- app version/build and backend environment label (`nextvisit_test` or production),
- date/time and device prefix/type,
- sanitized outbox transaction ID, operation, state, and error text,
- whether internet, local Wi-Fi, and Windows coordinator were reachable,
- screenshot with names, phone numbers, tokens, and credentials hidden.

Never send passwords, bearer tokens, pairing tokens, full database files, or unredacted customer exports in ordinary chat/support messages.
