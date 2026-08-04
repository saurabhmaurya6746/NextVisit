import { AppLink } from "@/lib/app-nav";
import { useQuery } from "@tanstack/react-query";
import { getSalonChairMetricsApi } from "@/lib/salon-chairs-api";
import {
  DollarSign, Calendar, Users, Cake, Gift, UserMinus, Ticket, Star,
  Sparkles, ChevronRight, ListChecks, Scissors,
  AlertTriangle, Activity, TrendingUp, Clock, CheckCircle2, UserCheck
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { fmt } from "@/lib/currency";
import { SkeletonStatsGrid } from "@/components/skeletons";

export interface SalonDashboardProps {
  dashData: any;
  fetchLoading: boolean;
  isError: boolean;
  error: any;
  refetch: () => void;
  displayName: string;
  displayBizName: string;
}

/**
 * Format any generic backend string into proper Salon terminology
 */
function formatSalonText(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/\bOrder Created\b/gi, "Appointment Booked")
    .replace(/\bTable Released\b/gi, "Appointment Completed")
    .replace(/\bQR Order Received\b/gi, "Online Booking Received")
    .replace(/\bOrder #/gi, "Appointment #")
    .replace(/\bOrders\b/gi, "Appointments")
    .replace(/\bOrder\b/gi, "Appointment")
    .replace(/\bVisits\b/gi, "Services")
    .replace(/\bVisit\b/gi, "Service")
    .replace(/\bCustomers\b/gi, "Clients")
    .replace(/\bCustomer\b/gi, "Client")
    .replace(/\bTable\b/gi, "Station");
}

export function SalonDashboard({
  dashData,
  fetchLoading,
  isError,
  error,
  refetch,
  displayName,
  displayBizName,
}: SalonDashboardProps) {
  // Core Salon Metrics from Database
  const todaysAppointments = dashData?.today_orders ?? dashData?.today_visits ?? 0;
  const todaysRevenue = dashData?.today_revenue ?? 0;
  const openAppointments = dashData?.open_visits ?? 0;
  const completedServices = dashData?.completed_visits ?? 0;
  const totalCustomers = dashData?.total_customers ?? 0;
  const activeCustomers = dashData?.active_customers ?? 0;
  const averageServiceValue = dashData?.average_bill ?? 0;
  const avgDailyRevenue = dashData?.avg_daily_revenue ?? 0;
  const totalRevenue = dashData?.total_revenue ?? 0;

  // Action Tasks from DB
  const tasksData = dashData?.tasks || {
    todays_birthdays: 0,
    todays_anniversaries: 0,
    pending_reviews: 0,
    recovery_customers: 0,
    expiring_coupons: 0,
  };

  const tasks = [
    { label: "Today's Birthdays", value: tasksData.todays_birthdays, path: "birthday-campaigns/today", icon: Cake, tone: "text-primary" },
    { label: "Today's Anniversaries", value: tasksData.todays_anniversaries, path: "anniversary-campaigns/today", icon: Gift, tone: "text-accent-foreground" },
    { label: "Pending Reviews", value: tasksData.pending_reviews, path: "review-booster", icon: Star, tone: "text-warning-foreground" },
    { label: "Recovery Clients", value: tasksData.recovery_customers, path: "customer-recovery", icon: UserMinus, tone: "text-destructive" },
    { label: "Coupons Expiring", value: tasksData.expiring_coupons, path: "coupons", icon: Ticket, tone: "text-info" },
  ] as const;

  // Weekly Charts from DB
  const weeklyRevenue = dashData?.weekly_sales || [
    { day: "Mon", sales: 0 }, { day: "Tue", sales: 0 }, { day: "Wed", sales: 0 },
    { day: "Thu", sales: 0 }, { day: "Fri", sales: 0 }, { day: "Sat", sales: 0 }, { day: "Sun", sales: 0 },
  ];

  const weeklyAppointments = dashData?.weekly_bookings || [
    { day: "Mon", bookings: 0 }, { day: "Tue", bookings: 0 }, { day: "Wed", bookings: 0 },
    { day: "Thu", bookings: 0 }, { day: "Fri", bookings: 0 }, { day: "Sat", bookings: 0 }, { day: "Sun", bookings: 0 },
  ];

  const { data: chairMetrics } = useQuery({
    queryKey: ["salon-chairs-metrics"],
    queryFn: getSalonChairMetricsApi,
    refetchInterval: 10000,
  });

  const repeatCustomerTrend = dashData?.repeat_customer_trend || [];
  
  // Salon Specific Analytics (Top Services)
  const topServices = dashData?.top_services && dashData.top_services.length > 0 
    ? dashData.top_services 
    : (dashData?.top_selling_items || []).map((it: any) => ({
        service_name: it.name,
        visit_count: it.quantity,
        revenue: it.revenue
      }));

  const payBreakdown = dashData?.payment_breakdown || { cash: 0, upi: 0, card: 0, wallet: 0, other: 0 };
  const recentActivity = dashData?.recent_activity || [];
  const calculatedInsights = dashData?.calculated_insights || [];
  const revComparison = dashData?.revenue_comparison || { today_vs_yesterday_pct: 0, week_vs_last_week_pct: 0, month_vs_last_month_pct: 0 };
  const growthMetrics = dashData?.growth_metrics || { customer_growth_pct: 0, revenue_growth_pct: 0, visit_growth_pct: 0, order_growth_pct: 0 };

  return (
    <PageTransition>
      <PageHeader
        title={`Welcome back, ${displayName} 👋`}
        description={`Here's what's happening at ${displayBizName} today.`}
        actions={
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" /> Salon Live Analytics
          </Badge>
        }
      />

      {isError ? (
        <EmptyState
          title="Failed to load Salon dashboard"
          description={(error as Error)?.message || "Could not retrieve live appointment statistics."}
          icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
          action={
            <Button variant="outline" className="rounded-full" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : fetchLoading ? (
        <SkeletonStatsGrid count={8} />
      ) : (
        <div className="space-y-6">
          {/* ONE COMPACT WORKSTATION SUMMARY CARD */}
          {chairMetrics && (
            <Card className="rounded-2xl border bg-card p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Scissors className="h-4 w-4 text-primary" /> Workstations Overview
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-6 font-mono text-xs">
                <span className="text-emerald-600 font-medium">Available : <strong className="font-bold">{chairMetrics.available}</strong></span>
                <span className="text-amber-600 font-medium">Reserved : <strong className="font-bold">{chairMetrics.reserved}</strong></span>
                <span className="text-blue-600 font-medium">In Service : <strong className="font-bold">{chairMetrics.occupied}</strong></span>
                <span className="text-purple-600 font-medium">Cleaning : <strong className="font-bold">{chairMetrics.cleaning}</strong></span>
              </div>
            </Card>
          )}

          {/* SALON TOP CARDS GRID */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
            <AppLink path="appointments">
              <StatCard
                label="Today's Appointments"
                value={todaysAppointments}
                icon={Calendar}
                accent="primary"
                index={0}
              />
            </AppLink>
            <AppLink path="revenue">
              <StatCard
                label="Today's Revenue"
                value={fmt(todaysRevenue)}
                delta={`${revComparison.today_vs_yesterday_pct >= 0 ? "+" : ""}${revComparison.today_vs_yesterday_pct}% vs yesterday`}
                trend={revComparison.today_vs_yesterday_pct >= 0 ? "up" : "down"}
                icon={DollarSign}
                accent="accent"
                index={1}
              />
            </AppLink>
            <AppLink path="appointments">
              <StatCard
                label="Ongoing Appointments"
                value={openAppointments}
                delta="currently in service"
                icon={Clock}
                accent="info"
                index={2}
              />
            </AppLink>
            <AppLink path="appointments">
              <StatCard
                label="Completed Services"
                value={completedServices}
                icon={CheckCircle2}
                accent="warning"
                index={3}
              />
            </AppLink>
            <AppLink path="customers">
              <StatCard
                label="Total Clients"
                value={totalCustomers}
                delta={`${activeCustomers} active clients`}
                icon={Users}
                accent="primary"
                index={4}
              />
            </AppLink>
            <AppLink path="revenue">
              <StatCard
                label="Average Service Value"
                value={fmt(averageServiceValue)}
                delta="per completed service"
                icon={TrendingUp}
                accent="destructive"
                index={5}
              />
            </AppLink>
            <AppLink path="revenue">
              <StatCard
                label="Avg Daily Revenue"
                value={fmt(avgDailyRevenue)}
                delta="current month avg"
                icon={DollarSign}
                accent="info"
                index={6}
              />
            </AppLink>
            <AppLink path="revenue">
              <StatCard
                label="Total Revenue"
                value={fmt(totalRevenue)}
                delta={`${growthMetrics.revenue_growth_pct >= 0 ? "+" : ""}${growthMetrics.revenue_growth_pct}% MoM`}
                trend={growthMetrics.revenue_growth_pct >= 0 ? "up" : "down"}
                icon={Sparkles}
                accent="accent"
                index={7}
              />
            </AppLink>
          </div>

          {/* SECTION 1: TODAY'S TASKS */}
          <Card className="rounded-2xl border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="font-display flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-primary" /> Today's tasks
              </CardTitle>
              <p className="text-xs text-muted-foreground">Action items requiring attention today for clients and salon automation.</p>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {tasks.map((t, i) => (
                <motion.div key={t.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <AppLink path={t.path} className="group block rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-sm bg-card">
                    <div className="flex items-center justify-between">
                      <div className={`grid h-8 w-8 place-items-center rounded-lg bg-muted ${t.tone}`}>
                        <t.icon className="h-4 w-4" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{t.label}</p>
                    <p className="font-display text-xl font-bold">{t.value}</p>
                  </AppLink>
                </motion.div>
              ))}
            </CardContent>
          </Card>

          {/* CHARTS ROW 1: REVENUE THIS WEEK & APPOINTMENTS THIS WEEK */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="rounded-2xl lg:col-span-2 border shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="font-display text-base">Revenue This Week</CardTitle>
                  <p className="text-xs text-muted-foreground">Daily service earnings from Monday to Sunday</p>
                </div>
                <Badge variant="outline" className="rounded-full font-mono text-xs">
                  {fmt(weeklyRevenue.reduce((s: number, d: any) => s + d.sales, 0))} Total
                </Badge>
              </CardHeader>
              <CardContent className="h-72 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyRevenue}>
                    <defs>
                      <linearGradient id="salonSalesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                    <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" fill="url(#salonSalesGrad)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">Appointments This Week</CardTitle>
                <p className="text-xs text-muted-foreground">Appointment count trend across the week</p>
              </CardHeader>
              <CardContent className="h-72 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyAppointments}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                    <Bar dataKey="bookings" fill="hsl(var(--accent-foreground))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* CHARTS ROW 2: REPEAT CLIENT RATE & TOP SERVICES */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">Repeat Client Rate %</CardTitle>
                <p className="text-xs text-muted-foreground">Calculated 6-month repeat visit rate for salon clients</p>
              </CardHeader>
              <CardContent className="h-64 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={repeatCustomerTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} unit="%" />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                    <Line type="monotone" dataKey="rate" stroke="oklch(0.65 0.2 340)" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="font-display flex items-center gap-2 text-base">
                  <Scissors className="h-4 w-4 text-primary" /> Top Services
                </CardTitle>
                <p className="text-xs text-muted-foreground">Highest booked services and revenue generated</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {topServices.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No completed services recorded yet.</p>
                ) : (
                  topServices.map((srv: any, i: number) => (
                    <div key={srv.service_name || i} className="flex items-center justify-between rounded-xl border p-3 bg-card">
                      <div>
                        <p className="text-sm font-medium">{srv.service_name || srv.name}</p>
                        <p className="text-xs text-muted-foreground">{srv.visit_count || srv.quantity || 0} appointments completed</p>
                      </div>
                      <span className="font-semibold text-sm font-mono">{fmt(srv.revenue || 0)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* SALON BREAKDOWN CARDS ROW (BOOKING SOURCE & PAYMENT METHODS) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            <Card className="rounded-2xl border shadow-xs p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Booking Source</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Online Booking</span><span className="font-mono font-medium">{fmt(dashData?.revenue_breakdown?.online_revenue || 0)}</span></div>
                <div className="flex justify-between"><span>Staff Booked</span><span className="font-mono font-medium">{fmt(dashData?.revenue_breakdown?.staff_orders_revenue || 0)}</span></div>
                <div className="flex justify-between"><span>Walk-in Client</span><span className="font-mono font-medium">{fmt(dashData?.revenue_breakdown?.walkin_revenue || 0)}</span></div>
              </div>
            </Card>

            <Card className="rounded-2xl border shadow-xs p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment Methods</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Cash</span><span className="font-mono font-medium">{fmt(payBreakdown.cash)}</span></div>
                <div className="flex justify-between"><span>UPI</span><span className="font-mono font-medium">{fmt(payBreakdown.upi)}</span></div>
                <div className="flex justify-between"><span>Card</span><span className="font-mono font-medium">{fmt(payBreakdown.card)}</span></div>
              </div>
            </Card>
          </div>

          {/* CALCULATED INSIGHTS & RECENT ACTIVITY */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="font-display flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" /> Salon Automated Insights
                </CardTitle>
                <p className="text-xs text-muted-foreground">Automated findings evaluated directly from live appointments & services</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {calculatedInsights.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No insights available yet. Complete more appointments to unlock salon analytics.</p>
                ) : (
                  calculatedInsights.map((ins: any) => (
                    <div key={ins.id} className="rounded-xl border p-3 bg-primary/5">
                      <p className="text-sm font-semibold text-foreground">{formatSalonText(ins.title)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatSalonText(ins.detail)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="font-display flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" /> Salon Activity Feed
                </CardTitle>
                <p className="text-xs text-muted-foreground">Live appointments & service activity stream sorted newest first</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentActivity.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No recent salon activity recorded yet.</p>
                ) : (
                  recentActivity.map((act: any) => (
                    <div key={act.id} className="flex items-center justify-between rounded-xl border p-2.5 text-sm bg-card">
                      <div>
                        <p className="font-medium text-xs">{formatSalonText(act.title)}</p>
                        <p className="text-[11px] text-muted-foreground">{formatSalonText(act.description)}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
