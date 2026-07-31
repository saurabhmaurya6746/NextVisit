import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getSession } from "@/lib/auth";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  getReportsAnalyticsApi,
  downloadReportsPdfApi,
} from "@/lib/reports-api";

export const Route = createFileRoute("/app/$type/$business/reports")({ component: ReportsPage });

function ReportsPage() {
  const session = getSession();
  const [isExporting, setIsExporting] = useState(false);

  // React Query: Fetch 100% Database-Driven Reports Analytics
  const { data: analytics, isLoading, isError } = useQuery({
    queryKey: ["reports-analytics", session?.clientId],
    queryFn: getReportsAnalyticsApi,
    refetchInterval: 30000,
  });

  const revenueSeries = analytics?.revenue_series ?? [];
  const bookingsSeries = analytics?.bookings_series ?? [];
  const topCustomers = analytics?.top_customers ?? [];
  const topItems = analytics?.top_items ?? [];
  const campaignPerformance = analytics?.campaign_performance ?? [];

  // Export PDF Report handler
  async function handleExportPdf() {
    setIsExporting(true);
    try {
      await downloadReportsPdfApi();
      toast.success("PDF Analytics Report downloaded successfully!");
    } catch (e: any) {
      toast.error(e.message || "Failed to download PDF report");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Revenue, customers, campaigns and more."
        actions={
          <Button
            size="sm"
            variant="outline"
            className="rounded-full font-semibold transition-all hover:bg-primary hover:text-primary-foreground"
            onClick={handleExportPdf}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generating PDF…
              </>
            ) : (
              <>
                <Download className="mr-1.5 h-4 w-4" /> Export PDF
              </>
            )}
          </Button>
        }
      />

      {isLoading ? (
        <div className="py-24 text-center text-sm text-muted-foreground">Loading database analytics reports…</div>
      ) : isError ? (
        <div className="py-16 text-center text-sm text-destructive">Failed to load analytics report data.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* REVENUE AREA CHART */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="p-4 border-b">
              <CardTitle className="font-display text-sm">Revenue</CardTitle>
            </CardHeader>
            <CardContent className="h-64 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries}>
                  <defs>
                    <linearGradient id="r" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.6 0.22 275)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="oklch(0.6 0.22 275)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" fontSize={12} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={12} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }}
                    formatter={(value: any) => [fmt(Number(value)), "Revenue"]}
                  />
                  <Area dataKey="sales" stroke="oklch(0.6 0.22 275)" fill="url(#r)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* BOOKINGS BAR CHART */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="p-4 border-b">
              <CardTitle className="font-display text-sm">Bookings</CardTitle>
            </CardHeader>
            <CardContent className="h-64 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bookingsSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" fontSize={12} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={12} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }}
                    formatter={(value: any) => [value, "Bookings"]}
                  />
                  <Bar dataKey="bookings" fill="oklch(0.7 0.17 165)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* TOP CUSTOMERS LIST */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="p-4 border-b">
              <CardTitle className="font-display text-sm">Top customers</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-4">
              {topCustomers.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">No customer spend history yet.</div>
              ) : (
                topCustomers.map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-xs text-foreground">{i + 1}. {c.name}</p>
                      <p className="text-[10px] text-muted-foreground">{c.visits} visits</p>
                    </div>
                    <p className="font-display font-semibold text-xs text-foreground">{fmt(c.spent)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* TOP SELLING ITEMS LIST */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="p-4 border-b">
              <CardTitle className="font-display text-sm">Top selling items</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-4">
              {topItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">No item sales records yet.</div>
              ) : (
                topItems.map((it) => (
                  <div key={it.name} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-xs text-foreground">{it.name}</p>
                      <p className="text-[10px] text-muted-foreground">{it.sold} sold</p>
                    </div>
                    <p className="font-display font-semibold text-xs text-foreground">{fmt(it.revenue)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* CAMPAIGN PERFORMANCE BAR CHART */}
          <Card className="rounded-2xl border bg-card shadow-sm lg:col-span-2">
            <CardHeader className="p-4 border-b">
              <CardTitle className="font-display text-sm">Campaign performance</CardTitle>
            </CardHeader>
            <CardContent className="h-64 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={12} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }}
                  />
                  <Bar dataKey="sent" name="Sent" fill="oklch(0.6 0.22 275)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="opened" name="Delivered / Clicked" fill="oklch(0.7 0.17 165)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="converted" name="Converted" fill="oklch(0.75 0.17 65)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}