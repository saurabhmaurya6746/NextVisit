/**
 * NextVisit Desktop Master Data Cache Client
 *
 * Provides browser-safe desktop SQLite caching for restaurant master data:
 * - Menu categories & items
 * - Dining areas & tables
 * - Business settings snapshot
 *
 * If running in a web browser, operations safely no-op or pass-through
 * without invoking native Tauri APIs.
 */

import { isDesktopApp, isNetworkOrTransientError } from "./desktop";
import { invoke } from "@tauri-apps/api/core";
import { apiFetch, getSession } from "./auth";
import { getStoredDeviceBinding } from "./devices-api";

export interface CachedMenuItem {
  id: string;
  business_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  gst_percentage: number;
  is_veg: boolean;
  is_available: boolean;
  display_order: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CachedMenuCategory {
  id: string;
  business_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  items: CachedMenuItem[];
}

export interface CachedDiningTable {
  id: string;
  business_id: string;
  dining_area_id: string;
  table_name: string;
  capacity: number;
  display_order: number;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CachedDiningArea {
  id: string;
  business_id: string;
  name: string;
  display_order: number;
  color?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  tables: CachedDiningTable[];
}

export interface MasterDataSnapshot {
  business_id: string;
  device_id: string;
  server_time: string;
  menu_categories: CachedMenuCategory[];
  dining_areas: CachedDiningArea[];
  business_settings: Record<string, unknown> | null;
  device_order_sequence?: number | null;
}

export interface MasterDataCacheResult {
  business_id: string;
  cached_at: string;
  last_server_time: string;
  is_stale: boolean;
  menu_categories: CachedMenuCategory[];
  dining_areas: CachedDiningArea[];
  business_settings: Record<string, unknown> | null;
}

export interface CacheStatus {
  business_id: string;
  device_id: string | null;
  last_sync_time: string | null;
  last_server_time: string | null;
  category_count: number;
  item_count: number;
  area_count: number;
  table_count: number;
  has_settings: boolean;
  has_cache: boolean;
}

/**
 * Saves a master data snapshot into local SQLite on desktop.
 * Browser runtime returns false cleanly without calling Tauri IPC.
 */
export async function saveMasterDataToDesktopCache(
  snapshot: MasterDataSnapshot,
  isFullSnapshot: boolean = true
): Promise<boolean> {
  if (!isDesktopApp()) {
    return false;
  }

  try {
    await invoke("cache_save_master_data", {
      snapshot,
      isFullSnapshot,
    });
    return true;
  } catch (err) {
    console.warn("Failed to persist master data to local SQLite cache:", err);
    return false;
  }
}

/**
 * Reads the cached master data from local SQLite on desktop.
 * Browser runtime returns null cleanly without calling Tauri IPC.
 */
export async function getMasterDataFromDesktopCache(
  businessId: string
): Promise<MasterDataCacheResult | null> {
  if (!isDesktopApp() || !businessId) {
    return null;
  }

  try {
    const result = await invoke<MasterDataCacheResult | null>("cache_get_master_data", {
      businessId,
    });
    return result;
  } catch (err) {
    console.warn("Failed to read master data from local SQLite cache:", err);
    return null;
  }
}

/**
 * Gets cache status and metadata from local SQLite on desktop.
 * Browser runtime returns null cleanly without calling Tauri IPC.
 */
export async function getDesktopCacheStatus(
  businessId: string
): Promise<CacheStatus | null> {
  if (!isDesktopApp() || !businessId) {
    return null;
  }

  try {
    const status = await invoke<CacheStatus>("cache_get_status", {
      businessId,
    });
    return status;
  } catch (err) {
    console.warn("Failed to read cache status from local SQLite:", err);
    return null;
  }
}

export interface PullAndSyncResult {
  source: "network" | "cache";
  persistedToDesktop: boolean;
  data: MasterDataCacheResult | null;
  error?: string;
}

/**
 * Validates the raw response structure received from /api/v1/sync/pull.
 * Throws an explicit Error if required fields or structures are missing/malformed.
 */
export function validateSyncPullResponse(
  raw: unknown,
  expectedBusinessId: string
): MasterDataSnapshot {
  if (!raw || typeof raw !== "object") {
    throw new Error("Malformed pull response: response is not an object");
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.business_id !== "string" || !obj.business_id.trim()) {
    throw new Error("Malformed pull response: missing or invalid business_id");
  }

  if (obj.business_id !== expectedBusinessId) {
    throw new Error(
      `Tenant mismatch: response business_id '${obj.business_id}' does not match active business '${expectedBusinessId}'`
    );
  }

  if (typeof obj.server_time !== "string" || !obj.server_time.trim()) {
    throw new Error("Malformed pull response: missing or invalid server_time");
  }

  if (!Array.isArray(obj.menu_categories)) {
    throw new Error("Malformed pull response: menu_categories must be an array");
  }

  if (!Array.isArray(obj.dining_areas)) {
    throw new Error("Malformed pull response: dining_areas must be an array");
  }

  const bizId = obj.business_id;

  // Validate menu categories and nested items
  const validatedCategories: CachedMenuCategory[] = obj.menu_categories.map((c, catIdx) => {
    if (!c || typeof c !== "object") {
      throw new Error(`Malformed category at index ${catIdx}`);
    }
    const cat = c as Record<string, unknown>;
    if (typeof cat.id !== "string" || !cat.id) {
      throw new Error(`Category at index ${catIdx} missing id`);
    }
    if (typeof cat.business_id !== "string" || cat.business_id !== bizId) {
      throw new Error(`Tenant violation in category ${cat.id}`);
    }
    if (typeof cat.name !== "string") {
      throw new Error(`Category ${cat.id} missing name`);
    }

    const itemsRaw = Array.isArray(cat.items) ? cat.items : [];
    const validatedItems: CachedMenuItem[] = itemsRaw.map((it, itemIdx) => {
      if (!it || typeof it !== "object") {
        throw new Error(`Malformed item at index ${itemIdx} in category ${cat.id}`);
      }
      const item = it as Record<string, unknown>;
      if (typeof item.id !== "string" || !item.id) {
        throw new Error(`Item at index ${itemIdx} in category ${cat.id} missing id`);
      }
      if (typeof item.business_id !== "string" || item.business_id !== bizId) {
        throw new Error(`Tenant violation in item ${item.id}`);
      }
      if (item.category_id !== cat.id) {
        throw new Error(
          `Relationship violation: Item ${item.id} has category_id ${item.category_id} but is in category ${cat.id}`
        );
      }
      return {
        id: item.id,
        business_id: item.business_id,
        category_id: cat.id,
        name: typeof item.name === "string" ? item.name : "",
        description: typeof item.description === "string" ? item.description : null,
        price: typeof item.price === "number" ? item.price : 0,
        gst_percentage: typeof item.gst_percentage === "number" ? item.gst_percentage : 0,
        is_veg: Boolean(item.is_veg),
        is_available: item.is_available !== false,
        display_order: typeof item.display_order === "number" ? item.display_order : 0,
        created_at: typeof item.created_at === "string" ? item.created_at : null,
        updated_at: typeof item.updated_at === "string" ? item.updated_at : null,
      };
    });

    return {
      id: cat.id,
      business_id: cat.business_id,
      name: cat.name,
      display_order: typeof cat.display_order === "number" ? cat.display_order : 0,
      is_active: cat.is_active !== false,
      created_at: typeof cat.created_at === "string" ? cat.created_at : null,
      updated_at: typeof cat.updated_at === "string" ? cat.updated_at : null,
      items: validatedItems,
    };
  });

  // Validate dining areas and nested tables
  const validatedAreas: CachedDiningArea[] = obj.dining_areas.map((a, areaIdx) => {
    if (!a || typeof a !== "object") {
      throw new Error(`Malformed dining area at index ${areaIdx}`);
    }
    const area = a as Record<string, unknown>;
    if (typeof area.id !== "string" || !area.id) {
      throw new Error(`Dining area at index ${areaIdx} missing id`);
    }
    if (typeof area.business_id !== "string" || area.business_id !== bizId) {
      throw new Error(`Tenant violation in dining area ${area.id}`);
    }
    if (typeof area.name !== "string") {
      throw new Error(`Dining area ${area.id} missing name`);
    }

    const tablesRaw = Array.isArray(area.tables) ? area.tables : [];
    const validatedTables: CachedDiningTable[] = tablesRaw.map((t, tableIdx) => {
      if (!t || typeof t !== "object") {
        throw new Error(`Malformed table at index ${tableIdx} in area ${area.id}`);
      }
      const table = t as Record<string, unknown>;
      if (typeof table.id !== "string" || !table.id) {
        throw new Error(`Table at index ${tableIdx} in area ${area.id} missing id`);
      }
      if (typeof table.business_id !== "string" || table.business_id !== bizId) {
        throw new Error(`Tenant violation in table ${table.id}`);
      }
      if (table.dining_area_id !== area.id) {
        throw new Error(
          `Relationship violation: Table ${table.id} has dining_area_id ${table.dining_area_id} but is in area ${area.id}`
        );
      }
      return {
        id: table.id,
        business_id: table.business_id,
        dining_area_id: area.id,
        table_name: typeof table.table_name === "string" ? table.table_name : "",
        capacity: typeof table.capacity === "number" ? table.capacity : 4,
        display_order: typeof table.display_order === "number" ? table.display_order : 0,
        is_active: table.is_active !== false,
        created_at: typeof table.created_at === "string" ? table.created_at : null,
        updated_at: typeof table.updated_at === "string" ? table.updated_at : null,
      };
    });

    return {
      id: area.id,
      business_id: area.business_id,
      name: area.name,
      display_order: typeof area.display_order === "number" ? area.display_order : 0,
      color: typeof area.color === "string" ? area.color : null,
      is_active: area.is_active !== false,
      created_at: typeof area.created_at === "string" ? area.created_at : null,
      updated_at: typeof area.updated_at === "string" ? area.updated_at : null,
      tables: validatedTables,
    };
  });

  const businessSettings =
    obj.business_settings && typeof obj.business_settings === "object"
      ? (obj.business_settings as Record<string, unknown>)
      : null;

  return {
    business_id: bizId,
    device_id: "", // caller attaches
    server_time: obj.server_time,
    menu_categories: validatedCategories,
    dining_areas: validatedAreas,
    business_settings: businessSettings,
    device_order_sequence: typeof obj.device_order_sequence === "number" ? obj.device_order_sequence : null,
  };
}

/**
 * Pulls master data from the backend sync pull endpoint with the current authenticated session.
 * If running on desktop, validates and writes to SQLite atomically upon successful fetch.
 * Returns persistedToDesktop = true ONLY if local SQLite persistence succeeded.
 * If network fails or offline, falls back safely to the local SQLite cache.
 */
export async function pullAndSyncMasterData(
  deviceId: string,
  businessId: string,
  options?: { forceFullSnapshot?: boolean }
): Promise<PullAndSyncResult> {
  const isDesktop = isDesktopApp();
  const session = getSession();

  // Validate session tenant matches requested businessId
  if (session && session.clientId && session.clientId !== businessId) {
    return {
      source: "cache",
      persistedToDesktop: false,
      data: null,
      error: `Tenant violation: Active session business ${session.clientId} does not match requested sync business ${businessId}`,
    };
  }

  // 1. Attempt network pull if online
  if (navigator.onLine && deviceId && businessId) {
    try {
      // Use the last successfully persisted server cursor for incremental pulls.
      // With no compatible local cursor (or an explicit full refresh), fetch a
      // full snapshot so the cache can be safely initialized/repaired.
      const cacheStatus = isDesktop && !options?.forceFullSnapshot
        ? await getDesktopCacheStatus(businessId)
        : null;
      const since =
        cacheStatus?.has_cache && cacheStatus.device_id === deviceId
          ? cacheStatus.last_server_time
          : null;
      const query = new URLSearchParams({ device_id: deviceId });
      if (since) query.set("since", since);
      const url = `/api/v1/sync/pull?${query.toString()}`;
      const res = await apiFetch(url);

      if (!res.ok) {
        // Strictly block cache fallback on authentication or authorization failure
        if (res.status === 401 || res.status === 403 || res.status === 400 || res.status === 404 || res.status === 422) {
          const errData = await res.json().catch(() => ({}));
          const detail = errData.detail || `Server returned HTTP ${res.status}`;
          return {
            source: "cache",
            persistedToDesktop: false,
            data: null,
            error: `Authorization failure (HTTP ${res.status}): ${detail}. Master data cache fallback is disallowed.`,
          };
        }
        const err = new Error(`HTTP ${res.status}`);
        (err as any).status = res.status;
        throw err;
      }

      const pullResp = await res.json();

      // Strictly validate response shape and tenant identity
      const validatedSnapshot = validateSyncPullResponse(pullResp, businessId);
      validatedSnapshot.device_id = deviceId;

      let persisted = false;
      let persistenceError: string | undefined;

      if (isDesktop) {
        persisted = await saveMasterDataToDesktopCache(validatedSnapshot, !since);
        if (!persisted) {
          persistenceError = "Local SQLite persistence failed; network response received without cache durability";
        }
      }

      return {
        source: "network",
        persistedToDesktop: persisted,
        error: persistenceError,
        data: {
          business_id: validatedSnapshot.business_id,
          cached_at: new Date().toISOString(),
          last_server_time: validatedSnapshot.server_time,
          is_stale: false,
          menu_categories: validatedSnapshot.menu_categories,
          dining_areas: validatedSnapshot.dining_areas,
          business_settings: validatedSnapshot.business_settings,
        },
      };
    } catch (err: unknown) {
      if (!isNetworkOrTransientError(err)) {
        // Validation, parsing, or non-transient error: do not silently fall back to cache
        return {
          source: "cache",
          persistedToDesktop: false,
          data: null,
          error: `Master data pull failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
      console.warn("Master data network pull failed due to network/transient error; checking desktop cache:", err);
    }
  }

  // 2. Fallback to desktop SQLite cache ONLY for network/offline or approved transient failures
  if (isDesktop && businessId && session?.token && session?.clientId === businessId) {
    try {
      const cached = await getMasterDataFromDesktopCache(businessId);
      if (cached) {
        return {
          source: "cache",
          persistedToDesktop: true,
          data: {
            ...cached,
            is_stale: true,
          },
        };
      }
    } catch (cacheErr: unknown) {
      console.warn("Desktop cache read error during fallback:", cacheErr);
    }
  }

  return {
    source: "cache",
    persistedToDesktop: false,
    data: null,
    error: "Master data unavailable (network unavailable and no valid local cache)",
  };
}

/**
 * Convenience helper to refresh master data cache on desktop:
 * - Uses active authenticated session's clientId if businessId not explicitly provided.
 * - Uses stored device ID (e.g. from localStorage 'nextvisit:pos_device_id') if deviceId not explicitly provided.
 * - Calls pullAndSyncMasterData if deviceId is available.
 * - If no device ID registered, refuses to invent one and reports prerequisite explicitly.
 */
export async function refreshMasterDataCache(
  explicitBusinessId?: string,
  explicitDeviceId?: string
): Promise<PullAndSyncResult> {
  const session = getSession();
  const businessId = explicitBusinessId || session?.clientId || "";

  if (!businessId || !session?.token) {
    return {
      source: "cache",
      persistedToDesktop: false,
      data: null,
      error: "No active authenticated business session",
    };
  }

  const binding = getStoredDeviceBinding(businessId);

  if (binding.isMismatch && !explicitDeviceId) {
    return {
      source: "cache",
      persistedToDesktop: false,
      data: null,
      error: `Device binding mismatch: this terminal was registered for business ${binding.boundBusinessId}. Registration required for business ${businessId}.`,
    };
  }

  const deviceId = explicitDeviceId || binding.deviceId || "";

  if (deviceId) {
    return await pullAndSyncMasterData(deviceId, businessId);
  }

  // If running offline on desktop and local cache exists, return stale cache
  if (!navigator.onLine && isDesktopApp()) {
    const cached = await getMasterDataFromDesktopCache(businessId);
    if (cached) {
      return {
        source: "cache",
        persistedToDesktop: true,
        data: {
          ...cached,
          is_stale: true,
        },
      };
    }
  }

  return {
    source: "cache",
    persistedToDesktop: false,
    data: null,
    error: "No registered POS device ID configured. Device registration is required before running online master data sync.",
  };
}

