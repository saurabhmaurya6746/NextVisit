import { apiFetch } from "./auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackendMenuCategory {
  id: string;
  business_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  items: BackendMenuItem[];
  created_at: string;
  updated_at: string;
  is_stale?: boolean;
}

export interface BackendMenuItem {
  id: string;
  category_id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number;
  gst_percentage: number;
  is_veg: boolean;
  is_available: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  is_stale?: boolean;
}

export interface MenuCategoryCreate {
  name: string;
  display_order?: number;
  is_active?: boolean;
}

export interface MenuCategoryUpdate {
  name?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface MenuItemCreate {
  category_id: string;
  name: string;
  description?: string;
  price: number;
  gst_percentage?: number;
  is_veg?: boolean;
  is_available?: boolean;
  display_order?: number;
}

export interface MenuItemUpdate {
  category_id?: string;
  name?: string;
  description?: string;
  price?: number;
  gst_percentage?: number;
  is_veg?: boolean;
  is_available?: boolean;
  display_order?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(
      typeof errData.detail === "string"
        ? errData.detail
        : Array.isArray(errData.detail)
        ? errData.detail.map((e: any) => `${e.loc?.join(".") || "field"}: ${e.msg}`).join("; ")
        : `HTTP ${res.status}`
    );
    (err as any).status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// CATEGORY APIs
// ---------------------------------------------------------------------------

import { getSession } from "./auth";
import { isDesktopApp, isNetworkOrTransientError } from "./desktop";
import { getMasterDataFromDesktopCache } from "./master-data-cache";

export async function listMenuCategoriesApi(): Promise<BackendMenuCategory[]> {
  try {
    const res = await apiFetch("/api/v1/menu/categories");
    return await handleResponse<BackendMenuCategory[]>(res);
  } catch (netErr) {
    if (isDesktopApp() && isNetworkOrTransientError(netErr)) {
      const session = getSession();
      const bizId = session?.clientId;
      if (bizId && session?.token) {
        try {
          const cached = await getMasterDataFromDesktopCache(bizId);
          if (cached && cached.menu_categories && cached.menu_categories.length > 0) {
            console.info("[DESKTOP CACHE] Serving cached menu categories (offline fallback, is_stale=true)");
            return cached.menu_categories.map((c) => ({
              id: c.id,
              business_id: c.business_id,
              name: c.name,
              display_order: c.display_order,
              is_active: c.is_active,
              created_at: c.created_at || "",
              updated_at: c.updated_at || "",
              is_stale: true,
              items: (c.items || []).map((it) => ({
                id: it.id,
                category_id: it.category_id,
                business_id: it.business_id,
                name: it.name,
                description: it.description,
                price: it.price,
                gst_percentage: it.gst_percentage,
                is_veg: it.is_veg,
                is_available: it.is_available,
                display_order: it.display_order,
                created_at: it.created_at || "",
                updated_at: it.updated_at || "",
                is_stale: true,
              })),
            }));
          }
        } catch (cacheErr) {
          console.warn("[DESKTOP CACHE] Error reading cached menu categories:", cacheErr);
        }
      }
    }
    throw netErr;
  }
}

export async function createMenuCategoryApi(payload: MenuCategoryCreate): Promise<BackendMenuCategory> {
  const res = await apiFetch("/api/v1/menu/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse<BackendMenuCategory>(res);
}

export async function updateMenuCategoryApi(
  categoryId: string,
  payload: MenuCategoryUpdate
): Promise<BackendMenuCategory> {
  const res = await apiFetch(`/api/v1/menu/categories/${categoryId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return handleResponse<BackendMenuCategory>(res);
}

export async function deleteMenuCategoryApi(categoryId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/menu/categories/${categoryId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `HTTP ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// ITEM APIs
// ---------------------------------------------------------------------------

export async function listMenuItemsApi(params?: {
  category_id?: string;
  available_only?: boolean;
}): Promise<BackendMenuItem[]> {
  const q = new URLSearchParams();
  if (params?.category_id) q.set("category_id", params.category_id);
  if (params?.available_only) q.set("available_only", "true");
  const res = await apiFetch(`/api/v1/menu/items${q.toString() ? `?${q}` : ""}`);
  return handleResponse<BackendMenuItem[]>(res);
}

export async function createMenuItemApi(payload: MenuItemCreate): Promise<BackendMenuItem> {
  const res = await apiFetch("/api/v1/menu/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse<BackendMenuItem>(res);
}

export async function updateMenuItemApi(
  itemId: string,
  payload: MenuItemUpdate
): Promise<BackendMenuItem> {
  const res = await apiFetch(`/api/v1/menu/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return handleResponse<BackendMenuItem>(res);
}

export async function deleteMenuItemApi(itemId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/menu/items/${itemId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `HTTP ${res.status}`);
  }
}
