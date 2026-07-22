import { AppLink } from "@/lib/app-nav";
import { motion } from "framer-motion";
import { Cake, Gift, Phone, MessageCircle, Send, Bell, Sparkles, Edit } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageTransition } from "@/components/page-transition";
import { logWhatsApp } from "@/lib/whatsapp-history";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  couponFor,
  formatDateLabel,
  getCelebrants,
  groupByDate,
  messageFor,
  openWhatsApp,
  type Bucket,
  type Kind,
} from "@/lib/celebration-utils";

interface Props {
  kind: Kind;
  bucket: Bucket;
}

export function CelebrationDetailPage({ kind, bucket }: Props) {
  const [opening, setOpening] = useState(false);
  const [customMessages, setCustomMessages] = useState<Record<string, string>>({});
  const isBday = kind === "birthday";
  const emoji = isBday ? "🎂" : "❤️";
  const list = getCelebrants(kind, bucket);

  const titleMap = {
    today: isBday ? "Today's Birthdays" : "Today's Anniversaries",
    tomorrow: isBday ? "Tomorrow's Birthdays" : "Tomorrow's Anniversaries",
    week: isBday ? "This Week Birthdays" : "This Week Anniversaries",
    month: isBday ? "This Month Birthdays" : "This Month Anniversaries",
  } as const;
  const descMap = {
    today: `${emoji} Reach out to ${list.length} guest${list.length === 1 ? "" : "s"} celebrating today.`,
    tomorrow: `${emoji} Prepare tomorrow's outreach — ${list.length} guest${list.length === 1 ? "" : "s"}.`,
    week: `${emoji} ${list.length} guest${list.length === 1 ? "" : "s"} in the next 7 days.`,
    month: `${emoji} ${list.length} guest${list.length === 1 ? "" : "s"} in the next 30 days.`,
  } as const;

  const backHref = isBday ? "/app/birthdays" : "/app/anniversaries";

  function handleSend(c: any) {
    setOpening(true);
    const msg = customMessages[c.id] ?? messageFor(kind, c.name);
    setTimeout(() => {
      openWhatsApp(c.phone, msg);
      logWhatsApp({ customerId: c.id, kind, message: msg });
      setOpening(false);
    }, 650);
  }

  const grouped = bucket === "week" || bucket === "month" ? groupByDate(list, kind) : [[null, list] as const];

  return (
    <PageTransition>
      <PageHeader
        title={titleMap[bucket]}
        description={descMap[bucket]}
        actions={
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to={backHref}>← Back to campaigns</Link>
          </Button>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          title={isBday ? "No birthdays today" : "No anniversaries today"}
          description="Check back soon — new customers are added every day."
          icon={isBday ? <Cake className="h-7 w-7" /> : <Gift className="h-7 w-7" />}
        />
      ) : (
        <div className="space-y-8">
          {grouped.map(([dateKey, group]) => (
            <div key={dateKey ?? "all"}>
              {dateKey && (
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="font-display text-lg font-semibold">{formatDateLabel(dateKey)}</h2>
                  <div className="h-px flex-1 bg-border" />
                  <Badge variant="outline" className="rounded-full">{group.length} guest{group.length === 1 ? "" : "s"}</Badge>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((c, i) => (
                  <CelebrantCard
                    key={c.id}
                    c={c}
                    index={i}
                    kind={kind}
                    bucket={bucket}
                    customMessage={customMessages[c.id]}
                    onSetMessage={(m) => setCustomMessages((prev) => ({ ...prev, [c.id]: m }))}
                    onSend={() => handleSend(c)}
                  />
                ))}
              </div>
            </div>
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
            <p className="text-center text-sm text-muted-foreground">Your message is prefilled — just press Send inside WhatsApp.</p>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}

function CelebrantCard({
  c,
  index,
  kind,
  bucket,
  customMessage,
  onSetMessage,
  onSend,
}: {
  c: any;
  index: number;
  kind: Kind;
  bucket: Bucket;
  customMessage?: string;
  onSetMessage: (m: string) => void;
  onSend: () => void;
}) {
  const isBday = kind === "birthday";
  const emoji = isBday ? "🎂" : "❤️";
  const code = couponFor(kind);
  const preview = customMessage ?? messageFor(kind, c.name);
  const disabled = bucket === "tomorrow";
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ scale: 1.02 }}
    >
      <Card className="overflow-hidden rounded-2xl transition-all duration-200 hover:shadow-glow">
        <div className="h-1.5 gradient-brand" />
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12"><AvatarFallback className="gradient-brand text-primary-foreground">{c.initials}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <AppLink path="customers/$id" params={{ id: c.id }} className="truncate font-semibold hover:text-primary block">{c.name}</AppLink>
              <p className="text-xs text-muted-foreground">{c.phone}</p>
            </div>
            <Badge variant="outline" className="rounded-full text-[10px]">{code}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-muted/60 p-2"><p className="font-display font-semibold">{c.visits}</p><p className="text-[10px] text-muted-foreground">Visits</p></div>
            <div className="rounded-lg bg-muted/60 p-2"><p className="font-display font-semibold">${c.spent}</p><p className="text-[10px] text-muted-foreground">Spent</p></div>
            <div className="rounded-lg bg-muted/60 p-2"><p className="font-display font-semibold">{c.lastVisit.slice(5)}</p><p className="text-[10px] text-muted-foreground">Last</p></div>
          </div>
          <p className="mt-2 truncate text-xs text-muted-foreground"><span className="text-foreground/70">Favorite:</span> {c.favorites?.[0] || "—"}</p>
          <div className="mt-4 max-h-28 overflow-y-auto rounded-xl bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-line">
            {preview}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {disabled ? (
              <>
                <Button size="sm" disabled variant="secondary" className="h-8 rounded-full text-xs opacity-70">
                  Available Tomorrow
                </Button>
                <Button size="sm" variant="outline" className="h-8 rounded-full text-xs transition-transform active:scale-95" onClick={() => toast.success(`Reminder set for ${c.name}`)}>
                  <Bell className="mr-1 h-3 w-3" /> Schedule Reminder
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  className="h-8 rounded-full gradient-brand text-primary-foreground text-xs transition-transform hover:scale-105 active:scale-95"
                  onClick={onSend}
                >
                  {emoji} Send WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full text-xs transition-transform active:scale-95"
                  onClick={() => setAiOpen(true)}
                >
                  <Sparkles className="mr-1 h-3 w-3 text-primary" /> AI Generate
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full text-xs transition-transform active:scale-95"
              onClick={() => toast.success(`Coupon ${code} sent to ${c.name}`)}
            >
              <Gift className="mr-1 h-3 w-3" /> Send Coupon
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full"
              onClick={() => window.open(`tel:${c.phone.replace(/[^\d+]/g, "")}`)}
            >
              <Phone className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full"
              onClick={() => toast("Edit dialog (demo)")}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
      <AiGenerateDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        title={isBday ? "AI birthday wish" : "AI anniversary wish"}
        description={`Personalized for ${c.name} · ${c.visits} visits · $${c.spent} spent · last visit ${c.lastVisit}`}
        generate={() => aiCelebrationDraft(kind, c, code)}
        onUse={(m) => {
          onSetMessage(m);
          toast.success("AI message ready — press Send WhatsApp");
        }}
        useLabel="Use this message"
      />
    </motion.div>
  );
}

function aiCelebrationDraft(kind: Kind, c: any, code: string) {
  const first = c.name.split(" ")[0];
  if (kind === "birthday") {
    return `Happy Birthday, ${first}! 🎂\n\nWe still remember your last visit on ${c.lastVisit} — it's guests like you (${c.visits} visits and counting) who make our day.\n\nA little birthday gift from all of us: coupon ${code} unlocks a FREE dessert on your next visit.\n\nWishing you an amazing year ahead ❤️\n— Aroma Bistro`;
  }
  return `Cheers to another wonderful year, ${first} ❤️\n\nThank you for ${c.visits} visits and every memory in between. You mean a lot to our little family here.\n\nCelebrate with us — coupon ${code} takes 25% off your favourite table.\n\nSee you soon,\n— Aroma Bistro`;
}

export { Send };