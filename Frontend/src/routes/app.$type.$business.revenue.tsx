import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  DollarSign, ShoppingBag, QrCode, Banknote, CreditCard, Smartphone,
  TrendingUp, Calendar, Users, Award, Percent, ChevronUp, ChevronDown,
  Clock, Receipt, Filter, ArrowUpRight, ArrowDownRight, Tag, Utensils
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { SkeletonRows, SkeletonCustomerCards } from "@/components/skeletons";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line } from "recharts";
import { fmt } from "@/lib/currency";
import { getRevenueAnalyticsApi, type RevenueAnalyticsData } from "@/lib/orders-api";
import { listDiningAreasApi, type DiningArea } from "@/lib/dining-area-api";

export const Route = createFileRoute("/app/$type/$business/revenue")({
  head: () => ({ meta: [{ title: "Revenue Analytics — NextVisit" }] }),
  component: RevenuePage,
});

function RevenuePage() {
  const [data, setData] = useState<RevenueAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [period, setPeriod] = useState<string>("this_month");
  const [paymentMethod, setPaymentMethod] = useState<string>("ALL");
  const [orderSource, setOrderSource] = useState<string>("ALL");
  const [diningAreaId, setDiningAreaId] = useState<string>("ALL");
  const [areas, setAreas] = useState<DiningArea[]>([]);

  // Load dining areas for dropdown filter
  useEffect(() => {
    listDiningAreasApi()
      .then(setAreas)
      .catch((err: any) => console.error("Failed to load dining areas for filter:", err));
  }, []);

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRevenueAnalyticsApi({
        period,
        dining_area_id: diningAreaId === "ALL" ? undefined : diningAreaId,
        payment_method: paymentMethod === "ALL" ? undefined : paymentMethod,
        order_source: orderSource === "ALL" ? undefined : orderSource,
      });
      setData(res);
    } catch (err) {
      console.error("❌ Failed to fetch revenue analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [period, paymentMethod, orderSource, diningAreaId]);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  if (loading && !data) {
    return (
      <PageTransition>
        <PageHeader title="Revenue Analytics" description="Paid orders only · updated in real time" />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <SkeletonCustomerCards count={4} />
          </div>
          <SkeletonRows rows={8} cols={4} />
        </div>
      </PageTransition>
    );
  }

  const top = data?.top_cards;
  const ca = data?.customer_analytics;
  const oa = data?.order_analytics;
  const da = data?.dining_analytics;
  const ta = data?.tax_discount_analytics;

  return (
    <PageTransition>
      <PageHeader
        title="Revenue Analytics"
        description="Real-time business analytics for paid orders & settled visits"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter: Period */}
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[130px] h-9 text-xs rounded-full bg-background border">
                <Calendar className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="last_week">Last Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter: Payment Method */}
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="w-[130px] h-9 text-xs rounded-full bg-background border">
                <Banknote className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Payments</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="CARD">Card</SelectItem>
                <SelectItem value="ONLINE">Online</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter: Order Source */}
            <Select value={orderSource} onValueChange={setOrderSource}>
              <SelectTrigger className="w-[120px] h-9 text-xs rounded-full bg-background border">
                <QrCode className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Sources</SelectItem>
                <SelectItem value="QR">QR Orders</SelectItem>
                <SelectItem value="POS">Staff / POS</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter: Dining Area */}
            {areas.length > 0 && (
              <Select value={diningAreaId} onValueChange={setDiningAreaId}>
                <SelectTrigger className="w-[130px] h-9 text-xs rounded-full bg-background border">
                  <Utensils className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Dining Area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Areas</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button variant="outline" size="sm" className="rounded-full h-9 text-xs" onClick={fetchRevenue}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* TOP 4 STAT CARDS WITH % CHANGE */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <RevenueStatCard
          label="Today Revenue"
          amount={top?.today.amount || 0}
          changePct={top?.today.change_pct || 0}
          count={top?.today.orders_count || 0}
          icon={DollarSign}
          accent="primary"
        />
        <RevenueStatCard
          label="This Week Revenue"
          amount={top?.week.amount || 0}
          changePct={top?.week.change_pct || 0}
          count={top?.week.orders_count || 0}
          icon={TrendingUp}
          accent="accent"
        />
        <RevenueStatCard
          label="This Month Revenue"
          amount={top?.month.amount || 0}
          changePct={top?.month.change_pct || 0}
          count={top?.month.orders_count || 0}
          icon={TrendingUp}
          accent="info"
        />
        <RevenueStatCard
          label="This Year Revenue"
          amount={top?.year.amount || 0}
          changePct={top?.year.change_pct || 0}
          count={top?.year.orders_count || 0}
          icon={TrendingUp}
          accent="warning"
        />
      </div>

      {/* REVENUE CHARTS (TABBED: DAILY, HOURLY, MONTHLY) */}
      <Card className="mt-6 rounded-2xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base">Revenue Trends & Patterns</CardTitle>
          <CardDescription className="text-xs">Visualize sales over time across peak hours, daily performance, and monthly growth</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <Tabs defaultValue="daily" className="w-full">
            <TabsList className="mb-4 bg-muted/60 p-1 rounded-xl">
              <TabsTrigger value="daily" className="text-xs rounded-lg">Daily (Last 30 Days)</TabsTrigger>
              <TabsTrigger value="hourly" className="text-xs rounded-lg">Hourly Peak Hours</TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs rounded-lg">Monthly (Last 12 Months)</TabsTrigger>
            </TabsList>

            <TabsContent value="daily" className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.daily || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: any) => fmt(v as number)}
                    labelFormatter={(lbl) => `Day ${lbl}`}
                  />
                  <Bar dataKey="revenue" fill="oklch(0.6 0.22 275)" radius={[6, 6, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="hourly" className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.hourly || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: any) => fmt(v as number)}
                  />
                  <Bar dataKey="revenue" fill="oklch(0.65 0.2 140)" radius={[6, 6, 0, 0]} name="Today Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="monthly" className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.monthly || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: any) => fmt(v as number)}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="oklch(0.6 0.22 275)" strokeWidth={3} dot={{ r: 4 }} name="Monthly Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* REVENUE BREAKDOWN GRID (SOURCE, PAYMENT, CATEGORY) */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Revenue by Source */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader><CardTitle className="font-display text-sm">Revenue by Source</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-xs">
            {data?.by_source.map((src) => (
              <div key={src.source} className="space-y-1 rounded-xl border p-3 bg-card">
                <div className="flex items-center justify-between font-medium">
                  <span className="flex items-center gap-2">
                    {src.source.includes("QR") ? <QrCode className="h-4 w-4 text-primary" /> : <ShoppingBag className="h-4 w-4 text-emerald-600" />}
                    {src.source}
                  </span>
                  <span className="font-bold font-mono">{fmt(src.amount)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{src.count} orders</span>
                  <span>{src.percentage}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${src.percentage}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Revenue by Payment Method */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader><CardTitle className="font-display text-sm">Revenue by Payment</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-xs">
            {data?.by_payment.map((pay) => (
              <div key={pay.method} className="space-y-1 rounded-xl border p-3 bg-card">
                <div className="flex items-center justify-between font-medium">
                  <span className="flex items-center gap-2">
                    {pay.method === "CASH" ? <Banknote className="h-4 w-4 text-emerald-600" /> : pay.method === "UPI" ? <Smartphone className="h-4 w-4 text-primary" /> : <CreditCard className="h-4 w-4 text-amber-600" />}
                    {pay.method}
                  </span>
                  <span className="font-bold font-mono">{fmt(pay.amount)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{pay.count} txns</span>
                  <span>{pay.percentage}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${pay.percentage}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Category Revenue */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader><CardTitle className="font-display text-sm">Category Revenue</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-xs">
            {data?.by_category.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No category data yet.</p>
            ) : (
              data?.by_category.map((cat) => (
                <div key={cat.category} className="space-y-1 rounded-xl border p-3 bg-card">
                  <div className="flex items-center justify-between font-medium">
                    <span>{cat.category}</span>
                    <span className="font-bold font-mono">{fmt(cat.revenue)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{cat.items_sold} items sold</span>
                    <span>{cat.percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: `${cat.percentage}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* TOP & LEAST SELLING ITEMS */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Top 10 Selling Items */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-sm flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" /> Top Selling Items
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {data?.top_items.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No paid item sales recorded yet.</p>
            ) : (
              data?.top_items.map((it, i) => (
                <div key={it.name} className="flex items-center justify-between rounded-xl border p-2.5 bg-card">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary text-xs font-bold font-mono">{i + 1}</span>
                    <div>
                      <p className="font-semibold text-foreground">{it.name}</p>
                      <p className="text-[10px] text-muted-foreground">{it.quantity_sold} sold · Avg {fmt(it.avg_price)}</p>
                    </div>
                  </div>
                  <span className="font-bold text-foreground font-mono">{fmt(it.revenue)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Least Selling Items */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-sm flex items-center gap-2">
              <Tag className="h-4 w-4 text-rose-500" /> Least Selling Items
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {data?.least_items.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No paid item sales recorded yet.</p>
            ) : (
              data?.least_items.map((it, i) => (
                <div key={it.name} className="flex items-center justify-between rounded-xl border p-2.5 bg-card">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-muted-foreground text-xs font-bold font-mono">{i + 1}</span>
                    <div>
                      <p className="font-semibold text-foreground">{it.name}</p>
                      <p className="text-[10px] text-muted-foreground">{it.quantity_sold} sold · Avg {fmt(it.avg_price)}</p>
                    </div>
                  </div>
                  <span className="font-bold text-foreground font-mono">{fmt(it.revenue)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* BUSINESS ANALYTICS: CUSTOMER, ORDER, DINING, TAX & DISCOUNTS */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Customer Revenue Analytics */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader><CardTitle className="font-display text-sm">Customer Analytics</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            <StatRow label="New Customer Rev" value={fmt(ca?.new_customer_revenue || 0)} />
            <StatRow label="Returning Rev" value={fmt(ca?.returning_customer_revenue || 0)} />
            <StatRow label="Avg Spend/Customer" value={fmt(ca?.avg_spend_per_customer || 0)} />
            <StatRow label="Repeat Cust %" value={`${ca?.repeat_customer_pct || 0}%`} />
            {ca?.highest_spending_customer && (
              <div className="border-t pt-2 mt-1">
                <span className="text-[10px] text-muted-foreground">Top Spender:</span>
                <p className="font-semibold text-foreground">{ca.highest_spending_customer.name} ({fmt(ca.highest_spending_customer.spent)})</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Analytics */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader><CardTitle className="font-display text-sm">Order Analytics</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            <StatRow label="Total Paid Orders" value={oa?.total_paid_orders || 0} />
            <StatRow label="Avg Order Value (AOV)" value={fmt(oa?.average_order_value || 0)} />
            <StatRow label="Largest Order" value={fmt(oa?.largest_order || 0)} />
            <StatRow label="Smallest Order" value={fmt(oa?.smallest_order || 0)} />
            <StatRow label="Avg Items/Order" value={oa?.avg_items_per_order || 0} />
          </CardContent>
        </Card>

        {/* Dining Analytics */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader><CardTitle className="font-display text-sm">Dining Analytics</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            <StatRow label="Most Occupied Table" value={da?.most_occupied_table || "N/A"} />
            <StatRow label="Top Revenue Table" value={da?.highest_revenue_table || "N/A"} />
            {da?.revenue_by_area.map((a) => (
              <StatRow key={a.area_name} label={`${a.area_name} Rev`} value={fmt(a.revenue)} />
            ))}
          </CardContent>
        </Card>

        {/* Tax & Discount Analytics */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader><CardTitle className="font-display text-sm">Tax & Discount</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            <StatRow label="Gross Revenue" value={fmt(ta?.gross_revenue || 0)} />
            <StatRow label="Tax Collected" value={fmt(ta?.total_tax_collected || 0)} />
            <StatRow label="Discounts Given" value={`-${fmt(ta?.total_discount_given || 0)}`} />
            <div className="border-t pt-2 flex justify-between font-bold text-sm text-foreground">
              <span>Net Revenue</span>
              <span className="font-mono text-primary">{fmt(ta?.net_revenue || 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}

function RevenueStatCard({
  label, amount, changePct, count, icon: Icon, accent
}: {
  label: string; amount: number; changePct: number; count: number; icon: any; accent: string
}) {
  const isPos = changePct >= 0;
  return (
    <Card className="rounded-2xl border shadow-sm p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="p-2 rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p className="font-display text-2xl font-bold text-foreground font-mono">{fmt(amount)}</p>
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{count} paid orders</span>
          <Badge variant={isPos ? "secondary" : "destructive"} className="rounded-full text-[10px] px-1.5 py-0.2 flex items-center gap-0.5">
            {isPos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(changePct)}%
          </Badge>
        </div>
      </div>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between border-b pb-1.5 last:border-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="font-medium font-mono text-foreground">{value}</span>
    </div>
  );
}