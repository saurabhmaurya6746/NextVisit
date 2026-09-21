import { createFileRoute } from "@/lib/route-compat";
import { useParams } from "react-router-dom";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Download, Loader2, RefreshCw, Filter, Calendar as CalendarIcon,
  TrendingUp, Users, DollarSign, Target, CheckCircle2, XCircle, Award,
  Sparkles, Scissors, UtensilsCrossed, Gift, PieChart as PieIcon, BarChart3,
  RotateCcw, SlidersHorizontal, UserCheck, Percent, Layers, ShieldCheck, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { getSession } from "@/lib/auth";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { SkeletonStatsGrid, SkeletonRows } from "@/components/skeletons";
import {
  getBiReportsAnalyticsApi,
  getReportFilterOptionsApi,
  downloadReportsPdfApi,
  downloadReportsExcelApi,
  downloadReportsCsvApi,
  ReportFilterParams,
} from "@/lib/reports-api";

export const Route = createFileRoute("/app/$type/$business/reports")({ component: ReportsBiDashboardPage });

const PIE_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6", "#3B82F6"];

export default function ReportsBiDashboardPage() {
  const { type } = useParams<{ type?: string }>();
  const isSalon = type === "salon";
  const session = getSession();

  // ---------------------------------------------------------------------------
  // Filter States
  // ---------------------------------------------------------------------------
  const [dateRange, setDateRange] = useState<string>("this_month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [bookingSource, setBookingSource] = useState<string>("all");
  const [staffId, setStaffId] = useState<string>("all");
  const [serviceAreaId, setServiceAreaId] = useState<string>("all");
  const [chairId, setChairId] = useState<string>("all");
  const [customerType, setCustomerType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [exportingType, setExportingType] = useState<"pdf" | "excel" | "csv" | null>(null);

  // Active filters payload
  const activeFilters: ReportFilterParams = {
    date_range: dateRange,
    start_date: dateRange === "custom" ? startDate : undefined,
    end_date: dateRange === "custom" ? endDate : undefined,
    payment_method: paymentMethod !== "all" ? paymentMethod : undefined,
    booking_source: bookingSource !== "all" ? bookingSource : undefined,
    staff_id: staffId !== "all" ? staffId : undefined,
    service_area_id: serviceAreaId !== "all" ? serviceAreaId : undefined,
    chair_id: chairId !== "all" ? chairId : undefined,
    customer_type: customerType !== "all" ? customerType : undefined,
    status: status !== "all" ? status : undefined,
  };

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------
  const {
    data: reportsData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["bi-reports-analytics", session?.clientId, activeFilters],
    queryFn: () => getBiReportsAnalyticsApi(activeFilters),
    refetchInterval: 60000,
  });

  const { data: filterOptions } = useQuery({
    queryKey: ["bi-reports-filter-options", session?.clientId],
    queryFn: getReportFilterOptionsApi,
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function resetFilters() {
    setDateRange("this_month");
    setStartDate("");
    setEndDate("");
    setPaymentMethod("all");
    setBookingSource("all");
    setStaffId("all");
    setServiceAreaId("all");
    setChairId("all");
    setCustomerType("all");
    setStatus("all");
    toast.success("Filters reset to default");
  }

  async function handleExport(format: "pdf" | "excel" | "csv") {
    setExportingType(format);
    const toastId = toast.loading(`Generating BI ${format.toUpperCase()} report…`);
    try {
      if (format === "pdf") await downloadReportsPdfApi(activeFilters);
      else if (format === "excel") await downloadReportsExcelApi(activeFilters);
      else if (format === "csv") await downloadReportsCsvApi(activeFilters);

      toast.dismiss(toastId);
      toast.success(`${format.toUpperCase()} report downloaded successfully!`);
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error(e.message || `Failed to download ${format.toUpperCase()} report`);
    } finally {
      setExportingType(null);
    }
  }

  const kpi = reportsData?.kpi_summary;
  const guestLabel = isSalon ? "Clients" : "Guests";
  const itemLabel = isSalon ? "Services" : "Items";
  const BusinessIcon = isSalon ? Scissors : UtensilsCrossed;

  return (
    <PageTransition>
      {/* PAGE HEADER & EXPORT ACTIONS */}
      <PageHeader
        title="Business Intelligence Reports"
        description={`Real-time ${isSalon ? "salon" : "restaurant"} performance, revenue analytics, staff metrics & customer insights.`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full text-xs"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} />
              Refresh
            </Button>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => handleExport("pdf")}
                disabled={!!exportingType}
              >
                {exportingType === "pdf" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
                Export PDF
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full text-xs font-semibold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => handleExport("excel")}
                disabled={!!exportingType}
              >
                {exportingType === "excel" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
                Export Excel (.xlsx)
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full text-xs text-muted-foreground hover:text-foreground"
                onClick={() => handleExport("csv")}
                disabled={!!exportingType}
              >
                {exportingType === "csv" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
                CSV
              </Button>
            </div>
          </div>
        }
      />

      {/* GLOBAL FILTER BAR */}
      <Card className="mb-6 rounded-2xl border bg-card/60 p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Selector */}
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date Range</span>
            <Select value={dateRange} onValueChange={(v) => setDateRange(v)}>
              <SelectTrigger className="h-9 w-44 rounded-xl text-xs font-medium bg-background">
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Inputs */}
          {dateRange === "custom" && (
            <div className="flex items-center gap-2 pt-4">
              <Input
                type="date"
                className="h-9 w-36 rounded-xl text-xs bg-background"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                className="h-9 w-36 rounded-xl text-xs bg-background"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Payment</span>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v)}>
              <SelectTrigger className="h-9 w-36 rounded-xl text-xs bg-background">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="CARD">Card</SelectItem>
                <SelectItem value="ONLINE">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Customer Type */}
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</span>
            <Select value={customerType} onValueChange={(v) => setCustomerType(v)}>
              <SelectTrigger className="h-9 w-36 rounded-xl text-xs bg-background">
                <SelectValue placeholder="Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                <SelectItem value="vip">VIP Only</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="returning">Returning</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
            <Select value={status} onValueChange={(v) => setStatus(v)}>
              <SelectTrigger className="h-9 w-36 rounded-xl text-xs bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="OPEN">Open / Pending</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Staff Filter (Salon Only) */}
          {isSalon && filterOptions && filterOptions.staff.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stylist / Staff</span>
              <Select value={staffId} onValueChange={(v) => setStaffId(v)}>
                <SelectTrigger className="h-9 w-40 rounded-xl text-xs bg-background">
                  <SelectValue placeholder="Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {filterOptions.staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Advanced Filters Toggle & Reset */}
          <div className="ml-auto flex items-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl text-xs text-muted-foreground hover:text-foreground"
              onClick={resetFilters}
            >
              <RotateCcw className="mr-1 h-3 w-3" /> Reset
            </Button>
          </div>
        </div>
      </Card>

      {/* APPLIED PERIOD BADGE */}
      {reportsData && (
        <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <BusinessIcon className="h-3.5 w-3.5 text-primary" />
            Showing <strong>{reportsData.business_name}</strong> analytics for:{" "}
            <Badge variant="outline" className="rounded-full bg-primary/10 text-primary border-primary/20">
              {reportsData.applied_period_label}
            </Badge>
          </span>
          <span>
            {reportsData.start_date} to {reportsData.end_date}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6">
          <SkeletonStatsGrid count={5} />
          <SkeletonRows rows={4} cols={5} />
        </div>
      ) : isError ? (
        <EmptyState
          title="Failed to load BI reports"
          description="Could not query the database reports engine. Please refresh or try again."
          icon={<XCircle className="h-8 w-8 text-destructive" />}
          action={
            <Button size="sm" onClick={() => refetch()} className="rounded-full">
              Retry
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* PRIMARY REVENUE BREAKDOWN CARDS */}
          <div className="rounded-2xl border bg-card/40 p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" /> Revenue & Tax Summary
              </h3>
              <Badge variant="outline" className="rounded-full text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                100% Calculated
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <KpiCard title="Gross Sales" value={fmt(kpi?.gross_sales ?? kpi?.total_revenue ?? 0)} sub="Total subtotal amount" icon={TrendingUp} highlight />
              <KpiCard title="Discounts" value={fmt(kpi?.discounts ?? kpi?.discount_given ?? 0)} sub="Coupons & offers" icon={Gift} />
              <KpiCard title="Taxable Sales" value={fmt(kpi?.taxable_sales ?? 0)} sub="Net taxable base" icon={Target} />
              <KpiCard title="GST Collected" value={fmt(kpi?.gst_collected ?? 0)} sub="Total tax collected" icon={Percent} />
              <KpiCard title="Net Revenue" value={fmt(kpi?.net_revenue ?? 0)} sub="Final net revenue" icon={DollarSign} highlight />
            </div>
          </div>

          {/* SECONDARY METRICS GRID */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <KpiCard title={isSalon ? "Appointments" : "Total Orders"} value={String(kpi?.total_appointments_or_orders ?? 0)} sub={`Completed: ${kpi?.completed_visits}`} icon={CheckCircle2} />
            <KpiCard title="Cancelled" value={String(kpi?.cancelled_visits ?? 0)} sub="No shows / cancelled" icon={XCircle} />
            <KpiCard title="Avg Ticket Size" value={fmt(kpi?.average_order_or_service_value ?? 0)} sub="Per visit / order" icon={Target} />
            <KpiCard title="Daily Avg Revenue" value={fmt(kpi?.average_daily_revenue ?? 0)} sub="Per active day" icon={BarChart3} />
            <KpiCard title={`Total ${guestLabel}`} value={String(kpi?.total_customers ?? 0)} sub={`Repeat rate: ${kpi?.repeat_rate_pct}%`} icon={Users} />
            <KpiCard title="New Customers" value={String(kpi?.new_customers ?? 0)} sub={`Returning: ${kpi?.returning_customers}`} icon={UserCheck} />
            <KpiCard title="Loyalty Points" value={String(kpi?.total_loyalty_points_earned ?? 0)} sub="Total points earned" icon={Award} />
            <KpiCard title="Coupons Used" value={String(kpi?.coupons_redeemed ?? 0)} sub="Campaign redemptions" icon={Percent} />
            <KpiCard title="Campaign Revenue" value={fmt(kpi?.campaign_revenue ?? 0)} sub="Generated from offers" icon={Sparkles} />
          </div>

          {/* MAIN CHARTS SECTION */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* REVENUE TREND AREA CHART */}
            <Card className="rounded-2xl border bg-card shadow-sm p-4">
              <div className="flex items-center justify-between pb-3 border-b mb-4">
                <div>
                  <h3 className="font-display font-semibold text-sm">Revenue Trend</h3>
                  <p className="text-[11px] text-muted-foreground">Daily gross vs net revenue over period</p>
                </div>
                <Badge variant="outline" className="text-[10px] rounded-full">Database Query</Badge>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={reportsData?.revenue_trend || []}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366F1" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" fontSize={11} stroke="var(--muted-foreground)" />
                    <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                      formatter={(v: any) => [fmt(Number(v)), "Revenue"]}
                    />
                    <Area dataKey="revenue" name="Gross Revenue" stroke="#6366F1" fill="url(#revGrad)" strokeWidth={2} />
                    <Area dataKey="net_revenue" name="Net Revenue" stroke="#10B981" fill="none" strokeWidth={2} strokeDasharray="4 4" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* APPOINTMENTS / ORDERS TREND BAR CHART */}
            <Card className="rounded-2xl border bg-card shadow-sm p-4">
              <div className="flex items-center justify-between pb-3 border-b mb-4">
                <div>
                  <h3 className="font-display font-semibold text-sm">
                    {isSalon ? "Appointment Trend" : "Order Volume Trend"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Completed vs Cancelled volume</p>
                </div>
                <Badge variant="outline" className="text-[10px] rounded-full">{isSalon ? "Visits" : "Orders"}</Badge>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportsData?.appointments_or_orders_trend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" fontSize={11} stroke="var(--muted-foreground)" />
                    <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="cancelled" name="Cancelled" fill="#EF4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* CUSTOMER GROWTH TREND */}
            <Card className="rounded-2xl border bg-card shadow-sm p-4">
              <div className="flex items-center justify-between pb-3 border-b mb-4">
                <div>
                  <h3 className="font-display font-semibold text-sm">Customer Acquisition</h3>
                  <p className="text-[11px] text-muted-foreground">New vs Returning customers</p>
                </div>
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportsData?.customer_growth_trend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" fontSize={11} stroke="var(--muted-foreground)" />
                    <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey="new_customers" name="New Customers" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="returning_customers" name="Returning Customers" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* REVENUE BY PAYMENT METHOD */}
            <Card className="rounded-2xl border bg-card shadow-sm p-4">
              <div className="flex items-center justify-between pb-3 border-b mb-4">
                <div>
                  <h3 className="font-display font-semibold text-sm">Revenue by Payment Method</h3>
                  <p className="text-[11px] text-muted-foreground">Cash, UPI, Card, Online breakdown</p>
                </div>
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reportsData?.revenue_by_payment_method || []}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={40}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {(reportsData?.revenue_by_payment_method || []).map((_, idx) => (
                        <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [fmt(Number(v)), "Revenue"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* SALON SPECIFIC REPORTS WIDGETS */}
          {isSalon && reportsData?.salon_reports && (
            <div className="space-y-6">
              {/* STAFF PERFORMANCE TABLE */}
              <Card className="rounded-2xl border bg-card shadow-sm p-4">
                <div className="flex items-center justify-between pb-3 border-b mb-4">
                  <div>
                    <h3 className="font-display font-semibold text-sm flex items-center gap-1.5">
                      <Scissors className="h-4 w-4 text-primary" /> Staff Performance Analytics
                    </h3>
                    <p className="text-[11px] text-muted-foreground">Appointments completed, revenue generated, avg ticket size & commission</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] rounded-full">Salon Only</Badge>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                        <th className="pb-2">Staff Member</th>
                        <th className="pb-2">Role</th>
                        <th className="pb-2 text-center">Appointments</th>
                        <th className="pb-2 text-right">Revenue</th>
                        <th className="pb-2 text-right">Avg Ticket</th>
                        <th className="pb-2 text-right">Hours</th>
                        <th className="pb-2 text-right">Commission</th>
                        <th className="pb-2 text-center">Rank</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {reportsData.salon_reports.staff_performance.map((stf) => (
                        <tr key={stf.staff_id} className="hover:bg-muted/30">
                          <td className="py-2.5 font-semibold text-foreground">{stf.name}</td>
                          <td className="py-2.5 text-muted-foreground">{stf.designation || "Stylist"}</td>
                          <td className="py-2.5 text-center font-medium">{stf.appointments_completed}</td>
                          <td className="py-2.5 text-right font-semibold text-foreground">{fmt(stf.revenue_generated)}</td>
                          <td className="py-2.5 text-right font-mono">{fmt(stf.average_ticket_size)}</td>
                          <td className="py-2.5 text-right text-muted-foreground">{stf.working_hours}h</td>
                          <td className="py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-medium">{fmt(stf.commission_earned)}</td>
                          <td className="py-2.5 text-center">
                            <Badge
                              className={cn(
                                "rounded-full text-[10px]",
                                stf.rank === "Top Performer"
                                  ? "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400"
                                  : "bg-primary/10 text-primary border-primary/20"
                              )}
                            >
                              {stf.rank}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* SERVICE PERFORMANCE & WORKSTATION UTILIZATION */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* SERVICE PERFORMANCE */}
                <Card className="rounded-2xl border bg-card shadow-sm p-4">
                  <div className="flex items-center justify-between pb-3 border-b mb-3">
                    <h3 className="font-display font-semibold text-sm">Service Breakdown</h3>
                    <span className="text-[11px] text-muted-foreground">Most & Least Booked</span>
                  </div>
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {reportsData.salon_reports.service_performance.map((svc) => (
                      <div key={svc.service_id} className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/20 text-xs">
                        <div>
                          <p className="font-semibold text-foreground">{svc.service_name}</p>
                          <p className="text-[10px] text-muted-foreground">{svc.category_name} · {svc.avg_duration_minutes} mins</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">{fmt(svc.total_revenue)}</p>
                          <p className="text-[10px] text-muted-foreground">{svc.booked_count} bookings</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* WORKSTATION / CHAIR UTILIZATION */}
                <Card className="rounded-2xl border bg-card shadow-sm p-4">
                  <div className="flex items-center justify-between pb-3 border-b mb-3">
                    <h3 className="font-display font-semibold text-sm">Chair & Workstation Occupancy</h3>
                    <span className="text-[11px] text-muted-foreground">Usage %</span>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {reportsData.salon_reports.workstation_utilization.map((wk) => (
                      <div key={wk.chair_id} className="p-3 rounded-xl border bg-card space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">{wk.chair_name}</span>
                          <Badge variant="outline" className="text-[10px] rounded-full">{wk.service_area_name}</Badge>
                        </div>
                        <div className="flex justify-between items-center pt-1 text-[11px]">
                          <span className="text-muted-foreground">Appointments:</span>
                          <span className="font-bold">{wk.appointments_count}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden mt-1">
                          <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${Math.min(100, wk.usage_pct)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* RESTAURANT SPECIFIC REPORTS WIDGETS */}
          {!isSalon && reportsData?.restaurant_reports && (
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                {/* TABLE UTILIZATION */}
                <Card className="rounded-2xl border bg-card shadow-sm p-4">
                  <div className="flex items-center justify-between pb-3 border-b mb-3">
                    <h3 className="font-display font-semibold text-sm flex items-center gap-1.5">
                      <UtensilsCrossed className="h-4 w-4 text-primary" /> Table Utilization
                    </h3>
                    <Badge variant="outline" className="text-[10px] rounded-full">Restaurant Only</Badge>
                  </div>
                  <div className="space-y-2.5">
                    {reportsData.restaurant_reports.table_utilization.map((t) => (
                      <div key={t.table_id} className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/20 text-xs">
                        <div>
                          <p className="font-semibold text-foreground">{t.table_name}</p>
                          <p className="text-[10px] text-muted-foreground">{t.dining_area_name} · Avg {t.avg_dining_minutes} mins</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">{fmt(t.total_revenue)}</p>
                          <p className="text-[10px] text-muted-foreground">{t.orders_count} orders</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* MENU ITEM SALES */}
                <Card className="rounded-2xl border bg-card shadow-sm p-4">
                  <div className="flex items-center justify-between pb-3 border-b mb-3">
                    <h3 className="font-display font-semibold text-sm">Top Selling Dishes / Items</h3>
                    <span className="text-[11px] text-muted-foreground">Quantity & Revenue</span>
                  </div>
                  <div className="space-y-2.5">
                    {reportsData.restaurant_reports.menu_item_sales.map((m) => (
                      <div key={m.menu_item_id} className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/20 text-xs">
                        <div>
                          <p className="font-semibold text-foreground">{m.item_name}</p>
                          <p className="text-[10px] text-muted-foreground">{m.category_name} · {m.quantity_sold} sold</p>
                        </div>
                        <p className="font-bold text-foreground">{fmt(m.total_revenue)}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TOP CUSTOMERS TABLE */}
          <Card className="rounded-2xl border bg-card shadow-sm p-4">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div>
                <h3 className="font-display font-semibold text-sm">Top High-Value Customers</h3>
                <p className="text-[11px] text-muted-foreground">Ranked by lifetime spend & visit frequency</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                    <th className="pb-2"># Customer Name</th>
                    <th className="pb-2">Phone</th>
                    <th className="pb-2 text-center">Visits</th>
                    <th className="pb-2 text-right">Lifetime Spend</th>
                    <th className="pb-2 text-right">Avg Spend</th>
                    <th className="pb-2 text-center">Last Visit</th>
                    <th className="pb-2 text-center">Membership</th>
                    <th className="pb-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reportsData?.top_customers.map((c, i) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="py-2.5 font-semibold text-foreground">
                        {i + 1}. {c.name}
                      </td>
                      <td className="py-2.5 font-mono text-muted-foreground">{c.phone}</td>
                      <td className="py-2.5 text-center font-medium">{c.visits}</td>
                      <td className="py-2.5 text-right font-bold text-foreground">{fmt(c.lifetime_spend)}</td>
                      <td className="py-2.5 text-right font-mono">{fmt(c.average_spend)}</td>
                      <td className="py-2.5 text-center text-muted-foreground">{c.last_visit || "—"}</td>
                      <td className="py-2.5 text-center">
                        <Badge variant="outline" className={cn("rounded-full text-[10px]", c.membership === "VIP" && "bg-amber-500/15 text-amber-600 border-amber-500/30")}>
                          {c.membership || "Regular"}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right font-bold text-primary">{c.loyalty_points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* CAMPAIGN PERFORMANCE SECTION */}
          <Card className="rounded-2xl border bg-card shadow-sm p-4">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div>
                <h3 className="font-display font-semibold text-sm">Automated Campaign Analytics</h3>
                <p className="text-[11px] text-muted-foreground">Performance breakdown across campaign types</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reportsData?.campaign_reports.map((camp) => (
                <div key={camp.campaign_type} className="p-3.5 rounded-xl border bg-muted/20 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-foreground">{camp.name}</span>
                    <Badge variant="outline" className="text-[10px] rounded-full">{camp.conversion_rate_pct}% Conv</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center text-[10px] pt-1">
                    <div className="bg-background p-1.5 rounded-lg border">
                      <p className="font-bold">{camp.messages_sent}</p>
                      <p className="text-muted-foreground">Sent</p>
                    </div>
                    <div className="bg-background p-1.5 rounded-lg border">
                      <p className="font-bold">{camp.coupons_used}</p>
                      <p className="text-muted-foreground">Redeemed</p>
                    </div>
                    <div className="bg-primary/10 text-primary p-1.5 rounded-lg font-bold">
                      <p>{fmt(camp.revenue_generated)}</p>
                      <p className="text-[9px] font-normal">Revenue</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </PageTransition>
  );
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  highlight = false,
}: {
  title: string;
  value: string;
  sub: string;
  icon: any;
  highlight?: boolean;
}) {
  return (
    <Card className={cn("rounded-2xl border bg-card p-3.5 shadow-sm transition-all hover:shadow-glow", highlight && "border-primary/40 bg-primary/5")}>
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[11px] font-medium">{title}</span>
        <Icon className={cn("h-3.5 w-3.5", highlight ? "text-primary" : "text-muted-foreground")} />
      </div>
      <p className="mt-1.5 font-display text-xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-[9px] text-muted-foreground truncate">{sub}</p>
    </Card>
  );
}