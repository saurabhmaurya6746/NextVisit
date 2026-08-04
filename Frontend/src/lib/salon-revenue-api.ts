import { apiFetch } from "./auth";

export interface SalonRevenueAnalyticsData {
  top_cards: {
    today_revenue: number;
    yesterday_revenue: number;
    this_week_revenue: number;
    this_month_revenue: number;
    this_year_revenue: number;
    total_revenue: number;
    paid_appointments: number;
    pending_payments: number;
    average_service_value: number;
    today_vs_yesterday_pct: number;
    week_vs_last_week_pct: number;
    month_vs_last_month_pct: number;
    year_vs_last_year_pct: number;
  };
  charts: {
    daily_trend: Array<{ label: string; sales: number }>;
    yearly_trend: Array<{ label: string; sales: number }>;
    revenue_by_payment_method: Array<{ method: string; amount: number }>;
    revenue_by_service_category: Array<{ category: string; revenue: number; bookings: number }>;
    revenue_by_staff: Array<{ staff_name: string; revenue: number; bookings: number }>;
    revenue_by_service_area: Array<{ area_name: string; revenue: number; bookings: number }>;
  };
  analytics: {
    top_services: Array<{ service_name: string; booking_count: number; revenue: number }>;
    top_staff: Array<{ staff_name: string; revenue: number; bookings: number }>;
    gst_collected: number;
    discount_given: number;
    net_revenue: number;
    outstanding_payments: number;
    repeat_client_rate: number;
    new_customer_revenue: number;
    returning_customer_revenue: number;
  };
}

export async function getSalonRevenueAnalyticsApi(period: string = "this_month"): Promise<SalonRevenueAnalyticsData> {
  const res = await apiFetch(`/api/v1/salon/revenue/analytics?period=${period}`);
  if (!res.ok) {
    throw new Error("Failed to fetch Salon revenue analytics");
  }
  return await res.json();
}
