import { apiFetch } from "./auth";

export interface RecoveryBucketCount {
  count: number;
}

export interface RecoveryDashboardResponse {
  "15_days": RecoveryBucketCount;
  "30_days": RecoveryBucketCount;
  "45_days": RecoveryBucketCount;
  "60_days": RecoveryBucketCount;
  "90_days": RecoveryBucketCount;
  total_recoverable: number;
}

export interface RecoverableCustomerItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  gender: string | null;
  last_visit_at: string | null;
  days_since_last_visit: number;
  avg_spend: number;
  total_spent: number;
  visit_count: number;
  loyalty_points: number;
  membership: string | null;
  favorite_item: string;
  is_vip: boolean;
  recovery_stage: string;
}

export interface PaginatedRecoverableCustomersResponse {
  items: RecoverableCustomerItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface RecoveryAnalyticsResponse {
  potential_revenue: number;
  average_spend: number;
  recoverable_customers: number;
  recovery_rate_pct: number;
  total_campaigns_sent: number;
  total_recovered: number;
  messages_sent: number;
  messages_failed: number;
}

export interface RecoveryPreviewResponse {
  recipients: number;
  estimated_revenue: number;
  estimated_message_count: number;
  coupon_code: string | null;
  bucket_days: number;
  average_spend: number;
}

export interface RecoveryLaunchPayload {
  bucket: number;
  message: string;
  coupon_code?: string;
  schedule_at?: string | null;
}

export interface RecoveryLaunchResponse {
  campaign_id: string;
  campaign_name: string;
  recipients_count: number;
  bucket_days: number;
  message: string;
}

export interface SuggestedOfferItem {
  title: string;
  type: string;
  value?: string | null;
}

export interface SuggestedOffersResponse {
  offers: SuggestedOfferItem[];
}

export interface RecoveryHistoryItem {
  campaign_id: string;
  campaign_name: string;
  bucket_days: number;
  launched_at: string;
  total_recipients: number;
  sent: number;
  failed: number;
  recovered: number;
  revenue_generated: number;
}

export interface RecoveryHistoryResponse {
  items: RecoveryHistoryItem[];
  total: number;
}

export interface RecoverySettings {
  recovery_enabled: boolean;
  recovery_buckets: number[];
  recovery_cooldown_days: number;
  recovery_max_messages_per_day: number;
  recovery_window_days: number;
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

/** 1. GET /api/v1/customer-recovery/dashboard */
export async function getRecoveryDashboardApi(): Promise<RecoveryDashboardResponse> {
  const res = await apiFetch("/api/v1/customer-recovery/dashboard");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to fetch recovery dashboard (HTTP ${res.status})`));
  }
  return res.json();
}

/** 2. GET /api/v1/customer-recovery/customers */
export async function getRecoverableCustomersApi(params: {
  bucket: number;
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  filterVip?: boolean;
  filterGender?: string;
  filterStage?: string;
}): Promise<PaginatedRecoverableCustomersResponse> {
  const query = new URLSearchParams({
    bucket: String(params.bucket),
    page: String(params.page || 1),
    page_size: String(params.pageSize || 20),
    sort_by: params.sortBy || "days_desc",
  });
  if (params.search && params.search.trim()) query.set("search", params.search.trim());

  const res = await apiFetch(`/api/v1/customer-recovery/customers?${query.toString()}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to fetch recoverable customers (HTTP ${res.status})`));
  }
  const data: PaginatedRecoverableCustomersResponse = await res.json();

  // Client-side filter augmentation for fields not yet in backend filter query params
  let items = data.items;
  if (params.filterVip === true) items = items.filter((c) => c.is_vip);
  if (params.filterGender && params.filterGender !== "all")
    items = items.filter((c) => (c.gender || "").toLowerCase() === params.filterGender!.toLowerCase());
  if (params.filterStage && params.filterStage !== "all")
    items = items.filter((c) => c.recovery_stage === params.filterStage);

  return { ...data, items };
}

/** 3. GET /api/v1/customer-recovery/analytics */
export async function getRecoveryAnalyticsApi(): Promise<RecoveryAnalyticsResponse> {
  const res = await apiFetch("/api/v1/customer-recovery/analytics");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to fetch recovery analytics (HTTP ${res.status})`));
  }
  return res.json();
}

/** 4. GET /api/v1/customer-recovery/preview */
export async function getRecoveryPreviewApi(
  bucket: number,
  couponCode?: string
): Promise<RecoveryPreviewResponse> {
  const query = new URLSearchParams({ bucket: String(bucket) });
  if (couponCode) query.set("coupon_code", couponCode);
  const res = await apiFetch(`/api/v1/customer-recovery/preview?${query.toString()}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to fetch campaign preview (HTTP ${res.status})`));
  }
  return res.json();
}

/** 5. POST /api/v1/customer-recovery/launch */
export async function launchRecoveryCampaignApi(
  payload: RecoveryLaunchPayload
): Promise<RecoveryLaunchResponse> {
  const res = await apiFetch("/api/v1/customer-recovery/launch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to launch recovery campaign (HTTP ${res.status})`));
  }
  return res.json();
}

/** 6. GET /api/v1/customer-recovery/offers */
export async function getSuggestedOffersApi(): Promise<SuggestedOffersResponse> {
  const res = await apiFetch("/api/v1/customer-recovery/offers");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to fetch suggested offers (HTTP ${res.status})`));
  }
  return res.json();
}

/** 7. GET /api/v1/customer-recovery/history */
export async function getRecoveryHistoryApi(): Promise<RecoveryHistoryResponse> {
  const res = await apiFetch("/api/v1/customer-recovery/history");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to fetch recovery history (HTTP ${res.status})`));
  }
  return res.json();
}

/** 8. GET /api/v1/customer-recovery/settings */
export async function getRecoverySettingsApi(): Promise<RecoverySettings> {
  const res = await apiFetch("/api/v1/customer-recovery/settings");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to fetch recovery settings (HTTP ${res.status})`));
  }
  return res.json();
}

/** 9. PUT /api/v1/customer-recovery/settings */
export async function updateRecoverySettingsApi(
  settings: Partial<RecoverySettings>
): Promise<RecoverySettings> {
  const res = await apiFetch("/api/v1/customer-recovery/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to update recovery settings (HTTP ${res.status})`));
  }
  return res.json();
}

/** 10. POST /api/v1/customer-recovery/ai-generate */
export async function generateRecoveryAiApi(payload: {
  bucket?: number;
  restaurant_name?: string;
  offer_type?: string;
  tone?: string;
  language?: string;
}): Promise<{ title: string; message: string; cta: string }> {
  const res = await apiFetch("/api/v1/customer-recovery/ai-generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to generate AI recovery copy (HTTP ${res.status})`));
  }
  return res.json();
}

/** 11. POST /api/v1/customer-recovery/mark-recovered/{customer_id} */
export async function markCustomerRecoveredApi(customerId: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch(`/api/v1/customer-recovery/mark-recovered/${customerId}`, {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to mark customer as recovered (HTTP ${res.status})`));
  }
  return res.json();
}

/** 12. POST /api/v1/customer-recovery/exclude/{customer_id} */
export async function excludeCustomerApi(customerId: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch(`/api/v1/customer-recovery/exclude/${customerId}`, {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to exclude customer (HTTP ${res.status})`));
  }
  return res.json();
}

/** 13. DELETE /api/v1/customer-recovery/exclude/{customer_id} - undo exclusion */
export async function unexcludeCustomerApi(customerId: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch(`/api/v1/customer-recovery/exclude/${customerId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to re-include customer (HTTP ${res.status})`));
  }
  return res.json();
}
