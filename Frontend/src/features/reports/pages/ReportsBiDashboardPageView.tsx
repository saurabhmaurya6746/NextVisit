import { useState } from "react";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Download, Loader2, RefreshCw, Filter, Calendar as CalendarIcon,
  TrendingUp, Users, DollarSign, Target, CheckCircle2, XCircle, Award,
  Sparkles, Scissors, UtensilsCrossed, Gift, PieChart as PieIcon, BarChart3,
  RotateCcw, SlidersHorizontal, UserCheck, Percent, Layers, ShieldCheck, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { getSession } from "@/lib/auth";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import {
  getBiReportsAnalyticsApi,
  getReportFilterOptionsApi,
  downloadReportsPdfApi,
  downloadReportsExcelApi,
  downloadReportsCsvApi,
  ReportFilterParams,
} from "@/lib/reports-api";

const PIE_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6", "#3B82F6"];

export function ReportsBiDashboardPageView() {
  const routerParams = useParams({ strict: false }) as Record<string, string>;
  const isSalon = routerParams?.type === "salon";
  const session = getSession();

  // ---------------------------------------------------------------------------
  // Filter States
  // ---------------------------------------------------------------------------
  const [dateRange, setDateRange] = useState<string>("this_month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [bookingSource, setBookingSource] = useState<string>("all");
  const [staffId, setStaffId] = useState<string>("all");
  const [serviceAreaId, setServiceAreaId] = useState<string>("all");
  const [chairId, setChairId] = useState<string>("all");
  const [customerType, setCustomerType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [exportingType, setExportingType] = useState<"pdf" | "excel" | "csv" | null>(null);

  // Filter params payload construction
  const filterParams: ReportFilterParams = {
    date_range: dateRange,
    start_date: dateRange === "custom" && startDate ? startDate : undefined,
    end_date: dateRange === "custom" && endDate ? endDate : undefined,
    payment_method: paymentMethod,
    booking_source: bookingSource,
    staff_id: staffId,
    service_area_id: serviceAreaId,
    chair_id: chairId,
    customer_type: customerType,
    status: status,
  };

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------
  const { data: optionsData } = useQuery({
    queryKey: ["reports-filter-options"],
    queryFn: getReportFilterOptionsApi,
    staleTime: 600000,
  });

  const {
    data: reportData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["bi-reports-analytics", filterParams],
    queryFn: () => getBiReportsAnalyticsApi(filterParams),
    staleTime: 30000,
  });

  // ---------------------------------------------------------------------------
  // Export Handlers
  // ---------------------------------------------------------------------------
  const handleExport = async (format: "pdf" | "excel" | "csv") => {
    try {
      setExportingType(format);
      toast.loading(`Generating ${format.toUpperCase()} report...`, { id: "export-toast" });

      let blob: Blob;
      let filename = `Report_${dateRange}_${new Date().toISOString().slice(0, 10)}`;

      if (format === "pdf") {
        blob = await downloadReportsPdfApi(filterParams);
        filename += ".pdf";
      } else if (format === "excel") {
        blob = await downloadReportsExcelApi(filterParams);
        filename += ".xlsx";
      } else {
        blob = await downloadReportsCsvApi(filterParams);
        filename += ".csv";
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${format.toUpperCase()} report downloaded!`, { id: "export-toast" });
    } catch (err: any) {
      toast.error(`Export failed: ${err.message || "Unknown error"}`, { id: "export-toast" });
    } finally {
      setExportingType(null);
    }
  };

  const handleResetFilters = () => {
    setDateRange("this_month");
    setStartDate("");
    setEndDate("");
    setPaymentMethod("all");
    setBookingSource("all");
    setStaffId("all");
    setServiceAreaId("all");
    setChairId("all");
    setCustomerType("all");
    setStatus("all");
    toast.info("Filters reset to defaults");
  };

  const summary = reportData?.summary;
  const charts = reportData?.charts;
  const staffPerf = reportData?.staff_performance || [];
  const topServices = reportData?.top_services || [];
  const serviceAreaPerf = reportData?.service_area_performance || [];
  const chairPerf = reportData?.chair_performance || [];
  const recentTx = reportData?.recent_transactions || [];

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Business Intelligence & Analytics"
          subtitle="Real-time revenue metrics, GST reports, staff breakdown & custom exports."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              disabled={!!exportingType || isLoading}
            >
              {exportingType === "csv" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("excel")}
              disabled={!!exportingType || isLoading}
            >
              {exportingType === "excel" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
              Excel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => handleExport("pdf")}
              disabled={!!exportingType || isLoading}
            >
              {exportingType === "pdf" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
              Download PDF Report
            </Button>
          </div>
        </PageHeader>

        {/* Filter Control Bar */}
        <Card className="p-4 shadow-sm border-muted">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Date Range Selector */}
                <div className="w-[180px]">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                    Timeframe
                  </Label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="yesterday">Yesterday</SelectItem>
                      <SelectItem value="this_week">This Week</SelectItem>
                      <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="this_quarter">This Quarter</SelectItem>
                      <SelectItem value="this_year">This Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Date Pickers */}
                {dateRange === "custom" && (
                  <>
                    <div className="w-[140px]">
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                        Start Date
                      </Label>
                      <Input
                        type="date"
                        className="h-9 text-xs"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="w-[140px]">
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                        End Date
                      </Label>
                      <Input
                        type="date"
                        className="h-9 text-xs"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* Payment Method */}
                <div className="w-[140px]">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                    Payment Method
                  </Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Payment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="UPI">UPI / Online</SelectItem>
                      <SelectItem value="CARD">Card</SelectItem>
                      <SelectItem value="DUE">Pending Due</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Booking Source */}
                <div className="w-[140px]">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                    Order Source
                  </Label>
                  <Select value={bookingSource} onValueChange={setBookingSource}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="POS">Staff POS</SelectItem>
                      <SelectItem value="QR">Customer QR</SelectItem>
                      <SelectItem value="ONLINE">Online Booking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-4 sm:pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                >
                  <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                  {showAdvancedFilters ? "Hide Filters" : "More Filters"}
                  {showAdvancedFilters ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs text-muted-foreground"
                  onClick={handleResetFilters}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Advanced Filters Expandable Bar */}
            {showAdvancedFilters && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t">
                <div>
                  <Label className="text-[11px] font-medium text-muted-foreground mb-1 block">Staff Member</Label>
                  <Select value={staffId} onValueChange={setStaffId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select Staff" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Staff</SelectItem>
                      {optionsData?.staff?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                    {isSalon ? "Service Area" : "Dining Area"}
                  </Label>
                  <Select value={serviceAreaId} onValueChange={setServiceAreaId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select Area" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {optionsData?.service_areas?.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                    {isSalon ? "Chair / Workstation" : "Table"}
                  </Label>
                  <Select value={chairId} onValueChange={setChairId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select Workstation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Workstations</SelectItem>
                      {optionsData?.chairs?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-medium text-muted-foreground mb-1 block">Customer Segment</Label>
                  <Select value={customerType} onValueChange={setCustomerType}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select Segment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Customers</SelectItem>
                      <SelectItem value="NEW">New Customers</SelectItem>
                      <SelectItem value="REPEAT">Repeat Customers</SelectItem>
                      <SelectItem value="VIP">VIP Segment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Calculating financial reports…</span>
          </div>
        )}

        {/* Summary Stat Cards */}
        {!isLoading && summary && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 border-l-4 border-l-primary">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gross Sales</span>
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <p className="font-display text-2xl font-bold mt-2">{fmt(summary.total_gross_sales)}</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.total_orders} total completed orders</p>
            </Card>

            <Card className="p-4 border-l-4 border-l-emerald-500">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Sales</span>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="font-display text-2xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">{fmt(summary.total_net_sales)}</p>
              <p className="text-xs text-muted-foreground mt-1">Excludes discounts & taxes</p>
            </Card>

            <Card className="p-4 border-l-4 border-l-amber-500">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total GST Collected</span>
                <Percent className="h-4 w-4 text-amber-500" />
              </div>
              <p className="font-display text-2xl font-bold mt-2">{fmt(summary.total_gst)}</p>
              <p className="text-xs text-muted-foreground mt-1">Single order-level tax liability</p>
            </Card>

            <Card className="p-4 border-l-4 border-l-indigo-500">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Average Ticket</span>
                <Target className="h-4 w-4 text-indigo-500" />
              </div>
              <p className="font-display text-2xl font-bold mt-2">{fmt(summary.average_order_value)}</p>
              <p className="text-xs text-muted-foreground mt-1">Average spent per visit</p>
            </Card>
          </div>
        )}

        {/* Charts Row */}
        {!isLoading && charts && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Sales Trend Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="font-display text-base font-semibold flex items-center justify-between">
                  <span>Sales Trend & Revenue</span>
                  <Badge variant="outline" className="font-normal text-xs">{dateRange.replace("_", " ")}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={charts.revenue_trend}>
                      <defs>
                        <linearGradient id="revenueReportGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis fontSize={11} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip formatter={(v: any) => [fmt(Number(v)), "Revenue"]} />
                      <Area type="monotone" dataKey="amount" stroke="#6366F1" strokeWidth={2} fill="url(#revenueReportGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base font-semibold">Payment Methods Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.payment_breakdown}
                        dataKey="amount"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                      >
                        {charts.payment_breakdown.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [fmt(Number(v)), "Total"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
