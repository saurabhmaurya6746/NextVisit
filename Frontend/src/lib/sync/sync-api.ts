/**
 * NextVisit Desktop Outbox & Sync Bridge
 *
 * Provides typed, browser-safe wrappers around Tauri IPC outbox commands.
 * In a standard browser environment, all operations safely return no-op defaults.
 */

import { invoke } from "@tauri-apps/api/core";
import { isDesktopApp } from "../desktop";

export interface OutboxItemDto {
  client_tx_id: string;
  business_id: string;
  device_id: string;
  operation_type: string;
  payload_json: string;
  status: "PENDING" | "SENDING" | "COMMITTED" | "FAILED" | "CONFLICT";
  retry_count: number;
  last_error: string | null;
  next_retry_at: string | null;
  updated_at: string | null;
  last_http_status: number | null;
  created_at: string;
}

export interface OutboxSummaryDto {
  business_id: string;
  total_count: number;
  pending_count: number;
  sending_count: number;
  committed_count: number;
  failed_count: number;
  conflict_count: number;
  oldest_pending_at: string | null;
}

export interface AcknowledgeItemPayload {
  business_id: string;
  client_tx_id: string;
  outcome: "COMMITTED" | "CONFLICT" | "FAILED" | "RETRY";
  error?: string | null;
  http_status?: number | null;
  backoff_secs?: number | null;
  response_data?: Record<string, unknown> | null;
}

/**
 * Recovers from app crashes or unexpected shutdowns by resetting any in-flight
 * 'SENDING' transactions back to 'PENDING'.
 */
export async function resetInFlightOutbox(businessId: string): Promise<number> {
  if (!isDesktopApp() || !businessId) return 0;
  try {
    return await invoke<number>("outbox_reset_in_flight", { businessId });
  } catch (err) {
    console.warn("[OUTBOX] Failed to reset in-flight transactions:", err);
    return 0;
  }
}

/**
 * Retrieves a batch of pending outbox items ready for push sync.
 */
export async function getPendingOutboxBatch(
  businessId: string,
  limit: number = 50
): Promise<OutboxItemDto[]> {
  if (!isDesktopApp() || !businessId) return [];
  try {
    return await invoke<OutboxItemDto[]>("outbox_get_pending_batch", {
      businessId,
      limit,
    });
  } catch (err) {
    console.warn("[OUTBOX] Failed to get pending outbox batch:", err);
    return [];
  }
}

/**
 * Atomically marks transactions as 'SENDING' while the network request is in flight.
 */
export async function markOutboxSending(
  businessId: string,
  txIds: string[]
): Promise<boolean> {
  if (!isDesktopApp() || !businessId || txIds.length === 0) return true;
  try {
    await invoke("outbox_mark_sending", { businessId, txIds });
    return true;
  } catch (err) {
    console.warn("[OUTBOX] Failed to mark transactions SENDING:", err);
    return false;
  }
}

/**
 * Acknowledges individual transaction outcome (COMMITTED, CONFLICT, FAILED, RETRY).
 */
export async function acknowledgeOutboxItem(
  payload: AcknowledgeItemPayload
): Promise<boolean> {
  if (!isDesktopApp() || !payload.business_id) return true;
  try {
    await invoke("outbox_acknowledge_item", { input: payload });
    return true;
  } catch (err) {
    console.warn(`[OUTBOX] Failed to acknowledge item ${payload.client_tx_id}:`, err);
    return false;
  }
}

/**
 * Operator action: manual force retry for a failed or conflicted transaction.
 */
export async function retryOutboxItem(
  businessId: string,
  clientTxId: string
): Promise<boolean> {
  if (!isDesktopApp() || !businessId) return false;
  try {
    await invoke("outbox_retry_item", { businessId, clientTxId });
    return true;
  } catch (err) {
    console.warn(`[OUTBOX] Failed to retry item ${clientTxId}:`, err);
    return false;
  }
}

/**
 * Gets aggregate statistics of the local outbox.
 */
export async function getOutboxSummary(
  businessId: string
): Promise<OutboxSummaryDto | null> {
  if (!isDesktopApp() || !businessId) return null;
  try {
    return await invoke<OutboxSummaryDto>("outbox_get_summary", { businessId });
  } catch (err) {
    console.warn("[OUTBOX] Failed to read outbox summary:", err);
    return null;
  }
}

/**
 * Lists outbox items for operator review with optional status filtering.
 */
export async function listOutboxItems(
  businessId: string,
  statusFilter?: string,
  limit: number = 100
): Promise<OutboxItemDto[]> {
  if (!isDesktopApp() || !businessId) return [];
  try {
    return await invoke<OutboxItemDto[]>("outbox_list_items", {
      businessId,
      statusFilter: statusFilter || null,
      limit,
    });
  } catch (err) {
    console.warn("[OUTBOX] Failed to list outbox items:", err);
    return [];
  }
}
