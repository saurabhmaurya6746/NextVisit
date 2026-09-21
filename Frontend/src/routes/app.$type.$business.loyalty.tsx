import { createFileRoute } from "@/lib/route-compat";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { Trophy, Award, Gem, Sparkles, AlertTriangle, Gift, CheckCircle2, User, Coins } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { SkeletonRows } from "@/components/skeletons";
import { PageTransition } from "@/components/page-transition";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";
import {
  getLoyaltySettingsApi,
  updateLoyaltySettingsApi,
  getCustomerLoyaltyApi,
  redeemLoyaltyPointsApi,
  type BackendLoyaltySettings,
  type CustomerLoyaltyData,
} from "@/lib/loyalty-api";
import { listCustomersApi, type CustomerModel } from "@/lib/customers-api";

export const Route = createFileRoute("/app/$type/$business/loyalty")({ component: LoyaltyPage });

const tiers = [
  { name: "Silver", icon: Award, color: "from-muted to-muted/50 text-foreground", min: 0, max: 499 },
  { name: "Gold", icon: Trophy, color: "from-warning/40 to-warning/10 text-warning-foreground", min: 500, max: 999 },
  { name: "Diamond", icon: Gem, color: "from-primary/40 to-accent/30 text-primary", min: 1000, max: 9999 },
];

