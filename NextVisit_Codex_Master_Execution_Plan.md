# NextVisit Offline POS --- Master Execution Plan for Codex

**Project root:** `C:\Users\hp\Desktop\Major Project\Nextvisit`

**Purpose:** This document is the single source of truth for Codex to
understand the target product, review the existing repository, decide
the next safe step, and generate precise copy-paste prompts for
Antigravity. Follow it sequentially. Do not attempt to implement the
entire roadmap in one pass.

------------------------------------------------------------------------

## 1. Roles and workflow

-   **Codex:** Senior software architect, technical project manager,
    reviewer, and prompt writer. It should inspect the current state,
    reason about dependencies, choose the next step, and generate one
    precise Antigravity prompt at a time.
-   **Antigravity:** Performs repository implementation and independent
    code/security audits when instructed.
-   Do not introduce Claude into this workflow.
-   Codex should not assume it has modified the repository unless it
    actually has tools and has performed those edits. Its default role
    is planning/review/prompt generation.
-   The user will give Codex's next prompt to Antigravity, then bring
    Antigravity's report/results back to Codex for review.
-   Keep explanations in concise Hinglish/Roman Hindi for the user.
    Prompts intended for Antigravity may be in clear technical English.
-   Stay strictly inside the stated Nextvisit project root. Do not
    search parent folders or unrelated projects.
-   Never make the user run a long manual test checklist if a focused
    automated check can verify it.

## 2. Product goal

Build NextVisit into a reliable restaurant POS ecosystem:

1.  Windows desktop POS application.
2.  Multiple Android phones/tablets used by restaurant staff.
3.  Existing FastAPI + PostgreSQL cloud backend remains the central
    cloud service.
4.  POS should continue essential order-entry and billing operations
    during internet outages.
5.  Locally stored work must survive app restart, Windows restart, and
    temporary power/network failure.
6.  When connectivity returns, changes sync safely without duplicate
    orders/payments or silent data loss.
7.  Receipt printing should eventually work with supported thermal
    printers.
8.  Existing restaurant functionality and all unrelated NextVisit
    modules must remain stable.

**Important product honesty:** Offline on two independent devices does
not mean they can see each other's new changes while the internet is
down. Cross-device offline sharing requires a deliberate LAN
coordinator/peer-sync architecture. Do not promise this until designed
and tested.

## 3. Current repository facts to re-check, not blindly assume

The latest reported baseline (2026-10-17) says:

-   Frontend is a Vite + React 19 + TypeScript SPA, with React Router
    and TanStack Query. It is not actually a Next.js app despite
    outdated README wording.
-   Backend is FastAPI + SQLAlchemy + Alembic + PostgreSQL.
-   Existing restaurant domain includes business/settings, dining
    areas/tables, menu categories/items, orders/order items, customers,
    visits/loyalty, and order settlement.
-   Main order APIs include `POST /api/v1/orders` and
    `POST /api/v1/orders/{id}/settle`.
-   Invoice display currently uses browser printing (`window.print()`).
-   No complete local SQLite database, durable client outbox, automatic
    frontend sync worker, or Android app was confirmed.
-   Some Tauri shell scaffolding already exists.
-   Backend sync scaffolding reportedly exists:
    -   `POST /api/v1/devices`
    -   `POST /api/v1/sync/push`
    -   `GET /api/v1/sync/pull`
    -   device registration, idempotency hashing, per-item transactions,
        tenant checks, order device prefixes, and batch limit reportedly
        exist.
-   A migration was added:
    `Backend/alembic/versions/j1k2l3m4n5o6_add_client_devices_and_sync_transactions.py`;
    latest reported Alembic head was `j1k2l3m4n5o6`, parent
    `e9d7a4459c47`. Do not apply migrations to a live database as part
    of an audit.
-   Last reported checks:
    -   Frontend `npm run build`: passed.
    -   Focused backend
        `python -m pytest tests/test_idempotency_and_sync.py -v`: 16
        passed.
    -   Full backend test command reported 16 tests, but test-discovery
        scope may be incomplete; historical results differed. Verify
        discovery before making claims.
    -   `cargo check --offline` was blocked because dependencies were
        not cached and the Rust toolchain was old. A working native
        Tauri binary/installer is not confirmed.
-   A reported frontend issue: auth API base URL detection may treat the
    packaged Tauri hostname (such as `tauri.localhost`) incorrectly.
    Verify actual code and behavior before changing it.
-   There may be existing unrelated scratch PDF modifications. Preserve
    them.

These are prior reported facts only. Start by checking the actual
current repository and Git state.

