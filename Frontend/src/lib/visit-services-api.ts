import { apiFetch } from "./auth";

export interface ServiceCatalogItem {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VisitServiceItem {
  id: string;
  visit_id: string;
  service_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  service_name?: string;
}

export interface RecalculatedTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
}

/**
 * Fetch available business services catalog
 */
export async function listServicesCatalogApi(): Promise<ServiceCatalogItem[]> {
  const res = await apiFetch("/api/v1/services");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * Fetch services for a specific visit
 */
export async function getVisitServicesApi(visitId: string): Promise<VisitServiceItem[]> {
  const res = await apiFetch(`/api/v1/visits/${visitId}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  const visit = await res.json();
  return visit.services || [];
}

/**
 * Create a new service item in the business catalog
 */
export async function createServiceCatalogItemApi(payload: {
  name: string;
  price: number;
  duration_minutes: number;
  description?: string;
  category?: string;
  is_active?: boolean;
}): Promise<ServiceCatalogItem> {
  const res = await apiFetch("/api/v1/services", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || "Failed to create catalog service");
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * Update an existing catalog service item
 */
export async function updateServiceCatalogItemApi(
  id: string,
  payload: {
    name?: string;
    price?: number;
    duration_minutes?: number;
    description?: string;
    category?: string;
    is_active?: boolean;
  }
): Promise<ServiceCatalogItem> {
  const res = await apiFetch(`/api/v1/services/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || "Failed to update catalog service");
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * Recalculates subtotal, discount, tax, and total_amount for a given list of service items.
 */
export function recalculateVisitTotals(
  services: { quantity: number; unit_price: number }[],
  discountPct: number = 0,
  taxPct: number = 0
): RecalculatedTotals {
  const subtotal = services.reduce((sum, item) => sum + (item.quantity || 1) * (item.unit_price || 0), 0);
  const discount = Math.round(((subtotal * Math.max(0, discountPct)) / 100) * 100) / 100;
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = Math.round(((taxableAmount * Math.max(0, taxPct)) / 100) * 100) / 100;
  const total_amount = Math.max(0, taxableAmount + tax);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount,
    tax,
    total_amount: Math.round(total_amount * 100) / 100,
  };
}
