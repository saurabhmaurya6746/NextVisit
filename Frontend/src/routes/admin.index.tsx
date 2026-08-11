import { Link } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import { useState } from "react";
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

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

const pieColors = [
  "oklch(0.6 0.22 275)",
  "oklch(0.7 0.17 165)",
  "oklch(0.75 0.17 65)",
];

export default function AdminDashboard() {
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
    refetch: refetchActivityLogs,
  } = useQuery({
    queryKey: [
      "admin-dashboard-activity-logs",
      activityPage,
      activityTypeFilter,
      activitySearch,
      activityDateRange,
    ],
    queryFn: () =>
      getActivityLogsApi(
        activityPage,
        10,
        activityTypeFilter,
        activitySearch,
        activityDateRange
      ),
    enabled: activityDialogOpen,
    staleTime: 30000,
    gcTime: 300000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Platform overview"
          description="Every merchant, every automation, every dollar — at a glance."
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} className="h-28 rounded-2xl animate-pulse bg-muted/40" />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="h-28 rounded-2xl animate-pulse bg-muted/40" />
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card className="h-80 lg:col-span-2 rounded-2xl animate-pulse bg-muted/40" />
          <Card className="h-80 rounded-2xl animate-pulse bg-muted/40" />
        </div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div>
          <h3 className="font-display text-lg font-semibold">Failed to load platform data</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {(error as any)?.message || "Internal server error occurred while retrieving platform metrics."}
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="rounded-full">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry Loading
        </Button>
      </div>
    );
  }

  const kpis = data.statistics || data.kpis;
  const analytics = data.charts || data.analytics;
  const recentActivity = data.recent_activity || [];

  const campaignChartData = analytics?.campaign
    ? [
        { name: "Active", value: analytics.campaign.active || 0 },
        { name: "Redeemed", value: analytics.campaign.redeemed || 0 },
        { name: "Expired", value: analytics.campaign.expired || 0 },
      ]
    : [
        { name: "Active", value: kpis.active_campaigns || 0 },
        { name: "Redeemed", value: kpis.coupons_redeemed || 0 },
        { name: "Expired", value: kpis.expired_clients || 0 },
      ];

  const totalCampaignItems = campaignChartData.reduce((acc, item) => acc + item.value, 0);

  return (
    <>
      <div className="flex items-center justify-between">
        <PageHeader
          title="Platform overview"
          description="Every merchant, every automation, every dollar — at a glance."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-full text-xs"
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Syncing..." : "Sync Live"}
        </Button>
      </div>

      {/* 12 Live KPI Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Link
          to="/admin/clients"
          className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer"
        >
          <StatCard
            label="Total clients"
            value={kpis.total_clients}
            delta={`+${kpis.new_clients_this_month} this month`}
            icon={Users}
            accent="primary"
            index={0}
          />
        </Link>
        <Link
          to="/admin/clients"
          className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer"
        >
          <StatCard
            label="Active clients"
            value={kpis.active_clients}
            delta={`${kpis.pending_clients} pending approval`}
            icon={UserCheck}
            accent="accent"
            index={1}
          />
        </Link>
        <Link
          to="/admin/clients"
          className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer"
        >
          <StatCard
            label="Trial clients"
            value={kpis.trial_clients}
            delta={`${kpis.expired_clients} expired`}
            icon={Clock}
            accent="warning"
            index={2}
          />
        </Link>
        <Link
          to="/admin/clients"
          className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer"
        >
          <StatCard
            label="Expired"
            value={kpis.expired_clients}
            delta="Requires renewal"
            trend="down"
            icon={XCircle}
            accent="destructive"
            index={3}
          />
        </Link>
        <Link
          to="/admin/subscriptions"
          className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer"
        >
          <StatCard
            label="Monthly revenue"
            value={formatCurrency(kpis.monthly_revenue, "INR")}
            delta="Current month"
            icon={DollarSign}
            accent="primary"
            index={4}
          />
        </Link>
        <Link
          to="/admin/subscriptions"
          className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer"
        >
          <StatCard
            label="Total revenue"
            value={formatCurrency(kpis.total_revenue, "INR")}
            delta="All time platform revenue"
            icon={Wallet}
            accent="accent"
            index={5}
          />
        </Link>
        <Link
          to="/admin/monitoring"
          className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer"
        >
          <StatCard
            label="Active campaigns"
            value={kpis.active_campaigns}
            delta="WhatsApp marketing"
            icon={Megaphone}
            accent="info"
            index={6}
          />
        </Link>
        <Link
          to="/admin/monitoring"
          className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer"
        >
          <StatCard
            label="Total customers"
            value={kpis.total_customers}
            delta="Registered shoppers"
            icon={UsersRound}
            accent="accent"
            index={7}
          />
        </Link>
        <Link
          to="/admin/monitoring"
          className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer"
        >
          <StatCard
            label="Coupons redeemed"
            value={kpis.coupons_redeemed}
            delta="Total claimed"
            icon={Ticket}
            accent="primary"
            index={8}
          />
        </Link>
        <Link
          to="/admin/clients"
          className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer"
        >
          <StatCard
            label="New clients this month"
            value={kpis.new_clients_this_month}
            delta="▲ Recent onboarding"
            icon={UserPlus}
            accent="info"
            index={9}
          />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/admin/clients"
          className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer"
        >
          <StatCard
            label="Churn rate"
            value={`${kpis.churn_rate}%`}
            delta="Expired / total clients"
            trend="down"
            icon={TrendingDown}
            accent="warning"
            index={0}
          />
        </Link>
        {/* Requirement #10: Clicking Pending Approvals navigates to /admin/approvals */}
        <Link
          to="/admin/approvals"
          className="block rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer sm:col-span-2 lg:col-span-2"
        >
          <StatCard
            label="Pending approvals"
            value={kpis.pending_approvals}
            delta="Action required — click to review registrations →"
            icon={ClipboardCheck}
            accent="warning"
            index={1}
          />
        </Link>
      </div>

      {/* Revenue Graph & Activity Log */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display">Revenue & Client Growth</CardTitle>
              <p className="text-xs text-muted-foreground">Monthly subscription breakdown</p>
            </div>
            <Badge variant="secondary" className="rounded-full font-mono text-[10px]">
              Live Backend
            </Badge>
          </CardHeader>
          <CardContent className="h-72">
            {analytics?.revenue_growth?.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No revenue recorded yet.
              </div>
            ) : (
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
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val), "INR"), "Revenue"]}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="oklch(0.6 0.22 275)"
                    fill="url(#rev)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Real Platform Activity Log */}
        <Card className="rounded-2xl flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display">Platform Activity</CardTitle>
              <p className="text-xs text-muted-foreground">Recent merchant events</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActivityDialogOpen(true)}
              className="text-xs rounded-full h-7 px-2 text-primary"
            >
              View All <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="h-72 overflow-y-auto space-y-3 pr-2">
            {recentActivity.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-xs text-muted-foreground">
                <p>No recent activity logged.</p>
              </div>
            ) : (
              recentActivity.map((act) => (
                <div key={act.id} className="text-xs border-b pb-2 space-y-0.5">
                  <div className="flex justify-between font-medium">
                    <span className="text-foreground">{act.title}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(act.created_at || act.timestamp || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{act.description}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Merchant Growth & Campaign Distribution */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display">Merchant Growth</CardTitle>
            <p className="text-xs text-muted-foreground">Monthly new registrations</p>
          </CardHeader>
          <CardContent className="h-64">
            {analytics?.client_growth?.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No merchant growth data available.
              </div>
            ) : (
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
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="oklch(0.65 0.2 340)"
                    fill="url(#cus)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display">Campaign & Coupon Distribution</CardTitle>
            <p className="text-xs text-muted-foreground">Active, redeemed, and expired items</p>
          </CardHeader>
          <CardContent className="h-64">
            {totalCampaignItems === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No campaign or coupon records found.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={campaignChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                  >
                    {campaignChartData.map((_, i) => (
                      <Cell key={i} fill={pieColors[i % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any, name: any) => {
                      const pct = totalCampaignItems > 0 ? ((Number(val) / totalCampaignItems) * 100).toFixed(1) : "0";
                      return [`${val} (${pct}%)`, name];
                    }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Logs Filter & Pagination Modal */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="max-w-3xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Platform Activity Logs</DialogTitle>
          </DialogHeader>

          {/* Activity Filters */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="relative sm:col-span-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search merchant or user..."
                value={activitySearch}
                onChange={(e) => {
                  setActivitySearch(e.target.value);
                  setActivityPage(1);
                }}
                className="pl-9 text-xs"
              />
            </div>
            <Select
              value={activityTypeFilter}
              onValueChange={(v) => {
                setActivityTypeFilter(v);
                setActivityPage(1);
              }}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="All Activity Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Activity Types</SelectItem>
                <SelectItem value="BUSINESS_REGISTERED">Business Registered</SelectItem>
                <SelectItem value="BUSINESS_ACTIVE">Business Approved</SelectItem>
                <SelectItem value="BUSINESS_REJECTED">Business Rejected</SelectItem>
                <SelectItem value="BUSINESS_SUSPENDED">Business Suspended</SelectItem>
                <SelectItem value="CAMPAIGN_CREATED">Campaign Created</SelectItem>
                <SelectItem value="SUBSCRIPTION_PURCHASED">Subscription Paid</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={activityDateRange}
              onValueChange={(v) => {
                setActivityDateRange(v);
                setActivityPage(1);
              }}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                <SelectItem value="last_month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Activity Log List */}
          <div className="min-h-[300px] max-h-[400px] overflow-y-auto space-y-2 border rounded-xl p-3">
            {activityLoading ? (
              <div className="flex min-h-[250px] flex-col items-center justify-center space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading activity logs...</p>
              </div>
            ) : activityError ? (
              <div className="flex min-h-[250px] flex-col items-center justify-center space-y-2 text-center text-xs text-destructive">
                <AlertCircle className="h-6 w-6" />
                <p>Failed to load activity logs.</p>
                <Button size="sm" variant="outline" onClick={() => refetchActivityLogs()}>
                  Retry
                </Button>
              </div>
            ) : !activityData?.items || activityData.items.length === 0 ? (
              <div className="flex min-h-[250px] items-center justify-center text-xs text-muted-foreground">
                No activity logs match your filter criteria.
              </div>
            ) : (
              activityData.items.map((act) => (
                <div key={act.id} className="rounded-lg border p-3 text-xs space-y-1 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{act.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(act.created_at).toLocaleString()}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">{act.description}</p>
                  {act.business_name && (
                    <p className="text-[10px] font-mono text-primary">
                      Business: {act.business_name}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {activityData && activityData.total > 10 && (
            <div className="flex items-center justify-between text-xs pt-2">
              <span className="text-muted-foreground">
                Showing {((activityPage - 1) * 10) + 1}–
                {Math.min(activityPage * 10, activityData.total)} of {activityData.total}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activityPage <= 1}
                  onClick={() => setActivityPage((p) => p - 1)}
                  className="rounded-full text-xs h-7"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activityPage * 10 >= activityData.total}
                  onClick={() => setActivityPage((p) => p + 1)}
                  className="rounded-full text-xs h-7"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}