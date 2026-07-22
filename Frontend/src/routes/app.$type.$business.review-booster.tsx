import { AppLink } from "@/lib/app-nav";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Star, Send, MessageCircle, Sparkles, Phone, Archive, Copy } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useReviewRows, setReviewStatus, customerFor, type ReviewStatus } from "@/lib/review-store";
import { useArchivedIds, archiveCustomer } from "@/lib/archive-store";
import { logWhatsApp } from "@/lib/whatsapp-history";
import { openWhatsApp } from "@/lib/celebration-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/$type/$business/review-booster")({ component: ReviewsPage });

const REVIEW_LINK = "https://g.page/r/aroma-bistro/review";

type DateFilter = "today" | "yesterday" | "7d" | "month" | "all";

const DEMO_TODAY = new Date("2026-07-17T00:00:00");

function inFilter(iso: string, f: DateFilter, custom: string) {
  const d = new Date(iso);
  if (f === "today") return iso.slice(0, 10) === "2026-07-17";
  if (f === "yesterday") return iso.slice(0, 10) === "2026-07-16";
  if (f === "7d") return (DEMO_TODAY.getTime() - d.getTime()) / 86400000 <= 7;
  if (f === "month") return (DEMO_TODAY.getTime() - d.getTime()) / 86400000 <= 30;
  if (custom) return iso.slice(0, 10) === custom;
  return true;
}

function reviewMessage(name: string) {
  return `Hi ${name.split(" ")[0]}\n\nThank you for visiting our restaurant.\nWe hope you enjoyed your experience.\n\nIf you have one minute, please leave us a Google Review.\n\n⭐⭐⭐⭐⭐\n${REVIEW_LINK}\n\nThank you ❤️`;
}

