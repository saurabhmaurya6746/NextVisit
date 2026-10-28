/**
 * NextVisit Durable Sync Engine — Persistent Outbox Worker
 *
 * Coordinates offline transaction pushing, per-item acknowledgements,
 * bounded exponential backoff with jitter, operator visibility,
 * clock skew detection, and incremental delta pull.
 */

import { apiFetch, getSession } from "../auth";
import { isDesktopApp, isNetworkOrTransientError } from "../desktop";
import { getStoredDeviceBinding } from "../devices-api";
import { pullAndSyncMasterData } from "../master-data-cache";
import { isLanPaired, relayBatchToLanCoordinator } from "./lan-sync";
import {
  acknowledgeOutboxItem,
  getOutboxSummary,
  getPendingOutboxBatch,
  markOutboxSending,
  resetInFlightOutbox,
  retryOutboxItem,
  type OutboxItemDto,
  type OutboxSummaryDto,
} from "./sync-api";

export interface SyncEngineState {
  isSyncing: boolean;
  isOnline: boolean;
  summary: OutboxSummaryDto | null;
  lastSyncAt: string | null;
  clockSkewSeconds: number | null;
  isClockSkewCritical: boolean;
  lastError: string | null;
}

type SyncStateListener = (state: SyncEngineState) => void;

/**
 * Calculates bounded exponential backoff with random jitter.
 * Base: 2 seconds, Multiplier: 2^(retry_count), Ceiling: 300 seconds (5 mins), Jitter: 0-20% (up to 5s).
 */
export function calculateBackoffWithJitter(retryCount: number): number {
  const baseSecs = 2;
  const maxSecs = 300;
  const exp = Math.min(maxSecs, baseSecs * Math.pow(2, Math.max(0, retryCount)));
  const jitter = Math.random() * Math.min(exp * 0.2, 5);
  return Math.round(exp + jitter);
}

/**
 * Detects clock skew between local system clock and server UTC time.
 * If discrepancy exceeds 5 minutes (300 seconds), marks as critical.
 */
export function detectClockSkew(serverTimeIso: string): {
  skewSeconds: number;
  isSkewCritical: boolean;
} {
  const clientMs = Date.now();
  const serverMs = new Date(serverTimeIso).getTime();
  if (isNaN(serverMs)) {
    return { skewSeconds: 0, isSkewCritical: false };
  }
  const skewSeconds = Math.round((clientMs - serverMs) / 1000);
  return {
    skewSeconds,
    isSkewCritical: Math.abs(skewSeconds) > 300,
  };
}

class DurableSyncWorker {
  private activeBusinessId: string | null = null;
  private activeDeviceId: string | null = null;
  private isRunning: boolean = false;
  private isFlushing: boolean = false;
  private timer: any = null;
  private listeners: Set<SyncStateListener> = new Set();

  private state: SyncEngineState = {
    isSyncing: false,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    summary: null,
    lastSyncAt: null,
    clockSkewSeconds: null,
    isClockSkewCritical: false,
    lastError: null,
  };

  public getState(): SyncEngineState {
    return { ...this.state };
  }

