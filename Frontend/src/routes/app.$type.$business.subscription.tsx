import { AppLink } from "@/lib/app-nav";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrentClient } from "@/lib/clients-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/$type/$business/subscription")({ component: SubscriptionPage });

const plans = [
  { name: "Free Trial", price: "₹0", duration: "14 days", features: ["Full access to all features", "Unlimited customers", "All automations", "WhatsApp campaigns"], current: true },
  { name: "Starter", price: "₹1,499", duration: "/month", features: ["Up to 1,000 customers", "Birthday & anniversary automation", "WhatsApp campaigns", "Coupons & loyalty"] },
  { name: "Professional", price: "₹3,999", duration: "/month", popular: true, features: ["Unlimited customers", "All automations", "Google review booster", "Priority support"] },
  { name: "Enterprise", price: "₹9,999", duration: "/month", features: ["Everything in Pro", "Multi-branch", "Custom integrations", "Dedicated CSM"] },
];

function SubscriptionPage() {
  const c = useCurrentClient();
  return (
    <>
      <PageHeader title="Subscription" description="Manage your plan and billing." />
      <Card className="mb-6 rounded-2xl">
        <CardHeader><CardTitle className="font-display">Current plan</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Plan</p><p className="mt-1 font-display text-xl font-semibold">{c?.plan || "Free Trial"}</p></div>
          <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Trial expires</p><p className="mt-1 font-medium">{c?.trialEnd ? new Date(c.trialEnd).toLocaleDateString() : "—"}</p></div>
          <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Days remaining</p><p className="mt-1 font-display text-xl font-semibold">{c?.isTrialExpired ? <span className="text-destructive">Expired</span> : `${c?.trialDaysRemaining ?? 0} days`}</p></div>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <Card key={p.name} className={cn("relative rounded-2xl transition-all hover:-translate-y-1", p.popular && "border-primary shadow-glow")}>
            {p.popular && <Badge className="absolute -top-2 left-4 rounded-full gradient-brand text-primary-foreground"><Sparkles className="mr-1 h-3 w-3" /> Popular</Badge>}
            {p.current && <Badge variant="secondary" className="absolute -top-2 right-4 rounded-full">Current</Badge>}
            <CardHeader>
              <CardTitle className="font-display">{p.name}</CardTitle>
              <p className="mt-2"><span className="font-display text-3xl font-semibold">{p.price}</span><span className="text-sm text-muted-foreground">{p.duration}</span></p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1.5 text-sm">
                {p.features.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-success" /> {f}</li>)}
              </ul>
              <Button
                disabled={p.current}
                className={cn("w-full rounded-full", p.popular && "gradient-brand text-primary-foreground shadow-glow")}
                variant={p.popular ? "default" : "outline"}
                onClick={() => toast.success(`Upgrade request for ${p.name} sent to admin`)}
              >
                {p.current ? "Current plan" : "Upgrade now"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Questions? <AppLink path="settings" className="text-primary hover:underline">Contact admin</AppLink>
      </p>
    </>
  );
}