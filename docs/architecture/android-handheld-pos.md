# NextVisit Phase 10: Android Phone & Tablet POS Application

## 1. Executive Summary & Framework Evaluation

In accordance with Phase 10 requirements of the Master Execution Plan (`NextVisit_Codex_Master_Execution_Plan.md`), multiple framework options were evaluated against team and repository constraints before finalizing the mobile strategy:

| Evaluation Dimension | Option 1: Tauri v2 Android (Selected) | Option 2: React Native / Expo | Option 3: Capacitor (Ionic) | Option 4: Flutter |
| :--- | :--- | :--- | :--- | :--- |
| **Code Reuse** | **100%** (Vite + React 19 UI, Lucide, Tailwind, Radix UI) | **~15%** (requires rewriting JSX to native components) | **~75%** (Vite webview wrapper) | **0%** (Requires Dart rewrite) |
| **Local SQLite Parity** | **Identical** (`rusqlite` + bundled SQLite C engine, exact same migrations `001` through `005`) | Divergent (requires WatermelonDB or `expo-sqlite`) | Divergent (`@capacitor-community/sqlite` IPC differences) | Divergent (Drift/sqflite) |
| **Sync Engine Parity** | **Identical** (re-uses `syncWorker`, client outbox, retry backoff, push/pull contracts) | Requires separate sync reimplementation | Reuses web worker or needs custom bridge | Complete rewrite |
| **Physical ESC/POS Printing** | **Shared** (Tauri Rust printer abstraction, network TCP 9100 + browser print fallback) | Native Bluetooth library required | Web Bluetooth or third-party Cordova plugin | Native ESC/POS plugin |
| **Maintenance Overhead** | **Single unified codebase** for Web, Windows Desktop, Android Phone, and Android Tablet | High (separate mobile repository or complex monorepo) | Medium | Very high (dual-stack team required) |

### Decision
**Option 1 (Tauri v2 Mobile Target)** was confirmed and implemented. It leverages the existing Tauri v2 Rust foundation and Vite React 19 frontend, guaranteeing complete parity across local SQLite schema migrations, offline order creation (Phase 6), offline cash settlements (Phase 7), durable sync outbox queue (Phase 8), and receipt printing (Phase 9).

---

## 2. Architecture & Device Identity

### 2.1 Supported Device Types
The backend (`Backend/app/models/client_device.py`) and client setup interface support three device form factors:
- `DESKTOP_WINDOWS`: Stationary counter POS (default prefix `POS01`).
- `ANDROID_TABLET`: Table-side tablet terminal for waitstaff and captains (default prefix `TAB01`).
- `ANDROID_MOBILE`: Handheld smartphone terminal for rapid table-side ordering and captain order dispatch (default prefix `MOB01`).

### 2.2 Client-Side Device Binding Storage
- Stored credentials in sandboxed storage (`localStorage`):
  - `nextvisit:pos_device_id`: Device UUID v4.
  - `nextvisit:pos_device_business_id`: Active business tenant ID (enforces strict cross-tenant isolation).
  - `nextvisit:pos_device_name`: Human-readable device label.
  - `nextvisit:pos_device_type`: `DESKTOP_WINDOWS`, `ANDROID_TABLET`, or `ANDROID_MOBILE`.
  - `nextvisit:pos_device_prefix`: 1–10 uppercase alphanumeric prefix (e.g. `TAB01`, `MOB01`).
- **Security Invariant:** Zero auth tokens or passwords are ever stored as device credentials.

---

## 3. Touch-First Responsive Mobile UI

### 3.1 Table Grid (`TablesPageView.tsx`)
- Minimum **40–48px** touch targets on all interactive table cards and primary action buttons.
- Touch-accessible status indicator chips: Available (`EMPTY`), Occupied (`OCCUPIED`), Food Served (`SERVED`), Bill Paid (`COMPLETED`), and Offline (`OFFLINE`).
- **Offline Order Capability:** While offline, cached table cards allow immediate order creation via `+ Offline Order`, queuing the local order and outbox transaction directly into `pos_local.db`.

### 3.2 Handheld Order Dialog (`NewOrderDialog.tsx`)
- **Sticky Bottom Cart Drawer:** Waitstaff on mobile phones (360–420px width) can view cart count, expand item breakdown, review tax/subtotal, and tap **"Place Order"** with a single thumb press.
- **Horizontal Scroll Category Chips:** Menu categories scroll horizontally on small screens for rapid single-handed category switching.
- **Enlarged Stepper Controls:** Item quantity `+` and `-` buttons optimized for touchscreen taps without misclicks.

---

## 4. Android Build Artifact & Verification

### 4.1 Build Toolchain
- **Android SDK:** `%LOCALAPPDATA%\Android\Sdk` (Platform `android-35`, Build Tools `35.0.0`).
- **Android NDK:** Version `29.0.13113456` (`LLVM clang` cross-compilers for `x86_64`, `aarch64`, `armv7`, `i686`).
- **Gradle & AGP:** Gradle `8.14-all` with Android Gradle Plugin (AGP) `8.11.1` and `android.useAndroidX=true`.
- **Rust Toolchain:** Target `x86_64-linux-android` (and `aarch64-linux-android`).

### 4.2 Verified Package Artifact
- **APK Path:** `Frontend/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`
- **Package ID:** `com.nextvisit.pos.debug`
- **Output Size:** ~150.6 MB (unstripped debug build with full SQLite and Rust symbols).

---

## 5. Verification Checklist & Current Status

| Verification Gate | Expected Behavior | Actual Result |
| :--- | :--- | :--- |
| **Framework Evaluation** | Formal evaluation against team/repo constraints | **PASSED** (Tauri v2 Mobile ADR documented) |
| **Device Registration** | Support `ANDROID_TABLET` & `ANDROID_MOBILE` with prefix | **PASSED** (`desktop-device-setup-dialog.tsx` updated) |
| **Vite Production Build** | Compiles clean HTML/JS/CSS bundle | **PASSED** (`npm run build` in 6.03s) |
| **Rust Cross-Compilation** | Compiles `libapp_lib.so` for Android runtime | **PASSED** (`dev` profile target in 1m 01s) |
| **Android APK Packaging** | Assembles signed debug APK with AndroidX | **PASSED** (`app-universal-debug.apk` generated) |
| **Backend Integration Tests**| 35 sync, order security, and device isolation tests | **PASSED** (`pytest tests/ -v`: 35 passed, 0 failed) |
| **Local Tauri SQLite Tests** | 33 Rust tests for WAL, migrations, outbox, settlement | **PASSED** (`cargo test`: 33 passed, 0 failed) |
| **Phase 9 Physical Printer** | Physical hardware ESC/POS print test | **PENDING** (Awaiting real hardware) |
