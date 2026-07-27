import { apiFetch } from "./auth";

export interface BackendLoyaltySettings {
  id: string;
  business_id: string;
  points_per_amount: number;
  amount_required: number;
  redeem_rate: number;
  minimum_redeem_points: number;
  is_active: boolean;
}

export interface LoyaltySettingsUpdatePayload {
  points_per_amount?: number;
  amount_required?: number;
  redeem_rate?: number;
  minimum_redeem_points?: number;
  is_active?: boolean;
}

export interface CustomerLoyaltyData {
  id: string;
  customer_id: string;
  current_points: number;
  lifetime_points: number;
  redeemed_points: number;
}

export interface LoyaltyRedeemPayload {
  customer_id: string;
  points: number;
}

export interface LoyaltyRedeemResult {
  customer_id: string;
  points_redeemed: number;
  discount_amount: number;
  remaining_points: number;
}

/**
 * 1. GET /api/v1/loyalty/settings - Fetch current loyalty program settings
 */
export async function getLoyaltySettingsApi(): Promise<BackendLoyaltySettings> {
  const res = await apiFetch("/api/v1/loyalty/settings");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 2. PUT /api/v1/loyalty/settings - Update loyalty program settings
 */
export async function updateLoyaltySettingsApi(
  payload: LoyaltySettingsUpdatePayload
): Promise<BackendLoyaltySettings> {
  const res = await apiFetch("/api/v1/loyalty/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to update loyalty settings (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 3. GET /api/v1/loyalty/customer/{customer_id} - Get customer loyalty balance & stats
 */
export async function getCustomerLoyaltyApi(customerId: string): Promise<CustomerLoyaltyData> {
  const res = await apiFetch(`/api/v1/loyalty/customer/${customerId}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to fetch customer loyalty (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 4. POST /api/v1/loyalty/redeem - Redeem customer loyalty points for discount
 */
export async function redeemLoyaltyPointsApi(
  payload: LoyaltyRedeemPayload
): Promise<LoyaltyRedeemResult> {
  const res = await apiFetch("/api/v1/loyalty/redeem", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to redeem points (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}
