import { AppLink } from "@/lib/app-nav";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Star, Send, MessageCircle, Sparkles, Phone, Copy, Search,
  CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, Calendar, TrendingUp,
  LayoutGrid, List
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { openWhatsApp } from "@/lib/celebration-utils";
import { logWhatsApp } from "@/lib/whatsapp-history";
import { fmt } from "@/lib/currency";
import { getSession } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getReviewBoosterDashboardApi,
  getReviewBoosterCustomersApi,
  getReviewBoosterSettingsApi,
  sendReviewRequestApi,
  generateReviewAiApi,
  markReviewCompletedApi,
  ReviewBoosterCustomerItem,
} from "@/lib/review-booster-api";

export const Route = createFileRoute("/app/$type/$business/review-booster")({ component: ReviewsPage });

type DateFilter = "today" | "yesterday" | "7d" | "month" | "all";
type StatusTab = "pending" | "requested" | "reviewed" | "eligible" | "all";

function getDateRange(f: DateFilter, customDate: string): { startDate?: string; endDate?: string } {
  if (customDate) {
    return { startDate: `${customDate}T00:00:00Z`, endDate: `${customDate}T23:59:59Z` };
  }
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (f === "today") {
    return { startDate: `${todayStr}T00:00:00Z` };
  }
  if (f === "yesterday") {
    const y = new Date(now.getTime() - 86400000);
    const yStr = y.toISOString().slice(0, 10);
    return { startDate: `${yStr}T00:00:00Z`, endDate: `${todayStr}T00:00:00Z` };
  }
  if (f === "7d") {
    const d7 = new Date(now.getTime() - 7 * 86400000);
    return { startDate: d7.toISOString() };
  }
  if (f === "month") {
    const d30 = new Date(now.getTime() - 30 * 86400000);
    return { startDate: d30.toISOString() };
  }
  return {};
}

function defaultReviewMessage(name: string, reviewUrl: string) {
  const firstName = name ? name.split(" ")[0] : "Valued Guest";
  return `Hi ${firstName}! 👋\nThank you for visiting us recently ❤️ We hope you had a fantastic experience!\nIf you have 1 minute, please support us with a Google review:\n⭐⭐⭐⭐⭐\n${reviewUrl}\nThank you!`;
}

