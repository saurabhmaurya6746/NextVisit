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

  let status = "Regular";
  if (c.total_spent >= 500) {
    status = "VIP";
  } else if (c.visit_count <= 1) {
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
    points: Math.round((c.total_spent || 0) * 10),
    lastVisit,
    status,
    initials,
    isActive: c.is_active,
    favorites: [],
    raw: c,
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

export async function getCustomerSegmentsApi() {
  const res = await apiFetch("/api/v1/customers/segments");
  if (!res.ok) {
    throw new Error("Failed to fetch customer segments");
  }
  return await res.json();
}
