/**
 * NextVisit Phase 11: LAN Coordination Client Bridge
 *
 * Enables Android POS handhelds and secondary terminals to discover, pair,
 * and relay transactions to the Windows Desktop LAN Coordinator during internet outages.
 */

import { apiFetch } from "../auth";
import { type OutboxItemDto } from "./sync-api";

export interface LanCoordinatorStatus {
  coordinator_name: string;
  business_id: string;
  server_time: string;
  is_pairing_open: boolean;
  active_paired_devices_count: number;
  version: string;
}

export interface LanPairingSessionInfo {
  pairing_code: string;
  expires_at: string;
  expires_in_seconds: number;
  business_id: string;
}

export interface LanPairingClaimResult {
  lan_token: string;
  token_expires_at: string;
  device_id: string;
  business_id: string;
  device_prefix: string;
  server_time: string;
}

export interface LanRelayResult {
  client_tx_id: string;
  status: "SUCCESS" | "ALREADY_COMMITTED" | "CONFLICT" | "FAILED";
  status_code: number;
  data?: any;
  error?: string | null;
}

const STORAGE_KEYS = {
  COORDINATOR_URL: "nextvisit:lan_coordinator_url",
  LAN_TOKEN: "nextvisit:lan_token",
  TOKEN_EXPIRES_AT: "nextvisit:lan_token_expires_at",
  BOUND_DEVICE_ID: "nextvisit:lan_bound_device_id",
  BOUND_BUSINESS_ID: "nextvisit:lan_bound_business_id",
};

export function getLanCoordinatorUrl(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.COORDINATOR_URL) || null;
}

export function setLanCoordinatorUrl(url: string | null): void {
  if (typeof window === "undefined") return;
  if (!url) {
    localStorage.removeItem(STORAGE_KEYS.COORDINATOR_URL);
  } else {
    // Clean trailing slashes
    localStorage.setItem(STORAGE_KEYS.COORDINATOR_URL, url.trim().replace(/\/+$/, ""));
  }
}

export function getStoredLanToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(STORAGE_KEYS.LAN_TOKEN);
  const expires = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
  if (!token) return null;
  if (expires && new Date(expires).getTime() <= Date.now()) {
    // Expired
    clearLanPairing();
    return null;
  }
  return token;
}

export function storeLanPairing(claim: LanPairingClaimResult): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.LAN_TOKEN, claim.lan_token);
  localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, claim.token_expires_at);
  localStorage.setItem(STORAGE_KEYS.BOUND_DEVICE_ID, claim.device_id);
  localStorage.setItem(STORAGE_KEYS.BOUND_BUSINESS_ID, claim.business_id);
}

export function clearLanPairing(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEYS.LAN_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
  localStorage.removeItem(STORAGE_KEYS.BOUND_DEVICE_ID);
  localStorage.removeItem(STORAGE_KEYS.BOUND_BUSINESS_ID);
}

export function isLanPaired(): boolean {
  return !!getStoredLanToken();
}

/**
 * Pings the LAN Coordinator to verify connectivity and node health.
 */
export async function pingLanCoordinator(
  coordinatorUrl?: string,
  businessId?: string
): Promise<LanCoordinatorStatus | null> {
  const base = coordinatorUrl || getLanCoordinatorUrl();
  if (!base) return null;

  try {
    const url = new URL(`${base}/api/v1/lan/status`);
    if (businessId) url.searchParams.set("business_id", businessId);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(3000), // 3-second quick probe
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

/**
 * Initiates a new short-lived pairing session on the Windows coordinator.
 * Must be executed by an authorized business user (Owner/Admin) on the coordinator host.
 */
export async function initiateLanPairing(): Promise<LanPairingSessionInfo> {
  const res = await apiFetch("/api/v1/lan/pairing/initiate", {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to initiate LAN pairing session.");
  }
  return await res.json();
}

/**
 * Claims a pairing session from an Android handheld device on the LAN.
 */
export async function claimLanPairing(
  coordinatorUrl: string,
  params: {
    pairingCode: string;
    businessId: string;
    deviceId: string;
    deviceName: string;
    deviceType: string;
    devicePrefix: string;
  }
): Promise<LanPairingClaimResult> {
  const cleanUrl = coordinatorUrl.trim().replace(/\/+$/, "");
  const res = await fetch(`${cleanUrl}/api/v1/lan/pairing/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pairing_code: params.pairingCode.trim(),
      business_id: params.businessId,
      device_id: params.deviceId,
      device_name: params.deviceName,
      device_type: params.deviceType,
      device_prefix: params.devicePrefix.toUpperCase(),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Pairing claim failed (${res.status})`);
  }

  const claimResult: LanPairingClaimResult = await res.json();
  setLanCoordinatorUrl(cleanUrl);
  storeLanPairing(claimResult);
  return claimResult;
}

/**
 * Relays an outbox batch of offline transactions to the Windows LAN Coordinator.
 */
export async function relayBatchToLanCoordinator(
  deviceId: string,
  batch: OutboxItemDto[]
): Promise<{ processed_count: number; server_time: string; results: LanRelayResult[] } | null> {
  const coordinatorUrl = getLanCoordinatorUrl();
  const lanToken = getStoredLanToken();
  if (!coordinatorUrl || !lanToken || batch.length === 0) {
    return null;
  }

  const transactions = batch.map((item) => {
    let parsed: any = {};
    try {
      parsed = JSON.parse(item.payload_json);
    } catch {
      parsed = { raw: item.payload_json };
    }
    return {
      client_tx_id: item.client_tx_id,
      operation_type: item.operation_type,
      payload: parsed,
    };
  });

  const res = await fetch(`${coordinatorUrl}/api/v1/lan/relay/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-LAN-Token": lanToken,
    },
    body: JSON.stringify({
      device_id: deviceId,
      transactions,
    }),
    signal: AbortSignal.timeout(10000), // 10s timeout
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `LAN relay failed with status ${res.status}`);
  }

  return await res.json();
}

/**
 * Pulls active orders and dining table occupancy from the LAN Coordinator.
 */
export async function pullFromLanCoordinator(): Promise<{
  orders: any[];
  table_statuses: any[];
  server_time: string;
} | null> {
  const coordinatorUrl = getLanCoordinatorUrl();
  const lanToken = getStoredLanToken();
  if (!coordinatorUrl || !lanToken) return null;

  const res = await fetch(`${coordinatorUrl}/api/v1/lan/relay/pull`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-LAN-Token": lanToken,
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return null;
  return await res.json();
}
