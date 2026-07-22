import { AppLink } from "@/lib/app-nav";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DollarSign, TrendingUp, Calendar, Users, Cake, Gift, UserMinus, Ticket, Star, Repeat, Sparkles, ChevronRight, ListChecks, ShoppingBag, Scissors, Utensils } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { businessSales, bookingsSeries, repeatCustomerSeries, aiSuggestions, coupons } from "@/lib/sample-data";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/page-transition";
import { getCelebrants } from "@/lib/celebration-utils";
import { useReviewRows } from "@/lib/review-store";
import { useActiveCustomers } from "@/lib/archive-store";
import { useBusinessType } from "@/lib/business-type";
import { useProfile } from "@/lib/business-profile";
import { useOrders, orderTopSelling, isToday } from "@/lib/orders-store";
import { useAppointments, topServices } from "@/lib/appointments-store";
import { fmt } from "@/lib/currency";
import { SkeletonStatsGrid, useShortMountFlag } from "@/components/skeletons";

export const Route = createFileRoute("/app/$type/$business/dashboard")({ component: BusinessDashboard });

function BusinessDashboard() {
  const type = useBusinessType();
  const loading = useShortMountFlag();
  const restaurant = useProfile("restaurant");
  const salon = useProfile("salon");
  const bizName = type === "salon" ? salon.name : restaurant.name;
  const bdays = getCelebrants("birthday", "today").length;
  const annis = getCelebrants("anniversary", "today").length;
  const rows = useReviewRows();
  const pendingReviews = rows.filter((r) => r.status === "pending").length;
  const active = useActiveCustomers();
  const orders = useOrders();
  const appts = useAppointments();
  const DEMO_TODAY = new Date("2026-07-17T00:00:00");
  const recovery = active.filter((c) => (DEMO_TODAY.getTime() - new Date(c.lastVisit).getTime()) / 86400000 >= 30).length;
  const expiring = coupons.filter((c) => c.status === "active" && new Date(c.expiry).getTime() - DEMO_TODAY.getTime() < 30 * 86400000).length;
  const repeatCustomers = active.filter((c) => c.visits >= 5).length;

  const todaysOrders = orders.filter((o) => isToday(o.createdAt));
  const todaysRevenue = todaysOrders.reduce((s, o) => s + o.total, 0);
  const activeTables = new Set(orders.filter((o) => o.status !== "completed" && o.table && o.table !== "Parcel" && o.table !== "Take Away").map((o) => o.table)).size;
  const paymentPending = orders.filter((o) => o.paymentStatus === "unpaid").length;
  const topItems = orderTopSelling(orders, 5);

  const todaysAppts = appts.filter((a) => isToday(a.start));
  const salonRevenue = todaysAppts.reduce((s, a) => s + a.price, 0);
  const topSvcs = topServices(appts, 5);

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
        title={`Good evening, ${type === "salon" ? "Aisha" : "Priya"} 👋`}
        description={`Here's what's happening at ${bizName} today.`}
        actions={<Badge variant="secondary" className="rounded-full"><Sparkles className="mr-1 h-3 w-3 text-primary" /> AI insights ready</Badge>}
      />

      {loading ? <SkeletonStatsGrid count={8} /> : type === "restaurant" ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <AppLink path="orders"><StatCard label="Today's Orders" value={todaysOrders.length || "—"} icon={ShoppingBag} accent="primary" index={0} /></AppLink>
          <AppLink path="revenue"><StatCard label="Today's Revenue" value={fmt(todaysRevenue || 1842)} delta="+12% vs yesterday" icon={DollarSign} accent="accent" index={1} /></AppLink>
          <AppLink path="tables"><StatCard label="Active Tables" value={activeTables || "0"} delta={`of ${restaurant.tables}`} icon={Utensils} accent="info" index={2} /></AppLink>
          <AppLink path="orders" search={{ payment: "unpaid" } as any}><StatCard label="Payment pending" value={paymentPending} icon={DollarSign} accent="warning" index={3} /></AppLink>
          <AppLink path="customers"><StatCard label="Repeat Customers" value={repeatCustomers} delta="5+ visits" icon={Repeat} accent="primary" index={4} /></AppLink>
          <AppLink path="review-booster"><StatCard label="Pending Reviews" value={pendingReviews} icon={Star} accent="warning" index={5} /></AppLink>
          <AppLink path="customer-recovery"><StatCard label="Recovery Customers" value={recovery} delta="30+ days" trend="down" icon={UserMinus} accent="destructive" index={6} /></AppLink>
          <AppLink path="coupons"><StatCard label="Coupons expiring" value={expiring} icon={Ticket} accent="info" index={7} /></AppLink>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <AppLink path="appointments"><StatCard label="Today's Appointments" value={todaysAppts.length || "—"} icon={Calendar} accent="primary" index={0} /></AppLink>
          <AppLink path="revenue"><StatCard label="Today's Revenue" value={fmt(salonRevenue || 1420)} delta="+9% vs yesterday" icon={DollarSign} accent="accent" index={1} /></AppLink>
          <AppLink path="customers"><StatCard label="Repeat Customers" value={repeatCustomers} delta="5+ visits" icon={Repeat} accent="primary" index={2} /></AppLink>
          <AppLink path="review-booster"><StatCard label="Pending Reviews" value={pendingReviews} icon={Star} accent="warning" index={3} /></AppLink>
          <AppLink path="customer-recovery"><StatCard label="Recovery Customers" value={recovery} delta="30+ days" trend="down" icon={UserMinus} accent="destructive" index={4} /></AppLink>
          <AppLink path="birthday-campaigns/today"><StatCard label="Birthdays today" value={bdays} icon={Cake} accent="warning" index={5} /></AppLink>
          <AppLink path="customers"><StatCard label="Customers" value={active.length} icon={Users} accent="info" index={6} /></AppLink>
          <AppLink path="coupons"><StatCard label="Coupons expiring" value={expiring} icon={Ticket} accent="info" index={7} /></AppLink>
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
            {(type === "restaurant" ? topItems : topSvcs).length === 0 ? (
              <div className="space-y-3">
                {aiSuggestions.slice(0, 3).map((s, i) => (
                  <motion.div key={s.title} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="glass rounded-xl p-3">
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
                  </motion.div>
                ))}
              </div>
            ) : (
              (type === "restaurant" ? topItems : topSvcs).map((it: any, i) => (
                <motion.div key={it.name} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <p className="text-sm font-medium">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{type === "restaurant" ? `${it.qty} sold` : `${it.count} bookings`}</p>
                  </div>
                  <span className="font-semibold">{fmt(it.revenue)}</span>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

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