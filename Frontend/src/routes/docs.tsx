import { createFileRoute } from "@/lib/route-compat";
import { useMemo, useState, useEffect } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  BookOpen,
  LayoutDashboard,
  ShoppingBag,
  QrCode,
  Users,
  Megaphone,
  Ticket,
  Trophy,
  BarChart3,
  HelpCircle,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Documentation — NextVisit" },
      {
        name: "description",
        content:
          "Official documentation and product guides for NextVisit: getting started, POS orders, table QR ordering, CRM, automated WhatsApp campaigns, loyalty programs, and reporting.",
      },
    ],
  }),
  component: DocsPage,
});

interface DocSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  summary: string;
  content: React.ReactNode;
}

export default function DocsPage() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState("getting-started");
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const hashId = location.hash.replace("#", "");
      setActive(hashId);
      const el = document.getElementById(hashId);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [location.hash]);

  const sections: DocSection[] = useMemo(
    () => [
      {
        id: "getting-started",
        label: "Getting Started",
        icon: BookOpen,
        tag: "Setup & Onboarding",
        summary: "Step-by-step walkthrough to register your business, receive Super Admin approval, and start operating.",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Welcome to <span className="font-semibold text-foreground">NextVisit</span>. Our platform is built to help
              restaurants, salons, cafes, and local businesses digitize orders, engage repeat customers, and automate
              marketing campaigns.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 pt-2">
              <div className="rounded-xl border bg-muted/30 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-foreground text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">1</span>
                  Create Your Business Account
                </div>
                <p className="text-xs">
                  Register with your business name, owner details, phone, email, and password. Your password must satisfy
                  all security rules (8+ characters, uppercase, lowercase, number, and special character).
                </p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-foreground text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">2</span>
                  Admin Review &amp; Activation
                </div>
                <p className="text-xs">
                  Our Super Admin team verifies new accounts to maintain platform security. You will receive an email
                  notification as soon as your account is approved (typically within 12 hours).
                </p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-foreground text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">3</span>
                  Complete Business Profile Setup
                </div>
                <p className="text-xs">
                  Configure your operating hours, currency, tax rates (GST), UPI payment QR code, and service or menu
                  catalog using our guided setup stepper.
                </p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-foreground text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">4</span>
                  Team Delegation &amp; Operations
                </div>
                <p className="text-xs">
                  Create staff accounts with custom permission boundaries (Owner, Manager, Cashier, Waiter, Kitchen) and
                  generate table QR codes for instant ordering.
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        tag: "Analytics & Overview",
        summary: "Live sales telemetry, pending order alerts, active table sessions, and celebration monitors.",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              The NextVisit merchant dashboard provides a unified real-time control room for your daily operations.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-foreground">Today's Sales &amp; Orders:</strong> Track total gross revenue, live
                order counts, and average order value updated continuously throughout the business day.
              </li>
              <li>
                <strong className="text-foreground">Active Tables &amp; Sessions:</strong> View which dine-in tables or
                salon workstations are currently occupied, along with active table timers and unbilled orders.
              </li>
              <li>
                <strong className="text-foreground">Celebrations Monitor:</strong> Displays customers celebrating birthdays
                or wedding anniversaries today, enabling one-click personalized WhatsApp greetings and reward dispatch.
              </li>
              <li>
                <strong className="text-foreground">Clickable Drill-Down Cards:</strong> Every metric card links directly
                to filtered views in the Orders, Customers, or Revenue reports for instant operational actions.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: "orders",
        label: "Orders & POS",
        icon: ShoppingBag,
        tag: "Order Lifecycle",
        summary: "Unified POS workflow for both staff-placed dine-in orders and self-service customer QR orders.",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              NextVisit simplifies order management by uniting table QR orders, counter takeaway orders, and staff POS entries
              into a single intuitive workspace.
            </p>
            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div className="font-semibold text-foreground text-xs uppercase tracking-wider">Order &amp; Payment Status Lifecycle</div>
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <span className="font-medium text-foreground">Fulfillment Status:</span>
                  <p><Badge variant="secondary" className="mr-1.5 text-[10px]">PENDING</Badge> Order received, being prepared by kitchen or staff.</p>
                  <p><Badge variant="outline" className="mr-1.5 text-[10px] text-success border-success/30">COMPLETED</Badge> Order fulfilled, served, and closed.</p>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <span className="font-medium text-foreground">Payment Status:</span>
                  <p><Badge variant="secondary" className="mr-1.5 text-[10px] text-warning border-warning/30">UNPAID</Badge> Active tab awaiting final bill settlement.</p>
                  <p><Badge variant="outline" className="mr-1.5 text-[10px] text-success border-success/30">PAID</Badge> Payment received via UPI QR, Cash, or Card.</p>
                </div>
              </div>
            </div>
            <p className="text-xs">
              Staff can edit orders in real time, apply custom discounts or valid coupon codes, split payments, and print clean
              itemized tax invoices.
            </p>
          </div>
        ),
      },
      {
        id: "qr-ordering",
        label: "QR Ordering",
        icon: QrCode,
        tag: "Contactless Experience",
        summary: "Table-specific QR codes enabling instant menu browsing, contactless ordering, and self-checkout.",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Equip every table or seating area with a dedicated NextVisit QR code to streamline ordering without requiring
              customers to download any third-party mobile apps.
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p>
                  <strong className="text-foreground">Instant Digital Menu:</strong> Customers scan the QR code with their
                  smartphone camera to view visual menus with real-time item availability, descriptions, and pricing.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p>
                  <strong className="text-foreground">Active Table Session Linking:</strong> Orders submitted by customers are
                  automatically linked to the designated table number, alerting staff with auditory and visual notifications.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p>
                  <strong className="text-foreground">UPI Self-Checkout QR:</strong> Businesses can display their custom UPI QR
                  code directly on the digital bill so customers can pay and checkout quickly from their phones.
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "customers",
        label: "Customers & CRM",
        icon: Users,
        tag: "Customer Intelligence",
        summary: "Centralized customer profiles, visit history, loyalty point ledgers, and automated segment tagging.",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              NextVisit transforms anonymous diners and salon visitors into recognized, loyal regulars by maintaining
              comprehensive CRM profiles identified by mobile phone numbers.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border bg-muted/20 p-3 space-y-1">
                <strong className="text-foreground block">Visit &amp; Spend Telemetry</strong>
                <p>Tracks lifetime visits, last visit timestamp, total spend, average order value, and preferred items.</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3 space-y-1">
                <strong className="text-foreground block">Celebrations &amp; Milestones</strong>
                <p>Stores customer birthdays and anniversaries to automatically trigger celebration campaigns.</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3 space-y-1">
                <strong className="text-foreground block">Communication History</strong>
                <p>Complete timeline log of every WhatsApp greeting, recovery offer, and promotional coupon dispatched.</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3 space-y-1">
                <strong className="text-foreground block">Automated Segments</strong>
                <p>Categorizes patrons into VIP, Regular, First-Time, and Dormant/At-Risk for targeted marketing.</p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "campaigns",
        label: "Campaigns & Marketing",
        icon: Megaphone,
        tag: "Marketing Automation",
        summary: "Automate birthday greetings, anniversary offers, welcome check-ins, VIP rewards, and customer recovery.",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Drive repeat visits effortlessly with pre-configured, highly effective automated marketing campaign triggers.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-foreground">Welcome Campaigns:</strong> Automatically sends a warm thank-you
                message and optional first-visit discount coupon to new patrons immediately after their first visit.
              </li>
              <li>
                <strong className="text-foreground">Birthday &amp; Anniversary Automations:</strong> Delivers personalized
                greetings with celebratory coupons on or before the customer's special day.
              </li>
              <li>
                <strong className="text-foreground">Customer Recovery (Win-Back):</strong> Identifies dormant patrons who
                haven't visited in 30, 60, or 90 days and dispatches enticing re-engagement offers.
              </li>
              <li>
                <strong className="text-foreground">Review Booster:</strong> Automatically prompts satisfied customers to
                share their positive experiences on Google Maps or your preferred review platform.
              </li>
              <li>
                <strong className="text-foreground">Festival &amp; Broadcast Campaigns:</strong> Craft bespoke announcements,
                holiday specials, and seasonal discounts sent to selected customer groups.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: "coupons",
        label: "Coupons & Discounts",
        icon: Ticket,
        tag: "Promotional Engine",
        summary: "Create percentage, flat, BOGO, or free-item coupons with live redemption tracking and fraud prevention.",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Design, manage, and track promotional discount vouchers tailored to your profit margins.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
              <div className="rounded-lg border bg-card p-3">
                <span className="font-semibold text-foreground">Percentage Off (%):</span> e.g., 20% off total food bill.
              </div>
              <div className="rounded-lg border bg-card p-3">
                <span className="font-semibold text-foreground">Flat Discount (₹):</span> e.g., Flat ₹150 off on orders above ₹800.
              </div>
              <div className="rounded-lg border bg-card p-3">
                <span className="font-semibold text-foreground">Buy One Get One (BOGO):</span> Buy any beverage, get one complimentary.
              </div>
              <div className="rounded-lg border bg-card p-3">
                <span className="font-semibold text-foreground">Free Item Reward:</span> Complimentary dessert on minimum spend.
              </div>
            </div>
            <p className="text-xs">
              Every coupon supports expiration dates, minimum order values, and single-use per customer rules to safeguard
              your margins.
            </p>
          </div>
        ),
      },
      {
        id: "loyalty",
        label: "Loyalty Program",
        icon: Trophy,
        tag: "Reward Mechanics",
        summary: "Turn visits into points: configure earning ratios, signup bonuses, and checkout redemption rules.",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Build lasting customer loyalty with a fully automated, point-based rewards program built into the billing engine.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="font-bold text-primary">•</span>
                <p>
                  <strong className="text-foreground">Custom Point Earning:</strong> Set how many reward points customers earn
                  for every ₹100 spent on paid orders.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-primary">•</span>
                <p>
                  <strong className="text-foreground">Bonus Points:</strong> Reward new signups with instant starter points and
                  grant extra birthday bonus points.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-primary">•</span>
                <p>
                  <strong className="text-foreground">Redemption at Checkout:</strong> Customers can redeem accumulated points
                  directly against their bill according to your conversion exchange rate (e.g., 100 points = ₹50 discount).
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "reports",
        label: "Reports & Analytics",
        icon: BarChart3,
        tag: "Business Intelligence",
        summary: "Understand your financial growth, sales channels, payment methods, and highest-grossing products.",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Gain clear visibility into your commercial performance with clean, actionable visual reports.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-foreground">Revenue Trends:</strong> Track sales performance across customizable
                timeframes (Daily, Weekly, Monthly, and Yearly comparisons).
              </li>
              <li>
                <strong className="text-foreground">Channel Breakdown:</strong> Compare sales volume generated via self-service
                Table QR Ordering versus Staff-placed POS orders.
              </li>
              <li>
                <strong className="text-foreground">Payment Method Distribution:</strong> Analyze payment splits across UPI QR,
                Cash, and Cards to reconcile daily cash registers.
              </li>
              <li>
                <strong className="text-foreground">Top-Selling Items:</strong> Identify best-selling dishes or salon services
                to optimize your menu engineering and inventory.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: "faqs",
        label: "Frequently Asked Questions",
        icon: HelpCircle,
        tag: "Help & Clarifications",
        summary: "Direct answers to common questions regarding account approvals, re-application, customer data, and features.",
        content: (
          <div className="space-y-3.5 text-sm">
            <div className="rounded-xl border bg-muted/20 p-4 space-y-1.5">
              <h3 className="font-semibold text-foreground text-xs sm:text-sm">How does the account approval process work?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                After you submit the signup form, your business registration is submitted for Super Admin review. Our team
                verifies the business details to ensure platform integrity. You will receive an approval confirmation email
                once reviewed (typically within 12 hours), after which you can log in immediately.
              </p>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4 space-y-1.5">
              <h3 className="font-semibold text-foreground text-xs sm:text-sm">What happens if an application is rejected?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If an application has incomplete or unverified information, the administrator may reject the application with
                specific feedback. The owner receives an explanatory notification email detailing the reason.
              </p>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4 space-y-1.5">
              <h3 className="font-semibold text-foreground text-xs sm:text-sm">Can a previously rejected account apply again?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Yes. If your application was rejected, you can simply submit a new registration using the same email address
                with updated and verified business details. The system will reset your application to pending review.
              </p>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4 space-y-1.5">
              <h3 className="font-semibold text-foreground text-xs sm:text-sm">How is customer data handled and protected?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your business retains full ownership of your customer profiles and visit records. NextVisit acts as a secure
                software processor with encrypted transmission (HTTPS/TLS) and isolated tenant databases. We never sell or
                share your customer records with third parties.
              </p>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4 space-y-1.5">
              <h3 className="font-semibold text-foreground text-xs sm:text-sm">Do customers need an app to order via QR?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                No. NextVisit QR ordering operates entirely in the mobile web browser. Customers simply scan the table QR code
                with their default smartphone camera to browse, order, and pay instantly.
              </p>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4 space-y-1.5">
              <h3 className="font-semibold text-foreground text-xs sm:text-sm">Is there a free trial period?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Yes. Once your business account is approved, you receive a complimentary 14-day full-access trial with no
                credit card required. You can test all QR ordering, campaign, and loyalty features during this period.
              </p>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4 space-y-1.5">
              <h3 className="font-semibold text-foreground text-xs sm:text-sm">How can I reach customer support?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You can reach our dedicated support team via email at{" "}
                <a href="mailto:hello@growthos.app" className="text-primary hover:underline font-medium">
                  hello@growthos.app
                </a>{" "}
                or by phone at{" "}
                <a href="tel:9555702945" className="text-primary hover:underline font-medium">
                  +91 9555702945
                </a>
                .
              </p>
            </div>
          </div>
        ),
      },
    ],
    []
  );

  const filtered = useMemo(
    () =>
      sections.filter(
        (s) =>
          s.label.toLowerCase().includes(q.toLowerCase()) ||
          s.summary.toLowerCase().includes(q.toLowerCase()) ||
          s.tag.toLowerCase().includes(q.toLowerCase())
      ),
    [q, sections]
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Header & Search Banner */}
        <div className="mb-10 rounded-2xl border bg-card/60 p-6 sm:p-8 backdrop-blur shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="secondary" className="rounded-full gap-1 text-xs">
              <Sparkles className="h-3 w-3 text-primary" /> Product Documentation
            </Badge>
            <Badge variant="outline" className="rounded-full text-xs">
              NextVisit Platform
            </Badge>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            NextVisit Documentation &amp; User Guides
          </h1>
          <p className="mt-2 max-w-3xl text-sm sm:text-base text-muted-foreground leading-relaxed">
            Everything you need to configure your business, accept QR and POS orders, engage repeat customers with
            automated marketing, manage loyalty rewards, and review analytics.
          </p>

          <div className="relative mt-6 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search documentation guides & FAQs…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* Sticky Left Navigation */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border bg-card/60 p-3.5 backdrop-blur shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2.5 mb-2">
                Documentation Topics
              </p>
              <nav className="space-y-0.5 text-xs">
                {filtered.map((s) => {
                  const Icon = s.icon;
                  const isCur = active === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setActive(s.id);
                        const el = document.getElementById(s.id);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        isCur
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isCur ? "text-primary-foreground" : "text-muted-foreground"}`} />
                      <span className="truncate">{s.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content Feed */}
          <div className="space-y-6">
            {filtered.length === 0 ? (
              <Card className="rounded-2xl p-8 text-center text-muted-foreground">
                <BookOpen className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="font-medium text-foreground">No matching documentation topics found</p>
                <p className="text-xs mt-1">Try searching for keywords like "QR", "Orders", "Loyalty", or "Campaigns".</p>
                <Button variant="outline" size="sm" onClick={() => setQ("")} className="mt-4 rounded-full text-xs">
                  Clear Search
                </Button>
              </Card>
            ) : (
              filtered.map((s) => {
                const Icon = s.icon;
                const isSelected = active === s.id;
                return (
                  <Card
                    key={s.id}
                    id={s.id}
                    className={`scroll-mt-24 rounded-2xl border bg-card p-6 sm:p-7 shadow-sm transition-all ${
                      isSelected ? "ring-1 ring-primary/40 border-primary/30" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h2 className="font-display text-lg font-semibold text-foreground">{s.label}</h2>
                          <p className="text-xs text-muted-foreground">{s.summary}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px] uppercase font-semibold tracking-wider">
                        {s.tag}
                      </Badge>
                    </div>

                    <div>{s.content}</div>
                  </Card>
                );
              })
            )}

            {/* Support Help Card */}
            <div className="mt-8 rounded-2xl border bg-muted/30 p-6 text-center space-y-3">
              <h3 className="font-display text-base font-semibold">Need Additional Help?</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                Can't find what you're looking for? Reach out directly to our support team and we'll be happy to assist you
                with your setup and questions.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <a href="mailto:hello@growthos.app">
                  <Button className="rounded-full gradient-brand text-primary-foreground text-xs gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    hello@growthos.app
                  </Button>
                </a>
                <a href="tel:9555702945">
                  <Button variant="outline" className="rounded-full text-xs gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    +91 9555702945
                  </Button>
                </a>
                <Link to="/terms">
                  <Button variant="ghost" className="rounded-full text-xs text-muted-foreground hover:text-foreground">
                    Terms &amp; Conditions
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}