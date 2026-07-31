import { AppLink } from "@/lib/app-nav";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  UserMinus, MessageCircle, Sparkles, Phone, Search, ArrowUpDown,
  ChevronLeft, ChevronRight, Crown, Star, Calendar, Heart
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { CampaignSendModal, SendCustomerItem } from "@/components/campaign-send-modal";
import { openWhatsApp } from "@/lib/celebration-utils";
import { logWhatsApp } from "@/lib/whatsapp-history";
import { fmt } from "@/lib/currency";
import { apiFetch, getSession } from "@/lib/auth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRecoverableCustomersApi, RecoverableCustomerItem } from "@/lib/customer-recovery-api";

const validDays = new Set(["15", "30", "45", "60", "90"]);

export const Route = createFileRoute("/app/$type/$business/customer-recovery/$days")({
  loader: ({ params }) => {
    if (!validDays.has(params.days)) throw notFound();
    return { days: Number(params.days) };
  },
  component: RecoveryBucketPage,
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">
      Bucket not found. <AppLink path="customer-recovery" className="text-primary">Back to recovery</AppLink>
    </div>
  ),
});

function offerFor(days: number) {
  if (days >= 90) return "20% Off + Free Dessert";
  if (days >= 60) return "15% Off Next Visit";
  if (days >= 45) return "10% Off + Free Drink";
  if (days >= 30) return "Free Dessert On Us";
  return "Free Drink On Us";
}

function couponFor(days: number) {
  return `COMEBACK${days}`;
}

