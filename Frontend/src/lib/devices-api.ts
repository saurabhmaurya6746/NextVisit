/**
 * NextVisit POS Client Device Management API
 *
 * Provides client-side helpers to register, list, and verify POS terminals
 * using the authenticated backend /api/v1/devices contract.
 *
 * Guarantees strict business-scoped tenant binding and prevents storing
 * or transmitting bearer tokens as device credentials.
 */

import { apiFetch } from "./auth";

export interface ClientDeviceResponse {
  id: string;
  business_id: string;
  device_name: string;
  device_type: string;
  device_prefix: string;
  device_identifier: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientDeviceCreatePayload {
  device_name: string;
  device_type?: string;
  device_prefix: string;
  device_identifier?: string | null;
}

export interface StoredDeviceBinding {
  deviceId: string | null;
  boundBusinessId: string | null;
  deviceName: string | null;
  deviceType: string | null;
  devicePrefix: string | null;
  isMismatch: boolean;
  isConfigured: boolean;
}

const KEY_DEVICE_ID = "nextvisit:pos_device_id";
const KEY_DEVICE_BUSINESS_ID = "nextvisit:pos_device_business_id";
const KEY_DEVICE_NAME = "nextvisit:pos_device_name";
const KEY_DEVICE_TYPE = "nextvisit:pos_device_type";
const KEY_DEVICE_PREFIX = "nextvisit:pos_device_prefix";

/**
 * Registers a new POS client device with the authenticated backend (POST /api/v1/devices).
 * Requires Owner or Administrator role.
 */
export async function registerDeviceApi(
  payload: ClientDeviceCreatePayload
): Promise<ClientDeviceResponse> {
  const cleanPrefix = payload.device_prefix.trim().toUpperCase();

  // Client-side prefix validation mirroring backend regex
  if (!/^[A-Z0-9]{1,10}$/.test(cleanPrefix)) {
    throw new Error(
      "Device prefix must be 1-10 alphanumeric uppercase characters (e.g., 'POS01', 'D1', 'REG1')."
    );
  }

  const res = await apiFetch("/api/v1/devices", {
    method: "POST",
    body: JSON.stringify({
      device_name: payload.device_name.trim(),
      device_type: payload.device_type?.trim() || "DESKTOP_WINDOWS",
      device_prefix: cleanPrefix,
      device_identifier: payload.device_identifier || null,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(
      errData.detail || `Failed to register device (HTTP ${res.status})`
    );
    (err as any).status = res.status;
    throw err;
  }

  return await res.json();
}

/**
 * Lists all registered POS devices for the current authenticated business (GET /api/v1/devices).
 */
export async function listDevicesApi(): Promise<ClientDeviceResponse[]> {
  const res = await apiFetch("/api/v1/devices");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(
      errData.detail || `Failed to fetch registered devices (HTTP ${res.status})`
    );
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * Fetches single device details to verify active status (GET /api/v1/devices/{device_id}).
 */
export async function getDeviceApi(deviceId: string): Promise<ClientDeviceResponse> {
  const res = await apiFetch(`/api/v1/devices/${encodeURIComponent(deviceId)}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(
      errData.detail || `Failed to fetch device status (HTTP ${res.status})`
    );
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * Reads the stored device binding from localStorage and verifies it matches
 * the current active business ID.
 *
 * If the device was registered to a DIFFERENT business, flags an explicit mismatch
 * and returns deviceId: null to prevent cross-tenant device usage.
 */
export function getStoredDeviceBinding(
  currentBusinessId?: string | null
): StoredDeviceBinding {
  if (typeof window === "undefined") {
    return {
      deviceId: null,
      boundBusinessId: null,
      deviceName: null,
      deviceType: null,
      devicePrefix: null,
      isMismatch: false,
      isConfigured: false,
    };
  }

  const deviceId = localStorage.getItem(KEY_DEVICE_ID);
  const boundBusinessId = localStorage.getItem(KEY_DEVICE_BUSINESS_ID);
  const deviceName = localStorage.getItem(KEY_DEVICE_NAME);
  const deviceType = localStorage.getItem(KEY_DEVICE_TYPE);
  const devicePrefix = localStorage.getItem(KEY_DEVICE_PREFIX);

  if (!deviceId) {
    return {
      deviceId: null,
      boundBusinessId: null,
      deviceName: null,
      deviceType: null,
      devicePrefix: null,
      isMismatch: false,
      isConfigured: false,
    };
  }

  // Detect cross-tenant device reuse
  if (boundBusinessId && currentBusinessId && boundBusinessId !== currentBusinessId) {
    return {
      deviceId: null, // strictly disallow using another tenant's device ID
      boundBusinessId,
      deviceName,
      deviceType,
      devicePrefix,
      isMismatch: true,
      isConfigured: false,
    };
  }

  return {
    deviceId,
    boundBusinessId: boundBusinessId || currentBusinessId || null,
    deviceName,
    deviceType,
    devicePrefix,
    isMismatch: false,
    isConfigured: true,
  };
}

/**
 * Persists the registered device credentials (UUID, prefix, business identity)
 * into localStorage. NEVER stores bearer tokens or sensitive credentials.
 */
export function saveStoredDeviceBinding(device: ClientDeviceResponse): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_DEVICE_ID, device.id);
  localStorage.setItem(KEY_DEVICE_BUSINESS_ID, device.business_id);
  localStorage.setItem(KEY_DEVICE_NAME, device.device_name);
  localStorage.setItem(KEY_DEVICE_TYPE, device.device_type || "DESKTOP_WINDOWS");
  localStorage.setItem(KEY_DEVICE_PREFIX, device.device_prefix);
}

/**
 * Clears the stored device binding (e.g. on business switch or explicit reset).
 */
export function clearStoredDeviceBinding(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_DEVICE_ID);
  localStorage.removeItem(KEY_DEVICE_BUSINESS_ID);
  localStorage.removeItem(KEY_DEVICE_NAME);
  localStorage.removeItem(KEY_DEVICE_TYPE);
  localStorage.removeItem(KEY_DEVICE_PREFIX);
}