  public subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(currentState);
      } catch (err) {
        console.error("[SYNC WORKER] Listener error:", err);
      }
    });
  }

  /**
   * Initializes or rebinds the sync worker for the given business.
   * Recovers in-flight transactions from any previous crash or restart.
   */
  public async initialize(businessId: string): Promise<void> {
    if (!isDesktopApp() || !businessId) return;

    this.activeBusinessId = businessId;
    const binding = getStoredDeviceBinding(businessId);
    this.activeDeviceId = binding.deviceId || null;

    // 1. Recover any transactions stuck in 'SENDING' from prior application exit
    try {
      const recovered = await resetInFlightOutbox(businessId);
      if (recovered > 0) {
        console.info(`[SYNC WORKER] Recovered ${recovered} in-flight outbox items to PENDING`);
      }
    } catch (e) {
      console.warn("[SYNC WORKER] Error during in-flight recovery:", e);
    }

    // 2. Fetch initial summary
    await this.refreshSummary();

    // 3. Attach online/offline event listeners
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }

    // 4. Start periodic scheduler if not already running
    this.startScheduler();

    // 5. Trigger initial flush if online and registered
    if (navigator.onLine && this.activeDeviceId) {
      this.triggerFlush();
    }
  }

  private handleOnline = () => {
    this.state.isOnline = true;
    this.notify();
    console.info("[SYNC WORKER] Network restored, triggering outbox flush");
    this.triggerFlush();
  };

  private handleOffline = () => {
    this.state.isOnline = false;
    this.notify();
    console.info("[SYNC WORKER] Network disconnected, pausing sync pushes");
  };

  public startScheduler() {
    if (this.timer) clearInterval(this.timer);
    this.isRunning = true;
    // Check outbox every 20 seconds
    this.timer = setInterval(() => {
      if (this.state.isOnline && this.activeBusinessId && this.activeDeviceId) {
        this.triggerFlush();
      }
    }, 20000);
  }

  public stopScheduler() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  public async refreshSummary(): Promise<OutboxSummaryDto | null> {
    if (!this.activeBusinessId) return null;
    const summary = await getOutboxSummary(this.activeBusinessId);
    this.state.summary = summary;
    this.notify();
    return summary;
  }

  /**
   * Forces an immediate outbox flush and master data delta sync.
   */
  public triggerFlush(): void {
    if (this.isFlushing) return;
    this.flush().catch((err) => {
      console.error("[SYNC WORKER] Flush cycle error:", err);
    });
  }

  /**
   * Manual operator retry for a failed or conflicted transaction.
   */
  public async retryItem(clientTxId: string): Promise<boolean> {
    if (!this.activeBusinessId) return false;
    const ok = await retryOutboxItem(this.activeBusinessId, clientTxId);
    if (ok) {
      await this.refreshSummary();
      this.triggerFlush();
    }
    return ok;
  }

  /**
   * Core sync execution loop:
   * 1. Pull pending batch from SQLite outbox.
   * 2. Mark batch as SENDING.
   * 3. Send batch to POST /api/v1/sync/push.
   * 4. Acknowledge each transaction outcome independently.
   * 5. Pull master data delta and check clock skew.
   */
  private async flush(): Promise<void> {
    if (!isDesktopApp() || !this.activeBusinessId || !navigator.onLine) {
      return;
    }

    const businessId = this.activeBusinessId;
    const session = getSession();
    if (!session || !session.token || session.clientId !== businessId) {
      return;
    }

    const binding = getStoredDeviceBinding(businessId);
    if (!binding.isConfigured || !binding.deviceId || binding.isMismatch) {
      return;
    }
    const deviceId = binding.deviceId;

    this.isFlushing = true;
    this.state.isSyncing = true;
    this.state.lastError = null;
    this.notify();

    try {
      // 1. Read pending batch (up to 50 items)
      const batch: OutboxItemDto[] = await getPendingOutboxBatch(businessId, 50);

      if (batch.length > 0) {
        // 2. Mark batch as SENDING
        const txIds = batch.map((b) => b.client_tx_id);
        const markedSending = await markOutboxSending(businessId, txIds);
        if (!markedSending) {
          this.state.lastError = "Could not safely claim the local sync batch; it remains queued for retry";
          return;
        }

        // 3. Prepare payload
        const transactions = batch.map((item) => {
          let parsed: any = {};
          try {
            parsed = JSON.parse(item.payload_json);
          } catch (e) {
            parsed = { raw: item.payload_json };
          }
          return {
            client_tx_id: item.client_tx_id,
            operation_type: item.operation_type,
            payload: parsed,
          };
        });

        const pushPayload = {
          device_id: deviceId,
          transactions,
        };

        // 4. Send HTTP request to backend
        let pushRes: Response | null = null;
        try {
          pushRes = await apiFetch("/api/v1/sync/push", {
            method: "POST",
            body: JSON.stringify(pushPayload),
          });
        } catch (netErr: any) {
          // Cloud network unreachable: Attempt LAN Coordinator relay if paired on local Wi-Fi / hotspot
          if (isLanPaired()) {
            try {
              console.info("[SYNC WORKER] Internet offline. Attempting relay via Windows LAN Coordinator...");
              const lanRes = await relayBatchToLanCoordinator(deviceId, batch);
              if (lanRes && Array.isArray(lanRes.results)) {
                console.info(`[SYNC WORKER] Relayed ${lanRes.results.length} transactions via Windows LAN Coordinator!`);
                const resultMap = new Map(lanRes.results.map((r) => [r.client_tx_id, r]));
                for (const item of batch) {
                  const res = resultMap.get(item.client_tx_id);
                  if (!res) {
                    const backoff = calculateBackoffWithJitter(item.retry_count);
                    await acknowledgeOutboxItem({
                      business_id: businessId,
                      client_tx_id: item.client_tx_id,
                      outcome: "RETRY",
                      error: "Missing transaction result from LAN coordinator",
                      http_status: null,
                      backoff_secs: backoff,
                    });
                  } else {
                    const outcome =
                      res.status === "SUCCESS" || res.status === "ALREADY_COMMITTED"
                        ? "COMMITTED"
                        : res.status === "CONFLICT"
                        ? "CONFLICT"
                        : "FAILED";
                    await acknowledgeOutboxItem({
                      business_id: businessId,
                      client_tx_id: item.client_tx_id,
                      outcome,
                      error: res.error,
                      http_status: res.status_code,
                      backoff_secs: null,
                    });
                  }
                }
                this.state.lastSyncAt = new Date().toISOString();
                await this.refreshSummary();
                return;
              }
            } catch (lanErr: any) {
              console.warn("[SYNC WORKER] LAN Coordinator relay attempt failed:", lanErr);
            }
          }

          // Network or connection failure: schedule bounded exponential backoff
          console.warn("[SYNC WORKER] Network failure during sync push:", netErr);
          for (const item of batch) {
            const backoff = calculateBackoffWithJitter(item.retry_count);
            await acknowledgeOutboxItem({
              business_id: businessId,
              client_tx_id: item.client_tx_id,
              outcome: "RETRY",
              error: netErr?.message || "Network connection failure",
              http_status: null,
              backoff_secs: backoff,
            });
          }
          this.state.lastError = "Network error during sync; retries scheduled";
          return;
        }


        if (pushRes && !pushRes.ok) {
          const status = pushRes.status;
          let errMsg = `HTTP ${status}`;
          try {
            const errJson = await pushRes.json();
            errMsg = errJson.detail || errMsg;
          } catch {
            // ignore
          }

          if (status === 401 || status === 403) {
            // Credentials or device authorization require operator action.
            console.error(`[SYNC WORKER] Authentication/Device failure (${status}): ${errMsg}`);
            for (const item of batch) {
              await acknowledgeOutboxItem({
                business_id: businessId,
                client_tx_id: item.client_tx_id,
                outcome: "FAILED",
                error: `Device authorization error (${status}): ${errMsg}`,
                http_status: status,
              });
            }
            this.state.lastError = `Device authorization failed (${status}): ${errMsg}`;
            return;
          }

          // Retry only transient HTTP failures. Other 4xx responses are
          // permanent request/configuration errors and need operator review.
          const isTransientHttpFailure = status === 408 || status === 429 || status >= 500;
          for (const item of batch) {
            await acknowledgeOutboxItem({
              business_id: businessId,
              client_tx_id: item.client_tx_id,
              outcome: isTransientHttpFailure ? "RETRY" : "FAILED",
              error: errMsg,
              http_status: status,
              backoff_secs: isTransientHttpFailure
                ? calculateBackoffWithJitter(item.retry_count)
                : null,
            });
          }
          this.state.lastError = isTransientHttpFailure
            ? `Temporary server error (${status}); retry scheduled: ${errMsg}`
            : `Sync request rejected (${status}); operator review required: ${errMsg}`;
          return;
        }

        // 5. Successful 200 OK: Process per-item results
        const pushData = await pushRes.json();
        const results: Array<{
          client_tx_id: string;
          status: "SUCCESS" | "ALREADY_COMMITTED" | "CONFLICT" | "FAILED";
          status_code?: number;
          error?: string | null;
          data?: Record<string, unknown> | null;
        }> = Array.isArray(pushData.results) ? pushData.results : [];

        // Check server_time from push response if provided
        if (pushData.server_time) {
          const skew = detectClockSkew(pushData.server_time);
          this.state.clockSkewSeconds = skew.skewSeconds;
          this.state.isClockSkewCritical = skew.isSkewCritical;
          if (skew.isSkewCritical) {
            console.warn(`[SYNC WORKER] Critical clock skew detected: ${skew.skewSeconds}s offset`);
          }
        }

        const resultMap = new Map(results.map((r) => [r.client_tx_id, r]));

        for (const item of batch) {
          const res = resultMap.get(item.client_tx_id);
          if (!res) {
            // Item was omitted by server somehow: schedule retry
            const backoff = calculateBackoffWithJitter(item.retry_count);
            await acknowledgeOutboxItem({
              business_id: businessId,
              client_tx_id: item.client_tx_id,
              outcome: "RETRY",
              error: "Transaction not acknowledged in server response",
              http_status: 200,
              backoff_secs: backoff,
            });
            continue;
          }

          if (res.status === "SUCCESS" || res.status === "ALREADY_COMMITTED") {
            await acknowledgeOutboxItem({
              business_id: businessId,
              client_tx_id: item.client_tx_id,
              outcome: "COMMITTED",
              http_status: res.status_code || 200,
              response_data: res.data || null,
            });
          } else if (res.status === "CONFLICT") {
            await acknowledgeOutboxItem({
              business_id: businessId,
              client_tx_id: item.client_tx_id,
              outcome: "CONFLICT",
              error: res.error || "Conflict: Transaction already committed with different payload",
              http_status: res.status_code || 409,
            });
          } else if (res.status === "FAILED") {
            const code = res.status_code || 400;
            if (code >= 500) {
              // Server-side transient failure on item: schedule retry
              const backoff = calculateBackoffWithJitter(item.retry_count);
              await acknowledgeOutboxItem({
                business_id: businessId,
                client_tx_id: item.client_tx_id,
                outcome: "RETRY",
                error: res.error || `Server failed transaction (${code})`,
                http_status: code,
                backoff_secs: backoff,
              });
            } else {
              // Client-side permanent validation failure (400, 422): mark FAILED for operator review
              await acknowledgeOutboxItem({
                business_id: businessId,
                client_tx_id: item.client_tx_id,
                outcome: "FAILED",
                error: res.error || `Validation failed (${code})`,
                http_status: code,
              });
            }
          }
        }
      }

      // 6. Master data delta synchronization and clock skew verification
      try {
        const pullRes = await pullAndSyncMasterData(deviceId, businessId);
        if (pullRes.data?.last_server_time) {
          const skew = detectClockSkew(pullRes.data.last_server_time);
          this.state.clockSkewSeconds = skew.skewSeconds;
          this.state.isClockSkewCritical = skew.isSkewCritical;
        }
      } catch (pullErr) {
        console.warn("[SYNC WORKER] Master data delta sync error:", pullErr);
      }

      this.state.lastSyncAt = new Date().toISOString();
    } catch (err: any) {
      console.error("[SYNC WORKER] Unexpected error during sync cycle:", err);
      this.state.lastError = err?.message || String(err);
    } finally {
      this.isFlushing = false;
      this.state.isSyncing = false;
      await this.refreshSummary();
      this.notify();
    }
  }
}

export const syncWorker = new DurableSyncWorker();
