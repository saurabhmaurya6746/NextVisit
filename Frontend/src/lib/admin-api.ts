import { apiFetch } from "./auth";

// 1. Admin Dashboard API
export interface AdminDashboardKpis {
  total_clients: number;
  active_clients: number;
  pending_clients: number;
  trial_clients: number;
  expired_clients: number;
  monthly_revenue: number;
  total_revenue: number;
  active_campaigns: number;
  total_customers: number;
  coupons_redeemed: number;
  new_clients_this_month: number;
  churn_rate: number;
  pending_approvals: number;
}

export interface RevenueGrowthPoint {
  month: string;
  revenue: number;
}

export interface ClientGrowthPoint {
  month: string;
  count: number;
}

export interface AdminDashboardAnalytics {
  revenue_growth: RevenueGrowthPoint[];
  client_growth: ClientGrowthPoint[];
  coupon_usage: any[];
}

export interface RecentActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

export interface AdminDashboardSummary {
  total_restaurants: number;
  total_salons: number;
  total_businesses: number;
  active_percentage: number;
  pending_percentage: number;
  rejected_percentage: number;
  suspended_percentage: number;
}

export interface AdminDashboardResponse {
  kpis: AdminDashboardKpis;
  analytics: AdminDashboardAnalytics;
  summary: AdminDashboardSummary;
  recent_activity: RecentActivityItem[];
}

export async function getAdminDashboardApi(): Promise<AdminDashboardResponse> {
  const res = await apiFetch("/api/v1/admin/dashboard");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to fetch admin dashboard");
  }
  return await res.json();
}

// 2. Admin Approvals APIs
export interface BusinessTypeModel {
  id: string;
  name: string;
}

export interface BusinessApprovalModel {
  id: string;
  name: string;
  owner_name: string;
  email: string;
  phone: string;
  country: string;
  currency: string;
  timezone: string;
  address: string;
  logo_url: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
  business_type: BusinessTypeModel | null;
}

