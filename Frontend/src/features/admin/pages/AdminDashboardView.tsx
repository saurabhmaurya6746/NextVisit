import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  RefreshCw,
  Search,
  Filter,
  ExternalLink,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Area,
  AreaChart,
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
import {
  getAdminDashboardApi,
  getActivityLogsApi,
  type AdminDashboardResponse,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/currency";

const pieColors = [
  "oklch(0.6 0.22 275)",
  "oklch(0.7 0.17 165)",
  "oklch(0.75 0.17 65)",
];

export function AdminDashboardView() {
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTypeFilter, setActivityTypeFilter] = useState("ALL");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityDateRange, setActivityDateRange] = useState("all");

  // Main Dashboard Data Query
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["admin-dashboard-overview"],
    queryFn: getAdminDashboardApi,
    staleTime: 30000,
    gcTime: 300000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Dedicated Activity Logs Query for Modal
  const {
    data: activityData,
    isLoading: activityLoading,
    isError: activityError,
  } = useQuery({
    queryKey: [
      "admin-activity-logs",
      activityPage,
      activityTypeFilter,
      activitySearch,
      activityDateRange,
    ],
    queryFn: () =>
      getActivityLogsApi({
        page: activityPage,
        limit: 10,
        type: activityTypeFilter,
        search: activitySearch,
        date_range: activityDateRange,
      }),
    enabled: activityDialogOpen,
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading Admin Console…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div>
          <h2 className="text-lg font-semibold">Failed to load dashboard data</h2>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Backend unavailable"}
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  const {
    client_counts,
    revenue_stats,
    growth_stats,
    plan_distribution,
    pending_approvals,
    recent_clients,
    monthly_revenue,
    activity_logs,
  } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Super Admin Console"
          subtitle="Platform overview, approvals, financial stats & system activity."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>

      {/* Row 1: Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Businesses"
          value={client_counts.total}
          icon={Users}
          description={`${client_counts.active} active · ${client_counts.pending} pending approval`}
        />
        <StatCard
          title="Total Revenue (Platform)"
          value={formatCurrency(revenue_stats.total_revenue)}
          icon={DollarSign}
          description={`Avg ticket: ${formatCurrency(revenue_stats.average_ticket)}`}
        />
        <StatCard
          title="Active Subscriptions"
          value={client_counts.active}
          icon={UserCheck}
          description={`${client_counts.trial} in free trial period`}
        />
        <StatCard
          title="Pending Approvals"
          value={client_counts.pending}
          icon={Clock}
          description={
            client_counts.pending > 0
              ? "Action required in Approvals queue"
              : "No pending registration requests"
          }
        />
      </div>

      {/* Row 2: Secondary Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="New Clients (30d)"
          value={`+${growth_stats.new_clients_30d}`}
          icon={UserPlus}
          trend={growth_stats.new_clients_trend}
        />
        <StatCard
          title="Churned Clients (30d)"
          value={growth_stats.churned_clients_30d}
          icon={TrendingDown}
          description="Accounts cancelled or expired"
        />
        <StatCard
          title="AI Credits Granted"
          value={revenue_stats.ai_credits_granted.toLocaleString()}
          icon={Wallet}
          description="Total bonus credits allocated"
        />
        <StatCard
          title="Total Orders Processed"
          value={revenue_stats.total_orders.toLocaleString()}
          icon={ClipboardCheck}
          description="Across all active business accounts"
        />
      </div>

      {/* Row 3: Revenue & Distribution Charts */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-base font-semibold">
              Monthly Platform Revenue (MRR)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly_revenue}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.6 0.22 275)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="oklch(0.6 0.22 275)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis
                    fontSize={12}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val)), "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="oklch(0.6 0.22 275)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#revenueGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base font-semibold">
              Subscription Plan Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={plan_distribution}
                    dataKey="count"
                    nameKey="plan"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    label={({ name, percent }) =>
                      `${name} (${((percent || 0) * 100).toFixed(0)}%)`
                    }
                  >
                    {plan_distribution.map((_, idx) => (
                      <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [v, "Businesses"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Tables */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Approvals Widget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-base font-semibold">
              Pending Registrations ({pending_approvals.length})
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/approvals">View All Queue →</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pending_approvals.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No pending registration requests.
              </p>
            ) : (
              <div className="space-y-3">
                {pending_approvals.slice(0, 5).map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between rounded-xl border p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">
                          {app.business_name}
                        </span>
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {app.business_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {app.owner_name} · {app.email}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/admin/approvals">Review</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Client Registrations Widget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-base font-semibold">
              Recently Joined Businesses
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/clients">Client Directory →</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recent_clients.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        {c.name}
                      </span>
                      <Badge
                        variant={c.status === "ACTIVE" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {c.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Owner: {c.owner_name} · Plan: {c.subscription_plan}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/admin/clients/$id" params={{ id: c.id }}>
                      Details
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 5: Activity Logs Widget */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base font-semibold">
            System Audit & Activity Logs
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setActivityDialogOpen(true)}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View Full Audit Log
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activity_logs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between text-xs py-1 border-b last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {log.type}
                  </Badge>
                  <span className="font-medium text-foreground">{log.action}</span>
                  <span className="text-muted-foreground">by {log.actor}</span>
                </div>
                <span className="text-muted-foreground">{log.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Full Audit Log Dialog */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              System Activity & Audit Logs
            </DialogTitle>
          </DialogHeader>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 py-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actions or actors..."
                value={activitySearch}
                onChange={(e) => {
                  setActivitySearch(e.target.value);
                  setActivityPage(1);
                }}
                className="pl-8 text-xs h-9"
              />
            </div>
            <Select
              value={activityTypeFilter}
              onValueChange={(val) => {
                setActivityTypeFilter(val);
                setActivityPage(1);
              }}
            >
              <SelectTrigger className="w-[140px] text-xs h-9">
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="REGISTRATION">Registration</SelectItem>
                <SelectItem value="APPROVAL">Approval</SelectItem>
                <SelectItem value="CREDIT">Credit Grant</SelectItem>
                <SelectItem value="SETTINGS">Settings</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={activityDateRange}
              onValueChange={(val) => {
                setActivityDateRange(val);
                setActivityPage(1);
              }}
            >
              <SelectTrigger className="w-[130px] text-xs h-9">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto min-h-[300px]">
            {activityLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : activityError || !activityData ? (
              <p className="py-12 text-center text-xs text-muted-foreground">
                Failed to load activity logs.
              </p>
            ) : activityData.logs.length === 0 ? (
              <p className="py-12 text-center text-xs text-muted-foreground">
                No matching activity logs found.
              </p>
            ) : (
              <div className="space-y-2 pr-1">
                {activityData.logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-2.5 text-xs gap-1 bg-card"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {log.type}
                        </Badge>
                        <span className="font-semibold text-foreground">
                          {log.action}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        Actor: <strong className="text-foreground">{log.actor}</strong> · Target: {log.target}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {log.time}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {activityData && activityData.total_pages > 1 && (
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">
                Page {activityPage} of {activityData.total_pages} ({activityData.total_count} entries)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activityPage <= 1}
                  onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                  className="h-8 text-xs"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activityPage >= activityData.total_pages}
                  onClick={() => setActivityPage((p) => p + 1)}
                  className="h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