function RecoveryBucketPage() {
  const { days } = Route.useLoaderData();
  const session = getSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("days_desc");
  const [page, setPage] = useState(1);

  const [opening, setOpening] = useState(false);
  const [aiFor, setAiFor] = useState<RecoverableCustomerItem | null>(null);
  const [customMsg, setCustomMsg] = useState<Record<string, string>>({});
  const [sendOpen, setSendOpen] = useState(false);

  // Debounce search input
  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__recoverySearchTimer);
    (window as any).__recoverySearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  // ── 100% Database-Driven Query for Bucket Customers ────────────────────────
  const {
    data: customerData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["customer-recovery", "bucket-customers", session?.clientId, days, debouncedSearch, sortBy, page],
    queryFn: () =>
      getRecoverableCustomersApi({
        bucket: days,
        page,
        pageSize: 20,
        search: debouncedSearch,
        sortBy,
      }),
    refetchInterval: 30000,
  });

  const list = customerData?.items ?? [];
  const totalPages = customerData?.total_pages ?? 1;
  const totalItems = customerData?.total ?? 0;

  function defaultMessageFor(c: RecoverableCustomerItem) {
    const first = c.name ? c.name.split(" ")[0] : "Guest";
    const coupon = couponFor(days);
    const offer = offerFor(days);
    return `Hi ${first}! 👋 We miss having you around!\nIt's been ${c.days_since_last_visit} days since your last visit. We'd love to welcome you back with ${offer} (Coupon: ${coupon}) on your next visit ❤️`;
  }

  function handleSendSingle(c: RecoverableCustomerItem) {
    setOpening(true);
    const msg = customMsg[c.id] ?? defaultMessageFor(c);
    setTimeout(() => {
      openWhatsApp(c.phone, msg);
      logWhatsApp({ customerId: c.id, kind: "recovery", message: msg });

      // Save log on backend
      apiFetch("/api/v1/campaign-logs", {
        method: "POST",
        body: JSON.stringify({
          customer_id: c.id,
          campaign_type: "RECOVERY",
          status: "SENT",
          message: msg,
        }),
      }).catch((e) => console.warn("Log save warning:", e));

      setOpening(false);
      toast.success("WhatsApp opened");
    }, 400);
  }

  const sendCustomerList: SendCustomerItem[] = list.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    status: c.is_vip ? "VIP" : c.days_since_last_visit >= 60 ? "At Risk" : "Regular",
    visit_count: c.visit_count,
    total_spent: c.total_spent,
  }));

  return (
    <PageTransition>
      <AppLink
        path="customer-recovery"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← All recovery buckets
      </AppLink>

      <PageHeader
        title={`Customers not visited for ${days} days`}
        description={`${totalItems} customer${totalItems === 1 ? "" : "s"} found in this bucket. Suggested offer: ${offerFor(days)}.`}
        actions={
          <Button
            className="rounded-full bg-primary text-primary-foreground text-xs font-semibold px-4"
            disabled={list.length === 0}
            onClick={() => setSendOpen(true)}
          >
            <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Launch {days}-Day Campaign ({totalItems})
          </Button>
        }
      />

      {/* SEARCH & SORT CONTROLS */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or phone..."
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
            <SelectItem value="visits_desc">Most Visits</SelectItem>
          </SelectContent>
        </Select>

        <p className="ml-auto text-xs text-muted-foreground">
          {totalItems} guest{totalItems === 1 ? "" : "s"} in {days}-day bucket
        </p>
      </div>

      {/* CUSTOMER CARDS GRID */}
      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading recoverable customers from database…</div>
      ) : isError ? (
        <div className="py-12 text-center text-sm text-destructive">Failed to load recovery list. Please try again.</div>
      ) : list.length === 0 ? (
        <EmptyState
          title="No recovery customers"
          description={`No customers matching the ${days}-day inactivity window right now — nice work!`}
          icon={<UserMinus className="h-7 w-7 text-muted-foreground" />}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c, i) => {
              const initials = c.name
                ? c.name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
                : "NV";
              const lastVisitDate = c.last_visit_at
                ? new Date(c.last_visit_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : "—";

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ scale: 1.01 }}
                >
                  <Card className="overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-glow">
                    <div className="h-1.5 bg-gradient-to-r from-primary to-primary/60" />
                    <CardContent className="p-4 space-y-3">
                      {/* HEADER */}
                      <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11 shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white font-bold text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <AppLink path="customers/$id" params={{ id: c.id }} className="truncate font-semibold text-sm hover:text-primary block">
                            {c.name}
                          </AppLink>
                          <p className="text-[11px] text-muted-foreground font-mono">{c.phone}</p>
                        </div>
                        {c.is_vip ? (
                          <Badge className="rounded-full text-[10px] bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0">
                            <Crown className="mr-1 h-2.5 w-2.5" /> VIP
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full text-[10px]">
                            {c.days_since_last_visit >= 60 ? "At Risk" : "Dormant"}
                          </Badge>
                        )}
                      </div>

                      {/* STATS MATRIX */}
                      <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold text-foreground">{c.days_since_last_visit}d</p>
                          <p className="text-[9px] text-muted-foreground">Absent</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold text-foreground">{c.visit_count}</p>
                          <p className="text-[9px] text-muted-foreground">Visits</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold text-foreground">{fmt(c.total_spent)}</p>
                          <p className="text-[9px] text-muted-foreground">Lifetime</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold text-foreground">{c.loyalty_points}</p>
                          <p className="text-[9px] text-muted-foreground">Points</p>
                        </div>
                      </div>

                      {/* FAVORITE ITEM & OFFER */}
                      <div className="space-y-1 text-[11px]">
                        <div className="rounded-lg bg-muted/40 p-2 flex justify-between items-center">
                          <span className="text-muted-foreground">⭐ Favorite:</span>
                          <span className="font-medium text-foreground truncate max-w-[140px]">{c.favorite_item}</span>
                        </div>
                        <div className="rounded-lg bg-primary/10 p-2 flex justify-between items-center text-primary font-medium">
                          <span>🎁 Suggested Offer:</span>
                          <span>{offerFor(days)}</span>
                        </div>
                      </div>

                      {/* CUSTOM MSG PREVIEW (if AI generated) */}
                      {customMsg[c.id] && (
                        <div className="max-h-16 overflow-y-auto rounded-xl bg-muted/40 p-2 font-mono text-[10px] whitespace-pre-line text-muted-foreground">
                          {customMsg[c.id]}
                        </div>
                      )}

                      {/* ACTION BUTTONS */}
                      <div className="flex items-center gap-1.5 pt-1">
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
                          className="h-8 rounded-full text-xs"
                          onClick={() => setAiFor(c)}
                        >
                          <Sparkles className="mr-1 h-3 w-3 text-primary" /> AI Copy
                        </Button>
                        <AppLink path="customers/$id" params={{ id: c.id }}>
                          <Button size="sm" variant="ghost" className="h-8 rounded-full text-xs">Profile</Button>
                        </AppLink>
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

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
              <span>Page {page} of {totalPages} ({totalItems} total recoverable)</span>
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
      <Dialog open={opening} onOpenChange={setOpening}>
        <DialogContent className="rounded-2xl sm:max-w-sm text-center">
          <DialogHeader>
            <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
              <MessageCircle className="h-7 w-7 animate-pulse" />
            </div>
            <DialogTitle className="text-center font-display">Opening WhatsApp…</DialogTitle>
            <p className="text-center text-xs text-muted-foreground">Your comeback message is prefilled with offer code {couponFor(days)}.</p>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* AI GENERATE DIALOG — GEMINI AI */}
      <AiGenerateDialog
        open={!!aiFor}
        onOpenChange={(o) => !o && setAiFor(null)}
        title="AI Comeback Message"
        description={aiFor ? `Generating Gemini AI message for ${aiFor.name} (Absent ${aiFor.days_since_last_visit} days)` : ""}
        customerId={aiFor?.id}
        campaignType="recovery"
        couponCode={couponFor(days)}
        discountPercent={offerFor(days)}
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
        templateMessage={`Hi {name}! 👋 We miss having you around! Enjoy ${offerFor(days)} with coupon ${couponFor(days)} on your next visit ❤️`}
        couponCode={couponFor(days)}
        discountPercent={offerFor(days)}
        customers={sendCustomerList}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["customer-recovery"] });
          toast.success("Recovery data refreshed!");
        }}
      />
    </PageTransition>
  );
}
