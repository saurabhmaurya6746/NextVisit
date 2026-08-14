import { Link } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import { Check, Brain, Clock, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { getPublicPlansApi, type SubscriptionPlanItem } from "@/lib/subscription-api";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — NextVisit" },
      { name: "description", content: "Simple, transparent pricing for restaurants, salons, spas and cafés. Free trial available on paid plans." },
      { property: "og:title", content: "NextVisit Pricing" },
      { property: "og:description", content: "Simple, transparent pricing for restaurants, salons, spas and cafés." },
    ],
  }),
  component: PricingPage,
});

export default function PricingPage() {
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadPlans() {
      try {
        const data = await getPublicPlansApi();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          const activePlans = data.filter((p) => p.is_active !== false);
          if (activePlans.length > 0) {
            setPlans(activePlans);
          }
        }
      } catch (err) {
        console.warn("Pricing page: using default fallback plans:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadPlans();
    return () => {
      isMounted = false;
    };
  }, []);

  const fallbackPlans: SubscriptionPlanItem[] = [
    {
      id: "free",
      name: "FREE",
      monthly_price: 0,
      trial_days: 0,
      max_staff: 2,
      max_active_devices: 2,
      storage_limit_gb: 0.5,
      monthly_ai_credits: 0,
      is_active: true,
      features: { ai_enabled: true, pdf_export: true },
    },
    {
      id: "starter",
      name: "STARTER",
      monthly_price: 29,
      trial_days: 14,
      max_staff: 5,
      max_active_devices: 5,
      storage_limit_gb: 2,
      monthly_ai_credits: 0,
      is_active: true,
      features: { ai_enabled: true, pdf_export: true },
    },
    {
      id: "pro",
      name: "PROFESSIONAL",
      monthly_price: 79,
      trial_days: 14,
      max_staff: 15,
      max_active_devices: 15,
      storage_limit_gb: 10,
      monthly_ai_credits: 0,
      is_active: true,
      features: { ai_enabled: true, pdf_export: true, priority_support: true },
    },
    {
      id: "enterprise",
      name: "ENTERPRISE",
      monthly_price: 199,
      trial_days: 30,
      max_staff: 100,
      max_active_devices: 100,
      storage_limit_gb: 50,
      monthly_ai_credits: 0,
      is_active: true,
      features: { ai_enabled: true, pdf_export: true, priority_support: true },
    },
  ];

  const displayPlans = plans.length > 0 ? plans : fallbackPlans;

  function formatPlanName(name: string): string {
    if (!name) return "";
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }

  function formatPlanPrice(price: number): string {
    if (price === 0) return "₹0";
    return `₹${price.toLocaleString("en-IN")}`;
  }

  function isPlanPopular(p: SubscriptionPlanItem): boolean {
    return Boolean(p.features?.popular || p.features?.is_popular);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 gradient-mesh" />
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Pricing</p>
          <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Plans that grow with you.</h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Simple, transparent tiers matching your operations. No credit card required to get started.
          </p>
        </div>

        {loading ? (
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="rounded-2xl p-6 border animate-pulse space-y-4">
                <div className="h-6 w-28 bg-muted rounded" />
                <div className="h-10 w-36 bg-muted rounded" />
                <div className="h-10 w-full bg-muted rounded-full mt-4" />
                <div className="space-y-2 pt-4">
                  {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                    <div key={j} className="h-4 w-full bg-muted rounded" />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div
            className={cn(
              "mt-12 grid gap-4",
              displayPlans.length === 1
                ? "max-w-md mx-auto"
                : displayPlans.length === 2
                ? "max-w-3xl mx-auto md:grid-cols-2"
                : displayPlans.length === 3
                ? "md:grid-cols-3"
                : "sm:grid-cols-2 lg:grid-cols-4"
            )}
          >
            {displayPlans.map((p) => {
              const isPopular = isPlanPopular(p);
              const feats = p.features || {};
              const isAiEnabled = feats.ai_enabled !== false && feats.ai_generator !== false;
              const isPdfExport = feats.pdf_export !== false;

              return (
                <Card
                  key={p.id || p.name}
                  className={cn(
                    "relative rounded-2xl p-6 flex flex-col justify-between transition-all hover:shadow-md",
                    isPopular && "border-primary shadow-glow bg-card"
                  )}
                >
                  {isPopular && (
                    <Badge className="absolute -top-2 left-4 rounded-full gradient-brand text-primary-foreground">
                      Popular
                    </Badge>
                  )}
                  <div>
                    <CardHeader className="p-0">
                      <CardTitle className="font-display text-xl">{formatPlanName(p.name)}</CardTitle>
                      <p className="pt-2">
                        <span className="font-display text-4xl font-semibold">{formatPlanPrice(p.monthly_price)}</span>
                        <span className="text-sm text-muted-foreground"> /month</span>
                      </p>
                      {feats.description && typeof feats.description === "string" && feats.description.trim() && (
                        <p className="mt-2 text-xs text-muted-foreground">{feats.description}</p>
                      )}
                    </CardHeader>

                    <CardContent className="p-0 pt-6 space-y-4">
                      <Button
                        asChild
                        className={cn("w-full rounded-full", isPopular && "gradient-brand text-primary-foreground shadow-glow")}
                        variant={isPopular ? "default" : "outline"}
                      >
                        <Link to="/signup">Start Free</Link>
                      </Button>

                      <ul className="space-y-2 text-sm pt-2 border-t border-border/50">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>{p.max_staff} active staff accounts</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>{p.max_active_devices} active devices</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>{p.storage_limit_gb} GB storage</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-violet-500 shrink-0" />
                          <span>{p.monthly_ai_credits > 0 ? `${p.monthly_ai_credits} AI credits/mo` : "No AI credits"}</span>
                        </li>
                        <li className="flex items-center gap-2 text-muted-foreground text-xs">
                          {isAiEnabled ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span>AI Enabled</span>
                        </li>
                        <li className="flex items-center gap-2 text-muted-foreground text-xs">
                          {isPdfExport ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span>PDF Export</span>
                        </li>
                        <li className="flex items-center gap-2 text-muted-foreground text-xs">
                          <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{p.trial_days > 0 ? `${p.trial_days} day trial` : "0 day trial"}</span>
                        </li>
                      </ul>
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        <p className="mt-8 text-center text-xs text-muted-foreground">All prices in INR. GST additional as applicable.</p>
      </main>
      <SiteFooter />
    </div>
  );
}