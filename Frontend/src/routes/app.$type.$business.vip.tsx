import { AppLink } from "@/lib/app-nav";
import { useParams, useNavigate } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  Crown, MessageCircle, Sparkles, Phone, Search, ArrowUpDown,
  ChevronLeft, ChevronRight, Star, Trophy, Gem, Heart, Settings,
  Info, Check, HelpCircle
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fmt } from "@/lib/currency";
import { sendWhatsAppWithStatusTracking } from "@/lib/celebration-utils";
import { apiFetch, getSession } from "@/lib/auth";
import { getVipCustomersApi, updateVipSettingsApi, VipSettings, VipSettingsUpdatePayload } from "@/lib/vip-api";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

export default function VipPage() {
  const session = getSession();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { type?: string; business?: string };
  const type = params.type || "restaurant";
  const business = params.business || "default";
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("spend_desc");
  const [page, setPage] = useState(1);
  const [aiFor, setAiFor] = useState<any | null>(null);
  const [sendCampaignOpen, setSendCampaignOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customMsgs, setCustomMsgs] = useState<Record<string, string>>({});

  // VIP Settings Form State
  const [settingsForm, setSettingsForm] = useState<VipSettingsUpdatePayload>({
    min_lifetime_spend: 10000,
    min_visits: 15,
    min_avg_bill: 0,
    last_visit_within_days: null,
    rule_logic: "ANY",
    is_active: true,
  });

  // Debounce search input
  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__vipSearchTimer);
    (window as any).__vipSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  // ── Database-Driven Dynamic VIP Query ─────────────────────────────────────
  const {
    data: vipData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["vip-customers", session?.clientId, debouncedSearch, sortBy, page],
    queryFn: () => getVipCustomersApi({
      page,
      page_size: 20,
      search: debouncedSearch.trim() || undefined,
      sort_by: sortBy,
    }),
    refetchInterval: 30000,
  });

  const settingsMutation = useMutation({
    mutationFn: (payload: VipSettingsUpdatePayload) => updateVipSettingsApi(payload),
    onSuccess: (updated) => {
      toast.success("VIP Rules updated successfully!");
      setSettingsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["vip-customers"] });
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update VIP rules");
    },
  });

  const summary = vipData?.summary ?? {
    total_vip: 0,
    total_lifetime_spend: 0,
    avg_visits: 0,
    avg_lifetime_spend: 0,
    total_loyalty_points: 0,
    formatted_rule_display: "Current VIP Rule: Lifetime Spend ≥ ₹10,000 OR Visits ≥ 15 (Rule Logic: ANY). Configured in Business Settings.",
  };

  const currentSettings: VipSettings | undefined = vipData?.settings;
  const customers: any[] = vipData?.items ?? [];
  const totalPages = vipData?.total_pages ?? 1;
  const totalVip = vipData?.total ?? 0;

  const handleOpenSettings = () => {
    if (currentSettings) {
      setSettingsForm({
        min_lifetime_spend: currentSettings.min_lifetime_spend,
        min_visits: currentSettings.min_visits,
        min_avg_bill: currentSettings.min_avg_bill,
        last_visit_within_days: currentSettings.last_visit_within_days,
        rule_logic: currentSettings.rule_logic as "ANY" | "ALL",
        is_active: currentSettings.is_active,
      });
    }
    setSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    settingsMutation.mutate(settingsForm);
  };

  const handleLaunchCampaign = () => {
    // Navigate to WhatsApp Campaigns page with audience=VIP preselected
    navigate({
      to: `/app/${type}/${business}/whatsapp-campaigns` as any,
      search: { audience: "VIP" } as any,
    });
  };

  async function sendWhatsApp(c: any) {
    const msg = customMsgs[c.id] ?? `Hi ${c.name.split(" ")[0]} 💎 As one of our most valued VIP guests, you deserve only the best! Enjoy coupon VIP25 for 25% off your next visit ❤️`;
    await sendWhatsAppWithStatusTracking({
      customerId: c.id,
      customerPhone: c.phone,
      message: msg,
      campaignType: "VIP",
      onSuccess: () => refetch(),
    });
  }

  return (
    <PageTransition>
      <PageHeader
        title="VIP Customers"
        description="Your top guests — identified automatically from configurable business rules, visits, spend, and average bill."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full text-xs font-semibold px-3.5 h-9"
              onClick={handleOpenSettings}
            >
              <Settings className="mr-1.5 h-3.5 w-3.5 text-primary" /> Configure Rules
            </Button>
            <Button
              className="rounded-full bg-primary text-primary-foreground text-xs font-semibold px-4 h-9 shadow-sm hover:shadow"
              onClick={handleLaunchCampaign}
            >
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Launch VIP Campaign ({totalVip})
            </Button>
          </div>
        }
      />

      {/* DYNAMIC CURRENT VIP RULE BANNER */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3.5 flex items-start gap-3 shadow-xs"
      >
        <div className="rounded-full bg-primary/15 p-2 text-primary shrink-0 mt-0.5">
          <Crown className="h-4 w-4" />
        </div>
        <div className="flex-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Active Business VIP Rule</span>
            <Badge variant="outline" className="rounded-full text-[10px] bg-background border-primary/30 text-primary font-mono">
              Logic: {currentSettings?.rule_logic || "ANY"}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground font-medium leading-relaxed">
            {summary.formatted_rule_display}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-primary hover:text-primary hover:bg-primary/10 rounded-full h-8 px-3 shrink-0"
          onClick={handleOpenSettings}
        >
          Edit Rule
        </Button>
      </motion.div>

      {/* SUMMARY KPI CARDS */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard
          label="Total VIPs"
          value={String(summary.total_vip)}
          icon={Crown}
          gradient="from-primary/20 to-primary/5"
          iconColor="text-primary"
        />
        <SummaryCard
          label="VIP Revenue"
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
          label="Avg Lifetime Spend"
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
            placeholder="Search VIP by name or phone..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-9 rounded-full pl-8 text-xs"
          />
        </div>

        <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-56 rounded-full text-xs">
            <ArrowUpDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="spend_desc">Highest Lifetime Spend</SelectItem>
            <SelectItem value="spend_asc">Lowest Lifetime Spend</SelectItem>
            <SelectItem value="visits_desc">Most Visits</SelectItem>
            <SelectItem value="visits_asc">Least Visits</SelectItem>
            <SelectItem value="avg_bill_desc">Highest Average Bill</SelectItem>
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
        <div className="py-20 text-center text-sm text-muted-foreground">Evaluating VIP criteria from live data…</div>
      ) : isError ? (
        <div className="py-12 text-center text-sm text-destructive">Failed to load VIP data. Please refresh.</div>
      ) : customers.length === 0 ? (
        <EmptyState
          title="No VIP customers qualify under current rules"
          description={summary.formatted_rule_display}
          action={<Button variant="outline" className="rounded-full text-xs" onClick={handleOpenSettings}>Adjust VIP Rules</Button>}
          icon={<Crown className="h-8 w-8 text-muted-foreground" />}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {customers.map((c, i) => {
              const SegIcon = getSegmentIcon(c.segment);
              const gradient = getSegmentGradient(c.segment);
              const initials = c.name
                ? c.name.split(/\s+/).map((s: string) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
                : "VIP";
              const lastVisit = c.last_visit_at
                ? new Date(c.last_visit_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : "Never";
              const vipSince = c.vip_since_date || c.created_at
                ? new Date(c.vip_since_date || c.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
                : "—";

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -2 }}
                >
                  <Card className="overflow-hidden rounded-2xl transition-all hover:shadow-md bg-card border">
                    {/* Top segment gradient bar */}
                    <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
                    <CardContent className="p-4 space-y-3">
                      {/* HEADER */}
                      <div className="flex items-start gap-3">
                        <Avatar className="h-11 w-11 shrink-0">
                          <AvatarFallback className={`bg-gradient-to-br ${gradient} text-white font-bold text-sm shadow-xs`}>
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <AppLink path="customers/$id" params={{ id: c.id }} className="truncate font-semibold hover:text-primary block text-sm">
                              {c.name}
                            </AppLink>
                            <Badge className="rounded-full text-[9px] bg-primary/15 text-primary border-primary/20 hover:bg-primary/20 shrink-0 font-bold px-1.5">
                              VIP
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono">{c.phone}</p>
                        </div>
                        <Badge className={`rounded-full text-[10px] bg-gradient-to-r ${gradient} text-white border-0 shrink-0`}>
                          <SegIcon className="mr-1 h-2.5 w-2.5" /> {c.segment}
                        </Badge>
                      </div>

                      {/* STATS MATRIX */}
                      <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold text-xs">{c.visit_count}</p>
                          <p className="text-[9px] text-muted-foreground">Visits</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold text-xs">{fmt(c.total_spent)}</p>
                          <p className="text-[9px] text-muted-foreground">Lifetime</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold text-xs">{fmt(c.avg_bill)}</p>
                          <p className="text-[9px] text-muted-foreground">Avg Bill</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold text-xs">{c.loyalty_points.toLocaleString()}</p>
                          <p className="text-[9px] text-muted-foreground">Points</p>
                        </div>
                      </div>

                      {/* QUALIFIED REASON BADGE */}
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 text-[10.5px] text-amber-700 dark:text-amber-300 font-medium">
                        <span className="font-semibold">Reason: </span>
                        {c.reason_qualified}
                      </div>

                      {/* FAVORITE ITEM & DATES */}
                      <div className="flex items-center justify-between text-[10.5px] text-muted-foreground pt-0.5">
                        <span className="truncate max-w-[170px]">⭐ {c.favorite_item}</span>
                        <span>VIP Since: <span className="text-foreground font-medium">{vipSince}</span></span>
                      </div>

                      {/* CUSTOM MSG PREVIEW (if AI generated) */}
                      {customMsgs[c.id] && (
                        <div className="max-h-16 overflow-y-auto rounded-xl bg-muted/40 p-2 font-mono text-[10px] whitespace-pre-line text-muted-foreground">
                          {customMsgs[c.id]}
                        </div>
                      )}

                      {/* ACTIONS */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t">
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

      {/* DYNAMIC VIP RULES CONFIGURATION DIALOG */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Crown className="h-4 w-4 text-primary" /> Configure Business VIP Rules
            </DialogTitle>
            <DialogDescription className="text-xs">
              Define the exact criteria for guests to automatically qualify as VIPs in your business.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* RULE LOGIC (ANY / ALL) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Rule Evaluation Logic</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={settingsForm.rule_logic === "ANY" ? "default" : "outline"}
                  className="h-9 rounded-xl text-xs font-medium"
                  onClick={() => setSettingsForm((f) => ({ ...f, rule_logic: "ANY" }))}
                >
                  ANY (OR) — Match at least 1 rule
                </Button>
                <Button
                  type="button"
                  variant={settingsForm.rule_logic === "ALL" ? "default" : "outline"}
                  className="h-9 rounded-xl text-xs font-medium"
                  onClick={() => setSettingsForm((f) => ({ ...f, rule_logic: "ALL" }))}
                >
                  ALL (AND) — Match all set rules
                </Button>
              </div>
            </div>

            {/* MIN LIFETIME SPEND */}
            <div className="space-y-1">
              <Label className="text-xs">Minimum Lifetime Spend (₹)</Label>
              <Input
                type="number"
                min={0}
                value={settingsForm.min_lifetime_spend}
                onChange={(e) => setSettingsForm((f) => ({ ...f, min_lifetime_spend: parseFloat(e.target.value) || 0 }))}
                className="h-9 rounded-xl text-xs"
                placeholder="e.g. 10000"
              />
              <p className="text-[10px] text-muted-foreground">Set to 0 to disable spend rule.</p>
            </div>

            {/* MIN VISITS */}
            <div className="space-y-1">
              <Label className="text-xs">Minimum Visits</Label>
              <Input
                type="number"
                min={0}
                value={settingsForm.min_visits}
                onChange={(e) => setSettingsForm((f) => ({ ...f, min_visits: parseInt(e.target.value, 10) || 0 }))}
                className="h-9 rounded-xl text-xs"
                placeholder="e.g. 15"
              />
              <p className="text-[10px] text-muted-foreground">Set to 0 to disable visit count rule.</p>
            </div>

            {/* MIN AVERAGE BILL */}
            <div className="space-y-1">
              <Label className="text-xs">Minimum Average Bill (₹) (Optional)</Label>
              <Input
                type="number"
                min={0}
                value={settingsForm.min_avg_bill}
                onChange={(e) => setSettingsForm((f) => ({ ...f, min_avg_bill: parseFloat(e.target.value) || 0 }))}
                className="h-9 rounded-xl text-xs"
                placeholder="e.g. 800"
              />
            </div>

            {/* LAST VISIT WITHIN DAYS */}
            <div className="space-y-1">
              <Label className="text-xs">Must have visited within X days (Optional)</Label>
              <Input
                type="number"
                min={0}
                value={settingsForm.last_visit_within_days ?? ""}
                onChange={(e) => setSettingsForm((f) => ({ ...f, last_visit_within_days: e.target.value ? parseInt(e.target.value, 10) : null }))}
                className="h-9 rounded-xl text-xs"
                placeholder="e.g. 90 (Leave blank for no limit)"
              />
            </div>

            {/* ENABLED TOGGLE */}
            <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3 border">
              <div>
                <Label className="text-xs font-semibold">Enable VIP System</Label>
                <p className="text-[10px] text-muted-foreground">Automatically flag guests as VIP based on these rules</p>
              </div>
              <Switch
                checked={settingsForm.is_active}
                onCheckedChange={(c) => setSettingsForm((f) => ({ ...f, is_active: c }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-9 rounded-full text-xs" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button
              className="h-9 rounded-full text-xs bg-primary"
              disabled={settingsMutation.isPending}
              onClick={handleSaveSettings}
            >
              {settingsMutation.isPending ? "Saving Rules…" : "Save & Apply VIP Rules"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI GENERATE DIALOG */}
      {aiFor && (
        <AiGenerateDialog
          open={!!aiFor}
          onOpenChange={(o) => !o && setAiFor(null)}
          title="AI VIP Appreciation Message"
          description={`Generating exclusive Gemini AI message for ${aiFor.name}`}
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