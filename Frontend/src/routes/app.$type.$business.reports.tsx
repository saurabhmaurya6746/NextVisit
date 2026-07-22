import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { businessSales, bookingsSeries, campaignAnalytics, customers } from "@/lib/sample-data";

export const Route = createFileRoute("/app/$type/$business/reports")({ component: ReportsPage });

function ReportsPage() {
  const top = [...customers].sort((a, b) => b.spent - a.spent).slice(0, 5);
  const items = [
    { name: "Butter Chicken", sold: 412, revenue: 5320 },
    { name: "Signature Facial", sold: 208, revenue: 8320 },
    { name: "Cappuccino", sold: 1204, revenue: 3612 },
    { name: "Deep Tissue Massage", sold: 148, revenue: 7400 },
    { name: "Tiramisu", sold: 336, revenue: 2688 },
  ];
  return (
    <>
      <PageHeader title="Reports" description="Revenue, customers, campaigns and more."
        actions={<Button size="sm" variant="outline" className="rounded-full"><Download className="mr-1.5 h-4 w-4" /> Export PDF</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl"><CardHeader><CardTitle className="font-display">Revenue</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={businessSales}>
                <defs><linearGradient id="r" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="oklch(0.6 0.22 275)" stopOpacity={0.5} /><stop offset="100%" stopColor="oklch(0.6 0.22 275)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" fontSize={12} stroke="var(--muted-foreground)" /><YAxis fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Area dataKey="sales" stroke="oklch(0.6 0.22 275)" fill="url(#r)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="font-display">Bookings</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookingsSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" fontSize={12} stroke="var(--muted-foreground)" /><YAxis fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="bookings" fill="oklch(0.7 0.17 165)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="font-display">Top customers</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {top.map((c, i) => (
              <div key={c.id} className="flex items-center justify-between py-3">
                <div><p className="font-medium">{i + 1}. {c.name}</p><p className="text-xs text-muted-foreground">{c.visits} visits</p></div>
                <p className="font-display font-semibold">${c.spent}</p>
              </div>
            ))}
          </CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="font-display">Top selling items</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {items.map((it) => (
              <div key={it.name} className="flex items-center justify-between py-3">
                <div><p className="font-medium">{it.name}</p><p className="text-xs text-muted-foreground">{it.sold} sold</p></div>
                <p className="font-display font-semibold">${it.revenue.toLocaleString()}</p>
              </div>
            ))}
          </CardContent></Card>
        <Card className="rounded-2xl lg:col-span-2"><CardHeader><CardTitle className="font-display">Campaign performance</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaignAnalytics}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" fontSize={12} stroke="var(--muted-foreground)" /><YAxis fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="sent" fill="oklch(0.6 0.22 275)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="opened" fill="oklch(0.7 0.17 165)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="converted" fill="oklch(0.75 0.17 65)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
      </div>
    </>
  );
}