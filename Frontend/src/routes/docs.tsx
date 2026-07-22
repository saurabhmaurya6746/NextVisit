import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, BookOpen, LayoutDashboard, ShoppingBag, QrCode, Users, Megaphone, Ticket, Trophy, BarChart3, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/docs")({
  head: () => ({ meta: [
    { title: "Docs — NextVisit" },
    { name: "description", content: "Everything you need to run NextVisit: getting started, orders, QR ordering, customers, campaigns and more." },
  ] }),
  component: DocsPage,
});

const sections = [
  { id: "getting-started", label: "Getting Started", icon: BookOpen, body: "Create your account, wait for admin approval, then complete onboarding. Set up your business profile, invite your team, and add your first customers." },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, body: "The dashboard summarizes today's sales, active tables/appointments, pending tasks, and celebrations. Every card is clickable and drills into a filtered view." },
  { id: "orders", label: "Orders", icon: ShoppingBag, body: "Manage staff orders and QR orders in one workspace. Track order status (Pending / Completed) separately from payment status (Unpaid / Paid)." },
  { id: "qr-ordering", label: "QR Ordering", icon: QrCode, body: "Print a QR per table. Customers scan, browse the menu, and place orders that link to the active table session. Notifications ring for every incoming order." },
  { id: "customers", label: "Customers", icon: Users, body: "Every customer gets a profile with visits, favorites, coupons, WhatsApp history and AI insights. Phone number is the unique key." },
  { id: "campaigns", label: "Campaigns", icon: Megaphone, body: "Automate birthdays, anniversaries, welcome messages, festivals, VIP and lost-customer recovery. Send to all or a custom segment." },
  { id: "coupons", label: "Coupons", icon: Ticket, body: "Create percent, flat, BOGO or free-item coupons. Track redemption in real time from the coupons page." },
  { id: "loyalty", label: "Loyalty", icon: Trophy, body: "Configure points per ₹100 spent, signup and birthday bonuses, redemption limits and expiry. Points award automatically on paid orders." },
  { id: "reports", label: "Reports", icon: BarChart3, body: "Revenue by day/week/month/year, source (QR vs staff), payment method, and top items. Export to CSV coming soon." },
  { id: "faqs", label: "FAQs", icon: HelpCircle, body: "Answers to the most common questions about billing, trials, approvals, and integrations." },
];

function DocsPage() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(sections[0].id);
  const filtered = useMemo(() => sections.filter((s) => (s.label + " " + s.body).toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-12">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Docs</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">NextVisit documentation</h1>
          <p className="mt-3 text-muted-foreground">Learn how to run every part of NextVisit.</p>
          <div className="relative mt-6 max-w-lg">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search the docs…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </div>
        <div className="mt-10 grid gap-8 lg:grid-cols-[220px_1fr]">
          <aside className="lg:sticky lg:top-6 lg:h-fit">
            <nav className="space-y-1">
              {filtered.map((s) => (
                <button key={s.id} onClick={() => setActive(s.id)} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left hover:bg-muted", active === s.id && "bg-muted font-medium text-foreground")}>
                  <s.icon className="h-4 w-4 text-muted-foreground" /> {s.label}
                </button>
              ))}
              {filtered.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No matches.</p>}
            </nav>
          </aside>
          <div className="space-y-6">
            {(filtered.length ? filtered : sections).map((s) => (
              <Card key={s.id} id={s.id} className="rounded-2xl p-6">
                <div className="flex items-center gap-2"><s.icon className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-semibold">{s.label}</h2></div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}