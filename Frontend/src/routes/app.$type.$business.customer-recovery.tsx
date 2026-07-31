import { AppLink } from "@/lib/app-nav";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw, Gift, MessageCircle, Percent, ArrowRight, UserMinus, Sparkles,
  TrendingUp, Users, DollarSign, Target, CheckCircle2, History, RotateCcw
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
  getRecoveryPreviewApi,
  launchRecoveryCampaignApi,
} from "@/lib/customer-recovery-api";

export const Route = createFileRoute("/app/$type/$business/customer-recovery")({ component: RecoveryPage });

const BUCKET_CONFIG = [
  { key: 15, title: "15 Days", tone: "from-primary/25 to-primary/5 text-primary", coupon: "MISSYOU15", defaultOffer: "15% Discount" },
  { key: 30, title: "30 Days", tone: "from-warning/25 to-warning/5 text-warning-foreground", coupon: "MISSYOU30", defaultOffer: "20% Discount" },
  { key: 45, title: "45 Days", tone: "from-accent/25 to-accent/5 text-accent-foreground", coupon: "MISSYOU45", defaultOffer: "Free Drink" },
  { key: 60, title: "60 Days", tone: "from-info/25 to-info/5 text-info", coupon: "MISSYOU60", defaultOffer: "Free Dessert" },
  { key: 90, title: "90 Days", tone: "from-destructive/25 to-destructive/5 text-destructive", coupon: "COMEBACK90", defaultOffer: "20% Off + Dessert" },
] as const;

