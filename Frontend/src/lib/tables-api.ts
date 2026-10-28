import { apiFetch } from "./auth";

export interface RestaurantTable {
  id: string;
  business_id: string;
  dining_area_id: string;
  table_name: string;
  capacity: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  is_stale?: boolean;
}

export interface RestaurantTableCreatePayload {
  dining_area_id: string;
  table_name: string;
  capacity?: number;
  display_order?: number;
  is_active?: boolean;
}

export interface RestaurantTableUpdatePayload {
  dining_area_id?: string;
  table_name?: string;
  capacity?: number;
  display_order?: number;
  is_active?: boolean;
}

import { getSession } from "./auth";
import { isDesktopApp, isNetworkOrTransientError } from "./desktop";
import { getMasterDataFromDesktopCache } from "./master-data-cache";

export async function listRestaurantTablesApi(diningAreaId?: string): Promise<RestaurantTable[]> {
  try {
    const url = diningAreaId ? `/api/v1/tables?dining_area_id=${diningAreaId}` : "/api/v1/tables";
    const res = await apiFetch(url);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const err = new Error(errData.detail || `HTTP ${res.status}`);
      (err as any).status = res.status;
      throw err;
    }
    return await res.json();
  } catch (netErr) {
    if (isDesktopApp() && isNetworkOrTransientError(netErr)) {
      const session = getSession();
      const bizId = session?.clientId;
      if (bizId && session?.token) {
        try {
          const cached = await getMasterDataFromDesktopCache(bizId);
          if (cached && cached.dining_areas) {
            let tables = cached.dining_areas.flatMap((a) => a.tables || []);
            if (diningAreaId) {
              tables = tables.filter((t) => t.dining_area_id === diningAreaId);
            }
            if (tables.length > 0) {
              console.info("[DESKTOP CACHE] Serving cached restaurant tables (offline fallback, is_stale=true)");
              return tables.map((t) => ({
                id: t.id,
                business_id: t.business_id,
                dining_area_id: t.dining_area_id,
                table_name: t.table_name,
                capacity: t.capacity,
                display_order: t.display_order,
                is_active: t.is_active,
                created_at: t.created_at || "",
                updated_at: t.updated_at || "",
                is_stale: true,
              }));
            }
          }
        } catch (cacheErr) {
          console.warn("[DESKTOP CACHE] Error reading cached tables:", cacheErr);
        }
      }
    }
    throw netErr;
  }
}

export async function createRestaurantTableApi(payload: RestaurantTableCreatePayload): Promise<RestaurantTable> {
  const res = await apiFetch("/api/v1/tables", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to create table (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function updateRestaurantTableApi(
  id: string,
  payload: RestaurantTableUpdatePayload
): Promise<RestaurantTable> {
  const res = await apiFetch(`/api/v1/tables/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to update table (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function deleteRestaurantTableApi(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/tables/${id}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to delete table (HTTP ${res.status})`);
  }
}