function ReviewsPage() {
  const rows = useReviewRows();
  const archived = useArchivedIds();
  const [tab, setTab] = useState<ReviewStatus>("pending");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customDate, setCustomDate] = useState("");
  const [opening, setOpening] = useState(false);
  const [aiFor, setAiFor] = useState<any | null>(null);
  const [customMsg, setCustomMsg] = useState<Record<string, string>>({});
  const [toArchive, setToArchive] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (archived.has(r.customerId)) return false;
      if (r.status !== tab) return false;
      return inFilter(r.visitDate, dateFilter, customDate);
    });
  }, [rows, tab, dateFilter, customDate, archived]);

  const counts = {
    pending: rows.filter((r) => !archived.has(r.customerId) && r.status === "pending").length,
    requested: rows.filter((r) => !archived.has(r.customerId) && r.status === "requested").length,
    reviewed: rows.filter((r) => !archived.has(r.customerId) && r.status === "reviewed").length,
  };

  function handleSend(row: (typeof rows)[number]) {
    const c = customerFor(row.customerId);
    if (!c) return;
    const msg = customMsg[row.visitId] ?? reviewMessage(c.name);
    setOpening(true);
    setTimeout(() => {
      openWhatsApp(c.phone, msg);
      logWhatsApp({ customerId: c.id, kind: "review", message: msg });
      setReviewStatus(row.visitId, "requested");
      setOpening(false);
      toast.success("Review request sent — status moved to Requested");
    }, 500);
  }

  return (
    <PageTransition>
      <PageHeader
        title="Review booster"
        description="Every visit today is automatically eligible for a Google review request."
        actions={
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => { navigator.clipboard?.writeText(REVIEW_LINK); toast("Review link copied"); }}
          >
            <Copy className="mr-1.5 h-4 w-4" /> Copy review link
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as ReviewStatus)}>
          <TabsList className="rounded-full">
            <TabsTrigger value="pending" className="rounded-full">Pending <Badge variant="secondary" className="ml-1.5 rounded-full text-[10px]">{counts.pending}</Badge></TabsTrigger>
            <TabsTrigger value="requested" className="rounded-full">Requested <Badge variant="secondary" className="ml-1.5 rounded-full text-[10px]">{counts.requested}</Badge></TabsTrigger>
            <TabsTrigger value="reviewed" className="rounded-full">Reviewed <Badge variant="secondary" className="ml-1.5 rounded-full text-[10px]">{counts.reviewed}</Badge></TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-1.5">
          {(["today", "yesterday", "7d", "month", "all"] as DateFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => { setDateFilter(f); setCustomDate(""); }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                dateFilter === f && !customDate ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "today" ? "Today" : f === "yesterday" ? "Yesterday" : f === "7d" ? "Last 7 days" : f === "month" ? "Last month" : "All"}
            </button>
          ))}
          <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="h-8 w-40 rounded-full text-xs" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={tab === "pending" ? "No pending reviews" : tab === "requested" ? "No requests waiting" : "No reviews yet"}
          description={tab === "pending" ? "Every visit added today lands here automatically." : "Change the filter above to see historic activity."}
          icon={<Star className="h-7 w-7" />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r, i) => {
            const c = customerFor(r.customerId);
            if (!c) return null;
            return (
              <motion.div key={r.visitId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ scale: 1.02 }}>
                <Card className="overflow-hidden rounded-2xl transition-all hover:shadow-glow">
                  <div className="h-1.5 gradient-brand" />
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11"><AvatarFallback className="gradient-brand text-primary-foreground text-sm">{c.initials}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <AppLink path="customers/$id" params={{ id: c.id }} className="truncate font-semibold hover:text-primary block">{c.name}</AppLink>
                        <p className="text-xs text-muted-foreground">{c.phone}</p>
                      </div>
                      <Badge variant="outline" className={cn("rounded-full text-[10px] capitalize", r.status === "reviewed" && "border-success/40 text-success", r.status === "requested" && "border-info/40 text-info")}>{r.status}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-muted/60 p-2"><p className="font-display font-semibold">{r.visitDate.slice(5)}</p><p className="text-[10px] text-muted-foreground">Visit</p></div>
                      <div className="rounded-lg bg-muted/60 p-2"><p className="font-display font-semibold">${r.bill}</p><p className="text-[10px] text-muted-foreground">Bill</p></div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {r.status === "pending" ? (
                        <Button size="sm" className="h-8 rounded-full gradient-brand text-primary-foreground text-xs transition-transform hover:scale-105 active:scale-95" onClick={() => handleSend(r)}>
                          <MessageCircle className="mr-1 h-3 w-3" /> Send Review Request
                        </Button>
                      ) : r.status === "requested" ? (
                        <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => handleSend(r)}>
                          <Send className="mr-1 h-3 w-3" /> Resend
                        </Button>
                      ) : (
                        <Badge className="rounded-full">Reviewed ⭐</Badge>
                      )}
                      {r.status !== "reviewed" && (
                        <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setAiFor({ ...c, visitId: r.visitId })}>
                          <Sparkles className="mr-1 h-3 w-3 text-primary" /> AI Improve
                        </Button>
                      )}
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
            );
          })}
        </div>
      )}

      <Dialog open={opening} onOpenChange={setOpening}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-glow">
              <MessageCircle className="h-7 w-7 animate-pulse" />
            </div>
            <DialogTitle className="text-center font-display">Opening WhatsApp…</DialogTitle>
            <p className="text-center text-sm text-muted-foreground">Your review request is prefilled — press Send inside WhatsApp.</p>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <AiGenerateDialog
        open={!!aiFor}
        onOpenChange={(o) => !o && setAiFor(null)}
        title="AI-improved review request"
        description={aiFor ? `Warmer variant for ${aiFor.name}` : ""}
        generate={() => aiFor ? reviewMessage(aiFor.name) + `\n\n(Tuned for warmth — mentions their recent visit.)` : ""}
        onUse={(m) => {
          if (aiFor) setCustomMsg((p) => ({ ...p, [aiFor.visitId]: m }));
          toast.success("AI message ready — press Send Review Request");
        }}
      />

      <ConfirmDialog
        open={!!toArchive}
        onOpenChange={(o) => !o && setToArchive(null)}
        title="Archive customer?"
        description="They'll be hidden from Review Booster. Nothing is deleted."
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