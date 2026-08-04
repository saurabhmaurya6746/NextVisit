import { apiFetch } from "./auth";

export interface ServiceCatalogItem {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  category: string | null;
  category_id?: string | null;
  category_name?: string | null;
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
  category_id?: string;
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
    category_id?: string;
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
 * Delete a catalog service item
 */
export async function deleteServiceCatalogItemApi(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/services/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to delete catalog service");
  }
}

/**
 * Update or append services for an active visit in PostgreSQL backend
 */
export async function updateVisitServicesApi(
  visitId: string,
  services: { name: string; price: number; duration: number; id?: string; service_id?: string }[]
): Promise<any> {
  const res = await apiFetch(`/api/v1/visits/${visitId}/services`, {
    method: "PUT",
    body: JSON.stringify({ services }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to update visit services in backend");
  }
  return res.json();
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

/**
 * Triggers browser download for official backend-generated Salon Invoice PDF
 */
export async function downloadInvoicePdfApi(id: string, code?: string): Promise<void> {
  const filename = `${code || "Invoice_" + id.slice(0, 8)}.pdf`;

  let res = await apiFetch(`/api/v1/salon/invoices/${encodeURIComponent(id)}/pdf`);
  if (!res.ok) {
    res = await apiFetch(`/api/v1/visits/${encodeURIComponent(id)}/pdf`);
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    let errMsg = "Failed to download invoice PDF from backend";
    if (typeof errData.detail === "string") {
      errMsg = errData.detail;
    } else if (Array.isArray(errData.detail) && errData.detail.length > 0) {
      errMsg = errData.detail[0]?.msg || errData.detail[0]?.detail || JSON.stringify(errData.detail[0]);
    } else if (errData.detail) {
      errMsg = JSON.stringify(errData.detail);
    }
    throw new Error(errMsg);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export interface GenerateThankYouWhatsAppResponse {
  message: string;
  customer_name: string;
  customer_phone: string;
  salon_name: string;
  visit_date: string;
  services_summary: string;
  grand_total: number;
  points_earned: number;
  loyalty_balance: number;
  tone: string;
}

/**
 * Complete a visit in PostgreSQL backend
 */
export async function completeVisitApi(
  visitId: string,
  payload?: { payment_method?: string; payment_status?: string }
): Promise<any> {
  const res = await apiFetch(`/api/v1/visits/${encodeURIComponent(visitId)}/complete`, {
    method: "POST",
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to complete visit in backend");
  }
  return res.json();
}

/**
 * Calls backend endpoint to generate personalized Thank You WhatsApp Message
 */
export async function generateSalonThankYouWhatsAppApi(
  appointmentId: string,
  tone: string = "Friendly"
): Promise<GenerateThankYouWhatsAppResponse> {
  const res = await apiFetch(`/api/v1/salon/invoices/${encodeURIComponent(appointmentId)}/generate-thank-you-whatsapp?tone=${encodeURIComponent(tone)}`, {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to generate Thank You WhatsApp message from backend");
  }
  return res.json();
}

export interface PaginatedVisitsResult {
  items: any[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export async function listPaginatedVisitsApi(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  payment_status?: string;
  staff_id?: string;
  date_from?: string;
  date_to?: string;
  booking_source?: string;
  sort?: string;
}): Promise<PaginatedVisitsResult> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.limit) query.append("limit", String(params.limit));
  if (params?.search) query.append("search", params.search);
  if (params?.status) query.append("status", params.status);
  if (params?.payment_status) query.append("payment_status", params.payment_status);
  if (params?.staff_id) query.append("staff_id", params.staff_id);
  if (params?.date_from) query.append("date_from", params.date_from);
  if (params?.date_to) query.append("date_to", params.date_to);
  if (params?.booking_source) query.append("booking_source", params.booking_source);
  if (params?.sort) query.append("sort", params.sort);

  const queryString = query.toString();
  const url = `/api/v1/visits${queryString ? `?${queryString}` : ""}`;
  const res = await apiFetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch paginated appointments");
  }
  const data = await res.json();
  const rawItems = Array.isArray(data) ? data : data.items || [];
  return {
    items: rawItems,
    page: data.page || 1,
    limit: data.limit || 10,
    total: data.total || rawItems.length,
    total_pages: data.total_pages || 1,
    has_next: !!data.has_next,
    has_previous: !!data.has_previous,
  };
}
