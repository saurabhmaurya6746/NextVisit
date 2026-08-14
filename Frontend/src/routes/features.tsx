import { Link } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Users,
  Calendar,
  Utensils,
  QrCode,
  MessageCircle,
  Cake,
  Gift,
  Ticket,
  Star,
  RefreshCw,
  LineChart,
  Brain,
  Shield,
  Clock,
  Scissors,
  Store,
  Check,
  Zap,
  Layers,
  ChevronRight,
  TrendingUp,
  Award,
  CheckCircle2,
  Share2,
  FileSpreadsheet,
  HeartHandshake,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "NextVisit Features | Customer Retention & Growth Platform" },
      {
        name: "description",
        content:
          "Explore NextVisit features for customer management, appointments, QR ordering, loyalty, WhatsApp campaigns, coupons, reviews, analytics and AI-powered growth.",
      },
      { property: "og:title", content: "NextVisit Features | Customer Retention & Growth Platform" },
      {
        property: "og:description",
        content:
          "Explore NextVisit features for customer management, appointments, QR ordering, loyalty, WhatsApp campaigns, coupons, reviews, analytics and AI-powered growth.",
      },
    ],
  }),
  component: FeaturesPage,
});

export default function FeaturesPage() {
  const [activeTab, setActiveTab] = useState<"restaurants" | "salons" | "retail">("restaurants");

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 gradient-mesh" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />

      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-12 md:pt-20">
        {/* ── HERO SECTION ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl text-center"
        >
          <Badge variant="secondary" className="mb-5 rounded-full border bg-card/60 px-3.5 py-1 backdrop-blur">
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" /> Complete Growth Platform
          </Badge>
          <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl md:text-7xl">
            Everything you need to turn customers into <span className="gradient-text">regulars</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            NextVisit brings customer management, bookings, orders, loyalty, WhatsApp campaigns, coupons, reviews and
            AI-powered insights into one simple platform for local businesses.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full gradient-brand text-primary-foreground shadow-glow">
              <Link to="/signup">
                Start free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link to="/#how-it-works">See how it works</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No credit card required. Free trial available on paid plans.</p>
        </motion.div>

        {/* ── CORE CAPABILITIES OVERVIEW GRID ──────────────────────────────────── */}
        <section className="mx-auto mt-28 max-w-6xl">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Full Platform Suite</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
              12 core tools. Zero disjointed apps.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Replace 4–5 separate subscriptions with one integrated customer retention engine.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureGridItems.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
                className="glass rounded-2xl p-6 shadow-elegant flex flex-col justify-between"
              >
                <div>
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary mb-4">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── CATEGORIZED FEATURE SECTIONS ────────────────────────────────────── */}
        <div className="mx-auto mt-32 max-w-6xl space-y-28">
          {/* SECTION A: RUN YOUR BUSINESS */}
          <section className="rounded-3xl border border-border/60 bg-card/40 p-8 md:p-12 backdrop-blur">
            <div className="max-w-2xl">
              <Badge variant="outline" className="rounded-full text-xs font-semibold text-primary border-primary/30 mb-3">
                Section A
              </Badge>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold">Run Your Day-to-Day Operations</h2>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                NextVisit handles your customer-facing workflows from greeting walk-ins and seating tables to booking
                workstations and managing staff schedules.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Calendar className="h-4 w-4 text-primary" /> Appointments & Workstations
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Manage walk-in and scheduled appointments, chair assignments, stylist calendars, and service durations.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <QrCode className="h-4 w-4 text-primary" /> QR Self-Ordering & Tables
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Give diners instant table QR menus to browse, customize, and order directly from their smartphones.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Utensils className="h-4 w-4 text-primary" /> Menu & Service Catalog
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Categorized item menus, veg/non-veg flags, service duration buffers, and dynamic pricing controls.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Shield className="h-4 w-4 text-primary" /> Staff Roles & Permissions
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Role-based access control for owners, managers, and staff accounts with device limits.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Users className="h-4 w-4 text-primary" /> Centralized Customer Profiles
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Every visit, itemized bill, total spend, and dietary/styling preference consolidated in one CRM.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Zap className="h-4 w-4 text-primary" /> Fast Bill Settlement
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Split-second checkout with UPI/Cash modes, GST calculations, thermal receipt printing, and coupons.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION B: BRING CUSTOMERS BACK */}
          <section className="rounded-3xl border border-border/60 bg-card/40 p-8 md:p-12 backdrop-blur">
            <div className="max-w-2xl">
              <Badge variant="outline" className="rounded-full text-xs font-semibold text-primary border-primary/30 mb-3">
                Section B
              </Badge>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold">Bring Customers Back Again & Again</h2>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                Turning one-off walk-ins into repeat visitors is the highest-ROI growth lever. NextVisit automates retention
                without extra staff effort.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Award className="h-4 w-4 text-primary" /> Tiered Loyalty Programs
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Silver, Gold, and Diamond tiers with automatic point accumulation per rupee spent and instant redemption.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Cake className="h-4 w-4 text-primary" /> Birthday & Anniversary Autopilot
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Automated personalized WhatsApp greetings with unique gift coupons delivered right on their special day.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <RefreshCw className="h-4 w-4 text-primary" /> Dormant Customer Recovery
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Automatically flags guests who haven't visited in 30, 60, or 90 days and delivers tailored win-back incentives.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Clock className="h-4 w-4 text-primary" /> Rebooking Nudges
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Prompts salon and spa clients when they are due for their next haircut, facial, or massage service.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <HeartHandshake className="h-4 w-4 text-primary" /> Visit Timeline & Recency
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Live visit cadence tracking so your staff can warmly recognize regulars and high-frequency guests.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <TrendingUp className="h-4 w-4 text-primary" /> Repeat Rate Tracking
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Measure retention cohort gains and monitor how effectively new customers become lifelong patrons.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION C: MARKET AUTOMATICALLY */}
          <section className="rounded-3xl border border-border/60 bg-card/40 p-8 md:p-12 backdrop-blur">
            <div className="max-w-2xl">
              <Badge variant="outline" className="rounded-full text-xs font-semibold text-primary border-primary/30 mb-3">
                Section C
              </Badge>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold">Market Automatically via WhatsApp</h2>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                Cut through crowded email inboxes. Reach customers where they actually open and read messages in seconds.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <MessageCircle className="h-4 w-4 text-primary" /> WhatsApp Broadcast Campaigns
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Send targeted announcements, weekend offers, and new arrivals directly to customer WhatsApp chats.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Ticket className="h-4 w-4 text-primary" /> Smart Dynamic Coupons
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Percentage discounts, flat amounts, or minimum-spend codes with real-time settlement verification and usage limits.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Sparkles className="h-4 w-4 text-primary" /> Festival & Holiday Campaigns
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Pre-configured holiday templates for Diwali, New Year, Eid, Christmas, and national celebrations.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Users className="h-4 w-4 text-primary" /> Smart Customer Segmentation
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Filter by VIP spenders, dormant clients, new walk-ins, or loyalty tier to send only relevant offers.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Layers className="h-4 w-4 text-primary" /> Delivery & Campaign Logs
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Track delivery timestamps, customer response history, and campaign engagement metrics in real time.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Gift className="h-4 w-4 text-primary" /> VIP Perks & Exclusive Codes
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Reward high-spending regulars with private VIP offers to protect your brand from generic discounting.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION D: BUILD YOUR REPUTATION */}
          <section className="rounded-3xl border border-border/60 bg-card/40 p-8 md:p-12 backdrop-blur">
            <div className="max-w-2xl">
              <Badge variant="outline" className="rounded-full text-xs font-semibold text-primary border-primary/30 mb-3">
                Section D
              </Badge>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold">Build a 5-Star Online Reputation</h2>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                Google reviews drive discovery for local dining and wellness businesses. Collect reviews automatically
                after every positive checkout.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Star className="h-4 w-4 text-warning" /> Google Review Booster
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Automated WhatsApp/SMS invites prompting satisfied customers to leave a 5-star Google rating right after service.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Brain className="h-4 w-4 text-violet-500" /> AI Review Response Generator
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Generate thoughtful, personalized responses to public reviews in seconds with our built-in AI assistant.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Direct Feedback Capture
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Capture constructive feedback privately before it ever reaches public review platforms.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION E: UNDERSTAND YOUR BUSINESS */}
          <section className="rounded-3xl border border-border/60 bg-card/40 p-8 md:p-12 backdrop-blur">
            <div className="max-w-2xl">
              <Badge variant="outline" className="rounded-full text-xs font-semibold text-primary border-primary/30 mb-3">
                Section E
              </Badge>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold">Actionable Sales & Revenue Insights</h2>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                Understand what's driving your top-line without digging through spreadsheets.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <LineChart className="h-4 w-4 text-primary" /> Sales & Revenue Dashboard
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Real-time sales breakdown across time periods, order channels, payment modes, and service categories.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Users className="h-4 w-4 text-primary" /> Customer Cohorts & Repeat Rate
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Monitor new vs. returning guest proportions, visit frequency, and average order value (AOV).
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-primary" /> Staff & Service Performance
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Track individual staff revenues, completed orders, appointments, and commission breakdowns.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION F: GROW WITH AI */}
          <section className="rounded-3xl border border-border/60 bg-card/40 p-8 md:p-12 backdrop-blur">
            <div className="max-w-2xl">
              <Badge variant="outline" className="rounded-full text-xs font-semibold text-violet-500 border-violet-500/30 mb-3">
                Section F
              </Badge>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold">Grow With Integrated AI</h2>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                Save hours of copywriting with practical AI tools directly integrated into your daily marketing workflows.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Brain className="h-4 w-4 text-violet-500" /> AI Campaign Generator
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Generate catchy, high-converting WhatsApp message copy for holiday promos, weekend specials, or VIP discounts.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <Sparkles className="h-4 w-4 text-violet-500" /> Smart Promotion Suggestions
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Get creative campaign themes and coupon ideas tailored specifically to your restaurant or salon concept.
                </p>
              </div>

              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <MessageCircle className="h-4 w-4 text-violet-500" /> AI Message Refinement
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Instantly adapt tone of voice from casual and playful to elegant and professional for VIP guests.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* ── BUSINESS-SPECIFIC CAPABILITIES ──────────────────────────────────── */}
        <section className="mx-auto mt-32 max-w-6xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Industry Tailored</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
              Built for the way your business works.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
              Select your business type to see the exact operational and retention workflow NextVisit configures for you.
            </p>
          </div>

          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-full bg-muted/60 p-1 border">
              <button
                onClick={() => setActiveTab("restaurants")}
                className={cn(
                  "flex items-center gap-2 rounded-full px-5 py-2 text-xs sm:text-sm font-medium transition-all",
                  activeTab === "restaurants" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Utensils className="h-4 w-4" /> Restaurants & Cafés
              </button>
              <button
                onClick={() => setActiveTab("salons")}
                className={cn(
                  "flex items-center gap-2 rounded-full px-5 py-2 text-xs sm:text-sm font-medium transition-all",
                  activeTab === "salons" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Scissors className="h-4 w-4" /> Salons & Spas
              </button>
              <button
                onClick={() => setActiveTab("retail")}
                className={cn(
                  "flex items-center gap-2 rounded-full px-5 py-2 text-xs sm:text-sm font-medium transition-all",
                  activeTab === "retail" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Store className="h-4 w-4" /> Local Businesses
              </button>
            </div>
          </div>

          <div className="glass rounded-3xl p-8 sm:p-12 shadow-elegant">
            {activeTab === "restaurants" && (
              <div className="grid gap-8 lg:grid-cols-2 items-center">
                <div>
                  <Badge variant="secondary" className="rounded-full mb-3 text-xs">
                    Food & Beverage Workflow
                  </Badge>
                  <h3 className="font-display text-2xl sm:text-3xl font-semibold">
                    Turn table turns into lasting relationships.
                  </h3>
                  <p className="mt-3 text-sm text-muted-foreground">
                    From QR ordering to customer retention, manage your restaurant operations and bring guests back again and again.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm">
                    {[
                      "Dynamic Table QR codes for contact-free guest ordering",
                      "Real-time order management & kitchen settlement workflow",
                      "Split payment support (Cash & UPI) with thermal receipt printing",
                      "Automated birthday & anniversary wishes with celebratory coupons",
                      "Dormant guest recovery campaigns to boost weekday covers",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <Button asChild className="rounded-full" variant="default">
                      <Link to="/signup">Start Free Restaurant Trial</Link>
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border bg-card/60 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b pb-3 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Restaurant Operations Matrix</span>
                    <Badge variant="outline" className="text-[10px]">Included</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-background/80 border">
                      <p className="font-semibold">QR Ordering</p>
                      <p className="text-muted-foreground mt-1">Live customer self-service</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background/80 border">
                      <p className="font-semibold">Table Management</p>
                      <p className="text-muted-foreground mt-1">Status & section tracking</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background/80 border">
                      <p className="font-semibold">Smart Coupons</p>
                      <p className="text-muted-foreground mt-1">Real-time discount checks</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background/80 border">
                      <p className="font-semibold">Review Booster</p>
                      <p className="text-muted-foreground mt-1">Automated 5-star Google prompts</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "salons" && (
              <div className="grid gap-8 lg:grid-cols-2 items-center">
                <div>
                  <Badge variant="secondary" className="rounded-full mb-3 text-xs">
                    Salon & Wellness Workflow
                  </Badge>
                  <h3 className="font-display text-2xl sm:text-3xl font-semibold">
                    Keep chairs full and clients rebooking.
                  </h3>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Manage appointments, customers and staff while automatically encouraging clients to rebook and return.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm">
                    {[
                      "Interactive appointment calendar with workstation & chair assignments",
                      "Client visit history, preferred stylists, and service records",
                      "Automated rebooking reminder notifications via WhatsApp",
                      "Stylist commission and staff performance revenue tracking",
                      "Digital loyalty points for repeat grooming and treatment visits",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <Button asChild className="rounded-full" variant="default">
                      <Link to="/signup">Start Free Salon Trial</Link>
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border bg-card/60 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b pb-3 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Salon Operations Matrix</span>
                    <Badge variant="outline" className="text-[10px]">Included</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-background/80 border">
                      <p className="font-semibold">Chair Assignment</p>
                      <p className="text-muted-foreground mt-1">Live workstation state</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background/80 border">
                      <p className="font-semibold">Client History</p>
                      <p className="text-muted-foreground mt-1">Past styles & spend logs</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background/80 border">
                      <p className="font-semibold">Staff Commission</p>
                      <p className="text-muted-foreground mt-1">Transparent staff payouts</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background/80 border">
                      <p className="font-semibold">Rebooking Nudges</p>
                      <p className="text-muted-foreground mt-1">Timely return reminders</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "retail" && (
              <div className="grid gap-8 lg:grid-cols-2 items-center">
                <div>
                  <Badge variant="secondary" className="rounded-full mb-3 text-xs">
                    Retail & Studio Workflow
                  </Badge>
                  <h3 className="font-display text-2xl sm:text-3xl font-semibold">
                    Build lifelong customer affinity.
                  </h3>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Streamline customer profiles, digital loyalty points, WhatsApp promos, and Google reviews for retail stores,
                    studios, and service counters.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm">
                    {[
                      "Rapid customer profile capture with mobile number lookup",
                      "Zero-app digital loyalty stamp cards and spend-based reward tiers",
                      "Automated WhatsApp promotional broadcasts and seasonal offers",
                      "Automated post-purchase Google review booster requests",
                      "Customer segmentation by VIP status and purchase frequency",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <Button asChild className="rounded-full" variant="default">
                      <Link to="/signup">Start Free Business Trial</Link>
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border bg-card/60 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b pb-3 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Local Business Matrix</span>
                    <Badge variant="outline" className="text-[10px]">Included</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-background/80 border">
                      <p className="font-semibold">Customer CRM</p>
                      <p className="text-muted-foreground mt-1">Instant contact directory</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background/80 border">
                      <p className="font-semibold">Digital Loyalty</p>
                      <p className="text-muted-foreground mt-1">Points on every rupee</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background/80 border">
                      <p className="font-semibold">Promo Coupons</p>
                      <p className="text-muted-foreground mt-1">Dynamic discount codes</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background/80 border">
                      <p className="font-semibold">Review Invites</p>
                      <p className="text-muted-foreground mt-1">5-star reputation growth</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── ALTERNATING FEATURE DETAIL DEEP DIVES ───────────────────────────── */}
        <div className="mx-auto mt-32 max-w-6xl space-y-24">
          {/* DEEP DIVE 1: WHATSAPP CAMPAIGNS */}
          <div className="grid gap-10 lg:grid-cols-2 items-center">
            <div className="order-2 lg:order-1">
              <Badge variant="outline" className="rounded-full text-xs font-semibold text-primary border-primary/30 mb-3">
                High-Impact Marketing
              </Badge>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold">
                Reach the right customers at the right time.
              </h2>
              <p className="mt-4 text-muted-foreground text-sm sm:text-base">
                Segment customers by behavior, visit history or loyalty status and send targeted campaigns without
                manually managing every single customer contact.
              </p>
              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Targeted Audiences</p>
                    <p className="text-xs text-muted-foreground">Filter VIPs, dormant regulars, or weekend visitors in one click.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">98% Open Rates</p>
                    <p className="text-xs text-muted-foreground">Direct WhatsApp messaging that customers actually notice and read.</p>
                  </div>
                </div>
              </div>
            </div>

            <Card className="order-1 lg:order-2 rounded-2xl p-6 shadow-elegant bg-card/70 border">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">WhatsApp Campaign Builder</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">Active</Badge>
              </div>
              <div className="mt-4 space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-background border">
                  <p className="text-muted-foreground">Target Audience</p>
                  <p className="font-medium text-foreground mt-0.5">VIP Customers (Total Spend &gt; ₹5,000)</p>
                </div>
                <div className="p-3 rounded-xl bg-background border">
                  <p className="text-muted-foreground">Attached Offer</p>
                  <p className="font-medium text-foreground mt-0.5">VIP20 — 20% OFF this weekend</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-foreground">
                  <p className="text-primary font-semibold">Message Preview</p>
                  <p className="mt-1 text-muted-foreground">
                    "Hi Priya! As one of our favorite guests, enjoy an exclusive 20% OFF your bill with code VIP20 this weekend."
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* DEEP DIVE 2: LOYALTY & REWARDS */}
          <div className="grid gap-10 lg:grid-cols-2 items-center">
            <Card className="rounded-2xl p-6 shadow-elegant bg-card/70 border">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Tiered Loyalty Engine</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">Automated</Badge>
              </div>
              <div className="mt-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-background border">
                  <div>
                    <p className="font-semibold">Silver Tier</p>
                    <p className="text-muted-foreground">0 – 1,000 pts</p>
                  </div>
                  <Badge variant="outline">1x Points</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/30">
                  <div>
                    <p className="font-semibold text-primary">Gold Tier</p>
                    <p className="text-muted-foreground">1,001 – 3,000 pts</p>
                  </div>
                  <Badge className="gradient-brand text-primary-foreground">1.5x Points</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-background border">
                  <div>
                    <p className="font-semibold">Diamond Tier</p>
                    <p className="text-muted-foreground">3,000+ pts</p>
                  </div>
                  <Badge variant="outline">2x Points</Badge>
                </div>
              </div>
            </Card>

            <div>
              <Badge variant="outline" className="rounded-full text-xs font-semibold text-primary border-primary/30 mb-3">
                Customer Retention
              </Badge>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold">
                Give customers a reason to come back.
              </h2>
              <p className="mt-4 text-muted-foreground text-sm sm:text-base">
                Create loyalty programs that reward repeat visits and increase lifetime value without requiring plastic cards
                or separate app downloads for your patrons.
              </p>
              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Zero Friction Setup</p>
                    <p className="text-xs text-muted-foreground">Points accumulate automatically on their mobile number during settlement.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Transparent Redemption</p>
                    <p className="text-xs text-muted-foreground">Instant point balance lookup and bill deduction at checkout.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DEEP DIVE 3: GOOGLE REVIEWS */}
          <div className="grid gap-10 lg:grid-cols-2 items-center">
            <div className="order-2 lg:order-1">
              <Badge variant="outline" className="rounded-full text-xs font-semibold text-primary border-primary/30 mb-3">
                Reputation Growth
              </Badge>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold">
                Turn happy customers into public reviews.
              </h2>
              <p className="mt-4 text-muted-foreground text-sm sm:text-base">
                Make review collection a natural part of the checkout flow and watch your Google business ranking climb effortlessly.
              </p>
              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Direct Review Link</p>
                    <p className="text-xs text-muted-foreground">Takes customers straight to your Google rating submission box.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">AI-Assisted Replies</p>
                    <p className="text-xs text-muted-foreground">Reply to praise and feedback professionally with one-click AI generation.</p>
                  </div>
                </div>
              </div>
            </div>

            <Card className="order-1 lg:order-2 rounded-2xl p-6 shadow-elegant bg-card/70 border">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-warning" />
                  <span className="font-semibold text-sm">Google Review Booster Flow</span>
                </div>
                <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">Auto-Triggered</Badge>
              </div>
              <div className="mt-4 space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-background border">
                  <div className="flex items-center gap-1 text-warning">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="font-medium text-foreground mt-1.5">"Amazing experience, loved the food and swift service!"</p>
                  <p className="text-muted-foreground mt-0.5">— Rahul M. via Google Reviews</p>
                </div>
                <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                  <p className="text-violet-600 dark:text-violet-400 font-semibold flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5" /> AI Generated Reply
                  </p>
                  <p className="text-muted-foreground mt-1">
                    "Thank you so much Rahul! We're thrilled you enjoyed your visit and look forward to welcoming you back soon!"
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* DEEP DIVE 4: AI GROWTH */}
          <div className="grid gap-10 lg:grid-cols-2 items-center">
            <Card className="rounded-2xl p-6 shadow-elegant bg-card/70 border">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-violet-500" />
                  <span className="font-semibold text-sm">AI Marketing Generator</span>
                </div>
                <Badge className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 text-[10px]">
                  Gemini Powered
                </Badge>
              </div>
              <div className="mt-4 space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-background border">
                  <p className="text-muted-foreground">Prompt</p>
                  <p className="font-medium text-foreground mt-0.5">"Create a festival offer for Diwali dinner bookings"</p>
                </div>
                <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                  <p className="text-violet-600 dark:text-violet-400 font-semibold">Generated Copy</p>
                  <p className="text-foreground mt-1 leading-relaxed">
                    "✨ Celebrate Diwali with warmth and flavor! Book your family feast this week and receive a complimentary dessert platter with code DIWALI20. Reserve now!"
                  </p>
                </div>
              </div>
            </Card>

            <div>
              <Badge variant="outline" className="rounded-full text-xs font-semibold text-violet-500 border-violet-500/30 mb-3">
                Smart Assistant
              </Badge>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold">
                Let AI help you find your next growth opportunity.
              </h2>
              <p className="mt-4 text-muted-foreground text-sm sm:text-base">
                Generate high-converting marketing campaigns and craft customer communications in seconds with AI trained for local business growth.
              </p>
              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Zero Writer's Block</p>
                    <p className="text-xs text-muted-foreground">Instantly draft compelling holiday, weekend, or birthday messages.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Tailored Tone</p>
                    <p className="text-xs text-muted-foreground">Tone adjustments specifically crafted for food and wellness businesses.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM CTA SECTION ──────────────────────────────────────────────── */}
        <section className="mx-auto mt-32 max-w-5xl rounded-3xl border border-primary/20 bg-card p-10 sm:p-16 text-center shadow-glow">
          <Badge variant="secondary" className="mb-4 rounded-full border px-3 py-1">
            Get Started Today
          </Badge>
          <h2 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight">
            Ready to turn more customers into regulars?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base text-muted-foreground">
            Start using NextVisit to manage your customers, automate marketing and increase repeat visits.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full gradient-brand text-primary-foreground shadow-glow">
              <Link to="/signup">
                Start free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link to="/pricing">View pricing</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No credit card required • Instant account setup</p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

// ── 12 Overview Cards Data ───────────────────────────────────────────────────
const featureGridItems = [
  {
    icon: Users,
    title: "Customer Management",
    description: "Keep every customer profile, visit, purchase, spend history and interaction in one place.",
  },
  {
    icon: Calendar,
    title: "Appointments & Bookings",
    description: "Manage appointments, service durations, staff schedules, and workstation chairs.",
  },
  {
    icon: QrCode,
    title: "Orders & QR Ordering",
    description: "Let restaurant diners scan, browse and order while staff manage kitchen flow in one workspace.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp Campaigns",
    description: "Create targeted campaigns for VIP, inactive, new, and frequent repeat customers.",
  },
  {
    icon: Cake,
    title: "Birthday & Anniversary Automation",
    description: "Automatically send personalized wishes and celebratory offers on autopilot.",
  },
  {
    icon: Award,
    title: "Loyalty & Rewards",
    description: "Reward repeat customers with tiered point accumulation and effortless bill redemption.",
  },
  {
    icon: Ticket,
    title: "Smart Coupons",
    description: "Create percentage, flat, and minimum-spend offers with real-time redemption checks.",
  },
  {
    icon: Star,
    title: "Google Review Booster",
    description: "Turn happy customers into more 5-star Google reviews after every positive checkout.",
  },
  {
    icon: RefreshCw,
    title: "Customer Recovery",
    description: "Identify customers who stopped visiting and bring them back with targeted win-back campaigns.",
  },
  {
    icon: LineChart,
    title: "Sales & Business Insights",
    description: "Track revenue, visits, repeat rate, average ticket size, and top-selling services.",
  },
  {
    icon: Brain,
    title: "AI Growth Assistant",
    description: "Use AI to generate marketing copy, review replies, and discover growth opportunities.",
  },
  {
    icon: Shield,
    title: "Staff & Role Management",
    description: "Manage staff accounts, access permissions, commission tracking, and active devices.",
  },
];
