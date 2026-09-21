import { apiFetch } from "./auth";

export interface SalonServiceArea {
  id: string;
  business_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalonChair {
  id: string;
  business_id: string;
  service_area_id: string;
  chair_name: string;
  chair_number?: string | null;
  workstation_type: string;
  status: "Available" | "Reserved" | "In Service" | "Completed" | "Cleaning" | "Disabled" | string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalonDashboardChairMetrics {
  available: number;
  occupied: number;
  reserved: number;
  cleaning: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Service Area APIs
// ---------------------------------------------------------------------------

export async function listSalonServiceAreasApi(): Promise<SalonServiceArea[]> {
  try {
    const res = await apiFetch("/api/v1/salon/service-areas");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("[SALON SERVICE AREAS API] Failed to fetch service areas:", err);
    return [];
  }
}

export async function createSalonServiceAreaApi(payload: {
  name: string;
  display_order?: number;
  is_active?: boolean;
}): Promise<SalonServiceArea> {
  const res = await apiFetch("/api/v1/salon/service-areas", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name.trim(),
      display_order: payload.display_order ?? 0,
      is_active: payload.is_active ?? true,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create service area");
  }
  return res.json();
}

export async function updateSalonServiceAreaApi(
  id: string,
  payload: { name?: string; display_order?: number; is_active?: boolean }
): Promise<SalonServiceArea> {
  const res = await apiFetch(`/api/v1/salon/service-areas/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update service area");
  }
  return res.json();
}

export async function deleteSalonServiceAreaApi(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/salon/service-areas/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete service area");
  }
}

// ---------------------------------------------------------------------------
// Salon Chair APIs
// ---------------------------------------------------------------------------

export async function listSalonChairsApi(serviceAreaId?: string): Promise<SalonChair[]> {
  try {
    const query = serviceAreaId ? `?service_area_id=${serviceAreaId}` : "";
    const res = await apiFetch(`/api/v1/salon/chairs${query}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("[SALON CHAIRS API] Failed to fetch chairs:", err);
    return [];
  }
}

export async function getSalonChairMetricsApi(): Promise<SalonDashboardChairMetrics> {
  try {
    const res = await apiFetch("/api/v1/salon/chairs/metrics");
    if (!res.ok) return { available: 0, occupied: 0, reserved: 0, cleaning: 0, total: 0 };
    return res.json();
  } catch (err) {
    console.warn("[SALON CHAIR METRICS] Failed to fetch chair metrics:", err);
    return { available: 0, occupied: 0, reserved: 0, cleaning: 0, total: 0 };
  }
}

export async function createSalonChairApi(payload: {
  service_area_id: string;
  chair_name: string;
  chair_number?: string;
  workstation_type?: string;
  status?: string;
  display_order?: number;
  is_active?: boolean;
}): Promise<SalonChair> {
  const res = await apiFetch("/api/v1/salon/chairs", {
    method: "POST",
    body: JSON.stringify({
      service_area_id: payload.service_area_id,
      chair_name: payload.chair_name.trim(),
      chair_number: payload.chair_number?.trim() || undefined,
      workstation_type: payload.workstation_type?.trim() || "Chair",
      status: payload.status || "Available",
      display_order: payload.display_order ?? 0,
      is_active: payload.is_active ?? true,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create chair");
  }
  return res.json();
}

export async function updateSalonChairApi(
  id: string,
  payload: {
    service_area_id?: string;
    chair_name?: string;
    chair_number?: string;
    workstation_type?: string;
    status?: string;
    display_order?: number;
    is_active?: boolean;
  }
): Promise<SalonChair> {
  const res = await apiFetch(`/api/v1/salon/chairs/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update chair");
  }
  return res.json();
}

export async function updateSalonChairStatusApi(id: string, status: string): Promise<SalonChair> {
  const res = await apiFetch(`/api/v1/salon/chairs/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update chair status");
  }
  return res.json();
}

export async function releaseSalonChairApi(id: string): Promise<SalonChair> {
  const res = await apiFetch(`/api/v1/salon/chairs/${id}/release`, {
    method: "PUT",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to release chair");
  }
  return res.json();
}

export function getNextUniqueChairName(chairs: { chair_name?: string }[], prefix = "Chair"): string {
  const existingNames = new Set((chairs || []).map((c) => (c?.chair_name || "").toLowerCase().trim()));
  let maxDigit = 0;
  for (const c of chairs || []) {
    const match = (c?.chair_name || "").match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxDigit) maxDigit = num;
    }
  }
  let candidateNum = Math.max((chairs || []).length + 1, maxDigit + 1);
  while (
    existingNames.has(`${prefix.toLowerCase()}${candidateNum}`) ||
    existingNames.has(`${prefix.toLowerCase()} ${candidateNum}`) ||
    existingNames.has(`${prefix.toLowerCase()}-${candidateNum}`)
  ) {
    candidateNum++;
  }
  return `${prefix}${candidateNum}`;
}

export async function deleteSalonChairApi(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/salon/chairs/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete chair");
  }
}
