import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, MessageCircle, Cake, Trophy, Star, LineChart, Ticket, UserPlus, ShieldCheck, Utensils, QrCode, Rocket, ChevronDown, ShoppingBag as ShoppingBagIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 gradient-mesh" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />

      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-12 md:pt-20">
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
            <Button asChild size="lg" className="rounded-full gradient-brand text-primary-foreground shadow-glow"><Link to="/signup">Start free <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline" className="rounded-full"><Link to="/login">Sign in</Link></Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No credit card. 14-day trial on every paid plan.</p>
        </motion.div>

        <section id="how-it-works" className="mx-auto mt-24 max-w-6xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">How it works</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Live in 6 simple steps.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {steps.map((s, i) => (
              <div key={s.title} className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary font-semibold">{i + 1}</span> Step</div>
                <div className="mt-3 grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><s.icon className="h-4 w-4" /></div>
                <p className="mt-2 font-display font-semibold">{s.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

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
        </section>

        <section id="testimonials" className="mx-auto mt-28 max-w-6xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Loved by owners</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">The results speak for themselves.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <Card key={t.name} className="rounded-2xl p-6">
                <div className="flex items-center gap-1 text-warning">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
                <p className="mt-3 text-sm">{t.quote}</p>
                <p className="mt-4 text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto mt-28 max-w-6xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Pricing</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Simple plans for every stage.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { name: "Starter", price: "₹1,499", note: "Single-location, up to 500 customers." },
              { name: "Professional", price: "₹3,999", note: "Growing brands, AI insights included.", popular: true },
              { name: "Enterprise", price: "₹9,999", note: "Multi-branch, dedicated CSM." },
            ].map((p) => (
              <Card key={p.name} className={"relative rounded-2xl p-6 " + (p.popular ? "border-primary shadow-glow" : "")}>
                {p.popular && <Badge className="absolute -top-2 left-4 rounded-full gradient-brand text-primary-foreground">Popular</Badge>}
                <p className="font-display text-xl font-semibold">{p.name}</p>
                <p className="mt-2"><span className="font-display text-3xl font-semibold">{p.price}</span><span className="text-sm text-muted-foreground"> /mo</span></p>
                <p className="mt-2 text-sm text-muted-foreground">{p.note}</p>
                <Button asChild className="mt-4 w-full rounded-full" variant={p.popular ? "default" : "outline"}>
                  <Link to="/signup">Start free</Link>
                </Button>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">See full comparison on the <Link to="/pricing" className="text-primary hover:underline">pricing page</Link>.</p>
        </section>

        <section id="faq" className="mx-auto mt-28 max-w-3xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">FAQ</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Questions, answered.</h2>
          </div>
          <div className="space-y-2">
            {faqs.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

const steps = [
  { icon: UserPlus, title: "Sign Up", body: "Create your business account in under a minute." },
  { icon: ShieldCheck, title: "Approval", body: "Our team verifies and unlocks your account." },
  { icon: Utensils, title: "Setup Menu", body: "Add tables, services, dishes and prices." },
  { icon: QrCode, title: "Print QR", body: "Place QR codes on every table for self-ordering." },
  { icon: ShoppingBagIcon, title: "Accept Orders", body: "Staff + QR orders flow into one workspace." },
  { icon: Rocket, title: "Grow Customers", body: "Automated campaigns turn walk-ins into regulars." },
];

const testimonials = [
  { name: "Marco De Luca", role: "The Daily Grind Café", quote: "NextVisit turned every walk-in into a regular. Our repeat rate doubled in a quarter." },
  { name: "Priya Sharma", role: "Aroma Bistro", quote: "QR ordering + WhatsApp campaigns doubled our weekend covers without extra staff." },
  { name: "Riya Kapoor", role: "Luxe Hair Lounge", quote: "The loyalty program is a game changer — clients rebook themselves now." },
];

const faqs = [
  { q: "Do I need a credit card to start?", a: "No. Sign up, get approved, and enjoy a 14-day free trial with full access." },
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
