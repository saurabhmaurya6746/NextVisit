import { apiFetch } from "./auth";

export interface BackendCustomer {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email: string | null;
  gender: string | null;
  birth_date: string | null;
  anniversary_date: string | null;
  address: string | null;
  notes: string | null;
  visit_count: number;
  total_spent: number;
  loyalty_points?: number;
  first_visit_at: string | null;
  last_visit_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CustomerModel {
  id: string;
  name: string;
  phone: string;
  email: string;
  gender: string;
  birthday: string;
  anniversary: string;
  birth_date: string | null;
  anniversary_date: string | null;
  address: string;
  notes: string;
  visits: number;
  spent: number;
  points: number;
  lastVisit: string;
  status: string;
  initials: string;
  isActive: boolean;
  favorites: string[];
  raw: BackendCustomer;
}

export function formatCustomer(c: BackendCustomer): CustomerModel {
  const initials = (c.name || "Guest")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "CU";

  let status = (c as any).status || "New";
  const v = c.visit_count || 0;
  const s = c.total_spent || 0;
  if (v >= 5 || s >= 2500) {
    status = "VIP";
  } else if (v >= 2 || s >= 500) {
    status = "Regular";
  } else {
    status = "New";
  }

  const lastVisit = c.last_visit_at
    ? new Date(c.last_visit_at).toISOString().slice(0, 10)
    : c.created_at
    ? new Date(c.created_at).toISOString().slice(0, 10)
    : "—";

  return {
    id: c.id,
    name: c.name || "Guest",
    phone: c.phone || "—",
    email: c.email || "",
    gender: c.gender || "",
    birthday: c.birth_date ? c.birth_date : "—",
    anniversary: c.anniversary_date ? c.anniversary_date : "—",
    birth_date: c.birth_date,
    anniversary_date: c.anniversary_date,
    address: c.address || "",
    notes: c.notes || "",
    visits: c.visit_count || 0,
    spent: c.total_spent || 0,
    points: c.loyalty_points && c.loyalty_points > 0 ? c.loyalty_points : Math.floor((c.total_spent || 0) / 10),
    lastVisit,
    status,
    initials,
    isActive: c.is_active,
    favorites: [],
    raw: c,
  };
}

export interface PaginatedCustomersResult {
  items: CustomerModel[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export async function listPaginatedCustomersApi(params?: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  filter?: string;
}): Promise<PaginatedCustomersResult> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.limit) query.append("limit", String(params.limit));
  if (params?.search) query.append("search", params.search);
  if (params?.sort) query.append("sort", params.sort);
  if (params?.filter) query.append("filter", params.filter);

  const queryString = query.toString();
  const url = `/api/v1/customers${queryString ? `?${queryString}` : ""}`;
  const res = await apiFetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch paginated customers");
  }
  const data = await res.json();
  const rawItems = Array.isArray(data) ? data : data.items || [];
  return {
    items: rawItems.map(formatCustomer),
    page: data.page || 1,
    limit: data.limit || 10,
    total: data.total || rawItems.length,
    total_pages: data.total_pages || 1,
    has_next: !!data.has_next,
    has_previous: !!data.has_previous,
  };
}

export async function listCustomersApi(): Promise<CustomerModel[]> {
  const res = await apiFetch("/api/v1/customers");
  if (!res.ok) {
    throw new Error("Failed to fetch customers");
  }
  const data: BackendCustomer[] = await res.json();
  return data.map(formatCustomer);
}

export async function getCustomerByIdApi(id: string): Promise<CustomerModel> {
  const res = await apiFetch(`/api/v1/customers/${id}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  const data: BackendCustomer = await res.json();
  return formatCustomer(data);
}

export async function createCustomerApi(payload: {
  name: string;
  phone: string;
  email?: string;
  gender?: string;
  birth_date?: string;
  anniversary_date?: string;
  address?: string;
  notes?: string;
}): Promise<CustomerModel> {
  const body: Record<string, any> = {
    name: payload.name.trim(),
    phone: payload.phone.trim(),
  };

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (payload.email && payload.email.trim() && EMAIL_REGEX.test(payload.email.trim())) {
    body.email = payload.email.trim();
  }
  if (payload.gender && payload.gender.trim()) body.gender = payload.gender.trim();
  if (payload.birth_date && payload.birth_date.trim()) body.birth_date = payload.birth_date.trim();
  if (payload.anniversary_date && payload.anniversary_date.trim()) body.anniversary_date = payload.anniversary_date.trim();
  if (payload.address && payload.address.trim()) body.address = payload.address.trim();
  if (payload.notes && payload.notes.trim()) body.notes = payload.notes.trim();

  const res = await apiFetch("/api/v1/customers", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    let errMsg = "Failed to create customer";
    if (Array.isArray(errData.detail)) {
      errMsg = errData.detail.map((e: any) => `${e.loc?.join(".") || "field"}: ${e.msg}`).join("; ");
    } else if (typeof errData.detail === "string") {
      errMsg = errData.detail;
    }
    throw new Error(errMsg);
  }
  const data: BackendCustomer = await res.json();
  return formatCustomer(data);
}

export async function updateCustomerApi(
  id: string,
  payload: {
    name?: string;
    phone?: string;
    email?: string;
    gender?: string;
    birth_date?: string;
    anniversary_date?: string;
    address?: string;
    notes?: string;
    is_active?: boolean;
  }
): Promise<CustomerModel> {
  const body: Record<string, any> = {};

  if (payload.name !== undefined) body.name = payload.name.trim();
  if (payload.phone !== undefined) body.phone = payload.phone.trim();
  if (payload.email !== undefined) body.email = payload.email?.trim() || null;
  if (payload.gender !== undefined) body.gender = payload.gender?.trim() || null;
  if (payload.birth_date !== undefined) body.birth_date = payload.birth_date?.trim() || null;
  if (payload.anniversary_date !== undefined) body.anniversary_date = payload.anniversary_date?.trim() || null;
  if (payload.address !== undefined) body.address = payload.address?.trim() || null;
  if (payload.notes !== undefined) body.notes = payload.notes?.trim() || null;
  if (payload.is_active !== undefined) body.is_active = payload.is_active;

  const res = await apiFetch(`/api/v1/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    let errMsg = "Failed to update customer";
    if (Array.isArray(errData.detail)) {
      errMsg = errData.detail.map((e: any) => `${e.loc?.join(".") || "field"}: ${e.msg}`).join("; ");
    } else if (typeof errData.detail === "string") {
      errMsg = errData.detail;
    }
    throw new Error(errMsg);
  }
  const data: BackendCustomer = await res.json();
  return formatCustomer(data);
}

