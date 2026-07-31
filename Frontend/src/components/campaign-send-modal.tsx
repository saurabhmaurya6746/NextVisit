import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Search, MessageCircle, ArrowRight, CheckCircle2, SkipForward, RefreshCw, AlertCircle, Play } from "lucide-react";
import { openWhatsApp } from "@/lib/celebration-utils";
import { logWhatsApp } from "@/lib/whatsapp-history";
import { apiFetch } from "@/lib/auth";
import { toast } from "sonner";

export interface SendCustomerItem {
  id: string;
  name: string;
  phone: string;
  status?: string;
  visit_count?: number;
  total_spent?: number;
}

interface CampaignSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignTitle: string;
  campaignType?: string;
  templateMessage: string;
  couponCode?: string;
  discountPercent?: string;
  festivalName?: string;
  customers: SendCustomerItem[];
  onComplete?: () => void;
}

type Stage = "select" | "confirm" | "sending" | "done";

export function CampaignSendModal({
  open,
  onOpenChange,
  campaignId,
  campaignTitle,
  campaignType = "custom",
  templateMessage,
  couponCode = "",
  discountPercent = "",
  festivalName = "",
  customers,
  onComplete,
}: CampaignSendModalProps) {
  const [stage, setStage] = useState<Stage>("select");
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [hasResumeState, setHasResumeState] = useState<boolean>(false);

  const storageKey = `nextvisit_campaign_resume_${campaignId}`;

  // Check for saved resume state in localStorage
  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.selectedIds && parsed.selectedIds.length > 0 && parsed.currentIndex < parsed.selectedIds.length) {
          setHasResumeState(true);
        }
      }
    } catch (e) {
      console.error("Failed to parse campaign resume state", e);
    }
  }, [open, campaignId, storageKey]);

  // Filter visible customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (filter === "new" && c.status !== "New") return false;
      if (filter === "vip" && c.status !== "VIP") return false;
      if (filter === "at_risk" && c.status !== "At Risk") return false;
      if (query) {
        const matchStr = `${c.name} ${c.phone}`.toLowerCase();
        if (!matchStr.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [customers, filter, query]);

  const selectedList = useMemo(() => {
    return customers.filter((c) => selectedIds.has(c.id));
  }, [customers, selectedIds]);

  const currentCustomer = selectedList[currentIndex];

  // Helper to replace placeholders
  function replacePlaceholders(txt: string, cust?: SendCustomerItem) {
    if (!cust) return txt;
    const firstName = cust.name ? cust.name.split(" ")[0] : "Valued Guest";
    const discClean = discountPercent ? (discountPercent.includes("%") ? discountPercent : `${discountPercent}%`) : "Special";

    return txt
      .replace(/\{name\}/gi, firstName)
      .replace(/\{customer_name\}/gi, cust.name || firstName)
      .replace(/\{coupon\}/gi, couponCode || "SPECIAL")
      .replace(/\{discount\}/gi, discClean)
      .replace(/\{festival\}/gi, festivalName || "Festival");
  }

  // Toggle customer selection
  function toggleCustomer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredCustomers.forEach((c) => next.add(c.id));
      return next;
    });
  }

  function handleResume() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSelectedIds(new Set(parsed.selectedIds || []));
        setSentIds(new Set(parsed.sentIds || []));
        setSkippedIds(new Set(parsed.skippedIds || []));
        setCurrentIndex(parsed.currentIndex || 0);
        setStage("sending");
        toast.info(`Resumed campaign at customer #${(parsed.currentIndex || 0) + 1}`);
      }
    } catch (e) {
      toast.error("Failed to resume campaign");
    }
  }

  function clearResumeState() {
    localStorage.removeItem(storageKey);
    setHasResumeState(false);
  }

  function saveProgress(nextIndex: number, newSent: Set<string>, newSkipped: Set<string>) {
    try {
      const stateObj = {
        campaignId,
        selectedIds: Array.from(selectedIds),
        sentIds: Array.from(newSent),
        skippedIds: Array.from(newSkipped),
        currentIndex: nextIndex,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(stateObj));
    } catch (e) {
      console.error("Failed to save progress", e);
    }
  }

  // Backend log tracking helper
  async function logToBackend(customerId: string, status: "SENT" | "SKIPPED" | "FAILED", msg: string) {
    try {
      await apiFetch("/api/v1/campaign-logs", {
        method: "POST",
        body: JSON.stringify({
          campaign_id: campaignId.length > 20 ? campaignId : null,
          customer_id: customerId,
          campaign_type: campaignType,
          status: status,
          message: msg,
        }),
      });
    } catch (e) {
      console.warn("Backend log save warning:", e);
    }
  }

  // Action: Open WhatsApp
  function handleOpenWhatsApp() {
    if (!currentCustomer) return;
    const formattedMsg = replacePlaceholders(templateMessage, currentCustomer);
    openWhatsApp(currentCustomer.phone, formattedMsg);
    logWhatsApp({ customerId: currentCustomer.id, kind: "campaign", message: formattedMsg });
  }

  // Action: Mark Sent & Advance
  function handleMarkSent() {
    if (!currentCustomer) return;
    const formattedMsg = replacePlaceholders(templateMessage, currentCustomer);
    const newSent = new Set(sentIds).add(currentCustomer.id);
    setSentIds(newSent);

    logToBackend(currentCustomer.id, "SENT", formattedMsg);

    const nextIdx = currentIndex + 1;
    saveProgress(nextIdx, newSent, skippedIds);

    if (nextIdx >= selectedList.length) {
      clearResumeState();
      setStage("done");
      if (onComplete) onComplete();
    } else {
      setCurrentIndex(nextIdx);
      setTimeout(() => {
        const nextCust = selectedList[nextIdx];
        if (nextCust) {
          const msg = replacePlaceholders(templateMessage, nextCust);
          openWhatsApp(nextCust.phone, msg);
          logWhatsApp({ customerId: nextCust.id, kind: "campaign", message: msg });
        }
      }, 300);
    }
  }

  // Action: Skip Customer
  function handleSkip() {
    if (!currentCustomer) return;
    const newSkipped = new Set(skippedIds).add(currentCustomer.id);
    setSkippedIds(newSkipped);

    logToBackend(currentCustomer.id, "SKIPPED", "Skipped by merchant");

    const nextIdx = currentIndex + 1;
    saveProgress(nextIdx, sentIds, newSkipped);

    if (nextIdx >= selectedList.length) {
      clearResumeState();
      setStage("done");
    } else {
      setCurrentIndex(nextIdx);
    }
  }

  function handleReset() {
    setStage("select");
    setFilter("all");
    setQuery("");
    setSelectedIds(new Set());
    setSentIds(new Set());
    setSkippedIds(new Set());
    setCurrentIndex(0);
  }

  function handleClose() {
    if (stage === "sending" && currentIndex < selectedList.length) {
      saveProgress(currentIndex, sentIds, skippedIds);
      toast.info("Campaign progress saved. You can resume anytime!");
    }
    onOpenChange(false);
  }

  const totalRecipients = selectedList.length;
  const progressPercent = totalRecipients > 0 ? Math.round(((sentIds.size + skippedIds.size) / totalRecipients) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg rounded-2xl border bg-card shadow-2xl">
        {/* RESUME CAMPAIGN BANNER */}
        {hasResumeState && stage === "select" && (
          <div className="mb-2 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-primary shrink-0 animate-pulse" />
              <div>
                <p className="font-semibold text-primary">Unfinished Campaign Found!</p>
                <p className="text-muted-foreground text-[11px]">Resume previous sending queue right where you left off.</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-full" onClick={clearResumeState}>
                Dismiss
              </Button>
              <Button size="sm" className="h-7 text-[10px] rounded-full bg-primary text-primary-foreground font-semibold" onClick={handleResume}>
                Resume Now
              </Button>
            </div>
          </div>
        )}

        {/* STAGE 1: CUSTOMER SELECTION */}
        {stage === "select" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-lg">{campaignTitle} — Select Recipients</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-1 text-xs">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "All Customers" },
                  { id: "new", label: "New Customers" },
                  { id: "vip", label: "VIP Guests" },
                  { id: "at_risk", label: "At Risk" },
                ].map((f) => (
                  <Button
                    key={f.id}
                    variant={filter === f.id ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-[11px] rounded-full"
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8 text-xs h-8 rounded-xl"
                  placeholder="Search customer name or phone…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-muted-foreground font-medium">
                  {filteredCustomers.length} matching · <strong className="text-primary">{selectedIds.size} selected</strong>
                </span>
                <Button variant="ghost" size="sm" className="h-6 text-[11px] text-primary" onClick={selectAllVisible}>
                  Select all visible
                </Button>
              </div>

              <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
                {filteredCustomers.map((c) => (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-2.5 transition-all ${
                      selectedIds.has(c.id) ? "border-primary/40 bg-primary/5" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleCustomer(c.id)} />
                      <div>
                        <p className="font-semibold text-xs">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground">{c.phone}</p>
                      </div>
                    </div>
                    {c.status && (
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        {c.status}
                      </Badge>
                    )}
                  </label>
                ))}
                {filteredCustomers.length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground">No matching customers found.</div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2 sm:justify-between">
              <Button variant="ghost" className="rounded-full text-xs" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                className="rounded-full bg-primary text-primary-foreground text-xs font-semibold px-5"
                disabled={selectedIds.size === 0}
                onClick={() => setStage("confirm")}
              >
                Continue ({selectedIds.size} selected) <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STAGE 2: PREVIEW & CONFIRM */}
        {stage === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-lg">Campaign Preview & Confirm</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-1 text-xs">
              <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
                <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                  <span>Target Audience: <strong>{selectedList.length} Customers</strong></span>
                  {couponCode && <Badge variant="secondary" className="font-mono text-[10px]">{couponCode}</Badge>}
                </div>
                <div className="rounded-lg bg-card p-3 border text-xs font-mono whitespace-pre-wrap leading-relaxed">
                  {replacePlaceholders(templateMessage, selectedList[0])}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>WhatsApp will open for each customer. Send the message, then return here to log status!</span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-between pt-2">
              <Button variant="outline" className="rounded-full text-xs" onClick={() => setStage("select")}>
                Back
              </Button>
              <Button
                className="rounded-full bg-primary text-primary-foreground text-xs font-semibold px-5"
                onClick={() => {
                  setStage("sending");
                  setCurrentIndex(0);
                  handleOpenWhatsApp();
                }}
              >
                <MessageCircle className="mr-1.5 h-4 w-4" /> Start WhatsApp Flow ({selectedList.length})
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STAGE 3: STEP-BY-STEP SENDING QUEUE */}
        {stage === "sending" && currentCustomer && (
          <>
            <DialogHeader>
              <div className="flex justify-between items-center">
                <DialogTitle className="font-display text-base">
                  Sending {currentIndex + 1} of {totalRecipients}
                </DialogTitle>
                <Badge variant="outline" className="rounded-full font-mono text-[10px]">
                  {progressPercent}% Complete
                </Badge>
              </div>
            </DialogHeader>

            {/* LIVE PROGRESS BAR */}
            <div className="space-y-1.5 py-1">
              <Progress value={progressPercent} className="h-2 rounded-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Sent: <strong className="text-emerald-600 dark:text-emerald-400">{sentIds.size}</strong></span>
                <span>Skipped: <strong className="text-amber-600 dark:text-amber-400">{skippedIds.size}</strong></span>
                <span>Remaining: <strong>{totalRecipients - (sentIds.size + skippedIds.size)}</strong></span>
              </div>
            </div>

            {/* CURRENT CUSTOMER CARD & PREVIEW */}
            <div className="rounded-xl border p-3.5 bg-card space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-display font-semibold text-sm">{currentCustomer.name}</h4>
                  <p className="text-xs text-muted-foreground font-mono">{currentCustomer.phone}</p>
                </div>
                {currentCustomer.status && (
                  <Badge className="rounded-full text-[10px] bg-primary/10 text-primary border-primary/20">
                    {currentCustomer.status}
                  </Badge>
                )}
              </div>

              <div className="relative rounded-xl border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-[160px] overflow-y-auto">
                {replacePlaceholders(templateMessage, currentCustomer)}
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={handleOpenWhatsApp}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Re-open WA
              </Button>
              <Button variant="secondary" size="sm" className="rounded-xl text-xs text-amber-600 dark:text-amber-400" onClick={handleSkip}>
                <SkipForward className="mr-1 h-3.5 w-3.5" /> Skip
              </Button>
              <Button size="sm" className="rounded-xl text-xs bg-emerald-600 text-white hover:bg-emerald-700 font-semibold" onClick={handleMarkSent}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Sent & Next
              </Button>
            </div>
          </>
        )}

        {/* STAGE 4: COMPLETED SUMMARY */}
        {stage === "done" && (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center font-display text-lg">Campaign Completed!</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3 py-3 text-center">
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Recipients</p>
                <p className="font-display text-xl font-bold">{totalRecipients}</p>
              </div>
              <div className="rounded-xl border bg-emerald-500/10 border-emerald-500/20 p-3 text-emerald-600 dark:text-emerald-400">
                <p className="text-[10px] uppercase font-medium">Successfully Sent</p>
                <p className="font-display text-xl font-bold">{sentIds.size}</p>
              </div>
              <div className="rounded-xl border bg-amber-500/10 border-amber-500/20 p-3 text-amber-600 dark:text-amber-400">
                <p className="text-[10px] uppercase font-medium">Skipped</p>
                <p className="font-display text-xl font-bold">{skippedIds.size}</p>
              </div>
            </div>

            <DialogFooter>
              <Button className="w-full rounded-full bg-primary text-primary-foreground text-xs font-semibold" onClick={() => onOpenChange(false)}>
                Done & Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
