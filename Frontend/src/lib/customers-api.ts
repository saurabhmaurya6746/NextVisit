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
  const res = await apiFetch("/api/v1/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to create customer");
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
  const res = await apiFetch(`/api/v1/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to update customer");
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