export default function LoyaltyPage() {
  // 1. ALL HOOKS CALLED UNCONDITIONALLY AT TOP-LEVEL
  const [settings, setSettings] = useState<BackendLoyaltySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Form State for Settings
  const [isActive, setIsActive] = useState(true);
  const [pointsPerAmount, setPointsPerAmount] = useState<number>(10);
  const [amountRequired, setAmountRequired] = useState<number>(100);
  const [redeemRate, setRedeemRate] = useState<number>(0.1);
  const [minimumRedeemPoints, setMinimumRedeemPoints] = useState<number>(100);

  // Customer Loyalty Lookup & Redeem State
  const [customers, setCustomers] = useState<CustomerModel[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerLoyalty, setCustomerLoyalty] = useState<CustomerLoyaltyData | null>(null);
  const [fetchingCustomerLoyalty, setFetchingCustomerLoyalty] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(100);
  const [redeeming, setRedeeming] = useState(false);

  // Live preview calculator state
  const [previewSpend, setPreviewSpend] = useState<number>(500);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sData, cData] = await Promise.all([
        getLoyaltySettingsApi(),
        listCustomersApi().catch(() => []),
      ]);
      setSettings(sData);
      setIsActive(sData.is_active);
      setPointsPerAmount(sData.points_per_amount);
      setAmountRequired(sData.amount_required);
      setRedeemRate(sData.redeem_rate);
      setMinimumRedeemPoints(sData.minimum_redeem_points);

      setCustomers(cData);
      if (cData.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(cData[0].id);
      }
    } catch (err: any) {
      console.error("[LOYALTY] Error loading loyalty program:", err);
      setError(err.message || "Failed to load loyalty settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch specific customer loyalty on customer change
  const fetchCustomerLoyalty = useCallback(async (customerId: string) => {
    if (!customerId) return;
    setFetchingCustomerLoyalty(true);
    try {
      const data = await getCustomerLoyaltyApi(customerId);
      setCustomerLoyalty(data);
    } catch (err: any) {
      console.error("[LOYALTY] Error fetching customer loyalty:", err);
      setCustomerLoyalty(null);
    } finally {
      setFetchingCustomerLoyalty(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerLoyalty(selectedCustomerId);
    }
  }, [selectedCustomerId, fetchCustomerLoyalty]);

  // Save Settings handler
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const updated = await updateLoyaltySettingsApi({
        is_active: isActive,
        points_per_amount: Number(pointsPerAmount) || 1,
        amount_required: Number(amountRequired) || 100,
        redeem_rate: Number(redeemRate) || 0.1,
        minimum_redeem_points: Number(minimumRedeemPoints) || 0,
      });
      setSettings(updated);
      toast.success("Loyalty program rules saved successfully!");
    } catch (err: any) {
      console.error("[LOYALTY] Error saving settings:", err);
      toast.error(err.message || "Failed to save loyalty settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  // Redeem Points handler
  const handleRedeemPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast.error("Please select a customer.");
      return;
    }
    if (!pointsToRedeem || pointsToRedeem <= 0) {
      toast.error("Please enter a valid amount of points to redeem.");
      return;
    }

    setRedeeming(true);
    try {
      const result = await redeemLoyaltyPointsApi({
        customer_id: selectedCustomerId,
        points: Number(pointsToRedeem),
      });
      toast.success(
        `Redeemed ${result.points_redeemed} points for ${fmt(result.discount_amount)} discount!`
      );
      await fetchCustomerLoyalty(selectedCustomerId);
    } catch (err: any) {
      console.error("[LOYALTY] Redeem error:", err);
      toast.error(err.message || "Failed to redeem points.");
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Loyalty program" description="Loading loyalty program settings..." />
        <Card className="rounded-2xl p-6">
          <SkeletonRows rows={6} cols={2} />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Loyalty program" description="Reward repeat guests and boost retention." />
        <EmptyState
          title="Failed to load loyalty settings"
          description={error}
          icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
          action={
            <Button variant="outline" className="rounded-full" onClick={loadData}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  // Preview calculations
  const previewPoints = Math.floor((previewSpend / (amountRequired || 100)) * pointsPerAmount);

  return (
    <PageTransition>
      <PageHeader
        title="Loyalty program"
        description="Silver, Gold and Diamond tiers that reward repeat guests."
        actions={
          <Badge
            variant="outline"
            className={isActive ? "border-success/40 text-success rounded-full" : "border-muted text-muted-foreground rounded-full"}
          >
            {isActive ? "Program Active" : "Program Disabled"}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Customers" value={customers.length} icon={Sparkles} accent="primary" />
        <StatCard label="Points Rate" value={`${pointsPerAmount} pts / ${fmt(amountRequired)}`} accent="accent" />
        <StatCard label="Redeem Rate" value={`1 pt = ${fmt(redeemRate)}`} icon={Trophy} accent="warning" />
        <StatCard label="Min Threshold" value={`${minimumRedeemPoints} pts`} accent="info" />
      </div>

      {/* Program Settings Form */}
      <Card className="mt-6 rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display">Loyalty Rules & Settings</CardTitle>
            <p className="text-xs text-muted-foreground">Configure earning ratios and redemption thresholds for your business.</p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="loyalty-toggle" className="text-xs font-medium">Program Status</Label>
            <Switch id="loyalty-toggle" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Points Earned</Label>
              <Input
                type="number"
                value={pointsPerAmount}
                onChange={(e) => setPointsPerAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Per Spend Amount ({fmt(amountRequired)})</Label>
              <Input
                type="number"
                value={amountRequired}
                onChange={(e) => setAmountRequired(Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Redemption Rate (Value per 1 point)</Label>
              <Input
                type="number"
                step="0.01"
                value={redeemRate}
                onChange={(e) => setRedeemRate(Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Minimum Points for Redemption</Label>
              <Input
                type="number"
                value={minimumRedeemPoints}
                onChange={(e) => setMinimumRedeemPoints(Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2 pt-2">
              <Button
                disabled={savingSettings}
                className="rounded-full gradient-brand text-primary-foreground"
                onClick={handleSaveSettings}
              >
                {savingSettings ? "Saving Rules..." : "Save Program Settings"}
              </Button>
            </div>
          </div>

          {/* Live Preview Calculator */}
          <div className="rounded-2xl border p-4 bg-muted/30 flex flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Live Earning Calculator</p>
              <div className="mt-3 space-y-1.5">
                <Label className="text-xs">Sample Customer Spend</Label>
                <Input type="number" value={previewSpend} onChange={(e) => setPreviewSpend(Number(e.target.value) || 0)} />
              </div>
              <div className="mt-4 rounded-xl gradient-brand p-4 text-primary-foreground shadow-glow">
                <p className="text-xs opacity-80">Customer spends {fmt(previewSpend)}</p>
                <p className="mt-1 font-display text-3xl font-semibold">{previewPoints} pts</p>
                <p className="mt-1 text-xs opacity-80">
                  Earns {pointsPerAmount} pts per {fmt(amountRequired)} spent
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Loyalty Balance & Redeem Card */}
      <Card className="mt-6 rounded-2xl">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" /> Customer Loyalty Lookup & Point Redemption
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="loyalty-cust-select">Select Customer</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger id="loyalty-cust-select" className="rounded-xl">
                  <SelectValue placeholder="Choose customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.phone || c.email || "Guest"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {fetchingCustomerLoyalty ? (
              <div className="p-4 rounded-xl bg-muted/40 animate-pulse text-xs text-muted-foreground">
                Loading customer points balance...
              </div>
            ) : customerLoyalty ? (
              <div className="grid grid-cols-3 gap-2 rounded-xl border p-4 text-center bg-card">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Available</p>
                  <p className="font-display text-2xl font-bold text-primary">{customerLoyalty.current_points}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Lifetime</p>
                  <p className="font-display text-2xl font-semibold">{customerLoyalty.lifetime_points}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Redeemed</p>
                  <p className="font-display text-2xl font-semibold">{customerLoyalty.redeemed_points}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed text-xs text-muted-foreground text-center">
                Select a customer to view their points balance.
              </div>
            )}
          </div>

          {/* Redemption Form */}
          <form onSubmit={handleRedeemPoints} className="space-y-4 rounded-2xl border p-4 bg-muted/10">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Gift className="h-4 w-4 text-primary" /> Redeem Points for Discount
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="redeem-points-input">Points to Redeem</Label>
              <Input
                id="redeem-points-input"
                type="number"
                min={minimumRedeemPoints}
                value={pointsToRedeem}
                onChange={(e) => setPointsToRedeem(Number(e.target.value))}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Calculated Discount: <strong className="text-foreground">{fmt((pointsToRedeem || 0) * (redeemRate || 0.1))}</strong> (Min required: {minimumRedeemPoints} pts)
              </p>
            </div>

            <Button
              type="submit"
              disabled={redeeming || !customerLoyalty || (customerLoyalty.current_points < minimumRedeemPoints)}
              className="w-full rounded-full gradient-brand text-primary-foreground"
            >
              {redeeming ? "Redeeming..." : "Redeem Points Now"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Tier Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {tiers.map((t) => (
          <Card key={t.name} className="overflow-hidden rounded-2xl">
            <div className={`bg-gradient-to-br ${t.color} p-6`}>
              <t.icon className="h-8 w-8" />
              <h3 className="mt-3 font-display text-2xl font-semibold">{t.name}</h3>
              <p className="mt-1 text-xs opacity-80">{t.min}+ points</p>
            </div>
            <CardContent className="space-y-2 p-4 text-sm">
              <p className="flex justify-between"><span>Free dessert / treatment</span><span className="text-muted-foreground">Every visit</span></p>
              <p className="flex justify-between"><span>Priority booking</span><span className="text-success">✓</span></p>
              <p className="flex justify-between"><span>Birthday gift</span><span className="text-success">✓</span></p>
              {t.name !== "Silver" && <p className="flex justify-between"><span>Anniversary experience</span><span className="text-success">✓</span></p>}
              {t.name === "Diamond" && <p className="flex justify-between"><span>VIP Table / Special Perk (1/yr)</span><span className="text-success">✓</span></p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Members List */}
      <Card className="mt-6 rounded-2xl">
        <CardHeader><CardTitle className="font-display">Top Loyalty Members</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {[...customers].slice(0, 6).map((c) => (
            <div key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="gradient-brand text-primary-foreground text-xs">{c.initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">{c.name}</p>
                <Progress className="mt-1.5 h-1.5" value={Math.min(100, (c.points / 1500) * 100)} />
              </div>
              <div className="text-right">
                <p className="font-display font-semibold">{c.points}</p>
                <Badge variant="outline" className="rounded-full text-[10px]">{c.points > 1000 ? "Diamond" : c.points > 500 ? "Gold" : "Silver"}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageTransition>
  );
}