import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Check, Loader2, Zap, Coins, Brain, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import {
  getAvailablePlansApi,
  requestUpgradeApi,
  getAiEntitlementApi,
  type SubscriptionPlanItem,
  type AiEntitlementDetails,
} from "@/lib/subscription-api";
import { AiCreditPackModel, getPublicCreditPacksApi, buyCreditPackApi } from "@/lib/credit-management-api";

interface SubscriptionUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export function SubscriptionUpgradeModal({
  open,
  onOpenChange,
  title = "Upgrade Subscription or Buy AI Credits",
  description = "Unlock higher staff account limits, active devices, or top-up extra non-expiring AI Credits.",
}: SubscriptionUpgradeModalProps) {
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([]);
  const [creditPacks, setCreditPacks] = useState<AiCreditPackModel[]>([]);
  const [entitlement, setEntitlement] = useState<AiEntitlementDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittingPlanId, setSubmittingPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      Promise.all([
        getAvailablePlansApi().catch(() => []),
        getPublicCreditPacksApi().catch(() => []),
        getAiEntitlementApi().catch(() => null),
      ])
        .then(([plansData, packsData, entData]) => {
          setPlans(plansData);
          setCreditPacks(packsData);
          setEntitlement(entData);
        })
        .finally(() => setLoading(false));
    }
  }, [open]);

  async function handleSelectPlan(plan: SubscriptionPlanItem) {
    if (entitlement && plan.name.toUpperCase() === entitlement.current_plan.toUpperCase()) {
      return;
    }
    setSubmittingPlanId(plan.id);
    try {
      await requestUpgradeApi(plan.id);
      toast.success(`Upgrade request for '${plan.name}' submitted to Super Admin!`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit upgrade request");
    } finally {
      setSubmittingPlanId(null);
    }
  }

  async function handleSelectCreditPack(pack: AiCreditPackModel) {
    setSubmittingPlanId(pack.id);
    try {
      await buyCreditPackApi(pack.id);
      toast.success(`Credit pack top-up request for '${pack.name}' (${pack.ai_credits} Credits for ${formatCurrency(pack.price, "INR")}) submitted to Super Admin!`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit credit purchase request");
    } finally {
      setSubmittingPlanId(null);
    }
  }

  const isCurrentPlan = (planName: string) => {
    if (!entitlement?.current_plan) return false;
    return planName.trim().toUpperCase() === entitlement.current_plan.trim().toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
            <Sparkles className="h-4 w-4" /> NextVisit Platform Upgrades
          </div>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading available options & usage...</p>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {/* CURRENT USAGE & ENTITLEMENT SUMMARY BANNER */}
            {entitlement && (
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                  !entitlement.ai_included_in_plan
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                    : !entitlement.credits_available
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200"
                    : "bg-primary/5 border-primary/20 text-foreground"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    {!entitlement.ai_included_in_plan ? (
                      <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                    ) : !entitlement.credits_available ? (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <span>
                      {!entitlement.ai_included_in_plan
                        ? `AI Not Included in Current ${entitlement.current_plan} Plan`
                        : !entitlement.credits_available
                        ? "AI Credit Limit Reached"
                        : "AI Copywriter Feature Active"}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    {!entitlement.ai_included_in_plan
                      ? `AI features aren't included in your current ${entitlement.current_plan} plan. Upgrade your subscription plan below to unlock Gemini AI features.`
                      : !entitlement.credits_available
                      ? "You've reached your monthly AI credit limit. Upgrade your plan or purchase additional AI credits to continue."
                      : `Your plan includes active Gemini AI generation. ${entitlement.credits_remaining} total credits available.`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                  <div className="px-3 py-1.5 rounded-lg bg-background border text-foreground flex flex-col items-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Current Plan</span>
                    <span className="font-bold text-xs">{entitlement.current_plan}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-background border text-foreground flex flex-col items-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">AI Credits</span>
                    <span className="font-bold text-xs">
                      {!entitlement.ai_included_in_plan
                        ? "Not included"
                        : `${entitlement.credits_remaining} remaining`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <Tabs defaultValue="plans" className="space-y-4">
              <TabsList className="rounded-xl bg-muted/50 p-1">
                <TabsTrigger value="plans" className="rounded-lg text-xs flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Subscription Plans
                </TabsTrigger>
                <TabsTrigger value="packs" className="rounded-lg text-xs flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-violet-500" /> AI Credit Packs
                  <Badge variant="secondary" className="rounded-full text-[10px] px-1.5">{creditPacks.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="plans">
                {plans.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">No plans available.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {plans.map((plan) => {
                      const isCurrent = isCurrentPlan(plan.name);
                      return (
                        <div
                          key={plan.id}
                          className={`rounded-2xl border p-5 space-y-4 flex flex-col justify-between transition-all shadow-sm ${
                            isCurrent
                              ? "bg-primary/5 border-primary ring-1 ring-primary/30"
                              : "bg-card hover:border-primary/50"
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h3 className="font-display font-bold text-base text-foreground">{plan.name}</h3>
                              {isCurrent ? (
                                <Badge className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-primary text-primary-foreground">
                                  CURRENT PLAN
                                </Badge>
                              ) : plan.monthly_price > 0 ? (
                                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] font-semibold">
                                  Popular
                                </Badge>
                              ) : null}
                            </div>
                            <div>
                              <span className="text-2xl font-bold text-foreground font-display">
                                {plan.monthly_price === 0 ? "Free" : formatCurrency(plan.monthly_price)}
                              </span>
                              {plan.monthly_price > 0 && <span className="text-xs text-muted-foreground"> / month</span>}
                            </div>
                            <ul className="space-y-2 text-xs text-muted-foreground pt-2">
                              <li className="flex items-center gap-1.5">
                                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span>Up to <strong>{plan.max_staff} Active Staff Accounts</strong></span>
                              </li>
                              <li className="flex items-center gap-1.5">
                                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span>Up to <strong>{plan.max_active_devices || plan.max_staff} Active Devices</strong></span>
                              </li>
                              <li className="flex items-center gap-1.5">
                                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span><strong>{plan.storage_limit_gb || 1} GB</strong> Storage</span>
                              </li>
                              <li className="flex items-center gap-1.5">
                                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span>
                                  {plan.monthly_ai_credits > 0 ? (
                                    <><strong>{plan.monthly_ai_credits} AI Credits</strong> / Month</>
                                  ) : (
                                    <span className="text-amber-600 dark:text-amber-400 font-medium">AI Not Included</span>
                                  )}
                                </span>
                              </li>
                              {plan.features?.pdf_export !== false && (
                                <li className="flex items-center gap-1.5">
                                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span>PDF Export</span>
                                </li>
                              )}
                              {Boolean(plan.features?.priority_support) && (
                                <li className="flex items-center gap-1.5">
                                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span>Priority Support</span>
                                </li>
                              )}
                            </ul>
                          </div>

                          {isCurrent ? (
                            <Button
                              disabled
                              className="w-full rounded-full bg-muted text-muted-foreground font-semibold text-xs border border-border cursor-not-allowed"
                            >
                              Current Plan
                            </Button>
                          ) : (
                            <Button
                              disabled={submittingPlanId === plan.id}
                              onClick={() => handleSelectPlan(plan)}
                              className="w-full rounded-full gradient-brand text-primary-foreground font-semibold text-xs"
                            >
                              {submittingPlanId === plan.id ? (
                                <>
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Requesting...
                                </>
                              ) : (
                                <>
                                  <Zap className="mr-1.5 h-3.5 w-3.5" /> Request Upgrade
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="packs">
                {entitlement && !entitlement.ai_included_in_plan && (
                  <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Note:</strong> AI Credit Packs provide extra credits. Since your current <strong>{entitlement.current_plan}</strong> plan does not include AI, please upgrade your subscription plan to unlock AI feature access.
                    </span>
                  </div>
                )}

                {creditPacks.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">No AI credit packs available.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {creditPacks.map((pack) => (
                      <div
                        key={pack.id}
                        className="rounded-2xl border bg-card p-5 space-y-4 flex flex-col justify-between hover:border-violet-500/50 transition-all shadow-sm"
                      >
                        <div className="space-y-2">
                          <h3 className="font-display font-bold text-base text-foreground">{pack.name}</h3>
                          <div>
                            <span className="text-2xl font-bold font-display text-violet-600 dark:text-violet-400">
                              {pack.ai_credits.toLocaleString()}
                            </span>
                            <span className="text-xs text-muted-foreground"> AI Credits</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground pt-1">
                            {pack.price === 0 ? "Free" : formatCurrency(pack.price, "INR")}
                          </p>
                          <ul className="space-y-1.5 text-xs text-muted-foreground pt-2">
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span>Never Expires</span>
                            </li>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span>Instant Top-Up</span>
                            </li>
                          </ul>
                        </div>

                        <Button
                          disabled={submittingPlanId === pack.id}
                          onClick={() => handleSelectCreditPack(pack)}
                          className="w-full rounded-full bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs"
                        >
                          {submittingPlanId === pack.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Coins className="mr-1.5 h-3.5 w-3.5" /> Buy Credits
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="sm:justify-between items-center text-xs text-muted-foreground pt-2">
          <span>Need custom limits or custom credit packs? Contact support anytime.</span>
          <Button variant="ghost" className="rounded-full text-xs" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
