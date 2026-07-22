import { createFileRoute } from "@tanstack/react-router";
import { AppLink } from "@/lib/app-nav";
import { motion } from "framer-motion";
import { useState } from "react";
import { UserPlus, MessageCircle, Sparkles, Phone, Users, Calendar, CalendarDays, QrCode, Store } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { useActiveCustomers } from "@/lib/archive-store";
import { useOrders, custId } from "@/lib/orders-store";
import { fmt } from "@/lib/currency";
import { openWhatsApp } from "@/lib/celebration-utils";
import { logWhatsApp } from "@/lib/whatsapp-history";
import { toast } from "sonner";
import { Cake, RotateCcw, RefreshCcw } from "lucide-react";

export const Route = createFileRoute("/app/$type/$business/welcome")({ component: WelcomePage });

// Anchored to today for demo, but derived from real Date at render time.
function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function isBirthdayToday(iso?: string) {
  if (!iso) return false;
  const d = new Date(iso); const n = new Date();
  return d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function welcomeMessage(name: string) {
  const first = name.split(" ")[0];
  return `Hi ${first} 👋\nThank you for visiting Aroma Bistro — it was lovely having you!\nHere's a little gift: coupon WELCOME10 for 10% off your next visit.\nWe hope to see you again soon ❤️\n— Aroma Bistro`;
}

type Bucket = "today" | "week" | "month";

function WelcomePage() {
  const active = useActiveCustomers();
  const orders = useOrders();
  const firstTime = active.filter((c) => c.visits <= 2);
  const [tab, setTab] = useState<Bucket>("today");
  const [aiFor, setAiFor] = useState<any | null>(null);
  const [custom, setCustom] = useState<Record<string, string>>({});

  const todayCount = firstTime.filter((c) => daysSince(c.lastVisit) <= 0).length;
  const weekCount = firstTime.filter((c) => daysSince(c.lastVisit) <= 7).length;
  const monthCount = firstTime.filter((c) => daysSince(c.lastVisit) <= 30).length;
  const returningCount = active.filter((c) => c.visits > 1 && daysSince(c.lastVisit) <= 30).length;
  const birthdayTodayCount = active.filter((c) => isBirthdayToday((c as any).birthday)).length;
  const recoveryDueCount = active.filter((c) => daysSince(c.lastVisit) >= 30).length;

  // Recent new customers with source detection from first order
  const recent = [...firstTime].sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()).slice(0, 8);
  function sourceFor(id: string): "QR" | "Staff" | "—" {
    const first = orders.filter((o) => o.customerId === id).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    if (!first) return "—";
    return first.source === "qr" ? "QR" : "Staff";
  }

  const list = firstTime.filter((c) => {
    const d = daysSince(c.lastVisit);
    if (tab === "today") return d <= 0;
    if (tab === "week") return d <= 7;
    return d <= 30;
  });

  function send(c: any) {
    const msg = custom[c.id] ?? welcomeMessage(c.name);
    openWhatsApp(c.phone, msg);
    logWhatsApp({ customerId: c.id, kind: "campaign", message: msg });
    toast.success("Welcome message opened in WhatsApp");
  }

  return (
    <PageTransition>
      <PageHeader title="Welcome campaigns" description="Greet first-visit guests and turn them into regulars." />

      <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Today's new customers", value: todayCount, icon: UserPlus, key: "today" as Bucket },
          { label: "This week", value: weekCount, icon: Calendar, key: "week" as Bucket },
          { label: "This month", value: monthCount, icon: CalendarDays, key: "month" as Bucket },
        ].map((k, i) => (
          <motion.button key={k.label} type="button" onClick={() => setTab(k.key)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileHover={{ scale: 1.02 }}
            className={`rounded-2xl border p-4 text-left transition-all hover:shadow-glow ${tab === k.key ? "border-primary bg-primary/5" : ""}`}>
            <div className="flex items-center justify-between">
              <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand text-primary-foreground"><k.icon className="h-4 w-4" /></div>
              <Badge variant="outline" className="rounded-full text-[10px]">New</Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{k.label}</p>
            <p className="font-display text-2xl font-semibold">{k.value}</p>
          </motion.button>
        ))}
        <InfoCard label="Returning customers" value={returningCount} icon={RefreshCcw} />
        <InfoCard label="Birthdays today" value={birthdayTodayCount} icon={Cake} />
        <InfoCard label="Recovery due" value={recoveryDueCount} icon={RotateCcw} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Bucket)} className="mb-5">
        <TabsList className="rounded-full">
          <TabsTrigger value="today" className="rounded-full">Today's New</TabsTrigger>
          <TabsTrigger value="week" className="rounded-full">This Week</TabsTrigger>
          <TabsTrigger value="month" className="rounded-full">This Month</TabsTrigger>
        </TabsList>
      </Tabs>

      {list.length === 0 ? (
        <EmptyState title="No new customers yet" description="First-visit guests will appear here automatically." icon={<UserPlus className="h-7 w-7" />} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ scale: 1.02 }}>
              <Card className="overflow-hidden rounded-2xl transition-all hover:shadow-glow">
                <div className="h-1.5 gradient-brand" />
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11"><AvatarFallback className="gradient-brand text-primary-foreground text-sm">{c.initials}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <AppLink path="customers/$id" params={{ id: c.id }} className="truncate font-semibold hover:text-primary block">{c.name}</AppLink>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full text-[10px]">New</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-muted/60 p-2"><p className="font-display font-semibold">{c.visits}</p><p className="text-[10px] text-muted-foreground">Visits</p></div>
                    <div className="rounded-lg bg-muted/60 p-2"><p className="font-display font-semibold">{fmt(c.spent)}</p><p className="text-[10px] text-muted-foreground">Spent</p></div>
                    <div className="rounded-lg bg-muted/60 p-2"><p className="font-display font-semibold">{c.lastVisit.slice(5)}</p><p className="text-[10px] text-muted-foreground">First</p></div>
                  </div>
                  <div className="mt-3 max-h-24 overflow-y-auto rounded-xl bg-muted/40 p-2 font-mono text-[11px] whitespace-pre-line">{custom[c.id] ?? welcomeMessage(c.name)}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button size="sm" className="h-8 rounded-full gradient-brand text-primary-foreground text-xs" onClick={() => send(c)}>
                      <MessageCircle className="mr-1 h-3 w-3" /> Send WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setAiFor(c)}>
                      <Sparkles className="mr-1 h-3 w-3 text-primary" /> AI Generate
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => window.open(`tel:${c.phone.replace(/[^\d+]/g, "")}`)}>
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Card className="mt-6 rounded-2xl">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Recent new customers</p>
              <p className="text-xs text-muted-foreground">First-visit guests in order of most recent.</p>
            </div>
          </div>
          {recent.length === 0 ? (
            <EmptyState title="Nobody new yet" description="New customers auto-appear here after their first visit." icon={<UserPlus className="h-7 w-7" />} />
          ) : (
            <div className="divide-y">
              {recent.map((c) => {
                const src = sourceFor(c.id);
                return (
                  <AppLink key={c.id} path="customers/$id" params={{ id: c.id }} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-3 text-sm hover:bg-muted/40 rounded-lg px-2 -mx-2 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-8 w-8"><AvatarFallback className="gradient-brand text-primary-foreground text-xs">{c.initials}</AvatarFallback></Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{custId(c.id)}</p>
                      </div>
                    </div>
                    <span className="hidden sm:inline text-xs text-muted-foreground">{c.phone}</span>
                    <span className="hidden md:inline text-xs text-muted-foreground">{c.lastVisit}</span>
                    <Badge variant="outline" className={`rounded-full text-[10px] ${src === "QR" ? "border-primary/50 text-primary" : ""}`}>
                      {src === "QR" ? <QrCode className="mr-1 h-3 w-3" /> : <Store className="mr-1 h-3 w-3" />}
                      {src}
                    </Badge>
                  </AppLink>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AiGenerateDialog
        open={!!aiFor}
        onOpenChange={(o) => !o && setAiFor(null)}
        title="AI welcome message"
        description={aiFor ? `Personalized for ${aiFor.name}` : ""}
        generate={() => aiFor ? welcomeMessage(aiFor.name) + `\n\nP.S. We noticed you loved ${aiFor.favorites?.[0] || "our menu"} — try it again on us!` : ""}
        onUse={(m) => { if (aiFor) setCustom((p) => ({ ...p, [aiFor.id]: m })); toast.success("AI message ready"); }}
      />
    </PageTransition>
  );
}

function InfoCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border p-4 transition-all hover:shadow-glow">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-primary"><Icon className="h-4 w-4" /></div>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
    </motion.div>
  );
}