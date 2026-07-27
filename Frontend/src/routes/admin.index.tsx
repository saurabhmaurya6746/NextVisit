import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  Clock,
  XCircle,
  DollarSign,
  Megaphone,
  UsersRound,
  Ticket,
  UserPlus,
  TrendingDown,
  Wallet,
  ClipboardCheck,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getAdminDashboardApi, type AdminDashboardResponse } from "@/lib/admin-api";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

const pieColors = ["oklch(0.6 0.22 275)", "oklch(0.7 0.17 165)", "oklch(0.75 0.17 65)"];

function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminDashboardApi();
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load admin dashboard statistics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    window.addEventListener("nextvisit:admin-data-changed", fetchDashboard);
    return () => {
      window.removeEventListener("nextvisit:admin-data-changed", fetchDashboard);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading real-time platform statistics…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-3 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h3 className="font-display text-lg font-semibold">Failed to load platform data</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={fetchDashboard} variant="outline" className="rounded-full">
          Retry Loading
        </Button>
      </div>
    );
  }

  const { kpis, analytics, recent_activity } = data;

  const couponUsageData = [
    { name: "Redeemed", value: kpis.coupons_redeemed || 0 },
    { name: "Active", value: kpis.active_campaigns || 0 },
  ];

  return (
    <>
      <PageHeader title="Platform overview" description="Every merchant, every automation, every dollar — at a glance." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Link to="/admin/clients" className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer">
          <StatCard label="Total clients" value={kpis.total_clients} delta={`+${kpis.new_clients_this_month} this month`} icon={Users} accent="primary" index={0} />
        </Link>
        <Link to="/admin/clients" className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer">
          <StatCard label="Active clients" value={kpis.active_clients} delta={`${kpis.pending_clients} pending approval`} icon={UserCheck} accent="accent" index={1} />
        </Link>
        <Link to="/admin/clients" className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer">
          <StatCard label="Trial clients" value={kpis.trial_clients} delta={`${kpis.expired_clients} expired`} icon={Clock} accent="warning" index={2} />
        </Link>
        <Link to="/admin/clients" className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer">
          <StatCard label="Expired" value={kpis.expired_clients} delta="Requires renewal" trend="down" icon={XCircle} accent="destructive" index={3} />
        </Link>
        <Link to="/admin/subscriptions" className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer">
          <StatCard label="Monthly revenue" value={formatCurrency(kpis.monthly_revenue, "INR")} delta="Current month" icon={DollarSign} accent="primary" index={4} />
        </Link>
        <Link to="/admin/subscriptions" className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer">
          <StatCard label="Total revenue" value={formatCurrency(kpis.total_revenue, "INR")} delta="All time platform revenue" icon={Wallet} accent="accent" index={5} />
        </Link>
        <Link to="/admin/monitoring" className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer">
          <StatCard label="Active campaigns" value={kpis.active_campaigns} delta="WhatsApp marketing" icon={Megaphone} accent="info" index={6} />
        </Link>
        <Link to="/admin/monitoring" className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer">
          <StatCard label="Total customers" value={kpis.total_customers} delta="Registered shoppers" icon={UsersRound} accent="accent" index={7} />
        </Link>
        <Link to="/admin/monitoring" className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer">
          <StatCard label="Coupons redeemed" value={kpis.coupons_redeemed} delta="Total claimed" icon={Ticket} accent="primary" index={8} />
        </Link>
        <Link to="/admin/clients" className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer">
          <StatCard label="New clients this month" value={kpis.new_clients_this_month} delta="▲ Recent onboarding" icon={UserPlus} accent="info" index={9} />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/admin/clients" className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer">
          <StatCard label="Churn rate" value={`${kpis.churn_rate}%`} delta="Platform churn rate" trend="down" icon={TrendingDown} accent="warning" index={0} />
        </Link>
        <Link to="/admin/approvals" className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer">
          <StatCard label="Pending approvals" value={kpis.pending_approvals} delta="Click to review →" icon={ClipboardCheck} accent="warning" index={1} />
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display">Revenue & client growth</CardTitle>
              <p className="text-xs text-muted-foreground">Last 7 months · Platform analytics</p>
            </div>
            <Badge variant="secondary" className="rounded-full">Real-time</Badge>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.revenue_growth}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.6 0.22 275)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.6 0.22 275)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="oklch(0.6 0.22 275)" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display">Platform activity</CardTitle>
            <p className="text-xs text-muted-foreground">Recent merchant events</p>
          </CardHeader>
          <CardContent className="h-72 overflow-y-auto space-y-3">
            {recent_activity.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center pt-10">No recent activity logged.</p>
            ) : (
              recent_activity.map((act) => (
                <div key={act.id} className="text-xs border-b pb-2">
                  <div className="flex justify-between font-medium">
                    <span>{act.title}</span>
                    <span className="text-muted-foreground">{new Date(act.timestamp).toLocaleDateString()}</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5">{act.description}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display">Merchant growth</CardTitle>
            <p className="text-xs text-muted-foreground">Monthly new registrations</p>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.client_growth}>
                <defs>
                  <linearGradient id="cus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.65 0.2 340)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.65 0.2 340)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="count" stroke="oklch(0.65 0.2 340)" fill="url(#cus)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display">Campaign & Coupon Distribution</CardTitle>
            <p className="text-xs text-muted-foreground">Overview</p>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={couponUsageData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={4}>
                  {couponUsageData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
}