## 4. Critical preservation rules

Before any implementation:

1.  Run `git status --short` and inspect relevant diffs.
2.  Treat all existing modified/untracked files as user work.
3.  Do not reset, clean, stash, discard, revert, or overwrite existing
    changes.
4.  Do not delete or replace scratch files, including:
    -   `Backend/scratch/test_executive_pdf.pdf`
    -   `Backend/scratch/test_layout.pdf`
5.  Keep changes inside `C:\Users\hp\Desktop\Major Project\Nextvisit`.
6.  Do not touch salon, school, pharmacy, or other product modules
    unless a shared component change is proven necessary. If necessary,
    explain and test impact first.
7.  Do not run database migrations against production/live databases.
    Use isolated test databases for migration tests.
8.  Never expose secrets, tokens, passwords, database URLs, or
    environment values in logs or reports.
9.  Make additive, reversible changes wherever possible.
10. Do not add packages, update Rust/Node/Python, or alter deployment
    configuration without explaining the need and getting the user's
    approval.
11. Never claim an installer, Android app, printer integration, or
    offline capability works without evidence from a build/test or a
    documented manual smoke test.

## 5. Architecture decision that must happen early

Before designing SQLite schema or finalizing sync contracts, compare
these options and recommend one based on actual repository constraints
and user needs.

### Option A --- Independent offline replicas per device

-   Windows and each Android device have their own local database.
-   Each device can create local orders offline.
-   While disconnected, a device cannot see another device's new offline
    orders.
-   Each device syncs to cloud when online.
-   Needs stable client-generated IDs, idempotency, conflict policy,
    tombstones/deletion propagation, and clear pending-sync UI.

### Option B --- Windows desktop as LAN coordinator

-   Windows POS hosts the local restaurant data/sync service on the
    local network.
-   Android devices connect to the Windows device over Wi-Fi/LAN during
    internet outages.
-   Can support shared local state, but Windows and router must stay
    powered on and reachable.
-   Adds local network security, pairing, authorization, conflict
    handling, backups, and coordinator failure concerns.

### Required output

Codex must explain the trade-offs in simple terms, recommend an MVP and
future direction, and explicitly list what works/does not work during an
internet outage. Do not silently assume the devices share offline data.
If a critical product choice is still uncertain, ask the user one
concise question before freezing the architecture.

## 6. Security gate --- first implementation priority

A previous audit raised these possible issues. Re-check the current code
and confirm with tests before changing anything:

1.  **Potential critical IDOR/BOLA:** `GET /api/v1/orders/{id}` and
    `POST /api/v1/orders/{id}/items` may use optional authentication;
    the order repository/service may skip tenant checks when no user is
    present. Check whether guest/QR tokens are properly validated and
    scoped.
2.  **Potential unauthenticated failure:**
    `POST /api/v1/orders/customers/auto-detect` may allow optional auth
    while accessing `current_user.business_id`, potentially producing a
    500 for anonymous requests.
3.  **Sync deletion gap:** incremental pull may use
    `updated_at >= since`, while hard deletes have no tombstones; local
    caches could retain deleted records.
4.  Check device ownership, business/tenant scoping, sync transaction
    ownership, replay protection, payload size limits, validation, and
    authorization on every sync endpoint.

Security instructions: - Trace every endpoint's callers and legitimate
public guest QR/checkout use before changing authentication. - Do not
break public guest flows. Use narrowly scoped, validated guest tokens
where appropriate. - Add regression tests for both allowed guest
operations and blocked unauthorized access. - Test cross-business
access, missing/invalid/expired token cases, duplicate/replayed sync
transactions, and malformed payloads. - Avoid leaking whether another
tenant's UUID exists. - Report each finding as confirmed, not
reproduced, or needs manual verification. - Do not start SQLite/offline
UI work until the security gate is reviewed and the user accepts the
result.

## 7. Roadmap and completion gates

Follow phases in order. Codex should generate **only the next
Antigravity prompt**, not a giant prompt that attempts all phases. After
results return, review them against the phase acceptance criteria, then
prepare the next prompt.

### Phase 0 --- Repository baseline and change safety

Tasks: - Inspect Git status and current diffs. - Verify frontend/backend
layout and current sync/Tauri work. - Run focused checks that do not
modify production data. - Confirm test discovery, migration chain/head,
and relevant endpoint call paths. Acceptance: - A concise baseline
report with exact commands/results. - All uncommitted work listed and
protected. - No migrations applied and no unrelated files changed.

### Phase 1 --- Security audit and targeted remediation

