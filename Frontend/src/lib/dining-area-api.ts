import { apiFetch } from "./auth";

export interface DiningArea {
  id: string;
  business_id: string;
  name: string;
  display_order: number;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  is_stale?: boolean;
}

export interface DiningAreaCreatePayload {
  name: string;
  display_order?: number;
  color?: string | null;
  is_active?: boolean;
}

import { getSession } from "./auth";
import { isDesktopApp, isNetworkOrTransientError } from "./desktop";
import { getMasterDataFromDesktopCache } from "./master-data-cache";

export async function listDiningAreasApi(): Promise<DiningArea[]> {
  try {
    const res = await apiFetch("/api/v1/dining-areas");
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
          if (cached && cached.dining_areas && cached.dining_areas.length > 0) {
            console.info("[DESKTOP CACHE] Serving cached dining areas (offline fallback, is_stale=true)");
            return cached.dining_areas.map((a) => ({
              id: a.id,
              business_id: a.business_id,
              name: a.name,
              display_order: a.display_order,
              color: a.color || null,
              is_active: a.is_active,
              created_at: a.created_at || "",
              updated_at: a.updated_at || "",
              is_stale: true,
            }));
          }
        } catch (cacheErr) {
          console.warn("[DESKTOP CACHE] Error reading cached dining areas:", cacheErr);
        }
      }
    }
    throw netErr;
  }
}

export async function createDiningAreaApi(payload: DiningAreaCreatePayload): Promise<DiningArea> {
  const res = await apiFetch("/api/v1/dining-areas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to create dining area (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function updateDiningAreaApi(
  id: string,
  payload: Partial<DiningAreaCreatePayload>
): Promise<DiningArea> {
  const res = await apiFetch(`/api/v1/dining-areas/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to update dining area (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function deleteDiningAreaApi(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/dining-areas/${id}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to delete dining area (HTTP ${res.status})`);
  }
}

export interface DiningAreaReorderItemPayload {
  id: string;
  display_order: number;
}

export async function reorderDiningAreasApi(items: DiningAreaReorderItemPayload[]): Promise<DiningArea[]> {
  const res = await apiFetch("/api/v1/dining-areas/reorder", {
    method: "POST",
    body: JSON.stringify(items),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to reorder dining areas (HTTP ${res.status})`);
  }
  return await res.json();
}

