import { apiFetch } from "./auth";

export interface AiCreditPackModel {
  id: string;
  name: string;
  ai_credits: number;
  price: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreditManagementAnalyticsModel {
  total_businesses: number;
  total_ai_credits_used_this_month: number;
  businesses_near_limit: number;
  businesses_out_of_credits: number;
  total_purchased_credits_sold: number;
}

export async function getCreditManagementAnalyticsApi(): Promise<CreditManagementAnalyticsModel> {
  const res = await apiFetch("/api/v1/admin/credits/analytics");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Unable to load credit management analytics.");
  }
  return await res.json();
}

export async function listAdminCreditPacksApi(includeInactive = true): Promise<AiCreditPackModel[]> {
  const res = await apiFetch(`/api/v1/admin/credits/packs?include_inactive=${includeInactive}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Unable to load AI credit packs.");
  }
  return await res.json();
}

export async function createCreditPackApi(payload: Partial<AiCreditPackModel>): Promise<AiCreditPackModel> {
  const res = await apiFetch("/api/v1/admin/credits/packs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Unable to create credit pack.");
  }
  return await res.json();
}

export async function updateCreditPackApi(packId: string, payload: Partial<AiCreditPackModel>): Promise<AiCreditPackModel> {
  const res = await apiFetch(`/api/v1/admin/credits/packs/${packId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Unable to update credit pack.");
  }
  return await res.json();
}

export async function deleteCreditPackApi(packId: string): Promise<{ message: string }> {
  const res = await apiFetch(`/api/v1/admin/credits/packs/${packId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Unable to delete credit pack.");
  }
  return await res.json();
}

export interface AiCreditPurchaseRequestModel {
  id: string;
  business_id: string;
  business_name?: string;
  merchant_name?: string;
  merchant_email?: string;
  current_plan_name?: string;
  current_ai_credits?: number;
  pack_id?: string;
  pack_name: string;
  ai_credits: number;
  amount: number;
  payment_status: string;
  approval_status: string;
  requested_at: string;
  approved_at?: string;
  approved_by_admin_name?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export async function getPublicCreditPacksApi(): Promise<AiCreditPackModel[]> {
  const res = await apiFetch("/api/v1/subscription/credit-packs");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Unable to load available credit packs.");
  }
  return await res.json();
}

export async function buyCreditPackApi(packId: string): Promise<{ success: boolean; message: string; request_id: string; approval_status: string }> {
  const res = await apiFetch(`/api/v1/subscription/buy-credit-pack/${packId}`, {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Unable to submit credit pack purchase request.");
  }
  return await res.json();
}

export async function listCreditPurchaseRequestsApi(
  page = 1,
  limit = 20,
  search = "",
  status = "ALL"
): Promise<{ items: AiCreditPurchaseRequestModel[]; total: number; page: number; pages: number }> {
  const res = await apiFetch(
    `/api/v1/admin/credits/requests?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Unable to load purchase requests.");
  }
  return await res.json();
}

export async function approveCreditPurchaseRequestApi(requestId: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch(`/api/v1/admin/credits/requests/${requestId}/approve`, {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Unable to approve purchase request.");
  }
  return await res.json();
}

export async function rejectCreditPurchaseRequestApi(requestId: string, reason: string, notes?: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch(`/api/v1/admin/credits/requests/${requestId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason, notes }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Unable to reject purchase request.");
  }
  return await res.json();
}

export async function getMyCreditPurchaseRequestsApi(): Promise<any[]> {
  const res = await apiFetch("/api/v1/subscription/my-credit-requests");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Unable to load purchase request history.");
  }
  return await res.json();
}
