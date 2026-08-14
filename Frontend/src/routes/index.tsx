import { Link } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  MessageCircle,
  Cake,
  Trophy,
  Star,
  LineChart,
  Ticket,
  UserPlus,
  Building2,
  Users,
  MessageSquareHeart,
  TrendingUp,
  Utensils,
  Scissors,
  Store,
  Check,
  ChevronDown,
  Brain,
  XCircle,
  Clock,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";
import { getPublicPlansApi, type SubscriptionPlanItem } from "@/lib/subscription-api";

export const Route = createFileRoute("/")({
  component: Index,
});

export default function Index() {
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

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
        console.warn("Could not load dynamic pricing from backend, using safe fallback:", err);
      } finally {
        if (isMounted) setLoadingPlans(false);
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 gradient-mesh" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />

      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-12 md:pt-20">
        {/* HERO SECTION */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-5 rounded-full border bg-card/60 px-3 py-1 backdrop-blur">
            <Sparkles className="mr-1.5 h-3 w-3 text-primary" /> New — AI campaign generator
          </Badge>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            The CRM that <span className="gradient-text">grows itself</span> for local businesses.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            NextVisit turns walk-ins into regulars — automated birthdays, WhatsApp campaigns, loyalty, coupons, and Google reviews. Built for restaurants, salons, spas and cafés.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full gradient-brand text-primary-foreground shadow-glow">
              <Link to="/signup">
                Start free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No credit card required. Free trial available on paid plans.</p>
        </motion.div>

        {/* HOW IT WORKS SECTION (GENERIC 6-STEP WORKFLOW) */}
        <section id="how-it-works" className="mx-auto mt-24 max-w-6xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">How it works</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Live in 6 simple steps.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {steps.map((s, i) => (
              <div key={s.title} className="glass rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary font-semibold">{i + 1}</span> Step
                  </div>
                  <div className="mt-3 grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <p className="mt-2 font-display font-semibold text-sm">{s.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BUSINESS-TYPE POSITIONING SECTION */}
        <section id="industries" className="mx-auto mt-28 max-w-6xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Tailored by industry</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">One platform. Built for your business type.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
              NextVisit adapts to your operations — whether you seat diners at tables, book appointments in chairs, or serve customers across the counter.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {industries.map((ind) => (
              <div key={ind.title} className="glass relative rounded-2xl p-6 shadow-elegant flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                      <ind.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold">{ind.title}</h3>
                      <p className="text-xs text-muted-foreground">{ind.tagline}</p>
                    </div>
                  </div>
                  <ul className="space-y-2 text-xs text-muted-foreground mt-4 border-t pt-4 border-border/50">
                    {ind.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES SECTION */}
        <section id="features" className="mx-auto mt-28 max-w-6xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Everything, in one place</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Automation that actually moves the needle.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="glass rounded-2xl p-6 shadow-elegant">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/features" className="inline-flex items-center gap-1.5 font-medium">
                Explore all features <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* TESTIMONIALS SECTION */}
        <section id="testimonials" className="mx-auto mt-28 max-w-6xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Loved by owners</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">The results speak for themselves.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <Card key={t.name} className="rounded-2xl p-6">
                <div className="flex items-center gap-1 text-warning">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-3 text-sm">{t.quote}</p>
                <p className="mt-4 text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* BACKEND-DRIVEN DYNAMIC PRICING SECTION */}
        <section id="pricing" className="mx-auto mt-28 max-w-6xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Pricing</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Simple plans for every stage.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Choose the plan that fits your business. Transparent tiers with no hidden fees.
            </p>
          </div>

          {loadingPlans ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="rounded-2xl p-6 border bg-card/50 flex flex-col justify-between animate-pulse space-y-4">
                  <div className="space-y-3">
                    <div className="h-6 w-28 bg-muted rounded" />
                    <div className="h-9 w-36 bg-muted rounded" />
                    <div className="h-4 w-48 bg-muted rounded" />
                  </div>
                  <div className="h-10 w-full bg-muted rounded-full mt-6" />
                </Card>
              ))}
            </div>
          ) : (
            <div
              className={cn(
                "grid gap-4",
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
                      <div>
                        <h3 className="font-display text-xl font-semibold">{formatPlanName(p.name)}</h3>
                        <p className="mt-2">
                          <span className="font-display text-3xl font-semibold">{formatPlanPrice(p.monthly_price)}</span>
                          <span className="text-sm text-muted-foreground"> /month</span>
                        </p>
                        {feats.description && typeof feats.description === "string" && feats.description.trim() && (
                          <p className="mt-2 text-xs text-muted-foreground">{feats.description}</p>
                        )}
                      </div>

                      <ul className="space-y-2 text-xs sm:text-sm mt-5 pt-4 border-t border-border/50">
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
                        <li className="flex items-center gap-2 text-muted-foreground">
                          {isAiEnabled ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span>AI Enabled</span>
                        </li>
                        <li className="flex items-center gap-2 text-muted-foreground">
                          {isPdfExport ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span>PDF Export</span>
                        </li>
                        <li className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{p.trial_days > 0 ? `${p.trial_days} day trial` : "0 day trial"}</span>
                        </li>
                      </ul>
                    </div>

                    <Button asChild className="mt-6 w-full rounded-full" variant={isPopular ? "default" : "outline"}>
                      <Link to="/signup">Start free</Link>
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            See full feature comparison on the{" "}
            <Link to="/pricing" className="text-primary hover:underline font-medium">
              pricing page
            </Link>
            .
          </p>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" className="mx-auto mt-28 max-w-3xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">FAQ</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Questions, answered.</h2>
          </div>
          <div className="space-y-2">
            {faqs.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

// ── Generic 6-Step Workflow ──────────────────────────────────────────────────
const steps = [
  { icon: UserPlus, title: "Sign Up", body: "Create your business account in under a minute." },
  { icon: Sparkles, title: "Get Started", body: "Complete your business setup and unlock your workspace." },
  { icon: Building2, title: "Add Your Business", body: "Add your services, products, tables, staff and pricing." },
  { icon: Users, title: "Start Serving Customers", body: "Manage appointments, orders or walk-ins based on your business type." },
  { icon: MessageSquareHeart, title: "Engage Customers", body: "Build customer profiles and send reminders, offers and campaigns." },
  { icon: TrendingUp, title: "Grow Repeat Business", body: "Turn first-time visitors into loyal, returning customers." },
];

// ── Multi-Business Type Highlights ──────────────────────────────────────────
const industries = [
  {
    icon: Utensils,
    title: "Restaurants & Cafés",
    tagline: "Dine-in, takeaway & table service",
    highlights: [
      "QR self-ordering & digital menus",
      "Table & dining area management",
      "Live order tracking & KDS workflow",
      "Guest loyalty points & reward tiers",
      "Automated customer marketing campaigns",
    ],
  },
  {
    icon: Scissors,
    title: "Salons & Spas",
    tagline: "Appointments, styling & wellness",
    highlights: [
      "Online & walk-in appointment calendar",
      "Workstation & chair assignment",
      "Stylist & staff scheduling with commission",
      "Client visit history & service preferences",
      "Automated rebooking reminders & offers",
    ],
  },
  {
    icon: Store,
    title: "Local Businesses & Retail",
    tagline: "Stores, studios & service counters",
    highlights: [
      "Fast customer profile management (CRM)",
      "Digital loyalty programs & stamp cards",
      "Dynamic promo coupons & discounts",
      "WhatsApp & birthday autopilot campaigns",
      "Automated Google review booster",
    ],
  },
];

const testimonials = [
  { name: "Marco De Luca", role: "The Daily Grind Café", quote: "NextVisit turned every walk-in into a regular. Our repeat rate doubled in a quarter." },
  { name: "Priya Sharma", role: "Aroma Bistro", quote: "QR ordering + WhatsApp campaigns doubled our weekend covers without extra staff." },
  { name: "Riya Kapoor", role: "Luxe Hair Lounge", quote: "The loyalty program is a game changer — clients rebook themselves now." },
];

const faqs = [
  { q: "Do I need a credit card to start?", a: "No. Sign up, get approved, and enjoy a free trial with full access." },
  { q: "How long does approval take?", a: "Most accounts are approved within one business day." },
  { q: "Which business types are supported?", a: "Restaurants, salons, spas and cafés. More coming soon." },
  { q: "Can I cancel anytime?", a: "Yes. Trials auto-expire and paid plans can be cancelled from Settings." },
  { q: "Do you offer WhatsApp campaigns?", a: "Yes — birthday, anniversary, VIP, recovery and festival campaigns come built-in." },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="rounded-xl">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between p-4 text-left">
        <span className="text-sm font-medium">{q}</span>
        <ChevronDown className={"h-4 w-4 transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && <p className="border-t p-4 text-sm text-muted-foreground">{a}</p>}
    </Card>
  );
}

const features = [
  { icon: Cake, title: "Birthday & anniversary autopilot", body: "Personalized WhatsApp wishes with the right coupon, sent at the right hour." },
  { icon: MessageCircle, title: "WhatsApp campaigns", body: "Segment VIPs, dormant guests, or festival lists — and hit send in seconds." },
  { icon: Ticket, title: "Smart coupons", body: "Percent, flat, BOGO or free item. Track redemption in real time." },
  { icon: Trophy, title: "Loyalty & tiers", body: "Silver, Gold and Diamond — reward the guests who come back for more." },
  { icon: Star, title: "Google review booster", body: "Turn happy customers into 5-star reviews without lifting a finger." },
  { icon: LineChart, title: "Insights that decide", body: "Repeat rate, revenue forecast, best time to send — all in plain English." },
];

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

