import { AppLink } from "@/lib/app-nav";
import {
  DollarSign, Calendar, Users, Cake, Gift, UserMinus, Ticket, Star, Repeat,
  Sparkles, ChevronRight, ListChecks, ShoppingBag, Utensils,
  AlertTriangle, Activity, TrendingUp
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

export interface RestaurantDashboardProps {
  dashData: any;
  fetchLoading: boolean;
  isError: boolean;
  error: any;
  refetch: () => void;
  displayName: string;
  displayBizName: string;
}

export function RestaurantDashboard({
  dashData,
  fetchLoading,
  isError,
  error,
  refetch,
  displayName,
  displayBizName,
}: RestaurantDashboardProps) {
  // Core Metrics from DB
  const todaysOrders = dashData?.today_orders ?? 0;
  const todaysRevenue = dashData?.today_revenue ?? 0;
  const totalCustomers = dashData?.total_customers ?? 0;
  const activeCustomers = dashData?.active_customers ?? 0;
  const openVisits = dashData?.open_visits ?? 0;
  const completedVisits = dashData?.completed_visits ?? 0;
  const totalRevenue = dashData?.total_revenue ?? 0;
  const averageBill = dashData?.average_bill ?? 0;
  const avgDailyRevenue = dashData?.avg_daily_revenue ?? 0;
  const mostBusyHour = dashData?.most_busy_hour ?? "No orders yet";
  const mostBusyDay = dashData?.most_busy_day ?? "No orders yet";

  // Section 1: Tasks
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
    { label: "Recovery Customers", value: tasksData.recovery_customers, path: "customer-recovery", icon: UserMinus, tone: "text-destructive" },
    { label: "Coupons Expiring", value: tasksData.expiring_coupons, path: "coupons", icon: Ticket, tone: "text-info" },
  ] as const;

  // Charts Data from DB
  const weeklySales = dashData?.weekly_sales || [
    { day: "Mon", sales: 0 }, { day: "Tue", sales: 0 }, { day: "Wed", sales: 0 },
    { day: "Thu", sales: 0 }, { day: "Fri", sales: 0 }, { day: "Sat", sales: 0 }, { day: "Sun", sales: 0 },
  ];

  const weeklyBookings = dashData?.weekly_bookings || [
    { day: "Mon", bookings: 0 }, { day: "Tue", bookings: 0 }, { day: "Wed", bookings: 0 },
    { day: "Thu", bookings: 0 }, { day: "Fri", bookings: 0 }, { day: "Sat", bookings: 0 }, { day: "Sun", bookings: 0 },
  ];

  const repeatCustomerTrend = dashData?.repeat_customer_trend || [];
  const topSellingItems = dashData?.top_selling_items || [];
  const revBreakdown = dashData?.revenue_breakdown || { qr_orders_revenue: 0, staff_orders_revenue: 0, walkin_revenue: 0, online_revenue: 0 };
  const payBreakdown = dashData?.payment_breakdown || { cash: 0, upi: 0, card: 0, wallet: 0, other: 0 };
  const newCustomers = dashData?.new_customers || { today: 0, this_week: 0, this_month: 0 };
  const recentActivity = dashData?.recent_activity || [];
  const calculatedInsights = dashData?.calculated_insights || [];
  const revComparison = dashData?.revenue_comparison || { today_vs_yesterday_pct: 0, week_vs_last_week_pct: 0, month_vs_last_month_pct: 0 };
  const growthMetrics = dashData?.growth_metrics || { customer_growth_pct: 0, revenue_growth_pct: 0, visit_growth_pct: 0, order_growth_pct: 0 };

  return (
    <PageTransition>
      <PageHeader
        title={`Welcome back, ${displayName} 👋`}
        description={`Here's what's happening at ${displayBizName} today.`}
      />

      {isError ? (
        <EmptyState
          title="Failed to load dashboard"
          description={(error as Error)?.message || "Could not retrieve live statistics."}
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
          {/* STAT CARDS GRID */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
            <AppLink path="orders">
              <StatCard
                label="Today's Orders"
                value={todaysOrders}
                icon={ShoppingBag}
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
            <AppLink path="tables">
              <StatCard
                label="Open Visits"
                value={openVisits}
                delta="active in store"
                icon={Utensils}
                accent="info"
                index={2}
              />
            </AppLink>
            <AppLink path="orders">
              <StatCard
                label="Completed Visits"
                value={completedVisits}
                icon={DollarSign}
                accent="warning"
                index={3}
              />
            </AppLink>
            <AppLink path="customers">
              <StatCard
                label="Total Customers"
                value={totalCustomers}
                delta={`${activeCustomers} active`}
                icon={Repeat}
                accent="primary"
                index={4}
              />
            </AppLink>
            <AppLink path="revenue">
              <StatCard
                label="Average Order Value"
                value={fmt(averageBill)}
                delta="per completed order"
                icon={UserMinus}
                accent="destructive"
                index={5}
              />
            </AppLink>
            <AppLink path="revenue">
              <StatCard
                label="Avg Daily Revenue"
                value={fmt(avgDailyRevenue)}
                delta="current month avg"
                icon={TrendingUp}
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
                icon={Ticket}
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
              <p className="text-xs text-muted-foreground">Action items requiring your attention today based on live records.</p>
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

          {/* CHARTS ROW 1: SALES THIS WEEK & BOOKINGS CHART */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="rounded-2xl lg:col-span-2 border shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="font-display text-base">Sales this week</CardTitle>
                  <p className="text-xs text-muted-foreground">Daily paid revenue from Monday to Sunday</p>
                </div>
                <Badge variant="outline" className="rounded-full font-mono text-xs">
                  {fmt(weeklySales.reduce((s: number, d: any) => s + d.sales, 0))} Total
                </Badge>
              </CardHeader>
              <CardContent className="h-72 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklySales}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                    <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" fill="url(#salesGrad)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">Bookings & Visits</CardTitle>
                <p className="text-xs text-muted-foreground">Weekly order count trend</p>
              </CardHeader>
              <CardContent className="h-72 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyBookings}>
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

          {/* CHARTS ROW 2: REPEAT CUSTOMER % & TOP SELLING ITEMS */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">Repeat customer %</CardTitle>
                <p className="text-xs text-muted-foreground">Calculated 6-month repeat visit rate</p>
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
                  <ShoppingBag className="h-4 w-4 text-primary" /> Top selling items
                </CardTitle>
                <p className="text-xs text-muted-foreground">Highest quantity sold from completed orders</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {topSellingItems.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No orders completed yet.</p>
                ) : (
                  topSellingItems.map((it: any) => (
                    <div key={it.name} className="flex items-center justify-between rounded-xl border p-3 bg-card">
                      <div>
                        <p className="text-sm font-medium">{it.name}</p>
                        <p className="text-xs text-muted-foreground">{it.quantity} qty sold</p>
                      </div>
                      <span className="font-semibold text-sm font-mono">{fmt(it.revenue)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* BREAKDOWN CARDS ROW */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border shadow-xs p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Revenue Source</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>QR Orders</span><span className="font-mono font-medium">{fmt(revBreakdown.qr_orders_revenue)}</span></div>
                <div className="flex justify-between"><span>Staff POS</span><span className="font-mono font-medium">{fmt(revBreakdown.staff_orders_revenue)}</span></div>
                <div className="flex justify-between"><span>Walk-in</span><span className="font-mono font-medium">{fmt(revBreakdown.walkin_revenue)}</span></div>
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

            <Card className="rounded-2xl border shadow-xs p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">New Customers</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Today</span><span className="font-bold">{newCustomers.today}</span></div>
                <div className="flex justify-between"><span>This Week</span><span className="font-bold">{newCustomers.this_week}</span></div>
                <div className="flex justify-between"><span>This Month</span><span className="font-bold">{newCustomers.this_month}</span></div>
              </div>
            </Card>

            <Card className="rounded-2xl border shadow-xs p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Peak Operations</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Busy Hour</span><span className="font-medium text-xs truncate max-w-[130px]">{mostBusyHour}</span></div>
                <div className="flex justify-between"><span>Busy Day</span><span className="font-medium text-xs">{mostBusyDay}</span></div>
              </div>
            </Card>
          </div>

          {/* CALCULATED INSIGHTS & RECENT ACTIVITY */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="font-display flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" /> Database Calculated Insights
                </CardTitle>
                <p className="text-xs text-muted-foreground">Automated findings evaluated directly from your business data</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {calculatedInsights.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No insights available yet. Complete more orders to unlock data analytics.</p>
                ) : (
                  calculatedInsights.map((ins: any) => (
                    <div key={ins.id} className="rounded-xl border p-3 bg-primary/5">
                      <p className="text-sm font-semibold text-foreground">{ins.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{ins.detail}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="font-display flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" /> Recent Activity Feed
                </CardTitle>
                <p className="text-xs text-muted-foreground">Live event stream sorted newest first</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentActivity.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No recent activity recorded yet.</p>
                ) : (
                  recentActivity.map((act: any) => (
                    <div key={act.id} className="flex items-center justify-between rounded-xl border p-2.5 text-sm bg-card">
                      <div>
                        <p className="font-medium text-xs">{act.title}</p>
                        <p className="text-[11px] text-muted-foreground">{act.description}</p>
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
