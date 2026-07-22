import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [
    { title: "Pricing — NextVisit" },
    { name: "description", content: "Simple, transparent pricing for restaurants, salons, spas and cafés. 14-day free trial on every plan." },
    { property: "og:title", content: "NextVisit Pricing" },
    { property: "og:description", content: "Simple, transparent pricing for restaurants, salons, spas and cafés." },
  ] }),
  component: PricingPage,
});

const plans = [
  { name: "Starter", price: "₹1,499", tag: "For single-location businesses starting out.", cta: "Start Free", features: {
    "Up to 500 customers": true, "5 GB storage": true, "Email support": true,
    "WhatsApp campaigns": true, "Loyalty program": true, "QR ordering": true,
    "Customer CRM": true, "AI insights": false, "Google review booster": false, "Multi-branch": false,
  } },
  { name: "Professional", price: "₹3,999", tag: "For growing businesses that automate everything.", cta: "Start Free", popular: true, features: {
    "Up to 5,000 customers": true, "50 GB storage": true, "Priority support": true,
    "WhatsApp campaigns": true, "Loyalty program": true, "QR ordering": true,
    "Customer CRM": true, "AI insights": true, "Google review booster": true, "Multi-branch": false,
  } },
  { name: "Enterprise", price: "₹9,999", tag: "For multi-branch chains and franchises.", cta: "Start Free", features: {
    "Unlimited customers": true, "500 GB storage": true, "Dedicated CSM": true,
    "WhatsApp campaigns": true, "Loyalty program": true, "QR ordering": true,
    "Customer CRM": true, "AI insights": true, "Google review booster": true, "Multi-branch": true,
  } },
];

function PricingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 gradient-mesh" />
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Pricing</p>
          <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Plans that grow with you.</h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">14-day free trial on every plan. No credit card required.</p>
        </div>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.name} className={cn("relative rounded-2xl", p.popular && "border-primary shadow-glow")}>
              {p.popular && <Badge className="absolute -top-2 left-4 rounded-full gradient-brand text-primary-foreground"><Sparkles className="mr-1 h-3 w-3" /> Most popular</Badge>}
              <CardHeader>
                <CardTitle className="font-display text-xl">{p.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{p.tag}</p>
                <p className="pt-2"><span className="font-display text-4xl font-semibold">{p.price}</span><span className="text-sm text-muted-foreground"> /month</span></p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button asChild className={cn("w-full rounded-full", p.popular && "gradient-brand text-primary-foreground shadow-glow")} variant={p.popular ? "default" : "outline"}>
                  <Link to="/signup">{p.cta}</Link>
                </Button>
                <ul className="space-y-2 text-sm">
                  {Object.entries(p.features).map(([label, ok]) => (
                    <li key={label} className={cn("flex items-start gap-2", !ok && "text-muted-foreground/60 line-through")}>
                      <Check className={cn("mt-0.5 h-4 w-4", ok ? "text-success" : "text-muted-foreground/40")} /> {label}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">All prices in INR. GST additional as applicable. Payments coming soon.</p>
      </main>
      <SiteFooter />
    </div>
  );
}