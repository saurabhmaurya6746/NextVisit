import { apiFetch } from "./auth";

export interface ReportFilterParams {
  date_range?: string;
  start_date?: string;
  end_date?: string;
  payment_method?: string;
  booking_source?: string;
  staff_id?: string;
  service_area_id?: string;
  chair_id?: string;
  customer_type?: string;
  membership?: string;
  campaign_type?: string;
  status?: string;
}

export interface FilterOptionItem {
  id: string;
  name: string;
}

export interface ReportFilterOptionsResponse {
  staff: FilterOptionItem[];
  service_areas: FilterOptionItem[];
  chairs: FilterOptionItem[];
}

export interface ReportsKpiSummary {
  total_revenue: number;
  gross_sales: number;
  discounts: number;
  taxable_sales: number;
  gst_collected: number;
  net_revenue: number;
  total_appointments_or_orders: number;
  completed_visits: number;
  cancelled_visits: number;
  average_order_or_service_value: number;
  average_daily_revenue: number;
  total_customers: number;
  new_customers: number;
  returning_customers: number;
  repeat_rate_pct: number;
  total_loyalty_points_earned: number;
  coupons_redeemed: number;
  campaign_revenue: number;
  discount_given: number;
}

export interface TimeSeriesPoint {
  label: string;
  revenue: number;
  net_revenue: number;
  count: number;
  completed: number;
  cancelled: number;
}

export interface CustomerGrowthPoint {
  label: string;
  new_customers: number;
  returning_customers: number;
}

export interface BreakdownPieItem {
  name: string;
  value: number;
  count: number;
}

export interface CategoryBreakdownItem {
  name: string;
  revenue: number;
  quantity: number;
}

export interface StaffPerformanceItem {
  staff_id: string;
  name: string;
  designation?: string | null;
  appointments_completed: number;
  revenue_generated: number;
  average_rating: number;
  average_ticket_size: number;
  working_hours: number;
  commission_earned: number;
  rank: string;
}

export interface ServicePerformanceItem {
  service_id: string;
  service_name: string;
  category_name: string;
  booked_count: number;
  total_revenue: number;
  avg_duration_minutes: number;
  is_top: boolean;
  is_lowest: boolean;
}

export interface WorkstationUtilizationItem {
  chair_id: string;
  chair_name: string;
  service_area_name: string;
  usage_pct: number;
  appointments_count: number;
}

export interface CustomerDemographics {
  male_count: number;
  female_count: number;
  other_count: number;
  birthday_customers_in_period: number;
  anniversary_customers_in_period: number;
  vip_count: number;
  regular_count: number;
}

export interface SalonSpecificReports {
  staff_performance: StaffPerformanceItem[];
  service_performance: ServicePerformanceItem[];
  workstation_utilization: WorkstationUtilizationItem[];
  customer_demographics: CustomerDemographics;
}

export interface TableUtilizationItem {
  table_id: string;
  table_name: string;
  dining_area_name: string;
  orders_count: number;
  total_revenue: number;
  avg_dining_minutes: number;
}

export interface MenuItemSalesItem {
  menu_item_id: string;
  item_name: string;
  category_name: string;
  quantity_sold: number;
  total_revenue: number;
  is_top: boolean;
  is_lowest: boolean;
}

export interface OrderTypeBreakdownItem {
  order_type: string;
  count: number;
  revenue: number;
}

export interface RestaurantSpecificReports {
  table_utilization: TableUtilizationItem[];
  menu_item_sales: MenuItemSalesItem[];
  order_type_breakdown: OrderTypeBreakdownItem[];
}

export interface TopCustomerReportItem {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  visits: number;
  lifetime_spend: number;
  average_spend: number;
  last_visit?: string | null;
  membership?: string | null;
  loyalty_points: number;
  total_coupons_used: number;
}

export interface CampaignReportItem {
  campaign_type: string;
  name: string;
  messages_sent: number;
  delivered: number;
  failed: number;
  read: number;
  clicked: number;
  coupons_used: number;
  revenue_generated: number;
  conversion_rate_pct: number;
}

export interface LoyaltyReportSummary {
  points_earned: number;
  points_redeemed: number;
  points_expired: number;
  top_loyalty_customers: TopCustomerReportItem[];
}

export interface BiReportsAnalyticsResponse {
  business_type: string;
  business_name: string;
  applied_period_label: string;
  start_date: string;
  end_date: string;

  kpi_summary: ReportsKpiSummary;
  revenue_trend: TimeSeriesPoint[];
  appointments_or_orders_trend: TimeSeriesPoint[];
  customer_growth_trend: CustomerGrowthPoint[];
  revenue_by_payment_method: BreakdownPieItem[];
  revenue_by_booking_source: BreakdownPieItem[];
  top_categories_chart: CategoryBreakdownItem[];

  salon_reports?: SalonSpecificReports | null;
  restaurant_reports?: RestaurantSpecificReports | null;

  top_customers: TopCustomerReportItem[];
  campaign_reports: CampaignReportItem[];
  loyalty_reports: LoyaltyReportSummary;
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

function buildQueryString(params?: ReportFilterParams): string {
  if (!params) return "";
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== "all") {
      q.append(k, String(v));
    }
  });
  const str = q.toString();
  return str ? `?${str}` : "";
}

/** 1. GET /api/v1/reports */
export async function getBiReportsAnalyticsApi(filters?: ReportFilterParams): Promise<BiReportsAnalyticsResponse> {
  const qs = buildQueryString(filters);
  const res = await apiFetch(`/api/v1/reports${qs}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to fetch BI reports (HTTP ${res.status})`));
  }
  return await res.json();
}

/** 2. GET /api/v1/reports/filter-options */
export async function getReportFilterOptionsApi(): Promise<ReportFilterOptionsResponse> {
  const res = await apiFetch("/api/v1/reports/filter-options");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to fetch report filter options (HTTP ${res.status})`));
  }
  return await res.json();
}

/** 3. GET /api/v1/reports/pdf */
export async function downloadReportsPdfApi(filters?: ReportFilterParams): Promise<void> {
  const qs = buildQueryString(filters);
  const res = await apiFetch(`/api/v1/reports/pdf${qs}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to generate PDF report (HTTP ${res.status})`));
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BI_Analytics_Report_${filters?.date_range || "custom"}_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/** 4. GET /api/v1/reports/excel */
export async function downloadReportsExcelApi(filters?: ReportFilterParams): Promise<void> {
  const qs = buildQueryString(filters);
  const res = await apiFetch(`/api/v1/reports/excel${qs}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to generate Excel report (HTTP ${res.status})`));
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BI_Analytics_Report_${filters?.date_range || "custom"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/** 5. GET /api/v1/reports/csv */
export async function downloadReportsCsvApi(filters?: ReportFilterParams): Promise<void> {
  const qs = buildQueryString(filters);
  const res = await apiFetch(`/api/v1/reports/csv${qs}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to generate CSV report (HTTP ${res.status})`));
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BI_Analytics_Report_${filters?.date_range || "custom"}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
