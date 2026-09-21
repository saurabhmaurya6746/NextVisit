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

export async function listRestaurantTablesApi(diningAreaId?: string): Promise<RestaurantTable[]> {
  const url = diningAreaId ? `/api/v1/tables?dining_area_id=${diningAreaId}` : "/api/v1/tables";
  const res = await apiFetch(url);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `HTTP ${res.status}`);
  }
  return await res.json();
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
