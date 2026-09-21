import { apiFetch } from "./auth";

export interface SalonServiceCategory {
  id: string;
  business_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function listSalonServiceCategoriesApi(): Promise<SalonServiceCategory[]> {
  const res = await apiFetch("/api/v1/salon/service-categories");
  if (!res.ok) return [];
  return res.json();
}

export async function createSalonServiceCategoryApi(payload: {
  name: string;
  display_order?: number;
  is_active?: boolean;
}): Promise<SalonServiceCategory> {
  const res = await apiFetch("/api/v1/salon/service-categories", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name.trim(),
      display_order: payload.display_order ?? 0,
      is_active: payload.is_active ?? true,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create service category");
  }
  return res.json();
}

export async function updateSalonServiceCategoryApi(
  id: string,
  payload: { name?: string; display_order?: number; is_active?: boolean }
): Promise<SalonServiceCategory> {
  const res = await apiFetch(`/api/v1/salon/service-categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update service category");
  }
  return res.json();
}

export async function deleteSalonServiceCategoryApi(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/salon/service-categories/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete service category");
  }
}

export async function reorderSalonServiceCategoriesApi(
  items: { id: string; display_order: number }[]
): Promise<SalonServiceCategory[]> {
  const res = await apiFetch("/api/v1/salon/service-categories/reorder", {
    method: "POST",
    body: JSON.stringify(items),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to reorder service categories");
  }
  return res.json();
}