export interface PaginatedApprovalResponse {
  items: BusinessApprovalModel[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function listPendingApprovalsApi(
  page = 1,
  pageSize = 10,
  search?: string,
  businessTypeId?: string
): Promise<PaginatedApprovalResponse> {
  const params = new URLSearchParams();
  params.set("page", page.toString());
  params.set("page_size", pageSize.toString());
  if (search) params.set("search", search);
  if (businessTypeId) params.set("business_type_id", businessTypeId);

  const res = await apiFetch(`/api/v1/admin/approvals?${params.toString()}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to fetch pending approvals");
  }
  return await res.json();
}

export async function getApprovalDetailsApi(businessId: string): Promise<BusinessApprovalModel> {
  const res = await apiFetch(`/api/v1/admin/approvals/${businessId}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to fetch approval details");
  }
  return await res.json();
}

export async function approveBusinessApi(businessId: string): Promise<BusinessApprovalModel> {
  const res = await apiFetch(`/api/v1/admin/approvals/${businessId}/approve`, {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to approve business");
  }
  return await res.json();
}

export async function rejectBusinessApi(businessId: string, reason?: string): Promise<BusinessApprovalModel> {
  const res = await apiFetch(`/api/v1/admin/approvals/${businessId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to reject business");
  }
  return await res.json();
}

// 3. Admin Client Management APIs
export interface ClientListItemModel {
  id: string;
  name: string;
  owner_name: string;
  email: string;
  phone: string;
  country: string;
  subscription_status: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  last_login: string | null;
  business_type: BusinessTypeModel | null;
}

export interface PaginatedClientListResponse {
  items: ClientListItemModel[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ClientStatsModel {
  customer_count: number;
  service_count: number;
  visit_count: number;
  campaign_count: number;
  loyalty_enabled: boolean;
}

export interface ClientDetailModel {
  id: string;
  name: string;
  owner_name: string;
  email: string;
  phone: string;
  country: string;
  currency: string;
  timezone: string;
  address: string;
  logo_url: string | null;
  subscription_status: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
  last_login: string | null;
  business_type: BusinessTypeModel | null;
  stats: ClientStatsModel;
  settings: Record<string, any> | null;
}

export async function listAdminClientsApi(
  page = 1,
  pageSize = 10,
  search?: string,
  status?: string,
  businessTypeId?: string,
  subscriptionStatus?: string,
  country?: string,
  sortBy = "newest"
): Promise<PaginatedClientListResponse> {
  const params = new URLSearchParams();
  params.set("page", page.toString());
  params.set("page_size", pageSize.toString());
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (businessTypeId) params.set("business_type_id", businessTypeId);
  if (subscriptionStatus) params.set("subscription_status", subscriptionStatus);
  if (country) params.set("country", country);
  if (sortBy) params.set("sort_by", sortBy);

  const res = await apiFetch(`/api/v1/admin/clients?${params.toString()}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to fetch clients list");
  }
  return await res.json();
}

export async function getAdminClientDetailApi(businessId: string): Promise<ClientDetailModel> {
  const res = await apiFetch(`/api/v1/admin/clients/${businessId}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to fetch client detail");
  }
  return await res.json();
}

export async function updateAdminClientStatusApi(
  businessId: string,
  status: "ACTIVE" | "SUSPENDED" | "PENDING" | "REJECTED"
): Promise<ClientDetailModel> {
  const res = await apiFetch(`/api/v1/admin/clients/${businessId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to update client status");
  }
  return await res.json();
}

export async function deleteAdminClientApi(businessId: string): Promise<{ message: string }> {
  const res = await apiFetch(`/api/v1/admin/clients/${businessId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to delete client");
  }
  return await res.json();
}

export async function impersonateAdminClientApi(businessId: string): Promise<{ access_token: string; token_type: string; business_id: string; business_name: string }> {
  const res = await apiFetch(`/api/v1/admin/clients/${businessId}/impersonate`, {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to impersonate merchant");
  }
  return await res.json();
}

// 4. Admin Subscriptions APIs
export interface SubscriptionPlanModel {
  id: string;
  name: string;
  monthly_price: number;
  trial_days: number;
  max_customers: number;
  max_staff: number;
  max_campaigns_per_month: number;
  storage_limit_gb: number;
  features: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessSubscriptionItemModel {
  business_id: string;
  business_name: string;
  owner_name: string;
  email: string;
  current_plan: SubscriptionPlanModel | null;
  subscription_status: string;
  status: string;
  trial_end: string | null;
  expiry_date: string | null;
  created_at: string;
}

export async function listSubscriptionPlansApi(): Promise<SubscriptionPlanModel[]> {
  const res = await apiFetch("/api/v1/admin/subscriptions/plans");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to fetch subscription plans");
  }
  return await res.json();
}

export async function createSubscriptionPlanApi(payload: Partial<SubscriptionPlanModel>): Promise<SubscriptionPlanModel> {
  const res = await apiFetch("/api/v1/admin/subscriptions/plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to create subscription plan");
  }
  return await res.json();
}

export async function updateSubscriptionPlanApi(planId: string, payload: Partial<SubscriptionPlanModel>): Promise<SubscriptionPlanModel> {
  const res = await apiFetch(`/api/v1/admin/subscriptions/plans/${planId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to update subscription plan");
  }
  return await res.json();
}

export async function deleteSubscriptionPlanApi(planId: string): Promise<{ message: string }> {
  const res = await apiFetch(`/api/v1/admin/subscriptions/plans/${planId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to delete subscription plan");
  }
  return await res.json();
}

export async function assignBusinessSubscriptionApi(
  businessId: string,
  payload: { plan_id: string; trial_days?: number; expiry_date?: string; notes?: string }
): Promise<BusinessSubscriptionItemModel> {
  const res = await apiFetch(`/api/v1/admin/subscriptions/business/${businessId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to assign subscription");
  }
  return await res.json();
}

export async function listBusinessSubscriptionsApi(): Promise<BusinessSubscriptionItemModel[]> {
  const res = await apiFetch("/api/v1/admin/subscriptions/business");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to fetch business subscriptions");
  }
  return await res.json();
}

export interface AdminUpgradeRequestItem {
  id: string;
  business_id: string;
  business_name: string;
  owner_name: string;
  email: string;
  current_plan: SubscriptionPlanModel | null;
  requested_plan: SubscriptionPlanModel;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string | null;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
}

export interface PaginatedAdminUpgradeRequests {
  items: AdminUpgradeRequestItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export async function listAdminUpgradeRequestsApi(
  page = 1,
  limit = 10,
  status = "ALL",
  search = ""
): Promise<PaginatedAdminUpgradeRequests> {
  const params = new URLSearchParams();
  params.set("page", page.toString());
  params.set("limit", limit.toString());
  if (status) params.set("status", status);
  if (search) params.set("search", search);

  const res = await apiFetch(`/api/v1/admin/subscriptions/requests?${params.toString()}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to fetch subscription requests");
  }
  return await res.json();
}

export async function approveUpgradeRequestApi(requestId: string): Promise<AdminUpgradeRequestItem> {
  const res = await apiFetch(`/api/v1/admin/subscriptions/requests/${requestId}/approve`, {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to approve upgrade request");
  }
  return await res.json();
}

export async function rejectUpgradeRequestApi(requestId: string, reason: string): Promise<AdminUpgradeRequestItem> {
  const res = await apiFetch(`/api/v1/admin/subscriptions/requests/${requestId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to reject upgrade request");
  }
  return await res.json();
}

// 5. Admin System Settings APIs
export interface PlatformSettingsModel {
  id: string;
  platform_name: string;
  logo_url: string | null;
  support_email: string;
  default_plan: string;
  trial_days: number;
  default_currency: string;
  max_clients: number;
  maintenance_mode: boolean;
  allow_new_registrations: boolean;
  created_at: string;
  updated_at: string;
}

export async function getPlatformSettingsApi(): Promise<PlatformSettingsModel> {
  const res = await apiFetch("/api/v1/admin/settings");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to fetch platform settings");
  }
  return await res.json();
}

export async function updatePlatformSettingsApi(payload: Partial<PlatformSettingsModel>): Promise<PlatformSettingsModel> {
  const res = await apiFetch("/api/v1/admin/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to update platform settings");
  }
  return await res.json();
}