function RecoveryPage() {
  const session = getSession();
  const queryClient = useQueryClient();

  const [aiOpen, setAiOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<number>(30);
  const [activeCoupon, setActiveCoupon] = useState<string>("MISSYOU15");
  const [templateMsg, setTemplateMsg] = useState(
    "Hi {name}! 👋 We miss having you around! Use coupon {coupon} for 15% off your next visit ❤️"
  );
  const [sendCustomers, setSendCustomers] = useState<SendCustomerItem[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string>("recovery_campaign");
  const [isLaunching, setIsLaunching] = useState(false);

  // 1. React Query: Dashboard bucket counts
  const {
    data: dashboard,
    isLoading: isDashLoading,
    refetch: refetchDashboard,
  } = useQuery({
    queryKey: ["customer-recovery", "dashboard", session?.clientId],
    queryFn: getRecoveryDashboardApi,
    refetchInterval: 30000,
  });

  // 2. React Query: Analytics
  const {
    data: analytics,
    isLoading: isAnalyticsLoading,
  } = useQuery({
    queryKey: ["customer-recovery", "analytics", session?.clientId],
    queryFn: getRecoveryAnalyticsApi,
    refetchInterval: 30000,
  });

  // 3. React Query: History
  const {
    data: historyData,
    isLoading: isHistoryLoading,
  } = useQuery({
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

  // Handle Offer Click -> Fetch Preview + Launch Campaign on Backend
  async function handleLaunchOffer(bucketDays: number, couponCode: string, offerName: string) {
    setIsLaunching(true);
    setSelectedBucket(bucketDays);
    setActiveCoupon(couponCode);
    const toastId = toast.loading(`Preparing ${offerName} for ${bucketDays}-day dormant guests…`);

    try {
      // 1. Fetch preview & customer list from backend
      const preview = await getRecoveryPreviewApi(bucketDays, couponCode);
      const custResp = await getRecoverableCustomersApi({ bucket: bucketDays, pageSize: 100 });

      if (custResp.items.length === 0) {
        toast.dismiss(toastId);
        toast.info(`No recoverable customers found for the ${bucketDays}-day bucket.`);
        setIsLaunching(false);
        return;
      }

      // 2. Launch campaign on backend to persist Campaign & CampaignLog queue entries
      const defaultMsg = `Hi {name}! 👋 We miss having you around at {restaurant}! Enjoy ${offerName} with coupon ${couponCode} on your next visit ❤️`;
      const launchRes = await launchRecoveryCampaignApi({
        bucket: bucketDays,
        message: defaultMsg,
        coupon_code: couponCode,
      }).catch((err) => {
        // If 409 conflict (cooldown), log warning and proceed with client campaign session
        console.warn("Launch campaign notice:", err);
        return { campaign_id: `recovery_${bucketDays}_${Date.now()}` };
      });

      setTemplateMsg(defaultMsg);
      setActiveCampaignId(launchRes.campaign_id);

      // Map backend customer items to SendCustomerItem format
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
      toast.success(`Loaded ${formattedCustomers.length} guests for ${offerName}`);
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

  return (
    <PageTransition>
      <PageHeader
        title="Lost customer recovery"
        description="Bring dormant guests back with personalized Gemini AI copy & WhatsApp campaigns."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full text-xs" onClick={() => setAiOpen(true)}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" /> AI Generator
            </Button>
            <Button
              className="rounded-full bg-primary text-primary-foreground text-xs font-semibold"
              disabled={totalRecoverable === 0 || isLaunching}
              onClick={() => handleLaunchOffer(30, "MISSYOU30", "30-Day Win-Back Offer")}
            >
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Launch Recovery Campaign ({totalRecoverable})
            </Button>
          </div>
        }
      />

      {/* ANALYTICS SUMMARY BAR */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryMetric
          label="Potential Revenue"
          value={isAnalyticsLoading ? "…" : fmt(analytics?.potential_revenue ?? 0)}
          icon={TrendingUp}
          subtext={`Avg spend: ${fmt(analytics?.average_spend ?? 0)}`}
        />
        <SummaryMetric
          label="Recoverable Guests"
          value={isDashLoading ? "…" : String(totalRecoverable)}
          icon={Users}
          subtext="Not visited in 15+ days"
        />
        <SummaryMetric
          label="Recovery Rate"
          value={isAnalyticsLoading ? "…" : `${analytics?.recovery_rate_pct ?? 0}%`}
          icon={Target}
          subtext={`${analytics?.total_recovered ?? 0} guests returned`}
        />
        <SummaryMetric
          label="Messages Sent"
          value={isAnalyticsLoading ? "…" : String(analytics?.messages_sent ?? 0)}
          icon={CheckCircle2}
          subtext={`Failed: ${analytics?.messages_failed ?? 0}`}
        />
      </div>

      {/* INACTIVITY BUCKET CARDS */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {BUCKET_CONFIG.map((b, i) => {
          const count = bucketCounts[b.key];
          return (
            <motion.div
              key={b.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02 }}
            >
              <AppLink path="customer-recovery/$days" params={{ days: String(b.key) }} className="block">
                <Card className="group relative overflow-hidden rounded-2xl p-5 shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-glow">
                  <div className={cn("pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br opacity-70 blur-2xl", b.tone)} />
                  <div className="relative">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Not visited for</p>
                    <p className="mt-2 font-display text-3xl font-semibold">{b.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground font-medium">
                      {isDashLoading ? "Loading…" : `${count} customer${count === 1 ? "" : "s"}`}
                    </p>
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

      {/* QUICK OFFER LAUNCH BUTTONS */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          className="rounded-full gradient-brand text-primary-foreground text-xs"
          disabled={isLaunching}
          onClick={() => handleLaunchOffer(30, "WINBACK30", "Win-Back Special")}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Send Win-Back Offer
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
          onClick={() => handleLaunchOffer(60, "SWEET60", "Free Dessert Offer")}
        >
          <Gift className="mr-1.5 h-3.5 w-3.5" /> Send Free Dessert Offer
        </Button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground inline-flex items-center gap-1.5">
        <UserMinus className="h-3.5 w-3.5" /> Click a bucket above to view dormant guests, filter, and launch step-by-step WhatsApp campaigns.
      </p>

      {/* RECOVERY HISTORY SECTION */}
      {historyData && historyData.items.length > 0 && (
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
        title="AI Recovery Campaign Generator"
        description="Generates personalized win-back copy for dormant customers using Gemini AI."
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
}: {
  label: string;
  value: string;
  icon: any;
  subtext: string;
}) {
  return (
    <Card className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{subtext}</p>
    </Card>
  );
}