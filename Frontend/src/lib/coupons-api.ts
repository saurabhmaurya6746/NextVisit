import { apiFetch } from "./auth";

export interface CouponItem {
  id: string;
  business_id: string;
  code: string;
  name: string;
  description: string | null;
  coupon_type: "PERCENTAGE" | "FLAT" | "FREE_ITEM" | "BOGO" | string;
  reward_value: number;
  reward_description: string | null;
  max_discount_amount: number | null;
  min_order_amount: number;
  max_usage: number | null;
  per_customer_limit: number;
  redeemed_count: number;
  valid_from: string | null;
  valid_until: string | null;
  applicable_segment: string;
  status: string;
  is_deleted: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  computed_status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "UPCOMING" | "DELETED" | string;
}

export interface PaginatedCouponsResponse {
  items: CouponItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface CouponCreatePayload {
  code: string;
  name: string;
  description?: string;
  coupon_type: string;
  reward_value: number;
  reward_description?: string;
  max_discount_amount?: number;
  min_order_amount?: number;
  max_usage?: number;
  per_customer_limit?: number;
  valid_from?: string;
  valid_until?: string;
  applicable_segment?: string;
  status?: string;
}

export interface CouponValidatePayload {
  code: string;
  customer_id?: string;
  order_amount?: number;
}

export interface CouponValidateResponse {
  valid: boolean;
  reason: string | null;
  calculated_discount: number;
  coupon?: CouponItem;
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
 * 1. GET /api/v1/coupons
 */
export async function getCouponsApi(params: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
}): Promise<PaginatedCouponsResponse> {
  const query = new URLSearchParams({
    status: params.status || "all",
    page: String(params.page || 1),
    page_size: String(params.pageSize || 20),
    sort_by: params.sortBy || "recent",
  });
  if (params.search && params.search.trim()) {
    query.set("search", params.search.trim());
  }

  const res = await apiFetch(`/api/v1/coupons?${query.toString()}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to fetch coupons (HTTP ${res.status})`));
  }
  return await res.json();
}

/**
 * 2. POST /api/v1/coupons
 */
export async function createCouponApi(payload: CouponCreatePayload): Promise<CouponItem> {
  const res = await apiFetch("/api/v1/coupons", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to create coupon (HTTP ${res.status})`));
  }
  return await res.json();
}

/**
 * 3. DELETE /api/v1/coupons/{id}
 */
export async function deleteCouponApi(couponId: string): Promise<{ id: string; code: string; message: string }> {
  const res = await apiFetch(`/api/v1/coupons/${couponId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to delete coupon (HTTP ${res.status})`));
  }
  return await res.json();
}

/**
 * 4. POST /api/v1/coupons/validate
 */
export async function validateCouponApi(payload: CouponValidatePayload): Promise<CouponValidateResponse> {
  const res = await apiFetch("/api/v1/coupons/validate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to validate coupon (HTTP ${res.status})`));
  }
  return await res.json();
}

/**
 * 5. POST /api/v1/coupons/redeem
 */
export async function redeemCouponApi(payload: {
  code: string;
  customer_id?: string;
  order_amount?: number;
  order_id?: string;
  visit_id?: string;
}): Promise<{ redemption_id: string; coupon_code: string; discount_applied: number; new_redeemed_count: number }> {
  const res = await apiFetch("/api/v1/coupons/redeem", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to redeem coupon (HTTP ${res.status})`));
  }
  return await res.json();
}
