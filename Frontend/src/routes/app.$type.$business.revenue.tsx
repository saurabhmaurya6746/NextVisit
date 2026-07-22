import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { DollarSign, ShoppingBag, QrCode, Banknote, CreditCard, Smartphone, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useOrders, orderTopSelling } from "@/lib/orders-store";
import { fmt } from "@/lib/currency";

export const Route = createFileRoute("/app/$type/$business/revenue")({
  head: () => ({ meta: [{ title: "Revenue details — NextVisit" }] }),
  component: RevenuePage,
});

function RevenuePage() {
  const orders = useOrders();
  const paid = orders.filter((o) => o.paymentStatus === "paid");

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dow = (new Date(startToday).getDay() + 6) % 7;
  const startWeek = startToday - dow * 86_400_000;
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startYear = new Date(now.getFullYear(), 0, 1).getTime();

  const sum = (from: number) => paid.filter((o) => new Date(o.createdAt).getTime() >= from).reduce((s, o) => s + o.total, 0);
  const today = sum(startToday);
  const week = sum(startWeek);
  const month = sum(startMonth);
  const year = sum(startYear);

  const qrRev = paid.filter((o) => o.source === "qr").reduce((s, o) => s + o.total, 0);
  const staffRev = paid.filter((o) => o.source === "staff").reduce((s, o) => s + o.total, 0);

  const byPay = { cash: 0, upi: 0, card: 0 } as Record<string, number>;
  for (const o of paid) if (o.payment) byPay[o.payment] = (byPay[o.payment] || 0) + o.total;

  const top = orderTopSelling(paid, 5);

  const daily = useMemo(() => {
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const arr = Array.from({ length: days }, (_, i) => ({ day: String(i + 1), revenue: 0 }));
    for (const o of paid) {
      const d = new Date(o.createdAt);
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
      arr[d.getDate() - 1].revenue += o.total;
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  return (
    <PageTransition>
      <PageHeader title="Revenue details" description="Paid orders only · updated in real time" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Today" value={fmt(today)} icon={DollarSign} accent="primary" index={0} />
        <StatCard label="This week" value={fmt(week)} icon={TrendingUp} accent="accent" index={1} />
        <StatCard label="This month" value={fmt(month)} icon={TrendingUp} accent="info" index={2} />
        <StatCard label="This year" value={fmt(year)} icon={TrendingUp} accent="warning" index={3} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-display">Revenue by source</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Row icon={<QrCode className="h-4 w-4" />} label="QR Orders" value={qrRev} />
            <Row icon={<ShoppingBag className="h-4 w-4" />} label="Staff Orders" value={staffRev} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-display">Revenue by payment</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Row icon={<Banknote className="h-4 w-4" />} label="Cash" value={byPay.cash} />
            <Row icon={<Smartphone className="h-4 w-4" />} label="UPI" value={byPay.upi} />
            <Row icon={<CreditCard className="h-4 w-4" />} label="Card" value={byPay.card} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 rounded-2xl">
        <CardHeader><CardTitle className="font-display">Top 5 items by revenue</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {top.length === 0 ? <p className="text-sm text-muted-foreground">No paid orders yet.</p> : top.map((it, i) => (
            <div key={it.name} className="flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-xs font-semibold">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium">{it.name}</p>
                  <p className="text-xs text-muted-foreground">{it.qty} sold</p>
                </div>
              </div>
              <span className="font-semibold">{fmt(it.revenue)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-2xl">
        <CardHeader><CardTitle className="font-display">Daily revenue — this month</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v: any) => fmt(v as number)} />
              <Bar dataKey="revenue" fill="oklch(0.6 0.22 275)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </PageTransition>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-3">
      <div className="flex items-center gap-2 text-sm"><span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-primary">{icon}</span>{label}</div>
      <span className="font-semibold">{fmt(value || 0)}</span>
    </div>
  );
}