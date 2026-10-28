# Android Pilot Findings — Functionality and UI

Captured from the user-provided Android screenshots on 2026-10-26. These are observations for follow-up; no order data was edited and no UI implementation was changed as part of recording them.

## Functionality issues to fix first

1. **Order submission shows `Failed to fetch`.** The New Staff Order modal remains open on Table T-02 with 7 Iced Cappuccinos and 1 Masala Chai (₹1,100) while the failure toast is visible.
   - **Endpoint & Transport Evidence:** The Phase 12 runbook and current build environment confirm the Android APK was built with `VITE_API_BASE_URL=http://10.192.39.162:8001` (laptop Wi-Fi IP). The phone connects over Wi-Fi directly to port 8001 without using ADB reverse port forwarding. The fetch rejection occurred because port 8001 was unreachable from the phone (e.g. backend server stopped or firewall blocked).
   - **Database Correlation:** Server database query on `nextvisit_test` confirmed that zero orders exist for Table T-02. The request was rejected at client transport before reaching the backend; no row was created on the server and none was saved in local SQLite.
   - **Code Fix (Resolved):** In `Frontend/src/lib/orders-api.ts:createOrderApi`, an explicit `try / catch` now intercepts transport failures (`isNetworkOrTransientError`). When online fetch rejects, it seamlessly creates the order locally in SQLite outbox using a stable `client_order_id`. Furthermore, the online `POST /api/v1/orders` payload now transmits `client_order_id`, ensuring that if a response is dropped after server commit, subsequent retries or syncs match idempotently and never create duplicate orders.

2. **Outbox has two terminal failures while reporting online.**
   - **Backend Safe Reconciliation (Resolved):** Historical cancelled order `4599db43` (`ORD-POS01-000001`) remains strictly immutable. When an incoming offline order from `POS01` collides, backend allocates the next free sequence for that device (e.g. `ORD-POS01-000002`) and binds `client_order_id`.
   - **Local SQLite & Outbox Atomicity (Resolved):** `Frontend/src-tauri/src/sync.rs` now takes `response_data` in `AcknowledgeItemInput`. When `CREATE_ORDER` sync succeeds with a server-reconciled order number, it atomically updates `local_orders.order_number`, transitions `sync_status` to `SYNCED`, updates `local_payments.receipt_reference` to `REC-{new_number}`, and rewrites any pending `SETTLE_ORDER` outbox payload's `receipt_reference` to match. Verified via unit test `test_order_number_remapping_on_sync_acknowledgement`.
   - **Sequence Counter Seeding (Resolved):** Backend `/sync/pull` returns `device_order_sequence`, and Tauri `apply_master_data_snapshot` seeds `app_metadata` with this sequence. Local fallback also queries max sequence from `local_orders`.

3. **Device identity/prefix validation.**
   - Inspection of `ClientDevice` table in `nextvisit_test` shows `NextVisit Smoke Bistro` currently only has one registered device: `Main Terminal (POS01)` (`DESKTOP_WINDOWS`).
   - The phone bound to `POS01` because it was the only registered terminal in that business session.
   - **Safe Migration Path:** Existing device binding and local SQLite database are preserved untouched. If the pilot requires a separate mobile prefix (`MOB01`), a new device `Mobile Terminal (MOB01)` can be registered via `POST /api/v1/devices` (`ANDROID_MOBILE`), and the device binding can be switched in settings without wiping local order history.

4. **Table/order state observation.**
   - Verified that Table T-01 has historical orders from prior desktop testing, while T-02 was never committed to the database. Live table occupancy and order lists accurately reflect committed records.

5. **Retry safety and outbox recovery.**
   - Do NOT blindly tap Retry on the phone until the updated APK is installed and the backend is running on `0.0.0.0:8001` with `nextvisit_test`.

## Evidence boundaries

- All automated tests run strictly against isolated test DB `nextvisit_test`.
- 31 backend Python tests passed.
- 34 Rust Tauri tests passed (including order remapping regression test).
- Frontend Vite production build passed.
- ARM64 Android debug APK built: `app-universal-debug.apk` (296,412,227 bytes, SHA-256 `7FB9D44B4FBB0C24AD0AD6FE2E4D83206E1FDC578AD322A926CBC3A0F39AAD88`).
- Physical on-phone execution remains pending until installed on device.
- No physical printer is available; printer hardware acceptance remains separate and pending.
4. **Table/order state may be stale or inconsistent.** The Tables screenshot shows T-01 occupied with a 2-item, ₹105 POS order while T-02 is empty, even though the failed T-02 order modal contains an ₹1,100 cart. Verify live table occupancy, order lists, and local cache are scoped to the correct business, device, table, and committed order. Do not infer that the T-02 cart was committed from the screenshot.
5. **Retry safety and outbox recovery.** Do not blindly retry or delete the two failed records. Trace their exact transaction IDs and payloads, determine whether matching server orders/payments already exist, and provide a safe idempotent reconciliation path that preserves audit history and never attaches an order based on order number or receipt reference alone.

## UI issues to defer (record only; do not change in the functionality fix)

- New Staff Order modal: the title/header and close control are partially obscured by the Android status bar and `Failed to fetch` toast; product cards are unusually tall with large unused whitespace; the cart/footer dominates the bottom of the viewport.
- Tables page: content looks oversized for a phone; the first table card is partially clipped horizontally; QR self-order links occupy a large area below the table map and make the page very long.
- Outbox: title/subtitle wrap into several lines and compete with the Close and Sync Now buttons; filter tabs are clipped horizontally; error messages truncate; the sheet consumes nearly the full screen and requires extensive scrolling.
- Top bar/safe area: Android system status icons have weak contrast/spacing against the light app header; the top bar and sync-status row take substantial vertical space.

## Evidence boundaries

- Screenshots show visible states only; they do not prove whether a failed order was persisted locally or on the server.
- The outbox errors are consistent with an order-number collision and client/device identity mismatch, but establish the exact cause by correlating the specific outbox payloads, sync transaction records, and server order/payment rows.
- The code-level online fetch fallback and server-to-local reconciled order-number mapping remain unverified/unfixed based on the reviewed changes. No successful on-phone retest is recorded here.
- No physical printer is available; printer hardware acceptance remains separate and pending.