export async function deleteCustomerApi(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/customers/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to delete customer");
  }
}

export async function getCustomerSegmentsApi() {
  const res = await apiFetch("/api/v1/customers/segments");
  if (!res.ok) {
    throw new Error("Failed to fetch customer segments");
  }
  return await res.json();
}

export interface CustomerCrmData {
  profile: BackendCustomer;
  total_visits: number;
  total_orders: number;
  total_spent: number;
  avg_bill: number;
  loyalty_points: number;
  last_visit_at: string | null;
  first_visit_at: string | null;
  last_order_at: string | null;
  customer_since: string;
  total_qr_orders: number;
  total_staff_orders: number;
  preferred_dining_area: string;
  favorite_table: string;
  favorite_items: Array<{ name: string; count: number; total_spent: number }>;
  avg_visit_frequency_days: number | null;
  customer_lifetime_value: number;
  timeline: Array<{
    id: string;
    type: string;
    title: string;
    description?: string | null;
    timestamp: string;
    badge?: string | null;
    amount?: number | null;
  }>;
  visits: Array<{
    id: string;
    visit_number: number;
    date: string;
    table_name: string;
    dining_area_name: string;
    source: string;
    status: string;
    total_amount: number;
    loyalty_earned: number;
    payment_method?: string | null;
  }>;
  orders: Array<{
    id: string;
    order_number: string;
    status: string;
    source: string;
    table_name: string;
    created_at: string;
    completed_at?: string | null;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    total_amount: number;
    items: Array<{
      id: string;
      name: string;
      unit_price: number;
      quantity: number;
      subtotal: number;
      notes?: string | null;
    }>;
  }>;
  loyalty_history: Array<{
    id: string;
    date: string;
    reason: string;
    points: number;
    type: string;
    balance_after: number;
  }>;
  loyalty_current_points: number;
  loyalty_lifetime_points: number;
  loyalty_redeemed_points: number;
  whatsapp_logs: Array<{
    id: string;
    campaign_name?: string | null;
    type: string;
    message: string;
    status: string;
    sent_at: string;
  }>;
  campaigns: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    sent_at?: string | null;
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string;
    date: string;
    google_status: string;
  }>;
  ai_insights: string;
}

export async function getCustomerCrmDetailsApi(id: string): Promise<CustomerCrmData> {
  const res = await apiFetch(`/api/v1/customers/${id}/crm`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * Record a completed visit & spend for a customer in PostgreSQL backend
 */
export async function recordCustomerVisitApi(customerId: string, amountSpent: number): Promise<CustomerModel> {
  const res = await apiFetch(`/api/v1/customers/${customerId}/record-visit?amount_spent=${encodeURIComponent(amountSpent)}`, {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to record customer visit in backend");
  }
  const data: BackendCustomer = await res.json();
  return formatCustomer(data);
}

export async function exportCustomersApi(params?: {
  search?: string;
  filter?: string;
  sort?: string;
  format?: string;
}): Promise<void> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.filter) query.set("filter", params.filter);
  if (params?.sort) query.set("sort", params.sort);
  if (params?.format) query.set("format", params.format);

  const res = await apiFetch(`/api/v1/customers/export?${query.toString()}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to export customers (HTTP ${res.status})`);
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get("Content-Disposition");
  let filename = `customers_export_${new Date().toISOString().slice(0, 10)}.csv`;
  if (contentDisposition && contentDisposition.includes("filename=")) {
    const match = contentDisposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export interface CustomerImportErrorItem {
  row: number;
  field?: string;
  reason: string;
}

export interface CustomerImportResponse {
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  duplicate_count: number;
  errors: CustomerImportErrorItem[];
  message: string;
}

export async function importCustomersApi(file: File): Promise<CustomerImportResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiFetch(`/api/v1/customers/import`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Customer import failed (HTTP ${res.status})`);
  }

  return await res.json();
}
