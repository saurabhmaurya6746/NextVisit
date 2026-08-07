import { apiFetch } from "./auth";

export interface VipSettings {
  id: string;
  business_id: string;
  min_lifetime_spend: number;
  min_visits: number;
  min_avg_bill: number;
  last_visit_within_days: number | null;
  rule_logic: "ANY" | "ALL" | string;
  is_active: boolean;
  formatted_rule_display: string;
}

export interface VipSettingsUpdatePayload {
  min_lifetime_spend: number;
  min_visits: number;
  min_avg_bill: number;
  last_visit_within_days: number | null;
  rule_logic: "ANY" | "ALL";
  is_active: boolean;
}

export interface VipCustomerItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  visit_count: number;
  total_spent: number;
  avg_bill: number;
  loyalty_points: number;
  favorite_item: string;
  vip_since_date: string | null;
  last_visit_at: string | null;
  first_visit_at: string | null;
  created_at: string | null;
  status: string;
  segment: string;
  reason_qualified: string;
}

export interface VipDashboardResponse {
  summary: {
    total_vip: number;
    total_lifetime_spend: number;
    avg_visits: number;
    avg_lifetime_spend: number;
    total_loyalty_points: number;
    formatted_rule_display: string;
  };
  settings: VipSettings;
  items: VipCustomerItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export async function getVipCustomersApi(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  sort_by?: string;
}): Promise<VipDashboardResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set("page", params.page.toString());
  if (params?.page_size) queryParams.set("page_size", params.page_size.toString());
  if (params?.search) queryParams.set("search", params.search);
  if (params?.sort_by) queryParams.set("sort_by", params.sort_by);

  const url = `/api/v1/customers/vip${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const res = await apiFetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch VIP customers (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function getVipSettingsApi(): Promise<VipSettings> {
  const res = await apiFetch("/api/v1/business-settings/vip");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch VIP settings (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function updateVipSettingsApi(payload: VipSettingsUpdatePayload): Promise<VipSettings> {
  const res = await apiFetch("/api/v1/business-settings/vip", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update VIP settings (HTTP ${res.status})`);
  }
  return await res.json();
}
