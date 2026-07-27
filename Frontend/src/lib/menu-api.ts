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

export async function listMenuCategoriesApi(): Promise<BackendMenuCategory[]> {
  const res = await apiFetch("/api/v1/menu/categories");
  return handleResponse<BackendMenuCategory[]>(res);
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
