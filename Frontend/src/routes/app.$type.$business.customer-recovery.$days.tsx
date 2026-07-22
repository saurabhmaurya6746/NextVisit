import { AppLink } from "@/lib/app-nav";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { UserMinus, MessageCircle, Sparkles, Phone, Archive } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useActiveCustomers, archiveCustomer } from "@/lib/archive-store";
import { openWhatsApp } from "@/lib/celebration-utils";
import { logWhatsApp } from "@/lib/whatsapp-history";
import { toast } from "sonner";

const DEMO_TODAY = new Date("2026-07-17T00:00:00");
function daysSince(iso: string) {
  return Math.floor((DEMO_TODAY.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

const validDays = new Set(["15", "30", "45", "60", "90"]);

export const Route = createFileRoute("/app/$type/$business/customer-recovery/$days")({
  loader: ({ params }) => {
    if (!validDays.has(params.days)) throw notFound();
    return { days: Number(params.days) };
  },
  component: RecoveryBucket,
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">
      Bucket not found. <AppLink path="customer-recovery" className="text-primary">Back to recovery</AppLink>
    </div>
  ),
});

function offerFor(days: number) {
  if (days >= 90) return "20% off + free dessert";
  if (days >= 60) return "15% off next visit";
  if (days >= 45) return "10% off + free drink";
  if (days >= 30) return "Free dessert on us";
  return "Free drink on us";
}

function RecoveryBucket() {
  const { days } = Route.useLoaderData();
  const active = useActiveCustomers();
  const list = active
    .map((c) => ({ c, since: daysSince(c.lastVisit) }))
    .filter(({ since }) => {
      if (days === 15) return since >= 15 && since < 30;
      if (days === 30) return since >= 30 && since < 45;
      if (days === 45) return since >= 45 && since < 60;
      if (days === 60) return since >= 60 && since < 90;
      return since >= 90;
    })
    .sort((a, b) => b.since - a.since);

  const [opening, setOpening] = useState(false);
  const [aiFor, setAiFor] = useState<any | null>(null);
  const [customMsg, setCustomMsg] = useState<Record<string, string>>({});
  const [toArchive, setToArchive] = useState<string | null>(null);

  function messageFor(c: any) {
    const first = c.name.split(" ")[0];
    return `Hi ${first}, we miss you! 💜\nIt's been ${daysSince(c.lastVisit)} days since your last visit. Here's ${offerFor(days).toLowerCase()} — coupon COMEBACK15 — on us.\nWe'd love to have you back at Aroma Bistro.`;
  }

  function handleSend(c: any) {
    setOpening(true);
    const msg = customMsg[c.id] ?? messageFor(c);
    setTimeout(() => {
      openWhatsApp(c.phone, msg);
      logWhatsApp({ customerId: c.id, kind: "recovery", message: msg });
      setOpening(false);
    }, 500);
  }

  return (
    <PageTransition>
      <AppLink path="customer-recovery" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">← All recovery buckets</AppLink>
      <PageHeader
        title={`Customers not visited for ${days} days`}
        description={`${list.length} customer${list.length === 1 ? "" : "s"} at risk. Suggested offer: ${offerFor(days)}.`}
      />

      {list.length === 0 ? (
        <EmptyState title="No recovery customers" description={`No customers matching the ${days}-day window right now — nice work!`} icon={<UserMinus className="h-7 w-7" />} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(({ c, since }, i) => (
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
                    <Badge variant="outline" className="rounded-full text-[10px]">{c.status}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                    <Metric label="Last" value={c.lastVisit.slice(5)} />
                    <Metric label="Days" value={since} />
                    <Metric label="Visits" value={c.visits} />
                    <Metric label="Spent" value={`$${c.spent}`} />
                  </div>
                  <div className="mt-3 rounded-xl bg-muted/40 p-2 text-xs">
                    <span className="text-muted-foreground">Suggested offer:</span> <span className="font-medium">{offerFor(days)}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Button size="sm" className="h-8 rounded-full gradient-brand text-primary-foreground text-xs transition-transform hover:scale-105 active:scale-95" onClick={() => handleSend(c)}>
                      <MessageCircle className="mr-1 h-3 w-3" /> Send WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setAiFor(c)}>
                      <Sparkles className="mr-1 h-3 w-3 text-primary" /> AI Generate
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => window.open(`tel:${c.phone.replace(/[^\d+]/g, "")}`)}>
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive" onClick={() => setToArchive(c.id)}>
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={opening} onOpenChange={setOpening}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-glow">
              <MessageCircle className="h-7 w-7 animate-pulse" />
            </div>
            <DialogTitle className="text-center font-display">Opening WhatsApp…</DialogTitle>
            <p className="text-center text-sm text-muted-foreground">Your comeback message is prefilled.</p>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <AiGenerateDialog
        open={!!aiFor}
        onOpenChange={(o) => !o && setAiFor(null)}
        title="AI comeback offer"
        description={aiFor ? `Personalized for ${aiFor.name} · last visit ${aiFor.lastVisit}` : ""}
        generate={() => aiFor ? messageFor(aiFor) + "\n\n(AI-tuned tone: warm & inviting)" : ""}
        onUse={(m) => {
          if (aiFor) setCustomMsg((p) => ({ ...p, [aiFor.id]: m }));
          toast.success("AI message ready — press Send WhatsApp");
        }}
      />

      <ConfirmDialog
        open={!!toArchive}
        onOpenChange={(o) => !o && setToArchive(null)}
        title="Archive customer?"
        description="They'll be removed from active recovery lists. Nothing is deleted."
        confirmLabel="Archive"
        destructive
        onConfirm={() => {
          if (toArchive) { archiveCustomer(toArchive); toast.success("Customer archived"); }
          setToArchive(null);
        }}
      />
    </PageTransition>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg bg-muted/60 p-2">
      <p className="font-display text-sm font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
