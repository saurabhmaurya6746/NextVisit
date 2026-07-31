import { apiFetch } from "./auth";

export interface SubscriptionPlanItem {
  id: string;
  name: string;
  monthly_price: number;
  trial_days: number;
  max_customers: number;
  max_staff: number;
  max_active_devices: number;
  max_campaigns_per_month: number;
  storage_limit_gb: number;
  features: Record<string, boolean | string> | null;
  is_active: boolean;
}

export interface SubscriptionUpgradeRequestItem {
  id: string;
  business_id: string;
  business_name: string;
  owner_name: string;
  email: string;
  current_plan: SubscriptionPlanItem | null;
  requested_plan: SubscriptionPlanItem;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string | null;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
}

export interface SubscriptionBillingHistoryItem {
  id: string;
  business_id: string;
  plan_name: string;
  invoice_number: string;
  amount: number;
  billing_date: string;
  renewal_date: string | null;
  status: string;
}

export interface MyPlanDetails {
  current_plan: SubscriptionPlanItem | null;
  subscription_status: string;
  trial_status: {
    is_trial: boolean;
    trial_start: string | null;
    trial_end: string | null;
    days_remaining: number;
  };
  expiry_date: string | null;
  days_remaining: number | null;
  features: Record<string, boolean>;
  limits: {
    max_customers: number;
    max_staff: number;
    max_active_devices: number;
    max_campaigns_per_month: number;
    storage_limit_gb: number;
  };
  has_pending_request: boolean;
  pending_request: SubscriptionUpgradeRequestItem | null;
}

export async function getMyPlanApi(): Promise<MyPlanDetails> {
  const res = await apiFetch("/api/v1/subscription/my-plan");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch current subscription plan");
  }
  return await res.json();
}

export async function getAvailablePlansApi(): Promise<SubscriptionPlanItem[]> {
  const res = await apiFetch("/api/v1/subscription/plans");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch subscription plans");
  }
  return await res.json();
}

export async function requestUpgradeApi(requestedPlanId: string): Promise<SubscriptionUpgradeRequestItem> {
  const res = await apiFetch("/api/v1/subscription/upgrade-request", {
    method: "POST",
    body: JSON.stringify({ requested_plan_id: requestedPlanId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to submit upgrade request");
  }
  return await res.json();
}

export async function getMyUpgradeRequestsApi(): Promise<SubscriptionUpgradeRequestItem[]> {
  const res = await apiFetch("/api/v1/subscription/my-requests");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch request history");
  }
  return await res.json();
}

export async function cancelUpgradeRequestApi(requestId: string): Promise<{ message: string }> {
  const res = await apiFetch(`/api/v1/subscription/cancel-request/${requestId}`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to cancel request");
  }
  return await res.json();
}

export async function getBillingHistoryApi(): Promise<SubscriptionBillingHistoryItem[]> {
  const res = await apiFetch("/api/v1/subscription/billing-history");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch billing history");
  }
  return await res.json();
}
