import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, UserCheck, Clock, XCircle, DollarSign, Megaphone, UsersRound, Ticket, UserPlus, TrendingDown, Wallet, ClipboardCheck } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { revenueSeries, customerGrowthSeries, campaignAnalytics, couponUsage } from "@/lib/sample-data";
import { useClients } from "@/lib/clients-store";
import { usePendingClients } from "@/lib/pending-clients-store";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

const pieColors = ["oklch(0.6 0.22 275)", "oklch(0.7 0.17 165)", "oklch(0.75 0.17 65)"];

function AdminDashboard() {
  const clients = useClients();
  const active = clients.filter((c) => c.status === "active").length;
  const trial = clients.filter((c) => c.status === "trial" && !c.isTrialExpired).length;
  const expired = clients.filter((c) => c.status === "expired" || c.isTrialExpired).length;
  const pending = usePendingClients().filter((p) => p.status === "pending").length;
  return (
    <>
      <PageHeader title="Platform overview" description="Every merchant, every automation, every dollar — at a glance." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total clients" value={clients.length} delta="+12 this month" icon={Users} accent="primary" index={0} />
        <StatCard label="Active clients" value={active} delta="94% retention" icon={UserCheck} accent="accent" index={1} />
        <StatCard label="Trial clients" value={trial} delta="+3 this week" icon={Clock} accent="warning" index={2} />
        <StatCard label="Expired" value={expired} delta="-2 vs last mo" trend="down" icon={XCircle} accent="destructive" index={3} />
        <StatCard label="Monthly revenue" value="$48,930" delta="+18.4% MoM" icon={DollarSign} accent="primary" index={4} />
        <StatCard label="Total revenue" value="$2.14M" delta="All clients combined" icon={Wallet} accent="accent" index={5} />
        <StatCard label="Active campaigns" value="284" delta="+41 today" icon={Megaphone} accent="info" index={6} />
        <StatCard label="Total customers" value="13,820" delta="+1,240 this mo" icon={UsersRound} accent="accent" index={7} />
        <StatCard label="Coupons redeemed" value="3,412" delta="+312 this mo" icon={Ticket} accent="primary" index={8} />
        <StatCard label="New clients this month" value="12" delta="▲ +4 vs last mo" icon={UserPlus} accent="info" index={9} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Churn rate" value="2.4%" delta="▼ 0.6% vs last mo" trend="down" icon={TrendingDown} accent="warning" index={0} />
        <Link to="/admin/approvals" className="block">
          <StatCard label="Pending approvals" value={pending} delta="Click to review →" icon={ClipboardCheck} accent="warning" index={1} />
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display">Revenue & client growth</CardTitle>
              <p className="text-xs text-muted-foreground">Last 7 months · USD</p>
            </div>
            <Badge variant="secondary" className="rounded-full">+18.4% MoM</Badge>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.6 0.22 275)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.6 0.22 275)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cli" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.17 165)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.7 0.17 165)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="oklch(0.6 0.22 275)" fill="url(#rev)" strokeWidth={2} />
                <Area type="monotone" dataKey="clients" stroke="oklch(0.7 0.17 165)" fill="url(#cli)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-display">Coupon usage</CardTitle><p className="text-xs text-muted-foreground">Platform-wide breakdown</p></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={couponUsage} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={4}>
                  {couponUsage.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-display">Customer growth</CardTitle><p className="text-xs text-muted-foreground">Total customers across all merchants</p></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={customerGrowthSeries}>
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
                <Area type="monotone" dataKey="customers" stroke="oklch(0.65 0.2 340)" fill="url(#cus)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-display">Campaign analytics</CardTitle><p className="text-xs text-muted-foreground">Sent · Opened · Converted</p></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaignAnalytics}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Legend />
                <Bar dataKey="sent" fill="oklch(0.6 0.22 275)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="opened" fill="oklch(0.7 0.17 165)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="converted" fill="oklch(0.75 0.17 65)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display">Recent clients</CardTitle>
            <p className="text-xs text-muted-foreground">Click a business to open its details</p>
          </div>
          <Link to="/admin/clients" className="text-xs text-primary hover:underline">View all →</Link>
        </CardHeader>
        <CardContent className="divide-y">
          {clients.slice(0, 6).map((c) => (
            <Link key={c.id} to="/admin/clients/$id" params={{ id: c.id }} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-3 text-sm hover:bg-muted/40 rounded-lg px-2 -mx-2 transition-colors">
              <div>
                <p className="font-medium hover:text-primary">{c.business}</p>
                <p className="text-xs text-muted-foreground">{c.owner} · {c.city}</p>
              </div>
              <Badge variant="secondary" className="rounded-full">{c.type}</Badge>
              <Badge variant="outline" className="rounded-full">{c.plan}</Badge>
              <Badge variant="outline" className="rounded-full capitalize">{c.status}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  );
}