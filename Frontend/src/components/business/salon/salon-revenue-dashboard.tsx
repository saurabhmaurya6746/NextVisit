import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, TrendingUp, Calendar, Users, Scissors, Award,
  Percent, ChevronUp, ChevronDown, CreditCard, Banknote, Smartphone,
  Sparkles, CheckCircle2, Clock, Receipt, RefreshCw, BarChart2, PieChart,
  UserCheck, Tag, ArrowUpRight, ArrowDownRight, Layers
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkeletonRows, SkeletonCustomerCards } from "@/components/skeletons";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line
} from "recharts";
import { fmt } from "@/lib/currency";
import { useAppointments } from "@/lib/appointments-store";
import {
  getSalonRevenueAnalyticsApi,
  type SalonRevenueAnalyticsData
} from "@/lib/salon-revenue-api";

export function SalonRevenueDashboard() {
  const appts = useAppointments();
  const [data, setData] = useState<SalonRevenueAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>("this_month");

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSalonRevenueAnalyticsApi(period);
      setData(res);
    } catch (err) {
      console.error("❌ Failed to fetch Salon revenue analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  // Local fallback calculations from appointments store
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const currentDayOfWeek = now.getDay();
  const distToMon = (currentDayOfWeek + 6) % 7;
  const monDate = new Date(now);
  monDate.setDate(now.getDate() - distToMon);
  monDate.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const paidAppts = appts.filter((a) => {
    if (a.status === "cancelled") return false;
    return a.paymentStatus === "paid" || a.status === "completed" || !!a.paidAt;
  });

  const localTodayAppts = paidAppts.filter((a) => (a.start ? a.start.slice(0, 10) : "") === todayStr);
  const localTodayRevenue = localTodayAppts.reduce((sum, a) => sum + (a.price || 0), 0);

  const localYesterdayAppts = paidAppts.filter((a) => (a.start ? a.start.slice(0, 10) : "") === yesterdayStr);
  const localYesterdayRevenue = localYesterdayAppts.reduce((sum, a) => sum + (a.price || 0), 0);

  const localWeekAppts = paidAppts.filter((a) => a.start && new Date(a.start) >= monDate);
  const localWeekRevenue = localWeekAppts.reduce((sum, a) => sum + (a.price || 0), 0);

  const localMonthAppts = paidAppts.filter((a) => a.start && new Date(a.start) >= monthStart);
  const localMonthRevenue = localMonthAppts.reduce((sum, a) => sum + (a.price || 0), 0);

  const localYearAppts = paidAppts.filter((a) => a.start && new Date(a.start) >= yearStart);
  const localYearRevenue = localYearAppts.reduce((sum, a) => sum + (a.price || 0), 0);

  const localTotalRevenue = paidAppts.reduce((sum, a) => sum + (a.price || 0), 0);
  const localPaidCount = paidAppts.length;
  const localAvgServiceValue = localPaidCount > 0 ? Math.round(localTotalRevenue / localPaidCount) : 0;

  // Chart Fallbacks
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const localDailyTrend = daysOfWeek.map((dayLabel, idx) => {
    const d = new Date(monDate);
    d.setDate(monDate.getDate() + idx);
    const dStr = d.toISOString().slice(0, 10);
    const daySales = paidAppts
      .filter((a) => (a.start ? a.start.slice(0, 10) : "") === dStr)
      .reduce((sum, a) => sum + (a.price || 0), 0);
    return { label: dayLabel, sales: daySales };
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentYr = now.getFullYear();
  const localYearlyTrend = monthNames.map((mLabel, mIdx) => {
    const mSales = paidAppts
      .filter((a) => {
        if (!a.start) return false;
        const d = new Date(a.start);
        return d.getFullYear() === currentYr && d.getMonth() === mIdx;
      })
      .reduce((sum, a) => sum + (a.price || 0), 0);
    return { label: mLabel, sales: mSales };
  });

  const payMethodMap: Record<string, number> = { Cash: 0, UPI: 0, Card: 0 };
  paidAppts.forEach((a) => {
    const pm = (a.paymentMethod || "CASH").toUpperCase();
    const amt = a.price || 0;
    if (pm.includes("CARD")) payMethodMap["Card"] += amt;
    else if (pm.includes("UPI") || pm.includes("ONLINE")) payMethodMap["UPI"] += amt;
    else payMethodMap["Cash"] += amt;
  });
  const localPaymentBreakdown = [
    { method: "Cash", amount: payMethodMap["Cash"] },
    { method: "UPI", amount: payMethodMap["UPI"] },
    { method: "Card", amount: payMethodMap["Card"] },
  ];

  const staffMap: Record<string, { bookings: number; revenue: number }> = {};
  paidAppts.forEach((a) => {
    const st = a.staff?.trim() || "Unassigned Staff";
    if (!staffMap[st]) staffMap[st] = { bookings: 0, revenue: 0 };
    staffMap[st].bookings += 1;
    staffMap[st].revenue += (a.price || 0);
  });
  const localStaffBreakdown = Object.entries(staffMap).map(([staff_name, d]) => ({
    staff_name,
    bookings: d.bookings,
    revenue: d.revenue,
  }));

  const serviceMap: Record<string, { booking_count: number; revenue: number }> = {};
  paidAppts.forEach((a) => {
    const list = a.services && a.services.length > 0 ? a.services : [{ name: a.service, price: a.price }];
    list.forEach((s) => {
      const sName = s.name || "General Service";
      if (!serviceMap[sName]) serviceMap[sName] = { booking_count: 0, revenue: 0 };
      serviceMap[sName].booking_count += 1;
      serviceMap[sName].revenue += (s.price || ((a.price || 0) / list.length));
    });
  });
  const localTopServices = Object.entries(serviceMap)
    .map(([service_name, d]) => ({
      service_name,
      booking_count: d.booking_count,
      revenue: d.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  if (loading && !data) {
    return (
      <PageTransition>
        <PageHeader title="Salon Revenue Analytics" description="Paid appointments & settled services · Real-time backend connected" />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <SkeletonCustomerCards count={4} />
          </div>
          <SkeletonRows rows={8} cols={4} />
        </div>
      </PageTransition>
    );
  }

  const dbTop = data?.top_cards;
  const dbCharts = data?.charts;
  const dbAnalytics = data?.analytics;

  const todayRevenue = (dbTop?.today_revenue ?? 0) > 0 ? dbTop!.today_revenue : Math.max(dbTop?.today_revenue ?? 0, localTodayRevenue);
  const yesterdayRevenue = (dbTop?.yesterday_revenue ?? 0) > 0 ? dbTop!.yesterday_revenue : Math.max(dbTop?.yesterday_revenue ?? 0, localYesterdayRevenue);
  const thisWeekRevenue = (dbTop?.this_week_revenue ?? 0) > 0 ? dbTop!.this_week_revenue : Math.max(dbTop?.this_week_revenue ?? 0, localWeekRevenue);
  const thisMonthRevenue = (dbTop?.this_month_revenue ?? 0) > 0 ? dbTop!.this_month_revenue : Math.max(dbTop?.this_month_revenue ?? 0, localMonthRevenue);
  const thisYearRevenue = (dbTop?.this_year_revenue ?? 0) > 0 ? dbTop!.this_year_revenue : Math.max(dbTop?.this_year_revenue ?? 0, localYearRevenue);
  const totalRevenue = (dbTop?.total_revenue ?? 0) > 0 ? dbTop!.total_revenue : Math.max(dbTop?.total_revenue ?? 0, localTotalRevenue);
  const paidAppointments = (dbTop?.paid_appointments ?? 0) > 0 ? dbTop!.paid_appointments : Math.max(dbTop?.paid_appointments ?? 0, localPaidCount);
  const averageServiceValue = (dbTop?.average_service_value ?? 0) > 0 ? dbTop!.average_service_value : (paidAppointments > 0 ? Math.round(totalRevenue / paidAppointments) : localAvgServiceValue);

  const dailyTrend = (dbCharts?.daily_trend && dbCharts.daily_trend.some((d: any) => d.sales > 0)) ? dbCharts.daily_trend : localDailyTrend;
  const yearlyTrend = (dbCharts?.yearly_trend && dbCharts.yearly_trend.some((d: any) => d.sales > 0)) ? dbCharts.yearly_trend : localYearlyTrend;
  const paymentBreakdown = (dbCharts?.revenue_by_payment_method && dbCharts.revenue_by_payment_method.some((p: any) => p.amount > 0)) ? dbCharts.revenue_by_payment_method : localPaymentBreakdown;
  const staffBreakdown = (dbCharts?.revenue_by_staff && dbCharts.revenue_by_staff.length > 0) ? dbCharts.revenue_by_staff : localStaffBreakdown;
  const topServices = (dbAnalytics?.top_services && dbAnalytics.top_services.length > 0) ? dbAnalytics.top_services : localTopServices;

  const formatPct = (val: number | undefined) => {
    if (val === undefined || val === 0) return null;
    const isPos = val > 0;
    return (
      <span className={`inline-flex items-center text-xs font-semibold ${isPos ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
        {isPos ? <ArrowUpRight className="mr-0.5 h-3 w-3" /> : <ArrowDownRight className="mr-0.5 h-3 w-3" />}
        {Math.abs(val)}% vs last period
      </span>
    );
  };

  return (
    <PageTransition>
      <PageHeader
        title="Salon Revenue Analytics"
        description="Comprehensive financial metrics for salon services, staff performance, and appointment payments"
        actions={
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px] h-9 text-xs rounded-full bg-background border">
                <Calendar className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 rounded-full px-3 text-xs" onClick={fetchRevenue}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        }
      />

      {/* 1. TOP KPI CARDS */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label="Today's Revenue"
          value={fmt(todayRevenue)}
          delta={dbTop?.today_vs_yesterday_pct ? `${dbTop.today_vs_yesterday_pct}% vs yesterday` : "Real-time today"}
          trend={dbTop?.today_vs_yesterday_pct && dbTop.today_vs_yesterday_pct < 0 ? "down" : "up"}
          icon={DollarSign}
          accent="primary"
        />
        <StatCard
          label="Yesterday Revenue"
          value={fmt(yesterdayRevenue)}
          delta="Previous day settled"
          trend="neutral"
          icon={Clock}
          accent="accent"
        />
        <StatCard
          label="This Week Revenue"
          value={fmt(thisWeekRevenue)}
          delta={dbTop?.week_vs_last_week_pct ? `${dbTop.week_vs_last_week_pct}% vs last week` : "Current week total"}
          trend={dbTop?.week_vs_last_week_pct && dbTop.week_vs_last_week_pct < 0 ? "down" : "up"}
          icon={TrendingUp}
          accent="info"
        />
        <StatCard
          label="This Month Revenue"
          value={fmt(thisMonthRevenue)}
          delta={dbTop?.month_vs_last_month_pct ? `${dbTop.month_vs_last_month_pct}% vs last month` : "Current month total"}
          trend={dbTop?.month_vs_last_month_pct && dbTop.month_vs_last_month_pct < 0 ? "down" : "up"}
          icon={Calendar}
          accent="primary"
        />
        <StatCard
          label="This Year Revenue"
          value={fmt(thisYearRevenue)}
          delta={dbTop?.year_vs_last_year_pct ? `${dbTop.year_vs_last_year_pct}% vs last year` : "Annual total"}
          trend={dbTop?.year_vs_last_year_pct && dbTop.year_vs_last_year_pct < 0 ? "down" : "up"}
          icon={Award}
          accent="warning"
        />
        <StatCard
          label="Total Lifetime Revenue"
          value={fmt(totalRevenue)}
          delta="All-time business total"
          trend="neutral"
          icon={Receipt}
          accent="accent"
        />
        <StatCard
          label="Paid Appointments"
          value={paidAppointments}
          delta="Completed paid services"
          trend="up"
          icon={CheckCircle2}
          accent="primary"
        />
        <StatCard
          label="Average Service Value"
          value={fmt(averageServiceValue)}
          delta="Revenue per completed visit"
          trend="neutral"
          icon={Scissors}
          accent="info"
        />
      </div>

      {/* 2. REVENUE TREND CHARTS */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span>Weekly Revenue Trend (Daily)</span>
              <Badge variant="outline" className="rounded-full text-[10px] font-medium">IST Mon-Sun</Badge>
            </CardTitle>
            <CardDescription className="text-xs">Completed appointment revenue by weekday</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} />
                  <YAxis fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip
                    formatter={(v: number) => [fmt(v), "Revenue"]}
                    contentStyle={{ borderRadius: "12px", fontSize: "12px" }}
                  />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span>Yearly Revenue Trend (Monthly)</span>
              <Badge variant="outline" className="rounded-full text-[10px] font-medium">Jan - Dec</Badge>
            </CardTitle>
            <CardDescription className="text-xs">Monthly breakdown for current calendar year</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yearlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} />
                  <YAxis fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip
                    formatter={(v: number) => [fmt(v), "Revenue"]}
                    contentStyle={{ borderRadius: "12px", fontSize: "12px" }}
                  />
                  <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. REVENUE BREAKDOWNS: PAYMENT METHODS & CATEGORIES */}
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        {/* Payment Methods */}
        <Card className="rounded-2xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span>Payment Methods</span>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
            <CardDescription className="text-xs">Revenue split by payment type</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 space-y-3">
            {(paymentBreakdown || []).map((pm: any) => {
              const tot = totalRevenue || 1;
              const pct = Math.round((pm.amount / tot) * 100);
              return (
                <div key={pm.method} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5">
                      {pm.method === "Cash" && <Banknote className="h-3.5 w-3.5 text-emerald-500" />}
                      {pm.method === "UPI" && <Smartphone className="h-3.5 w-3.5 text-indigo-500" />}
                      {pm.method === "Card" && <CreditCard className="h-3.5 w-3.5 text-blue-500" />}
                      {pm.method}
                    </span>
                    <span className="font-bold">{fmt(pm.amount)} ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Service Categories */}
        <Card className="rounded-2xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span>Revenue by Service Category</span>
              <Scissors className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
            <CardDescription className="text-xs">Hair, Skin, Spa, Nails, Bridal & Makeup</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 space-y-3">
            {(dbCharts?.revenue_by_service_category || []).map((cat: any) => (
              <div key={cat.category} className="flex items-center justify-between rounded-xl border p-2.5">
                <div>
                  <p className="text-xs font-semibold text-foreground">{cat.category}</p>
                  <p className="text-[11px] text-muted-foreground">{cat.bookings} service booking{cat.bookings === 1 ? "" : "s"}</p>
                </div>
                <Badge variant="secondary" className="font-bold text-xs">
                  {fmt(cat.revenue)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Revenue by Staff */}
        <Card className="rounded-2xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span>Revenue by Staff</span>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
            <CardDescription className="text-xs">Stylist & Therapist sales contribution</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 space-y-3">
            {(staffBreakdown || []).map((st: any) => (
              <div key={st.staff_name} className="flex items-center justify-between rounded-xl border p-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full gradient-brand flex items-center justify-center text-primary-foreground text-xs font-bold">
                    {st.staff_name[0]}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{st.staff_name}</p>
                    <p className="text-[11px] text-muted-foreground">{st.bookings} appointment{st.bookings === 1 ? "" : "s"}</p>
                  </div>
                </div>
                <Badge variant="outline" className="font-bold text-xs">
                  {fmt(st.revenue)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 4. DETAILED ANALYTICS: TOP SERVICES & FINANCIAL SUMMARY */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Performing Services */}
        <Card className="rounded-2xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span>Top Performing Salon Services</span>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </CardTitle>
            <CardDescription className="text-xs">Ranked by completed booking revenue</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2.5">
              {(topServices || []).map((srv: any, idx: number) => (
                <div key={srv.service_name} className="flex items-center justify-between rounded-xl border p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-foreground">{srv.service_name}</p>
                      <p className="text-[11px] text-muted-foreground">{srv.booking_count} completed booking{srv.booking_count === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {fmt(srv.revenue)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Financial & Tax Summary */}
        <Card className="rounded-2xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span>Financial & GST Breakdown</span>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
            <CardDescription className="text-xs">Net revenue, taxes collected, discounts, and pending balances</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-card p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Net Revenue</p>
                <p className="text-lg font-extrabold text-foreground">{fmt(dbAnalytics?.net_revenue ?? totalRevenue)}</p>
                <p className="text-[10px] text-muted-foreground">After discounts applied</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <p className="text-[11px] font-medium text-muted-foreground">GST Collected (18%)</p>
                <p className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">{fmt(dbAnalytics?.gst_collected ?? Math.round(totalRevenue * 0.18))}</p>
                <p className="text-[10px] text-muted-foreground">Standard Salon GST</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Discounts Given</p>
                <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400">{fmt(dbAnalytics?.discount_given ?? 0)}</p>
                <p className="text-[10px] text-muted-foreground">Coupons & promotions</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Outstanding Payments</p>
                <p className="text-lg font-extrabold text-rose-600 dark:text-rose-400">{fmt(dbAnalytics?.outstanding_payments ?? 0)}</p>
                <p className="text-[10px] text-muted-foreground">Unsettled active visits</p>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/40 p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-foreground">Repeat Client Revenue Share</p>
                <p className="text-[11px] text-muted-foreground">{dbAnalytics?.repeat_client_rate ?? 0}% of clients have return visits</p>
              </div>
              <Badge variant="default" className="gradient-brand text-primary-foreground font-bold">
                {dbAnalytics?.repeat_client_rate ?? 0}% Repeat
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
