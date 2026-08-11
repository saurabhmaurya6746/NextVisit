import { AppLink } from "@/lib/app-nav";
import { useParams } from "react-router-dom";
import { createFileRoute, notFound } from "@/lib/route-compat";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback } from "react";
import {
  UserMinus, MessageCircle, Sparkles, Phone, Search, ArrowUpDown,
  ChevronLeft, ChevronRight, Crown, CheckCircle2, X, Download,
  Filter, UserCheck, Scissors, UtensilsCrossed, Calendar,
  SlidersHorizontal, RefreshCw, Users, ChevronDown, ChevronUp,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { CampaignSendModal, SendCustomerItem } from "@/components/campaign-send-modal";
import { openWhatsApp, sendWhatsAppWithStatusTracking } from "@/lib/celebration-utils";
import { logWhatsApp } from "@/lib/whatsapp-history";
import { fmt } from "@/lib/currency";
import { apiFetch, getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRecoverableCustomersApi,
  RecoverableCustomerItem,
  markCustomerRecoveredApi,
  excludeCustomerApi,
} from "@/lib/customer-recovery-api";

const validDays = new Set(["15", "30", "45", "60", "90"]);

export const Route = createFileRoute("/app/$type/$business/customer-recovery/$days")({
  loader: ({ params }) => {
    if (!validDays.has(params.days)) throw notFound();
    return { days: Number(params.days) };
  },
  component: RecoveryBucketPage,
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">
      Bucket not found.{" "}
      <AppLink path="customer-recovery" className="text-primary">
        Back to recovery
      </AppLink>
    </div>
  ),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function offerFor(days: number, isSalon: boolean): string {
  if (isSalon) {
    if (days >= 90) return "20% Off + Free Deep Conditioning";
    if (days >= 60) return "15% Off Any Service";
    if (days >= 45) return "10% Off + Free Hair Wash";
    if (days >= 30) return "Free Hair Wash On Us";
    return "Free Conditioning On Us";
  }
  if (days >= 90) return "20% Off + Free Dessert";
  if (days >= 60) return "15% Off Next Visit";
  if (days >= 45) return "10% Off + Free Drink";
  if (days >= 30) return "Free Dessert On Us";
  return "Free Drink On Us";
}

function couponFor(days: number): string {
  return `COMEBACK${days}`;
}

function stageBadge(stage: string) {
  const map: Record<string, string> = {
    "15_days": "bg-primary/10 text-primary border-primary/20",
    "30_days": "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
    "45_days": "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400",
    "60_days": "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400",
    "90_days": "bg-destructive/10 text-destructive border-destructive/20",
  };
  return map[stage] || "bg-muted text-muted-foreground";
}

function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    "15_days": "15-29d",
    "30_days": "30-44d",
    "45_days": "45-59d",
    "60_days": "60-89d",
    "90_days": "90d+",
  };
  return map[stage] || stage;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function RecoveryBucketPage() {
  const { type, days: rawDays } = useParams<{ type?: string; days?: string }>();
  const days = parseInt(rawDays || "30", 10) || 30;
  const isSalon = type === "salon";
  const session = getSession();
  const queryClient = useQueryClient();

  // ── Filters & Sort ──────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("days_desc");
  const [page, setPage] = useState(1);
  const [filterVip, setFilterVip] = useState(false);
  const [filterGender, setFilterGender] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // ── Selection ───────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Modal States ────────────────────────────────────────────────────────
  const [openingWa, setOpeningWa] = useState(false);
  const [aiFor, setAiFor] = useState<RecoverableCustomerItem | null>(null);
  const [customMsg, setCustomMsg] = useState<Record<string, string>>({});
  const [sendOpen, setSendOpen] = useState(false);
  const [sendCustomers, setSendCustomers] = useState<SendCustomerItem[]>([]);
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [couponTarget, setCouponTarget] = useState<RecoverableCustomerItem | null>(null);
  const [couponCode, setCouponCode] = useState(couponFor(days));
  const [confirmExclude, setConfirmExclude] = useState<RecoverableCustomerItem | null>(null);

  // ── Debounce search ─────────────────────────────────────────────────────
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    clearTimeout((window as any).__recoverySearchTimer);
    (window as any).__recoverySearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  }, []);

  // ── Backend Query (100% DB driven) ──────────────────────────────────────
  const { data: customerData, isLoading, isError, refetch } = useQuery({
    queryKey: [
      "customer-recovery", "bucket-customers",
      session?.clientId, days, debouncedSearch, sortBy, page,
      filterVip, filterGender, filterStage,
    ],
    queryFn: () =>
      getRecoverableCustomersApi({
        bucket: days,
        page,
        pageSize: 20,
        search: debouncedSearch,
        sortBy,
        filterVip: filterVip || undefined,
        filterGender: filterGender !== "all" ? filterGender : undefined,
        filterStage: filterStage !== "all" ? filterStage : undefined,
      }),
    refetchInterval: 30000,
  });

  const list = customerData?.items ?? [];
  const totalPages = customerData?.total_pages ?? 1;
  const totalItems = customerData?.total ?? 0;

  // ── Mark Recovered Mutation ─────────────────────────────────────────────
  const markRecoveredMutation = useMutation({
    mutationFn: (customerId: string) => markCustomerRecoveredApi(customerId),
    onSuccess: (_, customerId) => {
      queryClient.invalidateQueries({ queryKey: ["customer-recovery"] });
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(customerId); return s; });
      toast.success("Customer marked as recovered!");
    },
    onError: (err: any) => toast.error(err.message || "Failed to mark recovered"),
  });

  // ── Exclude Mutation ────────────────────────────────────────────────────
  const excludeMutation = useMutation({
    mutationFn: (customerId: string) => excludeCustomerApi(customerId),
    onSuccess: (_, customerId) => {
      queryClient.invalidateQueries({ queryKey: ["customer-recovery"] });
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(customerId); return s; });
      setConfirmExclude(null);
      toast.success("Customer excluded from recovery list");
    },
    onError: (err: any) => toast.error(err.message || "Failed to exclude customer"),
  });

  // ── Per-customer helpers ────────────────────────────────────────────────
  function defaultMessageFor(c: RecoverableCustomerItem): string {
    const first = c.name ? c.name.split(" ")[0] : (isSalon ? "Client" : "Guest");
    const coupon = couponFor(days);
    const offer = offerFor(days, isSalon);
    const actionLabel = isSalon ? "appointment" : "visit";
    const bizLabel = isSalon ? "{salon_name}" : "{restaurant_name}";
    return `Hi ${first}! 👋 We miss you at ${bizLabel}!\nIt's been ${c.days_since_last_visit} days since your last ${actionLabel}. We'd love to welcome you back with ${offer} (Coupon: ${coupon}) ❤️`;
  }

  async function handleSendSingle(c: RecoverableCustomerItem) {
    setOpeningWa(true);
    const msg = customMsg[c.id] ?? defaultMessageFor(c);
    await sendWhatsAppWithStatusTracking({
      customerId: c.id,
      customerPhone: c.phone,
      message: msg,
      campaignType: "RECOVERY",
      onSuccess: () => {
        setOpeningWa(false);
        refetch();
      },
      onError: () => setOpeningWa(false),
    });
  }

  // ── Bulk Selection ──────────────────────────────────────────────────────
  const allSelected = list.length > 0 && list.every((c) => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(list.map((c) => c.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  // ── Bulk Actions ────────────────────────────────────────────────────────
  function handleBulkWhatsApp() {
    const selected = list.filter((c) => selectedIds.has(c.id));
    if (selected.length === 0) { toast.info("Select at least one customer first"); return; }
    setSendCustomers(
      selected.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        status: c.is_vip ? "VIP" : c.days_since_last_visit >= 60 ? "At Risk" : "Regular",
        visit_count: c.visit_count,
        total_spent: c.total_spent,
      }))
    );
    setSendOpen(true);
  }

  function handleBulkMarkRecovered() {
    const selected = Array.from(selectedIds);
    if (selected.length === 0) { toast.info("Select at least one customer first"); return; }
    const toastId = toast.loading(`Marking ${selected.length} customers as recovered…`);
    Promise.all(selected.map((id) => markCustomerRecoveredApi(id)))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["customer-recovery"] });
        setSelectedIds(new Set());
        toast.dismiss(toastId);
        toast.success(`${selected.length} customers marked as recovered!`);
      })
      .catch(() => {
        toast.dismiss(toastId);
        toast.error("Some customers could not be marked as recovered");
      });
  }

  function handleBulkExport() {
    const selected = list.filter((c) => selectedIds.has(c.id));
    if (selected.length === 0) { toast.info("Select at least one customer first"); return; }
    const headers = ["Name", "Phone", "Email", "Days Absent", "Total Spent", "Avg Spend", "Visits", "Loyalty Points", "Recovery Stage"];
    const rows = selected.map((c) => [
      c.name, c.phone, c.email || "", c.days_since_last_visit,
      c.total_spent, c.avg_spend ?? 0, c.visit_count,
      c.loyalty_points, c.recovery_stage,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recovery_customers_${days}d_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selected.length} customers`);
  }

  // ── UI Labels ───────────────────────────────────────────────────────────
  const guestLabel = isSalon ? "Clients" : "Guests";
  const actionLabel = isSalon ? "appointment" : "visit";
  const bookLabel = isSalon ? "Book Appointment" : "Create Reservation";
  const BusinessIcon = isSalon ? Scissors : UtensilsCrossed;

  return (
    <PageTransition>
      {/* BACK LINK */}
      <AppLink
        path="customer-recovery"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← All recovery buckets
      </AppLink>

      {/* PAGE HEADER */}
      <PageHeader
        title={`${guestLabel} absent for ${days}+ days`}
        description={`${totalItems} ${guestLabel.toLowerCase()} found. Suggested offer: ${offerFor(days, isSalon)}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full text-xs"
              onClick={() => { refetch(); queryClient.invalidateQueries({ queryKey: ["customer-recovery"] }); }}
            >
              <RefreshCw className="mr-1 h-3 w-3" /> Refresh
            </Button>
            <Button
              className="rounded-full bg-primary text-primary-foreground text-xs font-semibold px-4"
              disabled={list.length === 0}
              onClick={() => {
                setSendCustomers(
                  list.map((c) => ({
                    id: c.id,
                    name: c.name,
                    phone: c.phone,
                    status: c.is_vip ? "VIP" : c.days_since_last_visit >= 60 ? "At Risk" : "Regular",
                    visit_count: c.visit_count,
                    total_spent: c.total_spent,
                  }))
                );
                setSendOpen(true);
              }}
            >
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Launch {days}d Campaign ({totalItems})
            </Button>
          </div>
        }
      />

      {/* SEARCH, SORT & FILTER CONTROLS */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-52 max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search ${guestLabel.toLowerCase()} by name or phone…`}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-9 rounded-full pl-8 text-xs"
            />
          </div>

          <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-52 rounded-full text-xs">
              <ArrowUpDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="days_desc">Most Days Absent</SelectItem>
              <SelectItem value="days_asc">Least Days Absent</SelectItem>
              <SelectItem value="spend_desc">Highest Lifetime Spend</SelectItem>
              <SelectItem value="spend_asc">Lowest Lifetime Spend</SelectItem>
              <SelectItem value="visits_desc">Most {isSalon ? "Appointments" : "Visits"}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className={cn("h-9 rounded-full text-xs gap-1.5", showFilters && "bg-primary/10 text-primary border-primary/30")}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {(filterVip || filterGender !== "all" || filterStage !== "all") && (
              <Badge className="h-4 w-4 rounded-full p-0 text-[9px] bg-primary text-primary-foreground">!</Badge>
            )}
            {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>

          <p className="ml-auto text-xs text-muted-foreground">
            {totalItems} {guestLabel.toLowerCase()} in {days}-day bucket
          </p>
        </div>

        {/* EXPANDED FILTERS */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/30 p-3">
                {/* VIP Filter */}
                <button
                  onClick={() => { setFilterVip(!filterVip); setPage(1); }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 h-8 text-xs font-medium transition-all",
                    filterVip
                      ? "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Crown className="h-3 w-3" /> VIP Only
                </button>

                {/* Gender Filter (Salon only) */}
                {isSalon && (
                  <Select value={filterGender} onValueChange={(v) => { setFilterGender(v); setPage(1); }}>
                    <SelectTrigger className="h-8 w-36 rounded-full text-xs">
                      <Filter className="mr-1 h-3 w-3 text-muted-foreground" />
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genders</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {/* Recovery Stage Filter */}
                <Select value={filterStage} onValueChange={(v) => { setFilterStage(v); setPage(1); }}>
                  <SelectTrigger className="h-8 w-40 rounded-full text-xs">
                    <Filter className="mr-1 h-3 w-3 text-muted-foreground" />
                    <SelectValue placeholder="Recovery Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value="15_days">15–29 Days</SelectItem>
                    <SelectItem value="30_days">30–44 Days</SelectItem>
                    <SelectItem value="45_days">45–59 Days</SelectItem>
                    <SelectItem value="60_days">60–89 Days</SelectItem>
                    <SelectItem value="90_days">90+ Days</SelectItem>
                  </SelectContent>
                </Select>

                {/* Clear Filters */}
                {(filterVip || filterGender !== "all" || filterStage !== "all") && (
                  <button
                    className="flex items-center gap-1 rounded-full border px-2.5 h-8 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all"
                    onClick={() => { setFilterVip(false); setFilterGender("all"); setFilterStage("all"); setPage(1); }}
                  >
                    <X className="h-3 w-3" /> Clear filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* BULK ACTION BAR — appears when any selected */}
      <AnimatePresence>
        {someSelected && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border bg-primary/5 border-primary/20 p-3"
          >
            <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {selectedIds.size} {selectedIds.size === 1 ? (isSalon ? "client" : "guest") : (isSalon ? "clients" : "guests")} selected
            </span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Button size="sm" className="h-7 rounded-full text-[11px] gradient-brand text-primary-foreground" onClick={handleBulkWhatsApp}>
                <MessageCircle className="mr-1 h-3 w-3" /> Bulk WhatsApp
              </Button>
              <Button size="sm" variant="outline" className="h-7 rounded-full text-[11px]" onClick={handleBulkMarkRecovered}>
                <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" /> Mark Recovered
              </Button>
              <Button size="sm" variant="outline" className="h-7 rounded-full text-[11px]" onClick={handleBulkExport}>
                <Download className="mr-1 h-3 w-3" /> Export CSV
              </Button>
              <Button size="sm" variant="ghost" className="h-7 rounded-full text-[11px] text-muted-foreground" onClick={() => setSelectedIds(new Set())}>
                <X className="mr-1 h-3 w-3" /> Clear
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CUSTOMER LIST */}
      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading {guestLabel.toLowerCase()} from database…</div>
      ) : isError ? (
        <div className="py-12 text-center text-sm text-destructive">Failed to load recovery list. Please try again.</div>
      ) : list.length === 0 ? (
        <EmptyState
          title={`No ${guestLabel.toLowerCase()} to recover`}
          description={`No ${guestLabel.toLowerCase()} matching the ${days}-day inactivity window right now — great job!`}
          icon={<UserMinus className="h-7 w-7 text-muted-foreground" />}
        />
      ) : (
        <div className="space-y-4">
          {/* SELECT ALL HEADER */}
          <div className="flex items-center gap-3 px-1">
            <button
              onClick={toggleSelectAll}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all",
                allSelected
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-muted-foreground/40 hover:border-primary"
              )}
            >
              {allSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
            </button>
            <span className="text-xs text-muted-foreground">
              {allSelected ? `Deselect all ${list.length}` : `Select all ${list.length} on this page`}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c, i) => {
              const initials = c.name
                ? c.name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
                : "NV";
              const lastVisitDate = c.last_visit_at
                ? new Date(c.last_visit_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : "—";
              const isSelected = selectedIds.has(c.id);
              const avgSpend = c.avg_spend ?? (c.visit_count ? Math.round(c.total_spent / c.visit_count) : 0);

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card
                    className={cn(
                      "overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-glow",
                      isSelected && "ring-2 ring-primary border-primary/50"
                    )}
                  >
                    <div className="h-1.5 bg-gradient-to-r from-primary to-primary/60" />
                    <CardContent className="p-4 space-y-3">
                      {/* HEADER: CHECKBOX + AVATAR + NAME + BADGES */}
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleSelect(c.id)}
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all",
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/40 hover:border-primary"
                          )}
                        >
                          {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                        </button>

                        <Avatar className="h-11 w-11 shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white font-bold text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <AppLink
                            path="customers/$id"
                            params={{ id: c.id }}
                            className="truncate font-semibold text-sm hover:text-primary block"
                          >
                            {c.name}
                          </AppLink>
                          <p className="text-[11px] text-muted-foreground font-mono">{c.phone}</p>
                          {c.email && (
                            <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {c.is_vip && (
                            <Badge className="rounded-full text-[10px] bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0">
                              <Crown className="mr-1 h-2.5 w-2.5" /> VIP
                            </Badge>
                          )}
                          <Badge variant="outline" className={cn("rounded-full text-[9px]", stageBadge(c.recovery_stage))}>
                            {stageLabel(c.recovery_stage)}
                          </Badge>
                          {isSalon && c.gender && (
                            <span className="text-[10px] text-muted-foreground capitalize">{c.gender}</span>
                          )}
                        </div>
                      </div>

                      {/* STATS MATRIX */}
                      <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold text-foreground">{c.days_since_last_visit}d</p>
                          <p className="text-[9px] text-muted-foreground">Absent</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold text-foreground">{c.visit_count}</p>
                          <p className="text-[9px] text-muted-foreground">{isSalon ? "Visits" : "Orders"}</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold text-foreground">{fmt(c.total_spent)}</p>
                          <p className="text-[9px] text-muted-foreground">Lifetime</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold text-foreground">{fmt(avgSpend)}</p>
                          <p className="text-[9px] text-muted-foreground">Avg Spend</p>
                        </div>
                      </div>

                      {/* SECONDARY STATS ROW */}
                      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                        <div className="rounded-lg bg-muted/40 p-2 flex justify-between items-center">
                          <span className="text-muted-foreground">
                            {isSalon ? "⭐ Fav Service:" : "⭐ Fav Item:"}
                          </span>
                          <span className="font-medium text-foreground truncate max-w-[100px] ml-1">
                            {c.favorite_item}
                          </span>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2 flex justify-between items-center">
                          <span className="text-muted-foreground">🏆 Points:</span>
                          <span className="font-medium text-foreground">{c.loyalty_points}</span>
                        </div>
                      </div>

                      {/* LAST VISIT + OFFER */}
                      <div className="rounded-lg bg-primary/8 p-2 flex justify-between items-center text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Last {actionLabel}:
                        </span>
                        <span className="font-medium text-foreground">{lastVisitDate}</span>
                      </div>

                      <div className="rounded-lg bg-primary/10 p-2 flex justify-between items-center text-[11px] text-primary font-medium">
                        <span>🎁 Suggested Offer:</span>
                        <span>{offerFor(days, isSalon)}</span>
                      </div>

                      {/* AI GENERATED MESSAGE PREVIEW */}
                      {customMsg[c.id] && (
                        <div className="max-h-16 overflow-y-auto rounded-xl bg-muted/40 p-2 font-mono text-[10px] whitespace-pre-line text-muted-foreground border border-primary/20">
                          {customMsg[c.id]}
                        </div>
                      )}

                      {/* ACTION BUTTONS ROW 1: Primary actions */}
                      <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                        <Button
                          size="sm"
                          className="h-8 rounded-full bg-primary text-primary-foreground text-xs font-medium"
                          onClick={() => handleSendSingle(c)}
                        >
                          <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-full text-xs bg-primary/8 text-primary border-primary/20 hover:bg-primary/15"
                          onClick={() => setAiFor(c)}
                        >
                          <Sparkles className="mr-1 h-3 w-3" /> AI Copy
                        </Button>

                        <AppLink path="customers/$id" params={{ id: c.id }}>
                          <Button size="sm" variant="ghost" className="h-8 rounded-full text-xs">Profile</Button>
                        </AppLink>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full"
                          title="Call"
                          onClick={() => window.open(`tel:${c.phone.replace(/[^\d+]/g, "")}`)}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* ACTION BUTTONS ROW 2: Secondary actions */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full text-[11px] border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                          disabled={markRecoveredMutation.isPending}
                          onClick={() => markRecoveredMutation.mutate(c.id)}
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Recovered
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full text-[11px] border-destructive/20 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setConfirmExclude(c)}
                        >
                          <X className="mr-1 h-3 w-3" /> Exclude
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full text-[11px]"
                          onClick={() => { setCouponTarget(c); setCouponModalOpen(true); }}
                        >
                          🎫 Coupon
                        </Button>

                        {isSalon ? (
                          <AppLink path="appointments" className="block">
                            <Button size="sm" variant="outline" className="h-7 rounded-full text-[11px]">
                              <Scissors className="mr-1 h-3 w-3" /> Book
                            </Button>
                          </AppLink>
                        ) : (
                          <AppLink path="orders" className="block">
                            <Button size="sm" variant="outline" className="h-7 rounded-full text-[11px]">
                              <UtensilsCrossed className="mr-1 h-3 w-3" /> Reserve
                            </Button>
                          </AppLink>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages} ({totalItems} total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full"
                  disabled={!customerData?.has_previous}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
                </Button>
                <span className="px-2 font-semibold">{page}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full"
                  disabled={!customerData?.has_next}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* OPENING WHATSAPP DIALOG */}
      <Dialog open={openingWa} onOpenChange={setOpeningWa}>
        <DialogContent className="rounded-2xl sm:max-w-sm text-center">
          <DialogHeader>
            <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
              <MessageCircle className="h-7 w-7 animate-pulse" />
            </div>
            <DialogTitle className="text-center font-display">Opening WhatsApp…</DialogTitle>
            <p className="text-center text-xs text-muted-foreground">
              Your {isSalon ? "rebook" : "comeback"} message is prefilled with offer code {couponFor(days)}.
            </p>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* EXCLUDE CONFIRMATION DIALOG */}
      <Dialog open={!!confirmExclude} onOpenChange={(o) => !o && setConfirmExclude(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2 text-destructive">
              <X className="h-5 w-5 shrink-0" /> Exclude from Recovery?
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              <strong>{confirmExclude?.name}</strong> will be removed from all recovery buckets.
              You can undo this from their profile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmExclude(null)} className="rounded-xl">Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={excludeMutation.isPending}
              onClick={() => confirmExclude && excludeMutation.mutate(confirmExclude.id)}
              className="rounded-xl"
            >
              Exclude
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COUPON CREATION DIALOG */}
      <Dialog open={couponModalOpen} onOpenChange={setCouponModalOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">🎫 Create Coupon for {couponTarget?.name}</DialogTitle>
            <DialogDescription className="text-xs">
              Assign a coupon code to send with the recovery WhatsApp message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Coupon Code</Label>
              <Input
                className="mt-1 h-9 rounded-xl font-mono uppercase text-sm"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="e.g. COMEBACK20"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              This coupon will be pre-filled in the WhatsApp message template.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCouponModalOpen(false)} className="rounded-xl">Cancel</Button>
            <Button
              size="sm"
              className="rounded-xl gradient-brand text-primary-foreground"
              onClick={() => {
                if (couponTarget) {
                  const msg = `Hi ${couponTarget.name.split(" ")[0]}! 👋 Here's your exclusive code: ${couponCode} — ${offerFor(days, isSalon)} on your next ${isSalon ? "appointment" : "visit"}! ❤️`;
                  setCustomMsg((p) => ({ ...p, [couponTarget.id]: msg }));
                  toast.success(`Coupon ${couponCode} assigned to ${couponTarget.name}`);
                  setCouponModalOpen(false);
                }
              }}
            >
              Assign Coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI GENERATE DIALOG — GEMINI AI */}
      <AiGenerateDialog
        open={!!aiFor}
        onOpenChange={(o) => !o && setAiFor(null)}
        title={`AI ${isSalon ? "Rebook" : "Comeback"} Message`}
        description={
          aiFor
            ? `Generating Gemini AI message for ${aiFor.name} (Absent ${aiFor.days_since_last_visit} days)`
            : ""
        }
        customerId={aiFor?.id}
        campaignType="recovery"
        couponCode={couponFor(days)}
        discountPercent={offerFor(days, isSalon)}
        onUse={(m) => {
          if (aiFor) setCustomMsg((p) => ({ ...p, [aiFor.id]: m }));
          toast.success("AI message ready — click WhatsApp to send!");
        }}
      />

      {/* MULTI-CUSTOMER WHATSAPP SEND MODAL */}
      <CampaignSendModal
        open={sendOpen}
        onOpenChange={setSendOpen}
        campaignId={`recovery_bucket_${days}`}
        campaignTitle={`Recovery Campaign (${days}-Day Bucket)`}
        campaignType="recovery"
        templateMessage={
          `Hi {name}! 👋 We miss you! Enjoy ${offerFor(days, isSalon)} with coupon ${couponFor(days)} on your next ${isSalon ? "appointment" : "visit"} ❤️`
        }
        couponCode={couponFor(days)}
        discountPercent={offerFor(days, isSalon)}
        customers={sendCustomers}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["customer-recovery"] });
          toast.success("Recovery data refreshed!");
        }}
      />
    </PageTransition>
  );
}
