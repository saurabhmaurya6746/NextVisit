import { AppLink } from "@/lib/app-nav";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Gift, MessageCircle, Percent, ArrowRight, UserMinus } from "lucide-react";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/page-transition";
import { useActiveCustomers } from "@/lib/archive-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/$type/$business/customer-recovery")({ component: RecoveryPage });

const DEMO_TODAY = new Date("2026-07-17T00:00:00");
function daysSince(iso: string) {
  return Math.floor((DEMO_TODAY.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

const buckets = [
  { key: 15, title: "15 Days", tone: "from-primary/25 to-primary/5 text-primary" },
  { key: 30, title: "30 Days", tone: "from-warning/25 to-warning/5 text-warning-foreground" },
  { key: 45, title: "45 Days", tone: "from-accent/25 to-accent/5 text-accent-foreground" },
  { key: 60, title: "60 Days", tone: "from-info/25 to-info/5 text-info" },
  { key: 90, title: "90 Days", tone: "from-destructive/25 to-destructive/5 text-destructive" },
] as const;

function RecoveryPage() {
  const active = useActiveCustomers();
  const counts = {
    15: active.filter((c) => { const d = daysSince(c.lastVisit); return d >= 15 && d < 30; }).length,
    30: active.filter((c) => { const d = daysSince(c.lastVisit); return d >= 30 && d < 60; }).length,
    45: active.filter((c) => { const d = daysSince(c.lastVisit); return d >= 45 && d < 60; }).length,
    60: active.filter((c) => { const d = daysSince(c.lastVisit); return d >= 60 && d < 90; }).length,
    90: active.filter((c) => daysSince(c.lastVisit) >= 90).length,
  } as Record<number, number>;
  return (
    <PageTransition>
      <PageHeader title="Lost customer recovery" description="Bring dormant guests back with the right nudge at the right time." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {buckets.map((b, i) => (
          <motion.div key={b.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ scale: 1.02 }}>
            <AppLink path="customer-recovery/$days" params={{ days: String(b.key) }} className="block">
              <Card className="group relative overflow-hidden rounded-2xl p-5 shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-glow">
                <div className={cn("pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br opacity-70 blur-2xl", b.tone)} />
                <div className="relative">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Not visited for</p>
                  <p className="mt-2 font-display text-3xl font-semibold">{b.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{counts[b.key]} customer{counts[b.key] === 1 ? "" : "s"}</p>
                  <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    View list <ArrowRight className="h-3 w-3" />
                  </p>
                </div>
              </Card>
            </AppLink>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => toast.success("Come-back offer sent to bucket")}><RefreshCw className="mr-1.5 h-4 w-4" /> Send come-back offer</Button>
        <Button variant="outline" className="rounded-full" onClick={() => toast.success("15% discount sent")}><Percent className="mr-1.5 h-4 w-4" /> Send 15% discount</Button>
        <Button variant="outline" className="rounded-full" onClick={() => toast.success("Free dessert coupons sent")}><Gift className="mr-1.5 h-4 w-4" /> Send free dessert</Button>
        <Button variant="outline" className="rounded-full" onClick={() => toast.success("WhatsApp broadcast queued")}><MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp all</Button>
      </div>

      <p className="mt-6 text-sm text-muted-foreground inline-flex items-center gap-1.5"><UserMinus className="h-3.5 w-3.5" /> Click a bucket above to see who's slipping away and reach out one-by-one.</p>
    </PageTransition>
  );
}