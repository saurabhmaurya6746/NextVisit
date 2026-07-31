import { AppLink } from "@/lib/app-nav";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  Crown, MessageCircle, Sparkles, Phone, Search, ArrowUpDown,
  ChevronLeft, ChevronRight, Star, Trophy, Gem, Heart
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { CampaignSendModal } from "@/components/campaign-send-modal";
import { fmt } from "@/lib/currency";
import { openWhatsApp } from "@/lib/celebration-utils";
import { logWhatsApp } from "@/lib/whatsapp-history";
import { apiFetch, getSession } from "@/lib/auth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/app/$type/$business/vip")({ component: VipPage });

const SEGMENT_CONFIG: Record<string, { color: string; icon: any }> = {
  "Diamond VIP": { color: "from-violet-500 to-indigo-500", icon: Gem },
  "Gold VIP": { color: "from-amber-400 to-orange-500", icon: Trophy },
  "VIP": { color: "from-primary to-primary/70", icon: Crown },
};

function getSegmentIcon(segment: string) {
  return SEGMENT_CONFIG[segment]?.icon ?? Crown;
}

function getSegmentGradient(segment: string) {
  return SEGMENT_CONFIG[segment]?.color ?? "from-primary to-primary/70";
}

function VipPage() {
  const session = getSession();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("spend_desc");
  const [page, setPage] = useState(1);
  const [aiFor, setAiFor] = useState<any | null>(null);
  const [sendCampaignOpen, setSendCampaignOpen] = useState(false);
  const [customMsgs, setCustomMsgs] = useState<Record<string, string>>({});

  // Debounce search input
  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__vipSearchTimer);
    (window as any).__vipSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  // ── 100% Database-Driven VIP Query ─────────────────────────────────────────
  const {
    data: vipData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["vip-customers", session?.clientId, debouncedSearch, sortBy, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: "20",
        sort_by: sortBy,
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

      const res = await apiFetch(`/api/v1/customers/vip?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to load VIP customers (HTTP ${res.status})`);
      }
      return res.json();
    },
    refetchInterval: 30000,
  });

  const summary = vipData?.summary ?? {
    total_vip: 0,
    total_lifetime_spend: 0,
    avg_visits: 0,
    avg_lifetime_spend: 0,
    total_loyalty_points: 0,
  };

  const customers: any[] = vipData?.items ?? [];
  const totalPages = vipData?.total_pages ?? 1;
  const totalVip = vipData?.total ?? 0;

  function sendWhatsApp(c: any) {
    const msg = customMsgs[c.id] ?? `Hi ${c.name.split(" ")[0]} 💎 As one of our most valued guests, you deserve only the best! Enjoy coupon VIP25 for 25% off your next visit ❤️`;
    openWhatsApp(c.phone, msg);
    logWhatsApp({ customerId: c.id, kind: "campaign", message: msg });
    toast.success("VIP WhatsApp opened");
  }

  return (
    <PageTransition>
      <PageHeader
        title="VIP Customers"
        description="Your top guests — identified automatically from real spend, visits, and loyalty data."
        actions={
          <Button
            className="rounded-full bg-primary text-primary-foreground text-xs font-semibold px-4"
            disabled={customers.length === 0}
            onClick={() => setSendCampaignOpen(true)}
          >
            <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Launch VIP Campaign ({totalVip})
          </Button>
        }
      />

      {/* SUMMARY CARDS */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard
          label="Total VIPs"
          value={String(summary.total_vip)}
          icon={Crown}
          gradient="from-primary/20 to-primary/5"
          iconColor="text-primary"
        />
        <SummaryCard
          label="Lifetime Spend"
          value={fmt(summary.total_lifetime_spend)}
          icon={Trophy}
          gradient="from-amber-400/20 to-amber-400/5"
          iconColor="text-amber-500"
        />
        <SummaryCard
          label="Avg Visits"
          value={String(summary.avg_visits)}
          icon={Star}
          gradient="from-violet-400/20 to-violet-400/5"
          iconColor="text-violet-500"
        />
        <SummaryCard
          label="Avg Spend"
          value={fmt(summary.avg_lifetime_spend)}
          icon={Gem}
          gradient="from-emerald-400/20 to-emerald-400/5"
          iconColor="text-emerald-500"
        />
        <SummaryCard
          label="Loyalty Points"
          value={summary.total_loyalty_points.toLocaleString()}
          icon={Heart}
          gradient="from-rose-400/20 to-rose-400/5"
          iconColor="text-rose-500"
        />
      </div>

      {/* SEARCH & SORT BAR */}
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
            <SelectItem value="spend_desc">Highest Lifetime Spend</SelectItem>
            <SelectItem value="spend_asc">Lowest Lifetime Spend</SelectItem>
            <SelectItem value="visits_desc">Most Visits</SelectItem>
            <SelectItem value="visits_asc">Least Visits</SelectItem>
            <SelectItem value="points_desc">Highest Loyalty Points</SelectItem>
            <SelectItem value="recent">Most Recent Visit</SelectItem>
          </SelectContent>
        </Select>

        <p className="ml-auto text-xs text-muted-foreground">
          {totalVip} VIP customer{totalVip === 1 ? "" : "s"} found
        </p>
      </div>

      {/* VIP CARDS GRID */}
      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading VIP customers from database…</div>
      ) : isError ? (
        <div className="py-12 text-center text-sm text-destructive">Failed to load VIP data. Please refresh.</div>
      ) : customers.length === 0 ? (
        <EmptyState
          title="No VIP customers yet"
          description={`Guests with ₹500+ lifetime spend or 10+ visits automatically qualify as VIPs.`}
          icon={<Crown className="h-8 w-8 text-muted-foreground" />}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customers.map((c, i) => {
              const SegIcon = getSegmentIcon(c.segment);
              const gradient = getSegmentGradient(c.segment);
              const initials = c.name
                ? c.name.split(/\s+/).map((s: string) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
                : "VIP";
              const lastVisit = c.last_visit_at
                ? new Date(c.last_visit_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : "Never";
              const customerSince = c.created_at
                ? new Date(c.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
                : "—";

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -2 }}
                >
                  <Card className="overflow-hidden rounded-2xl transition-all hover:shadow-glow bg-card border">
                    {/* Segment gradient bar */}
                    <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
                    <CardContent className="p-4 space-y-3">
                      {/* HEADER */}
                      <div className="flex items-start gap-3">
                        <Avatar className="h-11 w-11 shrink-0">
                          <AvatarFallback className={`bg-gradient-to-br ${gradient} text-white font-bold text-sm`}>
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <AppLink path="customers/$id" params={{ id: c.id }} className="truncate font-semibold hover:text-primary block text-sm">
                            {c.name}
                          </AppLink>
                          <p className="text-[11px] text-muted-foreground font-mono">{c.phone}</p>
                        </div>
                        <Badge className={`rounded-full text-[10px] bg-gradient-to-r ${gradient} text-white border-0 shrink-0`}>
                          <SegIcon className="mr-1 h-2.5 w-2.5" /> {c.segment}
                        </Badge>
                      </div>

                      {/* STATS MATRIX */}
                      <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold">{c.visit_count}</p>
                          <p className="text-[9px] text-muted-foreground">Visits</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold">{fmt(c.total_spent)}</p>
                          <p className="text-[9px] text-muted-foreground">Lifetime</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold">{c.loyalty_points.toLocaleString()}</p>
                          <p className="text-[9px] text-muted-foreground">Points</p>
                        </div>
                      </div>

                      {/* FAVORITE ITEM */}
                      <div className="rounded-lg bg-primary/5 border border-primary/10 px-2.5 py-1.5 text-[11px]">
                        <span className="text-muted-foreground">⭐ Favorite: </span>
                        <span className="font-medium text-foreground">{c.favorite_item}</span>
                      </div>

                      {/* LAST VISIT & SINCE */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Last visit: <span className="text-foreground font-medium">{lastVisit}</span></span>
                        <span>Since: <span className="text-foreground font-medium">{customerSince}</span></span>
                      </div>

                      {/* CUSTOM MSG PREVIEW (if AI generated) */}
                      {customMsgs[c.id] && (
                        <div className="max-h-16 overflow-y-auto rounded-xl bg-muted/40 p-2 font-mono text-[10px] whitespace-pre-line text-muted-foreground">
                          {customMsgs[c.id]}
                        </div>
                      )}

                      {/* ACTIONS */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <Button size="sm" className={`h-7 rounded-full bg-gradient-to-r ${gradient} text-white text-xs border-0 font-medium`} onClick={() => sendWhatsApp(c)}>
                          <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => setAiFor(c)}>
                          <Sparkles className="mr-1 h-3 w-3 text-primary" /> AI Message
                        </Button>
                        <AppLink path="customers/$id" params={{ id: c.id }}>
                          <Button size="sm" variant="ghost" className="h-7 rounded-full text-xs">Profile</Button>
                        </AppLink>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="ml-auto h-7 w-7 rounded-full"
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
              <span>Page {page} of {totalPages} ({totalVip} total VIPs)</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full"
                  disabled={!vipData?.has_previous}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
                </Button>
                <span className="px-2 font-semibold">{page}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full"
                  disabled={!vipData?.has_next}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI GENERATE DIALOG — complete customer context passed to Gemini */}
      {aiFor && (
        <AiGenerateDialog
          open={!!aiFor}
          onOpenChange={(o) => !o && setAiFor(null)}
          title="AI VIP Appreciation Message"
          description={`Generating exclusive Gemini AI message for ${aiFor.name} (${aiFor.segment})`}
          customerId={aiFor.id}
          campaignType="vip"
          couponCode="VIP25"
          discountPercent="25%"
          onUse={(m) => {
            setCustomMsgs((p) => ({ ...p, [aiFor.id]: m }));
            toast.success("AI VIP message applied!");
          }}
        />
      )}

      {/* MULTI-CUSTOMER WHATSAPP CAMPAIGN MODAL */}
      <CampaignSendModal
        open={sendCampaignOpen}
        onOpenChange={setSendCampaignOpen}
        campaignId="vip_campaign_global"
        campaignTitle="VIP Appreciation Campaign"
        campaignType="vip"
        templateMessage="Hi {name} 💎 As one of our most valued guests, you deserve only the best! Use coupon VIP25 for 25% off your next visit. Thank you for being part of our story ❤️"
        couponCode="VIP25"
        discountPercent="25%"
        customers={customers}
      />
    </PageTransition>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  gradient,
  iconColor,
}: {
  label: string;
  value: string;
  icon: any;
  gradient: string;
  iconColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border bg-card p-4 transition-all hover:shadow-sm"
    >
      <div className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${gradient}`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-display text-xl font-bold truncate">{value}</p>
    </motion.div>
  );
}