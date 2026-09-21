import { AppLink } from "@/lib/app-nav";
import { useParams } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw, Gift, MessageCircle, Percent, ArrowRight, UserMinus, Sparkles,
  TrendingUp, Users, DollarSign, Target, CheckCircle2, History, RotateCcw,
  Scissors, UtensilsCrossed,
} from "lucide-react";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/page-transition";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { CampaignSendModal, SendCustomerItem } from "@/components/campaign-send-modal";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/currency";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSession } from "@/lib/auth";
import {
  getRecoveryDashboardApi,
  getRecoveryAnalyticsApi,
  getRecoveryHistoryApi,
  getRecoverableCustomersApi,
  launchRecoveryCampaignApi,
} from "@/lib/customer-recovery-api";

import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/$type/$business/customer-recovery")({ component: RecoveryPage });

const BUCKET_CONFIG = [
  { key: 15, title: "15 Days", subtext: "15–29 days away", tone: "from-primary/25 to-primary/5", badgeClass: "bg-primary/10 text-primary border-primary/20", coupon: "MISSYOU15", defaultOffer: "Free Drink On Us" },
  { key: 30, title: "30 Days", subtext: "30–44 days away", tone: "from-amber-400/25 to-amber-400/5", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400", coupon: "MISSYOU30", defaultOffer: "Free Dessert On Us" },
  { key: 45, title: "45 Days", subtext: "45–59 days away", tone: "from-violet-400/25 to-violet-400/5", badgeClass: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400", coupon: "MISSYOU45", defaultOffer: "10% Off + Free Drink" },
  { key: 60, title: "60 Days", subtext: "60–89 days away", tone: "from-sky-400/25 to-sky-400/5", badgeClass: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400", coupon: "MISSYOU60", defaultOffer: "15% Off Next Visit" },
  { key: 90, title: "90+ Days", subtext: "90+ days — at risk", tone: "from-destructive/25 to-destructive/5", badgeClass: "bg-destructive/10 text-destructive border-destructive/20", coupon: "COMEBACK90", defaultOffer: "20% Off + Free Dessert" },
] as const;

export default function RecoveryPage() {
  const { type } = useParams<{ type?: string }>();
  const isSalon = type === "salon";
  const session = getSession();
  const queryClient = useQueryClient();

  const [aiOpen, setAiOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<number>(30);
  const [activeCoupon, setActiveCoupon] = useState<string>("MISSYOU15");
  const [templateMsg, setTemplateMsg] = useState(
    isSalon
      ? "Hi {name}! 💇 We miss you at {salon_name}! Use coupon {coupon} for {offer} on your next appointment ❤️"
      : "Hi {name}! 👋 We miss you at {restaurant_name}! Use coupon {coupon} for {offer} on your next visit ❤️"
  );
  const [sendCustomers, setSendCustomers] = useState<SendCustomerItem[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string>("recovery_campaign");
  const [isLaunching, setIsLaunching] = useState(false);

  // 1. Dashboard bucket counts
  const { data: dashboard, isLoading: isDashLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ["customer-recovery", "dashboard", session?.clientId],
    queryFn: getRecoveryDashboardApi,
    refetchInterval: 30000,
  });

  // 2. Analytics
  const { data: analytics, isLoading: isAnalyticsLoading } = useQuery({
    queryKey: ["customer-recovery", "analytics", session?.clientId],
    queryFn: getRecoveryAnalyticsApi,
    refetchInterval: 30000,
  });

  // 3. History
  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["customer-recovery", "history", session?.clientId],
    queryFn: getRecoveryHistoryApi,
    refetchInterval: 30000,
  });

  const bucketCounts = {
    15: dashboard?.["15_days"]?.count ?? 0,
    30: dashboard?.["30_days"]?.count ?? 0,
    45: dashboard?.["45_days"]?.count ?? 0,
    60: dashboard?.["60_days"]?.count ?? 0,
    90: dashboard?.["90_days"]?.count ?? 0,
  };

  const totalRecoverable = dashboard?.total_recoverable ?? 0;

  async function handleLaunchOffer(bucketDays: number, couponCode: string, offerName: string) {
    setIsLaunching(true);
    setSelectedBucket(bucketDays);
    setActiveCoupon(couponCode);
    const toastId = toast.loading(
      `Preparing ${offerName} for ${isSalon ? "clients" : "guests"} absent ${bucketDays}+ days…`
    );

    try {
      const custResp = await getRecoverableCustomersApi({ bucket: bucketDays, pageSize: 100 });

      if (custResp.items.length === 0) {
        toast.dismiss(toastId);
        toast.info(`No recoverable ${isSalon ? "clients" : "guests"} found for the ${bucketDays}-day bucket.`);
        setIsLaunching(false);
        return;
      }

      const businessLabel = isSalon ? "{salon_name}" : "{restaurant_name}";
      const actionLabel = isSalon ? "appointment" : "visit";
      const defaultMsg = `Hi {name}! 👋 We miss you at ${businessLabel}! Enjoy ${offerName} with coupon ${couponCode} on your next ${actionLabel} ❤️`;

      const launchRes = await launchRecoveryCampaignApi({
        bucket: bucketDays,
        message: defaultMsg,
        coupon_code: couponCode,
      }).catch((err) => {
        console.warn("Launch campaign notice:", err);
        return { campaign_id: `recovery_${bucketDays}_${Date.now()}` };
      });

      setTemplateMsg(defaultMsg);
      setActiveCampaignId(launchRes.campaign_id ?? `recovery_${bucketDays}`);

      const formattedCustomers: SendCustomerItem[] = custResp.items.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        status: c.is_vip ? "VIP" : c.days_since_last_visit >= 60 ? "At Risk" : "Regular",
        visit_count: c.visit_count,
        total_spent: c.total_spent,
      }));

      setSendCustomers(formattedCustomers);
      toast.dismiss(toastId);
      toast.success(`Loaded ${formattedCustomers.length} ${isSalon ? "clients" : "guests"} for ${offerName}`);
      setSendOpen(true);
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error(e.message || "Failed to prepare campaign preview");
    } finally {
      setIsLaunching(false);
    }
  }

  function handleCampaignComplete() {
    queryClient.invalidateQueries({ queryKey: ["customer-recovery"] });
    toast.success("Recovery data refreshed!");
  }

  const BusinessIcon = isSalon ? Scissors : UtensilsCrossed;
  const guestLabel = isSalon ? "Clients" : "Guests";
  const visitLabel = isSalon ? "appointments" : "visits";
  const actionLabel = isSalon ? "rebook" : "dine";

  return (
    <PageTransition>
      <PageHeader
        title={`Lost ${guestLabel.toLowerCase()} recovery`}
        description={`Bring dormant ${guestLabel.toLowerCase()} back with personalized Gemini AI copy & WhatsApp campaigns.`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full text-xs" onClick={() => setAiOpen(true)}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" /> AI Generator
            </Button>
            <Button
              className="rounded-full bg-primary text-primary-foreground text-xs font-semibold"
              disabled={totalRecoverable === 0 || isDashLoading || isLaunching}
              onClick={() => handleLaunchOffer(30, "MISSYOU30", `30-Day ${isSalon ? "Rebook" : "Win-Back"} Offer`)}
            >
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
              Launch Recovery ({isDashLoading ? "…" : totalRecoverable})
            </Button>
          </div>
        }
      />

      {/* ANALYTICS SUMMARY BAR */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryMetric
          label="Potential Revenue"
          value={fmt(analytics?.potential_revenue ?? 0)}
          icon={TrendingUp}
          subtext={`Avg spend: ${fmt(analytics?.average_spend ?? 0)}`}
          loading={isAnalyticsLoading}
        />
        <SummaryMetric
          label={`Recoverable ${guestLabel}`}
          value={String(totalRecoverable)}
          icon={Users}
          subtext={`Not ${visitLabel === "appointments" ? "visited" : "dined"} in 15+ days`}
          loading={isDashLoading}
        />
        <SummaryMetric
          label="Recovery Rate"
          value={`${analytics?.recovery_rate_pct ?? 0}%`}
          icon={Target}
          subtext={`${analytics?.total_recovered ?? 0} ${guestLabel.toLowerCase()} returned`}
          loading={isAnalyticsLoading}
        />
        <SummaryMetric
          label="Messages Sent"
          value={String(analytics?.messages_sent ?? 0)}
          icon={CheckCircle2}
          subtext={`Failed: ${analytics?.messages_failed ?? 0}`}
          loading={isAnalyticsLoading}
        />
      </div>

      {/* INACTIVITY BUCKET CARDS — CLICKABLE */}
      <div className="mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BusinessIcon className="h-3.5 w-3.5" />
          {isSalon ? "Clients by days since last appointment" : "Guests by days since last visit"} — click to view list
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {BUCKET_CONFIG.map((b, i) => {
            const count = bucketCounts[b.key as keyof typeof bucketCounts];
            return (
              <motion.div
                key={b.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.02 }}
              >
                <AppLink path="customer-recovery/$days" params={{ days: String(b.key) }} className="block">
                  <Card className="group relative overflow-hidden rounded-2xl p-5 shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-glow cursor-pointer">
                    <div className={cn("pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br opacity-70 blur-2xl", b.tone)} />
                    <div className="relative">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{b.subtext}</p>
                      <p className="mt-1.5 font-display text-2xl font-bold">{b.title}</p>
                      <div className="mt-2 min-h-[20px] flex items-center">
                        {isDashLoading ? (
                          <Skeleton className="h-4 w-16 rounded-md" />
                        ) : (
                          <span className={cn("text-sm font-semibold", count > 0 ? "text-foreground" : "text-muted-foreground")}>
                            {count} {count === 1 ? (isSalon ? "client" : "guest") : (isSalon ? "clients" : "guests")}
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className={cn("mt-2 text-[10px] rounded-full", b.badgeClass)}>
                        {b.defaultOffer}
                      </Badge>
                      <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        View list <ArrowRight className="h-3 w-3" />
                      </p>
                    </div>
                  </Card>
                </AppLink>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* QUICK OFFER LAUNCH BUTTONS — BUSINESS-TYPE AWARE */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          className="rounded-full gradient-brand text-primary-foreground text-xs font-medium"
          disabled={isLaunching}
          onClick={() => handleLaunchOffer(30, "WINBACK30", isSalon ? "Rebook Special" : "Win-Back Special")}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {isSalon ? "Send Rebook Offer" : "Send Win-Back Offer"}
        </Button>
        <Button
          variant="outline"
          className="rounded-full text-xs"
          disabled={isLaunching}
          onClick={() => handleLaunchOffer(15, "SAVE15", "15% Discount")}
        >
          <Percent className="mr-1.5 h-3.5 w-3.5" /> Send 15% Discount
        </Button>
        <Button
          variant="outline"
          className="rounded-full text-xs"
          disabled={isLaunching}
          onClick={() =>
            handleLaunchOffer(60, isSalon ? "FREE60" : "SWEET60", isSalon ? "Free Hair Wash" : "Free Dessert Offer")
          }
        >
          <Gift className="mr-1.5 h-3.5 w-3.5" />
          {isSalon ? "Send Free Hair Wash" : "Send Free Dessert Offer"}
        </Button>
        <Button
          variant="outline"
          className="rounded-full text-xs"
          disabled={isLaunching}
          onClick={() => handleLaunchOffer(90, "COMEBACK90", isSalon ? "VIP Comeback Perk" : "VIP Come Back Offer")}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          {isSalon ? "Send VIP Comeback Perk" : "Send VIP Come Back Offer"}
        </Button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground inline-flex items-center gap-1.5">
        <UserMinus className="h-3.5 w-3.5" />
        Click a bucket above to view {isSalon ? "clients" : "guests"}, apply filters, and launch targeted WhatsApp campaigns.
      </p>

      {/* RECOVERY HISTORY SECTION */}
      {!isHistoryLoading && historyData && historyData.items.length > 0 && (
        <div className="mt-8 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-sm flex items-center gap-1.5">
              <History className="h-4 w-4 text-primary" /> Past Recovery Campaigns
            </h3>
            <span className="text-xs text-muted-foreground">{historyData.total} campaigns launched</span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {historyData.items.map((h) => (
              <Card key={h.campaign_id} className="rounded-xl p-3.5 border bg-card text-xs space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-semibold truncate max-w-[180px]">{h.campaign_name}</span>
                  <Badge variant="outline" className="text-[10px] rounded-full">{h.bucket_days}d Bucket</Badge>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] pt-1">
                  <div className="rounded-lg bg-muted/50 p-1.5">
                    <p className="font-bold text-foreground">{h.total_recipients}</p>
                    <p className="text-muted-foreground">Recipients</p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400">
                    <p className="font-bold">{h.recovered}</p>
                    <p>Recovered</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
                    <p className="font-bold">{fmt(h.revenue_generated)}</p>
                    <p>Revenue</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* AI GENERATE DIALOG */}
      <AiGenerateDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        title={isSalon ? "AI Client Recovery Generator" : "AI Recovery Campaign Generator"}
        description={
          isSalon
            ? "Generates personalized rebook copy for dormant salon clients using Gemini AI."
            : "Generates personalized win-back copy for dormant guests using Gemini AI."
        }
        campaignType="recovery"
        couponCode="MISSYOU15"
        discountPercent="15%"
        onUse={(m) => {
          setTemplateMsg(m);
          toast.success("AI Recovery template applied!");
        }}
      />

      {/* MULTI-CUSTOMER WHATSAPP SEND MODAL */}
      <CampaignSendModal
        open={sendOpen}
        onOpenChange={setSendOpen}
        campaignId={activeCampaignId}
        campaignTitle={`Recovery Campaign (${selectedBucket}-Day Bucket)`}
        campaignType="recovery"
        templateMessage={templateMsg}
        couponCode={activeCoupon}
        discountPercent="15%"
        customers={sendCustomers}
        onComplete={handleCampaignComplete}
      />
    </PageTransition>
  );
}

function SummaryMetric({
  label,
  value,
  icon: Icon,
  subtext,
  loading = false,
}: {
  label: string;
  value: string;
  icon: any;
  subtext: string;
  loading?: boolean;
}) {
  return (
    <Card className="rounded-2xl border bg-card p-4 flex flex-col justify-between min-h-[110px]">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        {loading ? (
          <div className="mt-2 space-y-1.5">
            <Skeleton className="h-7 w-20 rounded-md" />
            <Skeleton className="h-3 w-28 rounded-sm" />
          </div>
        ) : (
          <>
            <p className="mt-2 font-display text-2xl font-bold">{value}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{subtext}</p>
          </>
        )}
      </div>
    </Card>
  );
}