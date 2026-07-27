import { createFileRoute } from "@tanstack/react-router";
import { Users, Clock, XCircle, Megaphone, UsersRound, Wallet, Activity, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAdminDashboardApi, type AdminDashboardResponse } from "@/lib/admin-api";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/admin/monitoring")({ component: Monitoring });

function Monitoring() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminDashboardApi()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Checking platform health and real-time metrics…</p>
      </div>
    );
  }

  const { kpis, recent_activity } = data;

  return (
    <>
      <PageHeader title="Monitoring" description="Real-time platform health and activity feed." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Total clients" value={kpis.total_clients} icon={Users} accent="primary" index={0} />
        <StatCard label="Active trials" value={kpis.trial_clients} icon={Clock} accent="warning" index={1} />
        <StatCard label="Expired" value={kpis.expired_clients} icon={XCircle} accent="destructive" index={2} />
        <StatCard label="Active campaigns" value={kpis.active_campaigns} icon={Megaphone} accent="info" index={3} />
        <StatCard label="Total customers" value={kpis.total_customers.toLocaleString()} icon={UsersRound} accent="accent" index={4} />
        <StatCard label="Total revenue" value={formatCurrency(kpis.total_revenue, "INR")} icon={Wallet} accent="primary" index={5} />
      </div>

      <Card className="mt-6 rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Real-time Platform Activity
            </CardTitle>
            <p className="text-xs text-muted-foreground">Live signups, status changes, and marketing events</p>
          </div>
          <Badge variant="secondary" className="rounded-full">{recent_activity.length} events</Badge>
        </CardHeader>
        <CardContent className="divide-y">
          {recent_activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            recent_activity.map((a) => (
              <div key={a.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3 text-sm px-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.timestamp).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}