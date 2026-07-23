import { AppLink } from "@/lib/app-nav";
import { createFileRoute } from "@tanstack/react-router";
import { DollarSign, Calendar, Users, Cake, Gift, UserMinus, Ticket, Star, Repeat, Sparkles, ChevronRight, ListChecks, ShoppingBag, Scissors, Utensils, AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { businessSales, bookingsSeries, repeatCustomerSeries, aiSuggestions, coupons } from "@/lib/sample-data";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { getCelebrants } from "@/lib/celebration-utils";
import { useReviewRows } from "@/lib/review-store";
import { useActiveCustomers } from "@/lib/archive-store";
import { useBusinessType } from "@/lib/business-type";
import { useProfile } from "@/lib/business-profile";
import { fmt } from "@/lib/currency";
import { SkeletonStatsGrid } from "@/components/skeletons";
import { apiFetch, getSession } from "@/lib/auth";
import { useState, useEffect, useCallback } from "react";

export const Route = createFileRoute("/app/$type/$business/dashboard")({ component: BusinessDashboard });

function BusinessDashboard() {
  const type = useBusinessType();
  const session = getSession();

  const [userName, setUserName] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const [dashData, setDashData] = useState<any>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadAllDashboardData = useCallback(async () => {
    setFetchLoading(true);
    setFetchError(null);

    const token = localStorage.getItem("growthos:token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    try {
      // Parallel API calls for performance
      const [userRes, bizRes, dashRes] = await Promise.all([
        apiFetch("/api/v1/auth/me"),
        apiFetch("/api/v1/business"),
        apiFetch("/api/v1/dashboard"),
      ]);

      if (userRes.ok) {
        const u = await userRes.json();
        if (u.name) setUserName(u.name);
      }
      if (bizRes.ok) {
        const b = await bizRes.json();
        if (b.name) setBusinessName(b.name);
      }
      if (!dashRes.ok) {
        throw new Error(`Failed to load dashboard statistics (HTTP ${dashRes.status})`);
      }
      const d = await dashRes.json();
      setDashData(d);
    } catch (err: any) {
      console.error("[DASHBOARD] Parallel fetch error:", err);
      setFetchError(err.message || "Failed to load dashboard statistics.");
    } finally {
      setFetchLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllDashboardData();
  }, [loadAllDashboardData]);

  const restaurant = useProfile("restaurant");
  const salon = useProfile("salon");

  // Dynamic user and business info
  const displayName = userName || session?.businessName?.split(" ")[0] || (type === "salon" ? "Owner" : "Owner");
  const displayBizName = businessName || session?.businessName || (type === "salon" ? salon.name : restaurant.name);

  // Backend metrics mapping
  const todaysVisitsCount = dashData?.today_orders ?? dashData?.today_visits ?? 0;
  const todaysRevenueAmount = dashData?.today_revenue ?? 0;
  const totalCustomersCount = dashData?.total_customers ?? 0;
  const activeCustomersCount = dashData?.active_customers ?? 0;
  const openVisitsCount = dashData?.open_visits ?? 0;
  const completedVisitsCount = dashData?.completed_visits ?? 0;
  const totalRevenueAmount = dashData?.total_revenue ?? 0;
  const averageBillAmount = dashData?.average_bill ?? 0;

  const topBackendServices = (dashData?.top_services || []).map((s: any) => ({
    name: s.service_name || s.name || "Service",
    count: s.visit_count ?? s.total ?? 0,
    qty: s.visit_count ?? s.total ?? 0,
    revenue: s.revenue ?? s.total ?? 0,
  }));

  const recentVisitsList = dashData?.recent_visits || [];

  const bdays = getCelebrants("birthday", "today").length;
  const annis = getCelebrants("anniversary", "today").length;
  const rows = useReviewRows();
  const pendingReviews = rows.filter((r) => r.status === "pending").length;
  const active = useActiveCustomers();
  const DEMO_TODAY = new Date("2026-07-17T00:00:00");
  const recovery = active.filter((c) => (DEMO_TODAY.getTime() - new Date(c.lastVisit).getTime()) / 86400000 >= 30).length;
  const expiring = coupons.filter((c) => c.status === "active" && new Date(c.expiry).getTime() - DEMO_TODAY.getTime() < 30 * 86400000).length;

  const tasks = [
    { label: "Today's Birthdays", value: bdays, path: "birthday-campaigns/today", icon: Cake, tone: "text-primary" },
    { label: "Today's Anniversaries", value: annis, path: "anniversary-campaigns/today", icon: Gift, tone: "text-accent-foreground" },
    { label: "Pending Reviews", value: pendingReviews, path: "review-booster", icon: Star, tone: "text-warning-foreground" },
    { label: "Recovery Customers", value: recovery, path: "customer-recovery", icon: UserMinus, tone: "text-destructive" },
    { label: "Coupons Expiring", value: expiring, path: "coupons", icon: Ticket, tone: "text-info" },
  ] as const;

  return (
    <PageTransition>
      <PageHeader
        title={`Good evening, ${displayName} 👋`}
        description={`Here's what's happening at ${displayBizName} today.`}
        actions={<Badge variant="secondary" className="rounded-full"><Sparkles className="mr-1 h-3 w-3 text-primary" /> AI insights ready</Badge>}
      />

      {fetchError ? (
        <EmptyState
          title="Failed to load dashboard"
          description={fetchError}
          icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
          action={
            <Button variant="outline" className="rounded-full" onClick={loadAllDashboardData}>
              Retry
            </Button>
          }
        />
      ) : fetchLoading ? (
        <SkeletonStatsGrid count={8} />
      ) : type === "restaurant" ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <AppLink path="orders"><StatCard label="Today's Orders" value={todaysVisitsCount} icon={ShoppingBag} accent="primary" index={0} /></AppLink>
          <AppLink path="revenue"><StatCard label="Today's Revenue" value={fmt(todaysRevenueAmount)} delta="+12% vs yesterday" icon={DollarSign} accent="accent" index={1} /></AppLink>
          <AppLink path="tables"><StatCard label="Open Visits" value={openVisitsCount} delta="in progress" icon={Utensils} accent="info" index={2} /></AppLink>
          <AppLink path="orders"><StatCard label="Completed Visits" value={completedVisitsCount} icon={DollarSign} accent="warning" index={3} /></AppLink>
          <AppLink path="customers"><StatCard label="Total Customers" value={totalCustomersCount} delta={`${activeCustomersCount} active`} icon={Repeat} accent="primary" index={4} /></AppLink>
          <AppLink path="review-booster"><StatCard label="Pending Reviews" value={pendingReviews} icon={Star} accent="warning" index={5} /></AppLink>
          <AppLink path="customer-recovery"><StatCard label="Average Bill" value={fmt(averageBillAmount)} delta="per visit" trend="up" icon={UserMinus} accent="destructive" index={6} /></AppLink>
          <AppLink path="coupons"><StatCard label="Total Revenue" value={fmt(totalRevenueAmount)} icon={Ticket} accent="info" index={7} /></AppLink>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <AppLink path="appointments"><StatCard label="Today's Appointments" value={todaysVisitsCount} icon={Calendar} accent="primary" index={0} /></AppLink>
          <AppLink path="revenue"><StatCard label="Today's Revenue" value={fmt(todaysRevenueAmount)} delta="+9% vs yesterday" icon={DollarSign} accent="accent" index={1} /></AppLink>
          <AppLink path="customers"><StatCard label="Total Customers" value={totalCustomersCount} delta={`${activeCustomersCount} active`} icon={Repeat} accent="primary" index={2} /></AppLink>
          <AppLink path="review-booster"><StatCard label="Open Visits" value={openVisitsCount} icon={Star} accent="warning" index={3} /></AppLink>
          <AppLink path="customer-recovery"><StatCard label="Completed Visits" value={completedVisitsCount} delta="completed" trend="up" icon={UserMinus} accent="destructive" index={4} /></AppLink>
          <AppLink path="birthday-campaigns/today"><StatCard label="Birthdays today" value={bdays} icon={Cake} accent="warning" index={5} /></AppLink>
          <AppLink path="customers"><StatCard label="Average Bill" value={fmt(averageBillAmount)} icon={Users} accent="info" index={6} /></AppLink>
          <AppLink path="coupons"><StatCard label="Total Revenue" value={fmt(totalRevenueAmount)} icon={Ticket} accent="info" index={7} /></AppLink>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle className="font-display">Sales this week</CardTitle><p className="text-xs text-muted-foreground">Daily revenue in USD</p></div>
            <Badge variant="secondary" className="rounded-full">+18% WoW</Badge>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={businessSales}>
                <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="oklch(0.6 0.22 275)" stopOpacity={0.5} /><stop offset="100%" stopColor="oklch(0.6 0.22 275)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="sales" stroke="oklch(0.6 0.22 275)" fill="url(#s)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-display flex items-center gap-2">
            {type === "restaurant" ? <><ShoppingBag className="h-4 w-4 text-primary" /> Top selling items</> : <><Scissors className="h-4 w-4 text-primary" /> Top services</>}
          </CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(topBackendServices.length > 0 ? topBackendServices : []).length === 0 ? (
              <div className="space-y-3">
                {aiSuggestions.slice(0, 3).map((s, i) => (
                  <motion.div key={s.title} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="glass rounded-xl p-3">
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
                  </motion.div>
                ))}
              </div>
            ) : (
              topBackendServices.map((it: any, i: number) => (
                <motion.div key={it.name} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <p className="text-sm font-medium">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{`${it.count} visits`}</p>
                  </div>
                  <span className="font-semibold">{fmt(it.revenue)}</span>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {recentVisitsList.length > 0 && (
        <Card className="mt-4 rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Recent Visits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentVisitsList.map((v: any, i: number) => (
              <motion.div key={v.visit_id || v.id || i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <div>
                  <p className="font-medium">{v.customer_name || "Guest Customer"}</p>
                  <p className="text-xs text-muted-foreground">{v.completed_at ? new Date(v.completed_at).toLocaleString() : v.status}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{fmt(v.total_amount || 0)}</span>
                  <Badge variant="outline" className="rounded-full text-[10px] uppercase">{v.payment_status || v.status}</Badge>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mt-4 rounded-2xl">
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" /> Today's tasks</CardTitle><p className="text-xs text-muted-foreground">One-click drill-in to the day's most important lists.</p></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {tasks.map((t, i) => (
            <motion.div key={t.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <AppLink path={t.path} className="group block rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-glow">
                <div className="flex items-center justify-between">
                  <div className={`grid h-9 w-9 place-items-center rounded-lg bg-muted ${t.tone}`}>
                    <t.icon className="h-4 w-4" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t.label}</p>
                <p className="font-display text-2xl font-semibold">{t.value}</p>
              </AppLink>
            </motion.div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-display">{type === "salon" ? "Appointments" : "Bookings"}</CardTitle><p className="text-xs text-muted-foreground">Weekly trend</p></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookingsSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="bookings" fill="oklch(0.7 0.17 165)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-display">Repeat customer %</CardTitle><p className="text-xs text-muted-foreground">Six-month trend</p></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={repeatCustomerSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="rate" stroke="oklch(0.65 0.2 340)" strokeWidth={3} dot={{ r: 5, fill: "oklch(0.65 0.2 340)" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}