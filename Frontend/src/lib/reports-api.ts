import { apiFetch } from "./auth";

export interface RevenueSeriesItem {
  day: string;
  sales: number;
}

export interface BookingsSeriesItem {
  day: string;
  bookings: number;
}

export interface TopCustomerItem {
  id: string;
  name: string;
  visits: number;
  spent: number;
}

export interface TopSellingItem {
  name: string;
  sold: number;
  revenue: number;
}

export interface CampaignPerformanceItem {
  name: string;
  sent: number;
  opened: number;
  converted: number;
}

export interface ReportsSummary {
  total_revenue: number;
  total_bookings: number;
  total_customers: number;
  total_campaigns: number;
}

export interface ReportsAnalyticsResponse {
  revenue_series: RevenueSeriesItem[];
  bookings_series: BookingsSeriesItem[];
  top_customers: TopCustomerItem[];
  top_items: TopSellingItem[];
  campaign_performance: CampaignPerformanceItem[];
  summary: ReportsSummary;
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
 * 1. GET /api/v1/reports
 */
export async function getReportsAnalyticsApi(): Promise<ReportsAnalyticsResponse> {
  const res = await apiFetch("/api/v1/reports");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to fetch reports analytics (HTTP ${res.status})`));
  }
  return await res.json();
}

/**
 * 2. GET /api/v1/reports/pdf — Downloads PDF analytics report
 */
export async function downloadReportsPdfApi(): Promise<void> {
  const res = await apiFetch("/api/v1/reports/pdf");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(parseErrorDetail(errData, `Failed to generate PDF report (HTTP ${res.status})`));
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Business_Analytics_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
