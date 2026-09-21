import { createFileRoute } from "@/lib/route-compat";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Clock,
  XCircle,
  Megaphone,
  UsersRound,
  Wallet,
  Activity,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
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
  getPlatformHealthSummaryApi,
  getActivityLogsApi,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/admin/monitoring")({
  component: Monitoring,
});

/**
 * Safe timestamp formatting helper.
 * Parses ISO-8601 strings safely in local timezone.
 * Returns "-" if timestamp is invalid or missing. Never returns "Invalid Date".
 */
function formatTimestamp(isoStr?: string | null): string {
  if (!isoStr) return "-";
  try {
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

export default function Monitoring() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [activityTypeFilter, setActivityTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("all");

  // 1. Platform Health Summary Query
  const {
    data: health,
    isLoading: healthLoading,
    isError: healthError,
    error: healthErrObj,
    refetch: refetchHealth,
    isFetching: healthFetching,
  } = useQuery({
    queryKey: ["platform-health-summary"],
    queryFn: getPlatformHealthSummaryApi,
    staleTime: 30000,
    gcTime: 300000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // 2. Real-time Activity Feed Query
  const {
    data: activityData,
    isLoading: activityLoading,
    isError: activityError,
    error: activityErrObj,
    refetch: refetchActivity,
    isFetching: activityFetching,
  } = useQuery({
    queryKey: [
      "platform-monitoring-activity-feed",
      page,
      pageSize,
      activityTypeFilter,
      search,
      dateRange,
    ],
    queryFn: () =>
      getActivityLogsApi(
        page,
        pageSize,
        activityTypeFilter,
        search,
        dateRange
      ),
    staleTime: 30000,
    gcTime: 300000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const handleRefreshAll = () => {
    refetchHealth();
    refetchActivity();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <PageHeader
          title="Monitoring"
          description="Real-time platform health and activity feed."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshAll}
          disabled={healthFetching || activityFetching}
          className="rounded-full text-xs"
        >
          <RefreshCw
            className={`mr-1.5 h-3.5 w-3.5 ${
              healthFetching || activityFetching ? "animate-spin" : ""
            }`}
          />
          {healthFetching || activityFetching ? "Refreshing..." : "Sync Live"}
        </Button>
      </div>

      {/* Health Summary Stat Cards */}
      {healthLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-28 rounded-2xl animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : healthError || !health ? (
        <Card className="rounded-2xl p-6 text-center text-xs text-destructive space-y-2">
          <AlertCircle className="mx-auto h-6 w-6" />
          <p>{(healthErrObj as any)?.message || "Failed to load platform health metrics."}</p>
          <Button size="sm" variant="outline" onClick={() => refetchHealth()} className="rounded-full">
            Retry Health Summary
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <StatCard
            label="Total clients"
            value={health.total_clients}
            icon={Users}
            accent="primary"
            index={0}
          />
          <StatCard
            label="Active trials"
            value={health.active_trials}
            icon={Clock}
            accent="warning"
            index={1}
          />
          <StatCard
            label="Expired"
            value={health.expired_clients}
            icon={XCircle}
            accent="destructive"
            index={2}
          />
          <StatCard
            label="Active campaigns"
            value={health.active_campaigns}
            icon={Megaphone}
            accent="info"
            index={3}
          />
          <StatCard
            label="Total customers"
            value={health.total_customers.toLocaleString()}
            icon={UsersRound}
            accent="accent"
            index={4}
          />
          <StatCard
            label="Total revenue"
            value={formatCurrency(health.total_revenue, "INR")}
            icon={Wallet}
            accent="primary"
            index={5}
          />
        </div>
      )}

      {/* Real-time Activity Feed Card */}
      <Card className="mt-6 rounded-2xl">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="font-display flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Real-time Platform Activity
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live signups, status changes, payments, and marketing events (Auto-refreshes every 30s)
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full font-mono text-[10px] w-fit">
            {activityData?.total ? `${activityData.total} Total Events` : "Real-time Live"}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters Bar */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search merchant or title..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 text-xs"
              />
            </div>

            <Select
              value={activityTypeFilter}
              onValueChange={(v) => {
                setActivityTypeFilter(v);
                setPage(1);
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
                <SelectItem value="SUBSCRIPTION_PURCHASED">Subscription Purchased</SelectItem>
                <SelectItem value="COUPON_REDEEMED">Coupon Redeemed</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={dateRange}
              onValueChange={(v) => {
                setDateRange(v);
                setPage(1);
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

          {/* Feed List */}
          <div className="divide-y rounded-xl border">
            {activityLoading ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Streaming real-time events...</p>
              </div>
            ) : activityError ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center space-y-3 text-center text-xs text-destructive p-6">
                <AlertCircle className="h-8 w-8" />
                <p>{(activityErrObj as any)?.message || "Failed to load real-time activity feed."}</p>
                <Button size="sm" variant="outline" onClick={() => refetchActivity()} className="rounded-full">
                  Retry Loading
                </Button>
              </div>
            ) : !activityData?.items || activityData.items.length === 0 ? (
              <div className="flex min-h-[250px] flex-col items-center justify-center text-center text-xs text-muted-foreground p-6">
                <p>No activity logs found matching your filters.</p>
              </div>
            ) : (
              activityData.items.map((a) => (
                <div
                  key={a.id}
                  className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] items-start sm:items-center gap-3 p-3.5 text-xs transition-colors hover:bg-muted/20"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate">{a.title}</span>
                      <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 shrink-0">
                        {a.activity_type || a.type}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground truncate">{a.description}</p>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground sm:text-right shrink-0">
                    {formatTimestamp(a.created_at || a.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {activityData && activityData.total > pageSize && (
            <div className="flex items-center justify-between text-xs pt-2">
              <span className="text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1}–
                {Math.min(page * pageSize, activityData.total)} of {activityData.total} events
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-full text-xs h-8"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page * pageSize >= activityData.total}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-full text-xs h-8"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}