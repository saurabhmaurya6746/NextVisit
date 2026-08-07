import { AppLink } from "@/lib/app-nav";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  MessageCircle, Search, Calendar, Filter, ArrowUpDown, ChevronLeft,
  ChevronRight, Copy, Check, User, Phone, Mail, Sparkles, Building2, Tag, Clock, ShieldCheck
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSession } from "@/lib/auth";
import { toast } from "sonner";
import {
  fetchBackendCampaignHistoryApi,
  CampaignHistoryItem,
  PaginatedCampaignHistoryResponse
} from "@/lib/whatsapp-history";

export const Route = createFileRoute("/app/$type/$business/whatsapp-history")({ component: WhatsAppHistoryPage });

const CAMPAIGN_TYPE_META: Record<string, { label: string; tone: string }> = {
  WELCOME: { label: "Welcome", tone: "bg-blue-500/10 text-blue-600 border-blue-200" },
  BIRTHDAY: { label: "Birthday", tone: "bg-pink-500/10 text-pink-600 border-pink-200" },
  ANNIVERSARY: { label: "Anniversary", tone: "bg-purple-500/10 text-purple-600 border-purple-200" },
  FESTIVAL: { label: "Festival", tone: "bg-amber-500/10 text-amber-600 border-amber-200" },
  VIP: { label: "VIP", tone: "bg-amber-500/10 text-amber-600 border-amber-200 font-semibold" },
  RECOVERY: { label: "Customer Recovery", tone: "bg-orange-500/10 text-orange-600 border-orange-200" },
  REVIEW: { label: "Review Booster", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  COUPON: { label: "Coupon Offer", tone: "bg-indigo-500/10 text-indigo-600 border-indigo-200" },
  CUSTOM: { label: "Custom Campaign", tone: "bg-slate-500/10 text-slate-600 border-slate-200" },
};

function getBadgeMeta(typeStr: string) {
  const t = (typeStr || "CUSTOM").toUpperCase();
  return CAMPAIGN_TYPE_META[t] || { label: t, tone: "bg-slate-500/10 text-slate-600 border-slate-200" };
}

function WhatsAppHistoryPage() {
  const session = getSession();
  const queryClient = useQueryClient();

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [campaignType, setCampaignType] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [sort, setSort] = useState<string>("newest");

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Selected Detail Item for Side Drawer
  const [selectedItem, setSelectedItem] = useState<CampaignHistoryItem | null>(null);
  const [copied, setCopied] = useState(false);

  // Debounce search input
  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__waSearchTimer);
    (window as any).__waSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  // 100% Database-Driven Query
  const {
    data: historyData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<PaginatedCampaignHistoryResponse>({
    queryKey: [
      "whatsapp-history",
      session?.clientId,
      debouncedSearch,
      campaignType,
      statusFilter,
      dateRange,
      sort,
      page,
      limit,
    ],
    queryFn: () =>
      fetchBackendCampaignHistoryApi({
        page,
        limit,
        search: debouncedSearch,
        campaign_type: campaignType,
        status: statusFilter,
        date_range: dateRange,
        sort,
      }),
    refetchInterval: 10000, // Instant background polling
  });

  // Listen for realtime wa dispatch events to trigger instant refetch
  useEffect(() => {
    const handleWaChanged = () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-history"] });
      refetch();
    };
    window.addEventListener("growthos:wa-changed", handleWaChanged);
    window.addEventListener("storage", handleWaChanged);
    return () => {
      window.removeEventListener("growthos:wa-changed", handleWaChanged);
      window.removeEventListener("storage", handleWaChanged);
    };
  }, [queryClient, refetch]);

  const items = historyData?.items ?? [];
  const totalItems = historyData?.total ?? 0;
  const totalPages = historyData?.total_pages ?? 1;

  const handleCopyMessage = (msg: string) => {
    navigator.clipboard.writeText(msg);
    setCopied(true);
    toast.success("AI message copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PageTransition>
      <PageHeader
        title="WhatsApp History"
        description="100% database-driven campaign audit log — real backend records."
      />

      <Card className="rounded-2xl border shadow-sm bg-card">
        <CardContent className="p-4 sm:p-6">
          {/* SEARCH & FILTERS BAR */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search name, phone, message, coupon..."
                className="pl-9 rounded-full text-xs h-9"
              />
            </div>

            <Select value={campaignType} onValueChange={(v) => { setCampaignType(v); setPage(1); }}>
              <SelectTrigger className="w-[160px] rounded-full text-xs h-9">
                <SelectValue placeholder="Campaign Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaign Types</SelectItem>
                <SelectItem value="WELCOME">Welcome</SelectItem>
                <SelectItem value="BIRTHDAY">Birthday</SelectItem>
                <SelectItem value="ANNIVERSARY">Anniversary</SelectItem>
                <SelectItem value="FESTIVAL">Festival</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
                <SelectItem value="RECOVERY">Recovery</SelectItem>
                <SelectItem value="REVIEW">Review Booster</SelectItem>
                <SelectItem value="COUPON">Coupon Offer</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px] rounded-full text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setPage(1); }}>
              <SelectTrigger className="w-[130px] rounded-full text-xs h-9">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
              <SelectTrigger className="w-[130px] rounded-full text-xs h-9">
                <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* TABLE AREA */}
          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading database WhatsApp logs...</div>
          ) : isError ? (
            <div className="py-12 text-center text-sm text-destructive font-medium">
              {(error as any)?.message || "Failed to load WhatsApp history records"}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No WhatsApp records found"
              description="Real campaign messages sent via WhatsApp will appear here automatically."
              icon={<MessageCircle className="h-7 w-7 text-muted-foreground" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs">Campaign Type</TableHead>
                    <TableHead className="text-xs">Message Preview</TableHead>
                    <TableHead className="text-xs">Date & Time</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((m) => {
                    const meta = getBadgeMeta(m.campaign_type);
                    const isSent = m.status.toUpperCase() === "SENT";
                    const isFailed = m.status.toUpperCase() === "FAILED";

                    return (
                      <TableRow
                        key={m.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedItem(m)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <AppLink
                              path="customers/$id"
                              params={{ id: m.customer_id }}
                              className="font-semibold text-xs hover:text-primary"
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            >
                              {m.customer_name}
                            </AppLink>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{m.customer_phone}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`rounded-full text-[10px] uppercase font-mono px-2 py-0.5 ${meta.tone}`}>
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[320px] truncate text-xs text-muted-foreground font-mono">
                          {m.message_preview || m.message}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                          {new Date(m.sent_at || m.created_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`rounded-full text-[10px] font-semibold ${
                              isSent
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-200"
                                : isFailed
                                ? "bg-rose-500/10 text-rose-600 border border-rose-200"
                                : "bg-amber-500/10 text-amber-600 border border-amber-200"
                            }`}
                          >
                            {m.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* BACKEND SERVER-SIDE PAGINATION CONTROLS */}
          {totalItems > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <Select
                  value={limit.toString()}
                  onValueChange={(v) => {
                    setLimit(Number(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px] rounded-md text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="ml-2 font-mono">
                  Page {page} of {totalPages} ({totalItems} total logs)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full text-xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
                </Button>
                <span className="font-semibold px-2">{page}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full text-xs"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SIDE DRAWER (SHEET) FOR DETAILED CAMPAIGN AUDIT VIEW */}
      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto p-6">
          {selectedItem && (
            <div className="space-y-6">
              <SheetHeader className="border-b pb-4 text-left">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={`rounded-full text-xs uppercase ${getBadgeMeta(selectedItem.campaign_type).tone}`}>
                    {selectedItem.campaign_type}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={`rounded-full text-xs font-semibold ${
                      selectedItem.status.toUpperCase() === "SENT"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {selectedItem.status}
                  </Badge>
                </div>
                <SheetTitle className="text-lg font-bold font-display mt-2">
                  {selectedItem.campaign_name}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Audit log record #{selectedItem.id.slice(0, 8)}
                </SheetDescription>
              </SheetHeader>

              {/* GENERATED AI MESSAGE CARD */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Generated AI Message
                  </h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs rounded-full"
                    onClick={() => handleCopyMessage(selectedItem.message)}
                  >
                    {copied ? <Check className="mr-1 h-3 w-3 text-emerald-600" /> : <Copy className="mr-1 h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <div className="rounded-xl border bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                  {selectedItem.message}
                </div>
              </div>

              {/* CUSTOMER DETAILS */}
              <div className="rounded-xl border p-4 space-y-3 bg-card">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                  <User className="h-3.5 w-3.5 text-primary" /> Customer Profile
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Name</span>
                    <AppLink
                      path="customers/$id"
                      params={{ id: selectedItem.customer_id }}
                      className="font-semibold hover:text-primary"
                    >
                      {selectedItem.customer_name}
                    </AppLink>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Phone</span>
                    <span className="font-mono">{selectedItem.customer_phone}</span>
                  </div>
                  {selectedItem.customer_email && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground block text-[10px]">Email</span>
                      <span className="font-mono">{selectedItem.customer_email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* CAMPAIGN & OFFER DETAILS */}
              <div className="rounded-xl border p-4 space-y-3 bg-card">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                  <Tag className="h-3.5 w-3.5 text-primary" /> Campaign & Offer Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Campaign Type</span>
                    <span className="font-medium uppercase font-mono">{selectedItem.campaign_type}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Coupon Used</span>
                    <span className="font-mono font-bold text-primary">
                      {selectedItem.coupon_code || "None"}
                    </span>
                  </div>
                </div>
              </div>

              {/* DISPATCH METADATA */}
              <div className="rounded-xl border p-4 space-y-3 bg-card">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Dispatch Audit Information
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Sent By</span>
                    <span className="font-medium">{selectedItem.sent_by}</span>
                    {selectedItem.sent_by_role && (
                      <span className="text-[10px] text-muted-foreground block font-mono">({selectedItem.sent_by_role})</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Timestamp</span>
                    <span className="font-mono text-[11px]">
                      {new Date(selectedItem.sent_at || selectedItem.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Business Name</span>
                    <span className="font-medium">{selectedItem.business_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Business Type</span>
                    <span className="font-medium capitalize">{selectedItem.business_type}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </PageTransition>
  );
}