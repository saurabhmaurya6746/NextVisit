import { apiFetch } from "./auth";

export interface ReviewBoosterDashboardResponse {
  pending: number;
  requested: number;
  reviewed: number;
  clicked: number;
  eligible_today: number;
  eligible_yesterday: number;
  last_7_days: number;
  last_month: number;
}

export interface ReviewBoosterCustomerItem {
  customer_id: string;
  customer_name: string;
  phone: string;
  last_visit_at: string | null;
  bill_amount: number;
  visit_count: number;
  lifetime_spend: number;
  status: "eligible" | "pending" | "requested" | "clicked" | "reviewed" | string;
  last_review_request: string | null;
  clicked: boolean;
  clicked_at: string | null;
  reviewed: boolean;
  reviewed_at: string | null;
}

export interface PaginatedReviewBoosterCustomersResponse {
  items: ReviewBoosterCustomerItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface ReviewBoosterSendResponse {
  campaign_id: string;
  recipients_count: number;
  message: string;
}

export interface ReviewBoosterPreviewResponse {
  personalized_message: string;
  review_link: string;
  customer_name: string;
  business_name: string;
}

export interface ReviewBoosterAiGenerateResponse {
  message: string;
  tone: string;
  review_link: string;
}

export interface ReviewBoosterSettings {
  enable_review_booster: boolean;
  review_cooldown_days: number;
  google_review_url: string;
  auto_send: boolean;
  ai_enabled: boolean;
}

function parseErrorDetail(errData: any, fallback: string): string {
  if (!errData) return fallback;
  if (typeof errData.detail === "string") return errData.detail;
  if (Array.isArray(errData.detail) && errData.detail.length > 0) {
    return errData.detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ");
  }
  if (errData.message && typeof errData.message === "string") return errData.message;
  return fallback;
}

/**
 * 1. GET /api/v1/review-booster/dashboard
 */
export async function getReviewBoosterDashboardApi(): Promise<ReviewBoosterDashboardResponse> {
  const res = await apiFetch("/api/v1/review-booster/dashboard");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to fetch review dashboard (HTTP ${res.status})`));
  }
  return await res.json();
}

/**
 * 2. GET /api/v1/review-booster/customers
 */
export async function getReviewBoosterCustomersApi(params: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  startDate?: string;
  endDate?: string;
}): Promise<PaginatedReviewBoosterCustomersResponse> {
  const query = new URLSearchParams({
    status: params.status || "all",
    page: String(params.page || 1),
    page_size: String(params.pageSize || 20),
    sort_by: params.sortBy || "recent",
  });
  if (params.search && params.search.trim()) {
    query.set("search", params.search.trim());
  }
  if (params.startDate) query.set("start_date", params.startDate);
  if (params.endDate) query.set("end_date", params.endDate);

  const res = await apiFetch(`/api/v1/review-booster/customers?${query.toString()}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to fetch review booster customers (HTTP ${res.status})`));
  }
  return await res.json();
}

/**
 * 3. POST /api/v1/review-booster/send
 */
export async function sendReviewRequestApi(payload: {
  customer_ids: string[];
  template_id?: string;
  message?: string;
  schedule_at?: string;
}): Promise<ReviewBoosterSendResponse> {
  const res = await apiFetch("/api/v1/review-booster/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to send review request (HTTP ${res.status})`));
  }
  return await res.json();
}

/**
 * 4. POST /api/v1/review-booster/preview
 */
export async function previewReviewMessageApi(payload: {
  template_id?: string;
  message?: string;
  customer_id?: string;
}): Promise<ReviewBoosterPreviewResponse> {
  const res = await apiFetch("/api/v1/review-booster/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to preview review message (HTTP ${res.status})`));
  }
  return await res.json();
}

/**
 * 5. POST /api/v1/review-booster/ai-generate
 */
export async function generateReviewAiApi(payload: {
  tone?: string;
  language?: string;
  message_length?: string;
}): Promise<ReviewBoosterAiGenerateResponse> {
  const res = await apiFetch("/api/v1/review-booster/ai-generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to generate AI review copy (HTTP ${res.status})`));
  }
  return await res.json();
}

/**
 * 6. PATCH /api/v1/review-booster/{customer_id}/reviewed
 */
export async function markReviewCompletedApi(customerId: string): Promise<{ customer_id: string; reviewed: boolean }> {
  const res = await apiFetch(`/api/v1/review-booster/${customerId}/reviewed`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to mark review completed (HTTP ${res.status})`));
  }
  return await res.json();
}

/**
 * 7. GET /api/v1/review-booster/settings
 */
export async function getReviewBoosterSettingsApi(): Promise<ReviewBoosterSettings> {
  const res = await apiFetch("/api/v1/review-booster/settings");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to fetch review booster settings (HTTP ${res.status})`));
  }
  return await res.json();
}

/**
 * 8. PUT /api/v1/review-booster/settings
 */
export async function updateReviewBoosterSettingsApi(settings: Partial<ReviewBoosterSettings>): Promise<ReviewBoosterSettings> {
  const res = await apiFetch("/api/v1/review-booster/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to update review booster settings (HTTP ${res.status})`));
  }
  return await res.json();
}