Tasks: - Verify the potential IDOR/BOLA and unauthenticated customer
auto-detect issue. - Verify tenant/device ownership across sync
endpoints. - Design safe public guest flow behavior. - Add regression
tests and implement only confirmed fixes. Acceptance: - Tests prove
unauthorized access is blocked. - Legitimate public QR/guest flow
remains working. - Tenant isolation and sync replay protections are
covered. - Existing module regression checks pass. - Findings and
remaining risks clearly documented.

### Phase 2 --- Architecture decision and contract

Tasks: - Compare independent offline replicas vs Windows LAN
coordinator. - Recommend a staged approach. - Define offline scope:
order creation, cart editing, customer capture, settlement/payment
status, receipts, table status, and what remains online-only. - Define
stable IDs, order number strategy, idempotency, conflicts,
deletions/tombstones, device registration, clock/time handling, and
operator-visible sync states. Acceptance: - Architecture decision record
exists in the repository docs. - No implementation assumptions remain
hidden. - User-facing offline limitations are explicit.

### Phase 3 --- Windows Tauri shell viability

Tasks: - Inspect Tauri config, Rust/Cargo versions, package scripts,
capabilities/permissions, and API base URL selection. - Identify minimum
supported Rust version from actual dependency/config requirements. - Do
not install/update toolchains or packages without approval. - Produce
the smallest viable build path and online POS smoke test. Acceptance: -
Exact prerequisites documented. - Build status clearly marked as
passed/blocked. - If blocked, give the precise cause and minimal
user-approved next action. - Do not claim an installer exists unless
built and tested.

### Phase 4 --- Local SQLite foundation

Tasks: - Choose a suitable SQLite library compatible with the actual
Vite/Tauri setup. - Design schema versioning and local migrations. -
Include durable operation/outbox records, local IDs, server IDs, sync
status, timestamps, error state, and schema version. - Add
encrypted/safe handling for sensitive local data where appropriate; do
not store credentials in plaintext. - Add backup/recovery and corruption
handling strategy. Acceptance: - Local schema migrations work on a fresh
DB and on an older schema fixture. - App restart preserves data. -
Backup and restore tests pass. - No cloud schema or existing API
behavior is broken.

### Phase 5 --- Offline master-data cache

Tasks: - Cache only the data required for permitted offline operations:
menu, categories, tables/areas, business settings, and the minimum
staff/customer information justified by the chosen design. - Define
refresh rules and stale-data display. - Implement deletion
tombstones/soft-delete propagation. Acceptance: - App can open cached
POS data offline after a successful online refresh. - Stale/offline
status is visible. - Deleted or disabled records are handled safely on
sync. - No tenant data crosses business boundaries.

### Phase 6 --- Offline order creation

Tasks: - Create orders locally in an atomic SQLite transaction. -
Generate collision-resistant client IDs before sync. - Keep
cart/order/item totals consistent and validate prices/discounts/tax
according to the existing domain rules. - Track device identity and
origin. Acceptance: - Order can be created offline and survives app
restart. - Rapid repeated taps do not create duplicate local orders. -
Stable IDs remain unchanged during retries. - Existing online order
creation still works.

### Phase 7 --- Settlement, payment, invoice lifecycle

Tasks: - Model payment/settlement status explicitly, including pending
confirmation when offline. - Prevent duplicate settlements and duplicate
payment records. - Separate locally generated receipt reference from
server-assigned invoice/order number where needed. - Document how cash,
UPI, card, refunds, and split payments behave offline; do not mark an
unverified online payment as paid. Acceptance: - Offline cash settlement
behavior is explicit and tested. - Online payment verification is not
fabricated while disconnected. - Repeated sync cannot settle twice. -
Receipt/order references remain traceable.

### Phase 8 --- Durable sync engine

Tasks: - Implement a persistent outbox and retry worker. - Push
transactions in safe batches; acknowledge each item independently. -
Retry transient errors with bounded exponential backoff and jitter. -
Keep failed items for operator review; never silently drop them. - Pull
changes with pagination/cursors, tombstones, and tenant/device
authorization. - Handle duplicate requests, server restarts, clock skew,
schema/API version mismatch, and conflicts. - Ensure sync resumes after
app restart. Acceptance: - Offline orders sync when connectivity
returns. - Repeated retries do not create duplicate
orders/items/payments. - Pending, syncing, synced, and failed states are
visible to staff. - Permanent errors remain recoverable and explain the
next action. - Tests cover network failure, server failure, duplicate
push, partial batch failure, restart recovery, and conflicting updates.

### Phase 9 --- Receipt and thermal printer support

