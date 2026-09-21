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
}

export interface DiningAreaCreatePayload {
  name: string;
  display_order?: number;
  color?: string | null;
  is_active?: boolean;
}

export async function listDiningAreasApi(): Promise<DiningArea[]> {
  const res = await apiFetch("/api/v1/dining-areas");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `HTTP ${res.status}`);
  }
  return await res.json();
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

