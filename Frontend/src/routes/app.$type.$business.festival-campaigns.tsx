import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, MessageCircle, Save, PartyPopper, Plus, Trash2, ArrowRight, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageTransition } from "@/components/page-transition";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useFestivals, saveFestival, addFestival, deleteFestival, type Festival } from "@/lib/festivals-store";
import { useActiveCustomers } from "@/lib/archive-store";
import { openWhatsApp, getCelebrants } from "@/lib/celebration-utils";
import { logWhatsApp } from "@/lib/whatsapp-history";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$type/$business/festival-campaigns")({ component: FestivalsPage });

type Filter = "all" | "new" | "vip" | "birthday" | "inactive";

function FestivalsPage() {
  const festivals = useFestivals();
  const active = useActiveCustomers();
  const [aiFor, setAiFor] = useState<Festival | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteFor, setDeleteFor] = useState<Festival | null>(null);
  const [sendFor, setSendFor] = useState<Festival | null>(null);

  function templateFor(f: Festival) {
    return drafts[f.id] ?? f.template;
  }

  function save(f: Festival) {
    saveFestival({ ...f, template: templateFor(f) });
    toast.success(`${f.name} template saved`);
  }

  return (
    <PageTransition>
      <PageHeader
        title="Festival campaigns"
        description="Editable festival templates — send with one tap when the day arrives."
        actions={
          <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add New Campaign
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {festivals.map((f, i) => (
          <motion.div key={f.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="overflow-hidden rounded-2xl transition-all hover:shadow-glow">
              <div className="h-1.5 gradient-brand" />
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{f.emoji}</span>
                    <div>
                      <p className="font-display text-lg font-semibold">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.date}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full font-mono text-[10px]">{f.coupon}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    className="rounded-full text-xs"
                    defaultValue={f.date}
                    onChange={(e) => saveFestival({ ...f, date: e.target.value })}
                    placeholder="MM-DD"
                  />
                  <Input
                    className="rounded-full text-xs"
                    defaultValue={f.coupon}
                    onChange={(e) => saveFestival({ ...f, coupon: e.target.value })}
                    placeholder="Coupon code"
                  />
                </div>
                <Textarea
                  rows={5}
                  className="font-mono text-xs"
                  value={templateFor(f)}
                  onChange={(e) => setDrafts((p) => ({ ...p, [f.id]: e.target.value }))}
                  placeholder="Use {name} to insert the customer's first name."
                />
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" className="h-8 rounded-full gradient-brand text-primary-foreground text-xs" onClick={() => setSendFor(f)}>
                    <MessageCircle className="mr-1 h-3 w-3" /> Send WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setAiFor(f)}>
                    <Sparkles className="mr-1 h-3 w-3 text-primary" /> AI Generate
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => save(f)}>
                    <Save className="mr-1 h-3 w-3" /> Save template
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 rounded-full text-xs text-rose-600 hover:text-rose-700" onClick={() => setDeleteFor(f)}>
                    <Trash2 className="mr-1 h-3 w-3" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <p className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <PartyPopper className="h-3.5 w-3.5" /> Templates support the {"{name}"} placeholder for personalization.
      </p>

      <AiGenerateDialog
        open={!!aiFor}
        onOpenChange={(o) => !o && setAiFor(null)}
        title="AI festival message"
        description={aiFor ? `Personalized for ${aiFor.name}` : ""}
        generate={() => aiFor ? `${aiFor.emoji} Wishing you a joyful ${aiFor.name}, {name}!\nCelebrate with us at Aroma Bistro — use code ${aiFor.coupon} for a special treat.\nWe can't wait to see you ❤️` : ""}
        onUse={(m) => { if (aiFor) { setDrafts((p) => ({ ...p, [aiFor.id]: m })); toast.success("AI template ready — Save to persist"); } }}
      />

      <CreateCampaignDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmDialog
        open={!!deleteFor}
        onOpenChange={(o) => !o && setDeleteFor(null)}
        title={`Delete ${deleteFor?.name || "campaign"}?`}
        description="This will permanently remove the campaign template."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteFor) { deleteFestival(deleteFor.id); toast.success("Campaign deleted"); setDeleteFor(null); } }}
      />

      <SendCampaignFlow
        festival={sendFor}
        template={sendFor ? templateFor(sendFor) : ""}
        customers={active}
        onClose={() => setSendFor(null)}
      />
    </PageTransition>
  );
}

function CreateCampaignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [template, setTemplate] = useState("Hi {name}, celebrate with us! 🎉");
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState("");
  const [expiry, setExpiry] = useState("");

  function reset() { setName(""); setDate(""); setTemplate("Hi {name}, celebrate with us! 🎉"); setCoupon(""); setDiscount(""); setExpiry(""); }

  function submit() {
    if (!name.trim() || !date.trim() || !template.trim()) { toast.error("Name, date, and message are required."); return; }
    const body = discount ? `${template}\n${discount}% off${coupon ? ` — code ${coupon}` : ""}${expiry ? ` (valid till ${expiry})` : ""}` : template;
    addFestival({ name, date, template: body, coupon: coupon || "-", emoji: "🎉" });
    toast.success("Campaign created");
    reset(); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">New festival campaign</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Campaign name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali Special" className="mt-1" /></div>
          <div><Label className="text-xs">Festival date *</Label><Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="MM-DD or YYYY-MM-DD" className="mt-1" /></div>
          <div><Label className="text-xs">Message template *</Label><Textarea rows={4} value={template} onChange={(e) => setTemplate(e.target.value)} className="mt-1 font-mono text-xs" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Coupon code</Label><Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="DIWALI25" className="mt-1" /></div>
            <div><Label className="text-xs">Discount %</Label><Input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="25" className="mt-1" /></div>
          </div>
          <div><Label className="text-xs">Expiry date</Label><Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="rounded-full gradient-brand text-primary-foreground" onClick={submit}>Create campaign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendCampaignFlow({ festival, template, customers, onClose }: { festival: Festival | null; template: string; customers: ReturnType<typeof useActiveCustomers>; onClose: () => void }) {
  const [stage, setStage] = useState<"select" | "confirm" | "sending" | "done">("select");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [idx, setIdx] = useState(0);

  const birthdayIds = useMemo(() => new Set(getCelebrants("birthday", "today").map((c) => c.id)), []);
  const list = useMemo(() => {
    return customers.filter((c) => {
      if (filter === "new" && c.status !== "New") return false;
      if (filter === "vip" && c.status !== "VIP") return false;
      if (filter === "inactive" && c.status !== "At Risk") return false;
      if (filter === "birthday" && !birthdayIds.has(c.id)) return false;
      if (query && !(`${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase()))) return false;
      return true;
    });
  }, [customers, filter, query, birthdayIds]);

  const selectedList = customers.filter((c) => selected.has(c.id));
  const current = selectedList[idx];

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectAllVisible() {
    setSelected((prev) => { const n = new Set(prev); list.forEach((c) => n.add(c.id)); return n; });
  }
  function reset() { setStage("select"); setFilter("all"); setQuery(""); setSelected(new Set()); setIdx(0); }
  function close() { reset(); onClose(); }

  function sendCurrent() {
    if (!current) return;
    const msg = template.replace(/\{name\}/g, current.name.split(" ")[0]);
    openWhatsApp(current.phone, msg);
    logWhatsApp({ customerId: current.id, kind: "campaign", message: msg });
  }
  function next() {
    if (idx + 1 >= selectedList.length) { setStage("done"); return; }
    setIdx(idx + 1);
    setTimeout(sendCurrent, 50);
  }

  const open = !!festival;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg rounded-2xl">
        {stage === "select" && (
          <>
            <DialogHeader><DialogTitle className="font-display">Send {festival?.name} — pick customers</DialogTitle></DialogHeader>
            <div className="flex flex-wrap gap-1.5">
              {(["all","new","vip","birthday","inactive"] as Filter[]).map((k) => (
                <button key={k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-xs capitalize ${filter===k?"gradient-brand text-primary-foreground border-transparent":"hover:border-primary"}`}>{k}</button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search name or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{list.length} matching · {selected.size} selected</span>
              <Button variant="ghost" size="sm" onClick={selectAllVisible}>Select all visible</Button>
            </div>
            <div className="max-h-[280px] space-y-1 overflow-y-auto">
              {list.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-2 text-sm hover:bg-muted/40">
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                  <div className="flex-1"><p className="font-medium">{c.name}</p><p className="text-[11px] text-muted-foreground">{c.phone} · {c.status}</p></div>
                </label>
              ))}
              {list.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">No matching customers.</p>}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button className="rounded-full gradient-brand text-primary-foreground" disabled={selected.size === 0} onClick={() => setStage("confirm")}>Send ({selected.size})</Button>
            </DialogFooter>
          </>
        )}

        {stage === "confirm" && (
          <>
            <DialogHeader><DialogTitle className="font-display">Confirm send</DialogTitle></DialogHeader>
            <p className="text-sm">Will open WhatsApp for <b>{selectedList.length}</b> customer{selectedList.length===1?"":"s"} one by one.</p>
            <p className="text-xs text-muted-foreground">Send in WhatsApp, then return here and click "Next Customer".</p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStage("select")}>Back</Button>
              <Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => { setStage("sending"); setIdx(0); setTimeout(sendCurrent, 50); }}>Start Sending</Button>
            </DialogFooter>
          </>
        )}

        {stage === "sending" && current && (
          <>
            <DialogHeader><DialogTitle className="font-display">Sending {idx + 1} of {selectedList.length}</DialogTitle></DialogHeader>
            <div className="rounded-xl border p-3 text-sm">
              <p className="font-medium">{current.name}</p>
              <p className="text-xs text-muted-foreground">{current.phone}</p>
              <pre className="mt-2 max-h-[160px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-2 font-mono text-xs">{template.replace(/\{name\}/g, current.name.split(" ")[0])}</pre>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-full" onClick={sendCurrent}><MessageCircle className="mr-1 h-3.5 w-3.5" /> Re-open WhatsApp</Button>
              <Button className="rounded-full gradient-brand text-primary-foreground" onClick={next}>
                {idx + 1 >= selectedList.length ? "Finish" : <>Next Customer <ArrowRight className="ml-1 h-3.5 w-3.5" /></>}
              </Button>
            </DialogFooter>
          </>
        )}

        {stage === "done" && (
          <>
            <DialogHeader><DialogTitle className="font-display">Campaign Complete!</DialogTitle></DialogHeader>
            <p className="text-sm">{selectedList.length}/{selectedList.length} customers processed.</p>
            <DialogFooter><Button className="rounded-full gradient-brand text-primary-foreground" onClick={close}>Done</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}