function ReviewsPage() {
  const session = getSession();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<StatusTab>("pending");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDate, setCustomDate] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [opening, setOpening] = useState(false);
  const [aiFor, setAiFor] = useState<ReviewBoosterCustomerItem | null>(null);
  const [customMsg, setCustomMsg] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);

  // Debounce search input
  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__reviewSearchTimer);
    (window as any).__reviewSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  // 1. React Query: Fetch 100% Database-Driven Dashboard Metrics
  const { data: dashboard, isLoading: isDashLoading } = useQuery({
    queryKey: ["review-booster", "dashboard", session?.clientId],
    queryFn: getReviewBoosterDashboardApi,
    refetchInterval: 30000,
  });

  // 2. React Query: Fetch Business Google Review Settings
  const { data: settings } = useQuery({
    queryKey: ["review-booster", "settings", session?.clientId],
    queryFn: getReviewBoosterSettingsApi,
  });

  const googleReviewUrl = settings?.google_review_url || "https://g.page/review";

  // 3. React Query: Fetch 100% Database-Driven Paginated Customers List
  const dateRange = getDateRange(dateFilter, customDate);

  const {
    data: customerData,
    isLoading: isCustLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      "review-booster", "customers", session?.clientId,
      tab, debouncedSearch, page, pageSize, dateFilter, customDate,
    ],
    queryFn: () =>
      getReviewBoosterCustomersApi({
        status: tab,
        search: debouncedSearch,
        page,
        pageSize,
        sortBy: "recent",
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      }),
    refetchInterval: 30000,
  });

  const customers = customerData?.items ?? [];
  const totalPages = customerData?.total_pages ?? 1;
  const totalItems = customerData?.total ?? 0;

  const counts = {
    pending: dashboard?.pending ?? 0,
    requested: dashboard?.requested ?? 0,
    reviewed: dashboard?.reviewed ?? 0,
    clicked: dashboard?.clicked ?? 0,
    eligible_today: dashboard?.eligible_today ?? 0,
  };

  // Handle Send Review Request -> Calls Backend POST /api/v1/review-booster/send
  async function handleSend(c: ReviewBoosterCustomerItem) {
    setIsSending(true);
    setOpening(true);

    const msg = customMsg[c.customer_id] ?? defaultReviewMessage(c.customer_name, googleReviewUrl);

    try {
      // 1. Enqueue review request on backend
      await sendReviewRequestApi({
        customer_ids: [c.customer_id],
        message: msg,
      });

      // 2. Open WhatsApp prefilled with message
      setTimeout(() => {
        openWhatsApp(c.phone, msg);
        logWhatsApp({ customerId: c.customer_id, kind: "review", message: msg });
        setOpening(false);
        setIsSending(false);

        // 3. Invalidate React Query cache to auto-reload status & dashboard
        queryClient.invalidateQueries({ queryKey: ["review-booster"] });
        toast.success(`Review request sent to ${c.customer_name}!`);
      }, 500);
    } catch (e: any) {
      setOpening(false);
      setIsSending(false);
      toast.error(e.message || "Failed to send review request");
    }
  }

  // Handle Mark Reviewed -> Calls Backend PATCH /api/v1/review-booster/{customer_id}/reviewed
  async function handleMarkReviewed(c: ReviewBoosterCustomerItem) {
    try {
      await markReviewCompletedApi(c.customer_id);
      queryClient.invalidateQueries({ queryKey: ["review-booster"] });
      toast.success(`${c.customer_name} marked as Reviewed ⭐`);
    } catch (e: any) {
      toast.error(e.message || "Failed to mark as reviewed");
    }
  }

  const startRecordNum = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecordNum = Math.min(page * pageSize, totalItems);

  return (
    <PageTransition>
      <PageHeader
        title="Review booster"
        description="Every completed visit automatically becomes eligible for a Google review request."
        actions={
          <div className="flex items-center gap-2">
            {/* VIEW MODE TOGGLE BUTTONS */}
            <div className="flex items-center rounded-full border bg-card p-1 shadow-sm">
              <Button
                size="sm"
                variant={viewMode === "grid" ? "default" : "ghost"}
                className={cn("h-7 px-3 rounded-full text-xs gap-1.5", viewMode === "grid" && "bg-primary text-primary-foreground font-semibold")}
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Grid View
              </Button>
              <Button
                size="sm"
                variant={viewMode === "list" ? "default" : "ghost"}
                className={cn("h-7 px-3 rounded-full text-xs gap-1.5", viewMode === "list" && "bg-primary text-primary-foreground font-semibold")}
                onClick={() => setViewMode("list")}
              >
                <List className="h-3.5 w-3.5" /> List View
              </Button>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="rounded-full text-xs"
              onClick={() => {
                navigator.clipboard?.writeText(googleReviewUrl);
                toast.success("Google Review link copied!");
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy review link
            </Button>
          </div>
        }
      />

      {/* TABS & FILTERS BAR */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => { setTab(v as StatusTab); setPage(1); }}>
          <TabsList className="rounded-full">
            <TabsTrigger value="pending" className="rounded-full">
              Pending <Badge variant="secondary" className="ml-1.5 rounded-full text-[10px]">{counts.pending}</Badge>
            </TabsTrigger>
            <TabsTrigger value="requested" className="rounded-full">
              Requested <Badge variant="secondary" className="ml-1.5 rounded-full text-[10px]">{counts.requested}</Badge>
            </TabsTrigger>
            <TabsTrigger value="reviewed" className="rounded-full">
              Reviewed <Badge variant="secondary" className="ml-1.5 rounded-full text-[10px]">{counts.reviewed}</Badge>
            </TabsTrigger>
            <TabsTrigger value="all" className="rounded-full">
              All Visits
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* SEARCH & DATE FILTERS */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-44">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name/phone…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-8 rounded-full pl-8 text-xs"
            />
          </div>

          {(["today", "yesterday", "7d", "month", "all"] as DateFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => { setDateFilter(f); setCustomDate(""); setPage(1); }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                dateFilter === f && !customDate ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "today" ? "Today" : f === "yesterday" ? "Yesterday" : f === "7d" ? "Last 7 days" : f === "month" ? "Last month" : "All"}
            </button>
          ))}
          <Input
            type="date"
            value={customDate}
            onChange={(e) => { setCustomDate(e.target.value); setPage(1); }}
            className="h-8 w-36 rounded-full text-xs"
          />
        </div>
      </div>

      {/* CUSTOMERS GRID / LIST CONTAINER */}
      {isCustLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading database review records…</div>
      ) : isError ? (
        <div className="py-12 text-center text-sm text-destructive">Failed to load review booster list.</div>
      ) : customers.length === 0 ? (
        <EmptyState
          title={tab === "pending" ? "No pending review requests" : tab === "requested" ? "No pending follow-ups" : "No review records"}
          description="Every completed, paid visit lands here automatically based on your review settings."
          icon={<Star className="h-7 w-7 text-muted-foreground" />}
        />
      ) : (
        <div className="space-y-4">
          {/* GRID VIEW */}
          {viewMode === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {customers.map((c, i) => {
                const initials = c.customer_name
                  ? c.customer_name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
                  : "NV";

                const visitDateFormatted = c.last_visit_at
                  ? new Date(c.last_visit_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                  : "—";

                return (
                  <motion.div
                    key={c.customer_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileHover={{ scale: 1.01 }}
                  >
                    <Card className="overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-glow">
                      <div className="h-1.5 gradient-brand" />
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-11 w-11 shrink-0">
                            <AvatarFallback className="gradient-brand text-primary-foreground font-bold text-xs">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <AppLink path="customers/$id" params={{ id: c.customer_id }} className="truncate font-semibold text-sm hover:text-primary block">
                              {c.customer_name}
                            </AppLink>
                            <p className="text-xs text-muted-foreground font-mono">{c.phone}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full text-[10px] capitalize font-medium",
                              c.status === "reviewed" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
                              c.status === "clicked" && "border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10",
                              c.status === "requested" && "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10",
                              c.status === "pending" && "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                            )}
                          >
                            {c.status}
                          </Badge>
                        </div>

                        {/* STATS */}
                        <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                          <div className="rounded-lg bg-muted/60 p-1.5">
                            <p className="font-bold text-foreground">{visitDateFormatted}</p>
                            <p className="text-[9px] text-muted-foreground">Last Visit</p>
                          </div>
                          <div className="rounded-lg bg-muted/60 p-1.5">
                            <p className="font-bold text-foreground">{fmt(c.bill_amount)}</p>
                            <p className="text-[9px] text-muted-foreground">Bill Amount</p>
                          </div>
                          <div className="rounded-lg bg-muted/60 p-1.5">
                            <p className="font-bold text-foreground">{c.visit_count}</p>
                            <p className="text-[9px] text-muted-foreground">Total Visits</p>
                          </div>
                        </div>

                        {/* CUSTOM MSG PREVIEW */}
                        {customMsg[c.customer_id] && (
                          <div className="max-h-16 overflow-y-auto rounded-xl bg-muted/40 p-2 font-mono text-[10px] whitespace-pre-line text-muted-foreground">
                            {customMsg[c.customer_id]}
                          </div>
                        )}

                        {/* ACTION BUTTONS */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {c.status === "pending" || c.status === "eligible" ? (
                            <Button
                              size="sm"
                              className="h-8 rounded-full gradient-brand text-primary-foreground text-xs font-semibold"
                              onClick={() => handleSend(c)}
                              disabled={isSending}
                            >
                              <MessageCircle className="mr-1 h-3 w-3" /> Send Review Request
                            </Button>
                          ) : c.status === "requested" || c.status === "clicked" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-full text-xs"
                              onClick={() => handleSend(c)}
                              disabled={isSending}
                            >
                              <Send className="mr-1 h-3 w-3" /> Resend
                            </Button>
                          ) : (
                            <Badge className="rounded-full bg-emerald-600 text-white font-semibold text-xs py-1 px-3">
                              Reviewed ⭐
                            </Badge>
                          )}

                          {c.status !== "reviewed" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-full text-xs"
                                onClick={() => setAiFor(c)}
                              >
                                <Sparkles className="mr-1 h-3 w-3 text-primary" /> AI Improve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 rounded-full text-[11px] text-emerald-600 dark:text-emerald-400"
                                onClick={() => handleMarkReviewed(c)}
                              >
                                Mark Reviewed
                              </Button>
                            </>
                          )}

                          <Button
                            size="icon"
                            variant="ghost"
                            className="ml-auto h-8 w-8 rounded-full"
                            onClick={() => window.open(`tel:${c.phone.replace(/[^\d+]/g, "")}`)}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW TABLE */
            <Card className="rounded-2xl border overflow-hidden bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Phone</th>
                      <th className="px-4 py-3 font-semibold">Last Visit</th>
                      <th className="px-4 py-3 font-semibold">Bill Amount</th>
                      <th className="px-4 py-3 font-semibold">Visits</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {customers.map((c) => {
                      const initials = c.customer_name
                        ? c.customer_name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
                        : "NV";

                      const visitDateFormatted = c.last_visit_at
                        ? new Date(c.last_visit_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                        : "—";

                      return (
                        <tr key={c.customer_id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className="gradient-brand text-primary-foreground font-bold text-[10px]">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <AppLink path="customers/$id" params={{ id: c.customer_id }} className="hover:text-primary font-semibold truncate max-w-[140px]">
                                {c.customer_name}
                              </AppLink>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">{c.phone}</td>
                          <td className="px-4 py-3 font-medium">{visitDateFormatted}</td>
                          <td className="px-4 py-3 font-bold text-foreground">{fmt(c.bill_amount)}</td>
                          <td className="px-4 py-3 font-semibold">{c.visit_count}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full text-[10px] capitalize font-medium px-2 py-0.5",
                                c.status === "reviewed" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
                                c.status === "clicked" && "border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10",
                                c.status === "requested" && "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10",
                                c.status === "pending" && "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                              )}
                            >
                              {c.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {c.status === "pending" || c.status === "eligible" ? (
                                <Button
                                  size="sm"
                                  className="h-7 px-3 rounded-full gradient-brand text-primary-foreground text-[11px] font-semibold"
                                  onClick={() => handleSend(c)}
                                  disabled={isSending}
                                >
                                  <MessageCircle className="mr-1 h-3 w-3" /> Send
                                </Button>
                              ) : c.status === "requested" || c.status === "clicked" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-3 rounded-full text-[11px]"
                                  onClick={() => handleSend(c)}
                                  disabled={isSending}
                                >
                                  <Send className="mr-1 h-3 w-3" /> Resend
                                </Button>
                              ) : (
                                <Badge className="rounded-full bg-emerald-600 text-white font-semibold text-[10px] py-0.5 px-2">
                                  Reviewed ⭐
                                </Badge>
                              )}

                              {c.status !== "reviewed" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2.5 rounded-full text-[11px]"
                                    onClick={() => setAiFor(c)}
                                  >
                                    <Sparkles className="h-3 w-3 text-primary" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-[11px] text-emerald-600 dark:text-emerald-400 rounded-full px-2"
                                    onClick={() => handleMarkReviewed(c)}
                                  >
                                    Mark Reviewed
                                  </Button>
                                </>
                              )}

                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 rounded-full"
                                onClick={() => window.open(`tel:${c.phone.replace(/[^\d+]/g, "")}`)}
                              >
                                <Phone className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* COMPLETE PAGINATION CONTROLS BAR */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3 text-xs text-muted-foreground shadow-sm">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong>{startRecordNum}</strong>–<strong>{endRecordNum}</strong> of <strong>{totalItems}</strong> records
              </span>

              <div className="ml-2 flex items-center gap-1">
                <span className="text-[11px]">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-7 rounded-lg border bg-background px-2 text-xs font-semibold focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full px-3 text-xs"
                disabled={!customerData?.has_previous}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
              </Button>

              {/* NUMBERED PAGE BUTTONS */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                let pageNum = page;
                if (totalPages <= 5) pageNum = idx + 1;
                else if (page <= 3) pageNum = idx + 1;
                else if (page >= totalPages - 2) pageNum = totalPages - 4 + idx;
                else pageNum = page - 2 + idx;

                return (
                  <Button
                    key={pageNum}
                    size="sm"
                    variant={page === pageNum ? "default" : "outline"}
                    className={cn(
                      "h-8 w-8 rounded-full p-0 text-xs font-semibold",
                      page === pageNum && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}

              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full px-3 text-xs"
                disabled={!customerData?.has_next}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP OPENING DIALOG */}
      <Dialog open={opening} onOpenChange={setOpening}>
        <DialogContent className="rounded-2xl sm:max-w-sm text-center">
          <DialogHeader>
            <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-glow">
              <MessageCircle className="h-7 w-7 animate-pulse" />
            </div>
            <DialogTitle className="text-center font-display">Opening WhatsApp…</DialogTitle>
            <p className="text-center text-xs text-muted-foreground">Your review request message is prefilled — press Send inside WhatsApp.</p>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* AI GENERATE DIALOG — GEMINI AI */}
      <AiGenerateDialog
        open={!!aiFor}
        onOpenChange={(o) => !o && setAiFor(null)}
        title="AI Review Request Generator"
        description={aiFor ? `Generating Gemini AI review request copy for ${aiFor.customer_name}` : ""}
        customerId={aiFor?.customer_id}
        campaignType="review"
        onUse={(m) => {
          if (aiFor) setCustomMsg((p) => ({ ...p, [aiFor.customer_id]: m }));
          toast.success("AI review request copy ready — click Send Review Request!");
        }}
      />
    </PageTransition>
  );
}