import { createFileRoute } from "@/lib/route-compat";
import { useState, useEffect, useCallback } from "react";
import { Check, Sparkles, AlertCircle, Clock, ShieldCheck, XCircle, FileText, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { SkeletonRows } from "@/components/skeletons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import {
  getMyPlanApi,
  getAvailablePlansApi,
  requestUpgradeApi,
  getMyUpgradeRequestsApi,
  cancelUpgradeRequestApi,
  getBillingHistoryApi,
  type MyPlanDetails,
  type SubscriptionPlanItem,
  type SubscriptionUpgradeRequestItem,
  type SubscriptionBillingHistoryItem,
} from "@/lib/subscription-api";

export const Route = createFileRoute("/app/$type/$business/subscription")({ component: SubscriptionPage });

export default function SubscriptionPage() {
  const [myPlan, setMyPlan] = useState<MyPlanDetails | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlanItem[]>([]);
  const [upgradeRequests, setUpgradeRequests] = useState<SubscriptionUpgradeRequestItem[]>([]);
  const [billingHistory, setBillingHistory] = useState<SubscriptionBillingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingPlanId, setSubmittingPlanId] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [planData, plansData, reqsData, billData] = await Promise.all([
        getMyPlanApi(),
        getAvailablePlansApi(),
        getMyUpgradeRequestsApi(),
        getBillingHistoryApi(),
      ]);
      setMyPlan(planData);
      setAvailablePlans(plansData);
      setUpgradeRequests(reqsData);
      setBillingHistory(billData);
    } catch (err: any) {
      console.error("[SUBSCRIPTION] Error loading subscription data:", err);
      toast.error(err.message || "Failed to load subscription details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  async function handleRequestUpgrade(plan: SubscriptionPlanItem) {
    setSubmittingPlanId(plan.id);
    try {
      await requestUpgradeApi(plan.id);
      toast.success(`Upgrade request for '${plan.name}' submitted to Super Admin!`);
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit upgrade request");
    } finally {
      setSubmittingPlanId(null);
    }
  }

  async function handleCancelRequest(requestId: string) {
    try {
      await cancelUpgradeRequestApi(requestId);
      toast.success("Upgrade request cancelled");
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel request");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Subscription" description="Loading plan status and billing details..." />
        <Card className="rounded-2xl p-6">
          <SkeletonRows rows={6} cols={3} />
        </Card>
      </div>
    );
  }

  const currentPlan = myPlan?.current_plan;

  return (
    <>
      <PageHeader
        title="Subscription & Billing"
        description="View your current plan tier, features, request plan upgrades, and check billing invoices."
        actions={
          <Badge variant="outline" className="rounded-full font-mono">
            {myPlan?.subscription_status.toUpperCase()}
          </Badge>
        }
      />

      {/* Pending Upgrade Alert Banner */}
      {myPlan?.has_pending_request && myPlan.pending_request && (
        <Card className="mb-6 rounded-2xl border-amber-500/50 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground flex items-center gap-2">
                  Upgrade Request Under Review
                  <Badge className="bg-amber-500 text-white rounded-full text-[10px]">PENDING APPROVAL</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  You requested an upgrade to <span className="font-semibold text-foreground">{myPlan.pending_request.requested_plan.name}</span> on{" "}
                  {new Date(myPlan.pending_request.requested_at).toLocaleDateString()}. Super Admin will review shorty.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs text-destructive hover:bg-destructive/10"
              onClick={() => handleCancelRequest(myPlan.pending_request!.id)}
            >
              Cancel Request
            </Button>
          </div>
        </Card>
      )}

      {/* Current Plan Overview Card */}
      <Card className="mb-6 rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="font-display text-base">Current Plan Overview</CardTitle>
          <CardDescription>Your active platform subscription and feature entitlements.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Active Plan</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">{currentPlan?.name || "Free Tier"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentPlan ? `${formatCurrency(currentPlan.monthly_price, "INR")}/month` : "Free"}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Trial Status</p>
            <div className="mt-1 flex items-center gap-2">
              {myPlan?.trial_status.is_trial ? (
                <Badge variant="secondary" className="rounded-full bg-blue-500/10 text-blue-600 border-blue-500/30">
                  Trial Active
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-full border-emerald-500/40 text-emerald-600">
                  Active Subscription
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {myPlan?.trial_status.trial_end
                ? `Ends on ${new Date(myPlan.trial_status.trial_end).toLocaleDateString()}`
                : "No active trial"}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Expiry Date</p>
            <p className="mt-1 font-medium text-foreground">
              {myPlan?.expiry_date ? new Date(myPlan.expiry_date).toLocaleDateString() : "Lifetime / Managed"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {myPlan?.days_remaining !== null ? `${myPlan?.days_remaining} days remaining` : "Continuous access"}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Plan Features</p>
            <div className="mt-1 space-y-1 text-xs text-foreground font-medium">
              <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5 shrink-0" /> Up to {myPlan?.limits.max_staff || currentPlan?.max_staff || 5} Active Staff Accounts
              </p>
              <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5 shrink-0" /> Up to {myPlan?.limits.max_active_devices || currentPlan?.max_active_devices || 5} Active Devices
              </p>
              <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5 shrink-0" /> {myPlan?.limits.storage_limit_gb || currentPlan?.storage_limit_gb || 2} GB Storage
              </p>
              <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5 shrink-0" />
                {(myPlan?.limits.monthly_ai_credits ?? currentPlan?.monthly_ai_credits ?? 0) > 0 ? (
                  `${myPlan?.limits.monthly_ai_credits ?? currentPlan?.monthly_ai_credits} AI Credits / Month`
                ) : (
                  "AI Not Included"
                )}
              </p>
              {(myPlan?.features?.pdf_export !== false && currentPlan?.features?.pdf_export !== false) && (
                <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5 shrink-0" /> PDF Export
                </p>
              )}
              {Boolean(myPlan?.features?.priority_support || currentPlan?.features?.priority_support) && (
                <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5 shrink-0" /> Priority Support
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Plan Selection, Request History & Billing */}
      <Tabs defaultValue="plans" className="space-y-6">
        <TabsList className="rounded-2xl bg-muted/50 p-1">
          <TabsTrigger value="plans" className="rounded-xl text-xs">Available Plans</TabsTrigger>
          <TabsTrigger value="requests" className="rounded-xl text-xs flex items-center gap-1.5">
            Upgrade Requests History
            {upgradeRequests.length > 0 && <Badge variant="secondary" className="rounded-full px-1.5 text-[10px]">{upgradeRequests.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="billing" className="rounded-xl text-xs flex items-center gap-1.5">
            Billing & Invoices
            {billingHistory.length > 0 && <Badge variant="secondary" className="rounded-full px-1.5 text-[10px]">{billingHistory.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* PLANS GRID */}
        <TabsContent value="plans">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {availablePlans.map((p) => {
              const isCurrent = currentPlan?.id === p.id;
              const isPending = myPlan?.pending_request?.requested_plan.id === p.id;

              return (
                <Card
                  key={p.id}
                  className={cn(
                    "relative flex flex-col justify-between rounded-2xl border transition-all hover:-translate-y-1 shadow-sm",
                    p.name === "PROFESSIONAL" && "border-primary shadow-md"
                  )}
                >
                  {p.name === "PROFESSIONAL" && (
                    <Badge className="absolute -top-2.5 left-4 rounded-full gradient-brand text-primary-foreground text-[10px]">
                      <Sparkles className="mr-1 h-3 w-3" /> Recommended
                    </Badge>
                  )}
                  {isCurrent && (
                    <Badge variant="secondary" className="absolute -top-2.5 right-4 rounded-full text-[10px]">
                      Current Plan
                    </Badge>
                  )}

                  <CardHeader>
                    <CardTitle className="font-display text-lg">{p.name}</CardTitle>
                    <div className="mt-2">
                      <span className="font-display text-3xl font-bold">{formatCurrency(p.monthly_price, "INR")}</span>
                      <span className="text-sm text-muted-foreground">/month</span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                    <ul className="space-y-2 text-xs">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <span>Up to <strong>{p.max_staff}</strong> Active Staff Accounts</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <span>Up to <strong>{p.max_active_devices}</strong> Active Devices</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <span><strong>{p.storage_limit_gb} GB</strong> Storage</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <span>
                          {p.monthly_ai_credits > 0 ? (
                            <><strong>{p.monthly_ai_credits} AI Credits</strong> / Month</>
                          ) : (
                            <span>AI Not Included</span>
                          )}
                        </span>
                      </li>
                      {p.features?.pdf_export !== false && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          <span>PDF Export</span>
                        </li>
                      )}
                      {Boolean(p.features?.priority_support) && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          <span>Priority Support</span>
                        </li>
                      )}
                      <li className="flex items-center gap-2 text-muted-foreground">
                        <Check className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{p.trial_days} Day Trial</span>
                      </li>
                    </ul>

                    <div className="pt-2">
                      <Button
                        disabled={isCurrent || isPending || submittingPlanId === p.id}
                        className={cn(
                          "w-full rounded-full font-semibold text-xs",
                          p.name === "PROFESSIONAL" && "gradient-brand text-primary-foreground shadow-sm"
                        )}
                        variant={p.name === "PROFESSIONAL" ? "default" : "outline"}
                        onClick={() => handleRequestUpgrade(p)}
                      >
                        {submittingPlanId === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isCurrent ? (
                          "Current Plan"
                        ) : isPending ? (
                          "Pending Review"
                        ) : (
                          "Upgrade Now"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* REQUESTS HISTORY */}
        <TabsContent value="requests">
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader>
              <CardTitle className="font-display text-base">Upgrade Requests Audit Log</CardTitle>
              <CardDescription>Status history of all subscription upgrade requests submitted to Super Admin.</CardDescription>
            </CardHeader>
            <CardContent>
              {upgradeRequests.length === 0 ? (
                <EmptyState
                  title="No Upgrade Requests"
                  description="You have not submitted any subscription upgrade requests yet."
                  icon={<Clock className="h-8 w-8 text-muted-foreground" />}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requested Plan</TableHead>
                      <TableHead>Requested Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Approved / Rejected By</TableHead>
                      <TableHead>Notes / Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upgradeRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-semibold text-foreground">
                          {req.requested_plan.name} ({formatCurrency(req.requested_plan.monthly_price, "INR")}/mo)
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(req.requested_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full text-[10px] capitalize",
                              req.status === "APPROVED" && "border-emerald-500/40 text-emerald-600 bg-emerald-500/10",
                              req.status === "PENDING" && "border-amber-500/40 text-amber-600 bg-amber-500/10",
                              req.status === "REJECTED" && "border-rose-500/40 text-rose-600 bg-rose-500/10",
                              req.status === "CANCELLED" && "border-muted text-muted-foreground"
                            )}
                          >
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {req.approved_by ? `Approved by ${req.approved_by}` : req.rejected_by ? `Rejected by ${req.rejected_by}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {req.reason || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BILLING HISTORY */}
        <TabsContent value="billing">
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader>
              <CardTitle className="font-display text-base">Invoices & Billing History</CardTitle>
              <CardDescription>Complete archive of payment invoices and renewals.</CardDescription>
            </CardHeader>
            <CardContent>
              {billingHistory.length === 0 ? (
                <EmptyState
                  title="No Invoices Found"
                  description="Billing history will populate as subscription invoices are generated."
                  icon={<FileText className="h-8 w-8 text-muted-foreground" />}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Billing Date</TableHead>
                      <TableHead>Next Renewal</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billingHistory.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-xs font-medium text-foreground">{b.invoice_number}</TableCell>
                        <TableCell className="font-semibold text-xs">{b.plan_name}</TableCell>
                        <TableCell className="font-bold text-xs">{formatCurrency(b.amount, "INR")}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(b.billing_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {b.renewal_date ? new Date(b.renewal_date).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-full text-[10px] border-emerald-500/40 text-emerald-600 bg-emerald-500/10">
                            {b.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}