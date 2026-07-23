import { apiFetch } from "./auth";

export interface BackendVisitService {
  id: string;
  visit_id: string;
  service_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface BackendVisit {
  id: string;
  business_id: string;
  customer_id: string;
  staff_id: string | null;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  notes: string | null;
  subtotal: number;
  discount: number;
  total_amount: number;
  payment_method: "CASH" | "CARD" | "UPI" | "OTHER" | null;
  payment_status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  earned_points: number;
  services: BackendVisitService[];
}

export interface VisitModel {
  id: string;
  businessId: string;
  customerId: string;
  staffId?: string | null;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  notes: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  startedAt: string;
  completedAt: string;
  createdAt: string;
  earnedPoints: number;
  services: BackendVisitService[];
  raw: BackendVisit;
}

export function formatVisit(v: BackendVisit): VisitModel {
  return {
    id: v.id,
    businessId: v.business_id,
    customerId: v.customer_id,
    staffId: v.staff_id,
    status: v.status || "OPEN",
    notes: v.notes || "",
    subtotal: v.subtotal || 0,
    discount: v.discount || 0,
    totalAmount: v.total_amount || 0,
    paymentMethod: v.payment_method || "CASH",
    paymentStatus: v.payment_status || "PENDING",
    startedAt: v.started_at ? new Date(v.started_at).toISOString() : v.created_at,
    completedAt: v.completed_at ? new Date(v.completed_at).toISOString() : "—",
    createdAt: v.created_at,
    earnedPoints: v.earned_points || 0,
    services: v.services || [],
    raw: v,
  };
}

export async function listVisitsApi(): Promise<VisitModel[]> {
  const res = await apiFetch("/api/v1/visits");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  const data: BackendVisit[] = await res.json();
  return data.map(formatVisit);
}

export async function listOpenVisitsApi(): Promise<VisitModel[]> {
  const res = await apiFetch("/api/v1/visits/open");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  const data: BackendVisit[] = await res.json();
  return data.map(formatVisit);
}

export async function listCompletedVisitsApi(): Promise<VisitModel[]> {
  const res = await apiFetch("/api/v1/visits/completed");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  const data: BackendVisit[] = await res.json();
  return data.map(formatVisit);
}

export async function getVisitByIdApi(id: string): Promise<VisitModel> {
  const res = await apiFetch(`/api/v1/visits/${id}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  const data: BackendVisit = await res.json();
  return formatVisit(data);
}

export async function createVisitApi(payload: {
  customer_id: string;
  staff_id?: string;
  notes?: string;
  payment_method?: "CASH" | "CARD" | "UPI" | "OTHER";
  discount?: number;
  services: { service_id: string; quantity: number }[];
}): Promise<VisitModel> {
  const res = await apiFetch("/api/v1/visits", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || "Failed to create visit");
    (err as any).status = res.status;
    throw err;
  }
  const data: BackendVisit = await res.json();
  return formatVisit(data);
}

export async function completeVisitApi(
  id: string,
  payload?: {
    payment_method?: "CASH" | "CARD" | "UPI" | "OTHER";
    notes?: string;
  }
): Promise<VisitModel> {
  const res = await apiFetch(`/api/v1/visits/${id}/complete`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || "Failed to complete visit");
    (err as any).status = res.status;
    throw err;
  }
  const data: BackendVisit = await res.json();
  return formatVisit(data);
}
