import { apiFetch } from "./auth";

export interface SubscriptionPlanItem {
  id: string;
  name: string;
  monthly_price: number;
  trial_days: number;
  max_customers?: number;
  max_staff: number;
  max_active_devices: number;
  max_campaigns_per_month?: number;
  storage_limit_gb: number;
  monthly_ai_credits: number;
  features: Record<string, any> | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
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
    max_staff: number;
    max_active_devices: number;
    storage_limit_gb: number;
    monthly_ai_credits: number;
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

export async function getPublicPlansApi(): Promise<SubscriptionPlanItem[]> {
  try {
    const res = await apiFetch("/api/v1/subscription/public-plans");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.warn("Public pricing fetch /public-plans failed, attempting /plans fallback:", err);
  }

  const resFallback = await apiFetch("/api/v1/subscription/plans");
  if (!resFallback.ok) {
    const err = await resFallback.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch subscription plans");
  }
  return await resFallback.json();
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

export interface SubscriptionUsageSummary {
  plan_name: string;
  subscription_status: string;
  staff_usage: {
    plan_name: string;
    active_count: number;
    max_count: number;
    remaining_slots: number;
    limit_reached: boolean;
  };
  ai_usage: {
    ai_enabled: boolean;
    used_requests: number;
    max_requests: number;
    remaining_requests: number;
    limit_reached: boolean;
    reset_date: string;
  };
}

export async function getSubscriptionUsageApi(): Promise<SubscriptionUsageSummary> {
  const res = await apiFetch("/api/v1/subscription/usage");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch subscription usage summary");
  }
  return await res.json();
}

export interface AiEntitlementDetails {
  can_use_ai: boolean;
  ai_included_in_plan: boolean;
  credits_available: boolean;
  current_plan: string;
  credits_remaining: number;
  monthly_plan_credits: number;
  purchased_remaining_credits: number;
  reason: "PLAN_NOT_ELIGIBLE" | "NO_CREDITS" | "AVAILABLE";
}

export async function getAiEntitlementApi(): Promise<AiEntitlementDetails> {
  const res = await apiFetch("/api/v1/subscription/ai-entitlement");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch AI entitlement details");
  }
  return await res.json();
}

/**
 * Global AI Error & Entitlement Interceptor.
 * Dispatches `growthos:open-ai-upgrade-modal` event when AI access is restricted.
 * Returns true if the error was intercepted (and upgrade modal opened).
 */
export function handleAiApiError(err: any): boolean {
  let code = "";
  let detailMsg = "";

  if (err && typeof err === "object") {
    if (err.code) code = String(err.code);
    if (err.detail && typeof err.detail === "object") {
      code = String(err.detail.code || code);
      detailMsg = String(err.detail.detail || err.detail.message || "");
    } else if (typeof err.detail === "string") {
      detailMsg = err.detail;
    }
    if (!detailMsg && err.message) detailMsg = String(err.message);
  } else if (typeof err === "string") {
    detailMsg = err;
  }

  const isPlanEligibleError =
    code === "AI_PLAN_NOT_ELIGIBLE" ||
    detailMsg.includes("AI_PLAN_NOT_ELIGIBLE") ||
    detailMsg.includes("not included in your current subscription") ||
    detailMsg.includes("disabled for your current subscription plan");

  const isCreditsExhaustedError =
    code === "AI_CREDITS_EXHAUSTED" ||
    detailMsg.includes("AI_CREDITS_EXHAUSTED") ||
    detailMsg.includes("used all available AI Credits") ||
    detailMsg.includes("used all available AI credits") ||
    detailMsg.includes("reached your available AI credits");

  if (isPlanEligibleError) {
    window.dispatchEvent(
      new CustomEvent("growthos:open-ai-upgrade-modal", {
        detail: {
          reason: "PLAN_NOT_ELIGIBLE",
          message:
            "AI features aren't included in your current subscription plan. Upgrade your subscription to unlock Gemini AI copywriter features.",
        },
      })
    );
    return true;
  }

  if (isCreditsExhaustedError) {
    window.dispatchEvent(
      new CustomEvent("growthos:open-ai-upgrade-modal", {
        detail: {
          reason: "NO_CREDITS",
          message:
            "You've reached your available AI credits. Upgrade your plan or purchase additional AI credits to continue.",
        },
      })
    );
    return true;
  }

  return false;
}
