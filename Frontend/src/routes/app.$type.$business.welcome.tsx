import { createFileRoute } from "@tanstack/react-router";
import { AppLink } from "@/lib/app-nav";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  UserPlus, MessageCircle, Sparkles, Phone, Users, Calendar, QrCode, Search, ArrowUpDown, ChevronLeft, ChevronRight, Cake, RotateCcw,
  RefreshCcw, Gift, Ticket
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { CampaignSendModal } from "@/components/campaign-send-modal";
import { fmt } from "@/lib/currency";
import { openWhatsApp, sendWhatsAppWithStatusTracking } from "@/lib/celebration-utils";
import { logWhatsApp } from "@/lib/whatsapp-history";
import { apiFetch, getSession } from "@/lib/auth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/app/$type/$business/welcome")({ component: WelcomePage });

type TimeframeBucket = "today" | "week" | "month" | "all";

function defaultWelcomeMessage(name: string) {
  const first = name ? name.split(" ")[0] : "{name}";
  return `Hi ${first} 👋\nThank you for visiting us — it was lovely having you!\nHere's a little gift: coupon WELCOME10 for 10% off your next visit.\nWe hope to see you again soon ❤️`;
}

function WelcomePage() {
  const session = getSession();
  const [tab, setTab] = useState<TimeframeBucket>("today");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [aiFor, setAiFor] = useState<any | null>(null);
  const [sendCampaignOpen, setSendCampaignOpen] = useState(false);
  const [customMsgs, setCustomMsgs] = useState<Record<string, string>>({});

  // ---------------------------------------------------------------------------
  // Fetch 100% Database-Driven Welcome Campaign Data
  // ---------------------------------------------------------------------------
  const {
    data: welcomeData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["welcome-campaign", session?.clientId, tab, search, sortBy, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeframe: tab,
        page: String(page),
        page_size: "20",
        sort_by: sortBy,
      });
      if (search.trim()) params.set("search", search.trim());

      const res = await apiFetch(`/api/v1/customers/welcome?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to load welcome campaign data (HTTP ${res.status})`);
      }
      return await res.json();
    },
    refetchInterval: 15000,
  });

  const cards = welcomeData?.summary_cards || {
    todays_new: 0,
    this_week: 0,
    this_month: 0,
    returning: 0,
    birthdays_today: 0,
    recovery_due: 0,
  };

  const customers = welcomeData?.items || [];
  const totalPages = welcomeData?.total_pages || 1;

  const handleTabChange = (val: string) => {
    setTab(val as TimeframeBucket);
    setPage(1);
  };

  async function sendWhatsApp(c: any) {
    const msg = customMsgs[c.id] || defaultWelcomeMessage(c.name);
    await sendWhatsAppWithStatusTracking({
      customerId: c.id,
      customerPhone: c.phone,
      message: msg,
      campaignType: "WELCOME",
      onSuccess: () => refetch(),
    });
  }

  return (
    <PageTransition>
      <PageHeader
        title="Welcome Campaigns"
        description="Database-driven first-time guest onboarding — automated Gemini AI copy."
        actions={
          <Button
            className="rounded-full bg-primary text-primary-foreground font-semibold text-xs px-4"
            disabled={customers.length === 0}
            onClick={() => setSendCampaignOpen(true)}
          >
            <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Launch Welcome Campaign ({customers.length})
          </Button>
        }
      />

      {/* SUMMARY DASHBOARD CARDS */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <InfoCard label="Today's New" value={cards.todays_new} icon={UserPlus} />
        <InfoCard label="This Week" value={cards.this_week} icon={Calendar} />
        <InfoCard label="This Month" value={cards.this_month} icon={Users} />
        <InfoCard label="Returning Guests" value={cards.returning} icon={RotateCcw} />
        <InfoCard label="Birthdays Today" value={cards.birthdays_today} icon={Cake} />
        <InfoCard label="Recovery Due" value={cards.recovery_due} icon={RefreshCcw} />
      </div>

      {/* TABS & SEARCH BAR */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={handleTabChange} className="w-auto">
          <TabsList className="rounded-full">
            <TabsTrigger value="today" className="rounded-full">Today's New</TabsTrigger>
            <TabsTrigger value="week" className="rounded-full">This Week</TabsTrigger>
            <TabsTrigger value="month" className="rounded-full">This Month</TabsTrigger>
            <TabsTrigger value="all" className="rounded-full">All Guests</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-60">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 rounded-full text-xs"
            />
          </div>

          <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-44 rounded-full text-xs">
              <ArrowUpDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="spend_desc">Highest Spend</SelectItem>
              <SelectItem value="spend_asc">Lowest Spend</SelectItem>
              <SelectItem value="visits_desc">Most Visits</SelectItem>
              <SelectItem value="visits_asc">Least Visits</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* CUSTOMER CARDS GRID */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading welcome customers...</div>
      ) : customers.length === 0 ? (
        <EmptyState
          title="No new customers yet"
          description="First-time guests will appear here automatically."
          icon={<UserPlus className="h-8 w-8 text-muted-foreground" />}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customers.map((c: any, i: number) => {
              const initials = c.name
                .split(/\s+/)
                .map((s: string) => s[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase() || "CU";

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ scale: 1.01 }}
                >
                  <Card className="overflow-hidden rounded-2xl border shadow-xs transition-all hover:shadow-md bg-card">
                    <div className="h-1.5 bg-primary" />
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11">
                          <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <AppLink path="customers/$id" params={{ id: c.id }} className="truncate font-semibold hover:text-primary block text-sm">
                            {c.name}
                          </AppLink>
                          <p className="text-xs text-muted-foreground font-mono">{c.phone}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="rounded-full text-[10px] uppercase font-mono">
                            {c.customer_type}
                          </Badge>
                          <Badge variant="secondary" className={`rounded-full text-[9px] ${c.welcome_status === "Sent" ? "bg-emerald-500/10 text-emerald-600" : ""}`}>
                            {c.welcome_status}
                          </Badge>
                        </div>
                      </div>

                      {/* STATS MATRIX */}
                      <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-[11px]">
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold">{c.visit_count}</p>
                          <p className="text-[9px] text-muted-foreground">Visits</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold">{fmt(c.total_spent)}</p>
                          <p className="text-[9px] text-muted-foreground">Spent</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold">{c.loyalty_points}</p>
                          <p className="text-[9px] text-muted-foreground">Points</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-1.5">
                          <p className="font-bold font-mono text-[10px]">{c.source}</p>
                          <p className="text-[9px] text-muted-foreground">Source</p>
                        </div>
                      </div>

                      {/* CUSTOM MESSAGE PREVIEW */}
                      <div className="mt-3 max-h-20 overflow-y-auto rounded-xl bg-muted/40 p-2 font-mono text-[11px] whitespace-pre-line text-muted-foreground">
                        {customMsgs[c.id] ?? defaultWelcomeMessage(c.name)}
                      </div>

                      {/* QUICK ACTIONS */}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <Button size="sm" className="h-7 rounded-full bg-primary text-primary-foreground text-xs" onClick={() => sendWhatsApp(c)}>
                          <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => setAiFor(c)}>
                          <Sparkles className="mr-1 h-3 w-3 text-primary" /> AI Msg
                        </Button>
                        <AppLink path="customers/$id" params={{ id: c.id }}>
                          <Button size="sm" variant="ghost" className="h-7 rounded-full text-xs">
                            Profile
                          </Button>
                        </AppLink>
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full ml-auto" onClick={() => window.open(`tel:${c.phone.replace(/[^\d+]/g, "")}`)}>
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* SERVER-SIDE PAGINATION */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t pt-4 text-xs">
              <span className="text-muted-foreground">
                Page {page} of {totalPages} ({welcomeData?.total ?? 0} total guests)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full"
                  disabled={!welcomeData?.has_previous}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
                </Button>
                <span className="px-2 font-semibold">{page}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full"
                  disabled={!welcomeData?.has_next}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI GENERATE DIALOG */}
      <AiGenerateDialog
        open={!!aiFor}
        onOpenChange={(o) => !o && setAiFor(null)}
        title="AI Welcome Message Generator"
        description={aiFor ? `Generating Gemini AI message for ${aiFor.name}` : ""}
        customerId={aiFor?.id}
        campaignType="welcome"
        couponCode="WELCOME10"
        discountPercent="10%"
        onUse={(m) => {
          if (aiFor) setCustomMsgs((p) => ({ ...p, [aiFor.id]: m }));
          toast.success("AI message applied!");
        }}
      />

      {/* MULTI-CUSTOMER WHATSAPP SEND MODAL WITH RESUME STATE & LOGS */}
      <CampaignSendModal
        open={sendCampaignOpen}
        onOpenChange={setSendCampaignOpen}
        campaignId="welcome_campaign_global"
        campaignTitle="Welcome Campaign"
        campaignType="welcome"
        templateMessage="Hi {name}! 👋 Thank you for visiting us — it was lovely having you! Enjoy coupon {coupon} for {discount} on your next visit ❤️"
        couponCode="WELCOME10"
        discountPercent="10%"
        customers={customers}
      />
    </PageTransition>
  );
}

function InfoCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border p-4 transition-all hover:shadow-sm bg-card">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold">{value}</p>
    </motion.div>
  );
}