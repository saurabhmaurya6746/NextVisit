# Phase 8: Durable Sync Engine Architecture & Operator Contract

## 1. Overview & Objectives

NextVisit's **Durable Sync Engine** guarantees that offline POS orders, settlements, and master data remain durable, consistent, and eventually synchronized between local Windows terminals (SQLite WAL) and the cloud PostgreSQL backend without duplicate transactions or silent drops.

Key Guarantees:
1. **Persistent Outbox Queue**: All offline operations (`CREATE_ORDER`, `SETTLE_ORDER`, `DIRECT_SALE`) are atomically committed to the local `client_outbox` table in SQLite before any network dispatch is attempted.
2. **Safe Batch Push with Per-Item Acknowledgements**: Pushes transactions in batches (up to 50 items). The backend processes and acknowledges each transaction independently with distinct outcomes (`SUCCESS`, `ALREADY_COMMITTED`, `FAILED`, `CONFLICT`).
3. **Crash & Restart Resumption**: Transactions in-flight (`SENDING`) when the app terminates or crashes are automatically recovered to `PENDING` on application startup.
4. **Bounded Exponential Backoff with Jitter**: Transient failures (network drops, HTTP 5xx) schedule progressive retry backoff ($T = \min(300, 2^{\text{retry}} \times 2) + \text{jitter}$ seconds) to protect servers from thundering-herd surges upon reconnection.
5. **No Silent Drops / Operator Visibility**: Permanent failures (HTTP 400 validation error) or state conflicts (HTTP 409) are visibly displayed in the POS Topbar indicator and Dialog, allowing operators to review error reasons and trigger one-click manual retries.
6. **Clock Skew Detection**: Server UTC time returned in push/pull responses is compared against local system clock. Skew $> 5$ minutes triggers an operator warning and forces delta synchronization to rely strictly on server time cursors.
7. **Tombstone & Soft-Delete Propagation**: Inactive categories (`is_active=False`), unavailable items (`is_available=False`), and inactive tables are propagated in delta sync (`since` cursor) and updated in local SQLite cache.

---

## 2. Outbox State Machine

```
      [Local Order / Settlement Created]
                     │
                     ▼
                 ┌────────┐
                 │PENDING │ ◄──────────────────────┐
                 └────┬───┘                        │
                      │ (worker ready & online)    │
                      ▼                            │
                 ┌─────────┐                       │
                 │ SENDING │                       │
                 └────┬────┘                       │
                      │                            │
         ┌────────────┼─────────────┐              │
         │            │             │              │
         ▼ (200)      ▼ (409)       ▼ (400/422)    ▼ (5xx / Net drop)
   ┌───────────┐ ┌──────────┐  ┌────────┐     ┌───────────┐
   │ COMMITTED │ │ CONFLICT │  │ FAILED │     │   RETRY   │ (next_retry_at scheduled)
   └───────────┘ └──────────┘  └────────┘     └─────┬─────┘
         │             ▲            ▲               │
         │             └────────────┴───────────────┘
         │             (Operator Manual "Retry" action)
         ▼
[local_orders.sync_status = 'SYNCED']
```

### State Definitions
- **`PENDING`**: Ready to be sent to the backend as soon as connectivity allows and `next_retry_at` is reached.
- **`SENDING`**: In flight in an active HTTP batch push. If the application crashes during this state, `outbox_reset_in_flight` resets it back to `PENDING` on next launch.
- **`COMMITTED`**: Successfully committed on the server or confirmed as `ALREADY_COMMITTED`. Corresponding `local_orders.sync_status` transitions to `'SYNCED'`.
- **`RETRY`**: Transient failure encountered (network disconnect or HTTP 5xx). `retry_count` is incremented, and `next_retry_at` is scheduled with bounded exponential backoff and jitter.
- **`FAILED`**: Permanent client-side error (HTTP 400/422 invalid payload). Item is retained for staff/operator inspection and never silently dropped.
- **`CONFLICT`**: SHA-256 payload hash mismatch for the same `client_tx_id` (HTTP 409). Retained for operator resolution.

---

## 3. Safe Batch Push Contract

### Endpoint: `POST /api/v1/sync/push`
- **Request Envelope**:
  ```json
  {
    "device_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "transactions": [
      {
        "client_tx_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "operation_type": "CREATE_ORDER",
        "payload": { ... }
      }
    ]
  }
  ```
- **Response Envelope**:
  ```json
  {
    "device_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "processed_count": 1,
    "server_time": "2026-10-19T10:30:00.000Z",
    "results": [
      {
        "client_tx_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "status": "SUCCESS",
        "status_code": 200,
        "data": { "id": "...", "order_number": "ORD-POS01-000004", ... },
        "error": null
      }
    ]
  }
  ```

---

## 4. Backoff & Jitter Algorithm

```typescript
export function calculateBackoffWithJitter(retryCount: number): number {
  const baseSecs = 2;
  const maxSecs = 300; // 5 minutes ceiling
  const exp = Math.min(maxSecs, baseSecs * Math.pow(2, Math.max(0, retryCount)));
  const jitter = Math.random() * Math.min(exp * 0.2, 5); // 0-20% bounded jitter
  return Math.round(exp + jitter);
}
```

- Retry 0: ~2–3 seconds
- Retry 1: ~4–6 seconds
- Retry 2: ~8–12 seconds
- Retry 3: ~16–20 seconds
- Retry 4: ~32–37 seconds
- Max ceiling: 300 seconds

---

## 5. Operator Visibility Contract

The POS UI includes an adaptive Topbar status pill (`SyncStatusIndicator`):
- **Green Pill (`POS Synced`)**: Connected online, 0 pending items, 0 failures.
- **Blue Pill (`Syncing...`)**: Batch upload or delta pull actively in flight.
- **Amber Pill (`Offline (X pending)`)**: Local network disconnected; local SQLite transactions queued.
- **Red Pill (`X Sync Issues`)**: Failed or conflicted items requiring staff inspection.

Clicking the pill opens the **Operator Outbox Dialog**, providing:
- Connection status and registered terminal credentials.
- Server clock offset and critical skew alerts (> 5 minutes).
- Breakdown of Pending, Syncing, Synced, Failed, and Conflicted items.
- Queue table displaying operation type, order number, timestamp, retry count, and specific error messages.
- Single-click **"Retry"** action to reset failed/conflicted items back to `PENDING` for immediate synchronization.
- **"Sync Now"** manual flush button.