Tasks: - First identify target printer connection types: USB, Bluetooth,
LAN/Wi-Fi, and command language (for example ESC/POS). - Avoid assuming
every printer is compatible. - Design a printer abstraction and retain
browser-print fallback. - Add a test receipt and paper-width options
only after confirming printer model/connection. Acceptance: - Tested on
at least one specified printer model/connection. - Correct item, tax,
discount, payment, business, and receipt details print. - Printer
failure does not lose the order. - Reprint is possible and clearly
marked when appropriate.

### Phase 10 --- Android phone/tablet app

Tasks: - Decide implementation framework based on repository and team
constraints; do not select one without evaluating options. - Reuse
documented API/sync contracts and shared business rules where
feasible. - Implement device identity, local persistence, secure auth,
cached master data, offline order queue, retry states, and responsive
touch-first UI. Acceptance: - Android build installs on a real or
emulated device. - Online and offline tests pass. - Data survives app
restart. - Multi-device limitations match the architecture decision. -
Existing web/desktop APIs remain backward-compatible.

### Phase 11 --- LAN coordination (only if selected)

Tasks: - Add a local coordinator service on Windows and authenticated
device pairing. - Restrict LAN access, validate devices, protect local
endpoints, and handle coordinator restarts. - Define what happens when
Windows or router is unavailable. Acceptance: - Two Android devices and
Windows can exchange allowed changes during an internet outage, if that
is the chosen requirement. - Unpaired/unauthorized devices are
blocked. - Coordinator restart does not lose committed transactions. -
Failure and recovery scenarios are tested.

### Phase 12 --- Pilot, regression, packaging, and release

Tasks: - Run an end-to-end matrix: internet loss, app restart, Windows
restart, power interruption, duplicate retry, two devices creating
orders, settlement retries, server downtime, upgrade/migration, backup
restore, printer disconnect, and Android disconnect. - Test all existing
NextVisit restaurant flows and unrelated modules affected by shared
code. - Build a Windows installer and Android package only when the
required toolchain is approved and available. - Write setup, update,
backup, restore, and support instructions. Acceptance: - Evidence-backed
release checklist. - No known critical/high security issues
unresolved. - No lost or duplicated committed orders/payments in tested
scenarios. - Build artifacts actually exist and have been
smoke-tested. - Known limitations and recovery steps are documented.

## 8. Rules for every Antigravity prompt

Every prompt generated by Codex must: 1. State the exact project root
and forbid searching/editing outside it. 2. Identify the one phase and
narrow objective. 3. Begin with inspection of relevant current files and
Git state. 4. Preserve all existing uncommitted changes and scratch
PDFs. 5. Avoid broad refactors and unrelated modules. 6. Ask for a plan
before risky changes; do not perform migrations on a live database. 7.
Require focused tests plus relevant regression tests. 8. Require exact
commands and actual results, not guessed results. 9. Require a final
report listing changed files, tests run, pass/fail/blockers, risks, and
the recommended next phase. 10. Stop at the phase acceptance gate; do
not jump ahead. 11. Never claim an action or capability was completed
unless evidence supports it. 12. Never print secrets or full environment
files.

## 9. Codex's operating loop

At every new turn:

1.  Read this document and the latest Antigravity report.
2.  Identify the current phase and whether its acceptance criteria are
    met.
3.  If not met, generate a narrowly scoped corrective prompt for the
    same phase.
4.  If met, summarize the evidence and risks in concise Hinglish, then
    generate one prompt for the next phase.
5.  Do not repeat already completed work without a reason.
6.  Do not produce prompts for several phases at once.
7.  If a major architecture decision is needed, explain the options and
    ask one concise question rather than guessing.
8.  Keep a progress table in the repository documentation or in the
    Codex conversation, with statuses: `Not started`, `In progress`,
    `Blocked`, `Passed`, `Needs review`.
9.  Update phase status only when there is evidence from actual command
    output or test results.

## 10. First task for Codex

Start with **Phase 0 only**.

-   Inspect the current repository state and diffs without modifying
    files.
-   Verify what has actually been implemented in backend sync, Tauri
    shell, frontend integration, and tests.
-   Re-check the security concerns listed in Phase 1 enough to determine
    exact files and call paths, but do not change code yet.
-   Verify full test discovery and migration head without applying
    migrations.
-   Return:
    1.  concise Hinglish summary for the user,
    2.  facts confirmed vs unverified,
    3.  current phase status,
    4.  the single best copy-paste Antigravity prompt for Phase 0 or, if
        the baseline is already verified, the single prompt for Phase 1.
-   Do not start SQLite, Android, printer, or offline UI implementation
    yet.
