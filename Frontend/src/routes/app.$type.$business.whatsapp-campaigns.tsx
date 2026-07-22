import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Clock, MessageCircle, Search, Users, CheckCircle2, ArrowRight, X } from "lucide-react";
import { campaigns, customers } from "@/lib/sample-data";
import { openWhatsApp } from "@/lib/celebration-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/$type/$business/whatsapp-campaigns")({ component: WhatsAppPage });

const statusStyle: Record<string, string> = {
  sent: "border-success/40 text-success",
  scheduled: "border-info/40 text-info",
  draft: "border-muted-foreground/40 text-muted-foreground",
};

function WhatsAppPage() {
  const [recipientMode, setRecipientMode] = useState<"all" | "custom">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Happy Birthday {{name}} 🎉 Enjoy a FREE Dessert on your next visit — coupon {{coupon}}. See you soon ❤️");
  const [coupon, setCoupon] = useState("BDAY20");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendingOpen, setSendingOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [queue, setQueue] = useState<typeof customers>([]);

  const filtered = useMemo(
    () => customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [search]
  );
  const recipients = recipientMode === "all" ? customers : customers.filter((c) => selected.has(c.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSendClick() {
    if (recipients.length === 0) {
      toast.error("Select at least one recipient");
      return;
    }
    setConfirmOpen(true);
  }

  function startSending() {
    setConfirmOpen(false);
    setQueue(recipients);
    setCursor(0);
    setSendingOpen(true);
    // Open first
    setTimeout(() => openFor(recipients[0]), 300);
  }

  function openFor(c: (typeof customers)[number]) {
    const msg = message.replace(/{{\s*name\s*}}/gi, c.name.split(" ")[0]).replace(/{{\s*coupon\s*}}/gi, coupon || "");
    openWhatsApp(c.phone, msg);
  }

  function nextCustomer() {
    const nextIdx = cursor + 1;
    if (nextIdx >= queue.length) {
      setCursor(queue.length);
      return;
    }
    setCursor(nextIdx);
    openFor(queue[nextIdx]);
  }

  function finishFlow() {
    setSendingOpen(false);
    setCursor(0);
    setQueue([]);
    toast.success(`Campaign completed — ${recipients.length} customers processed`);
  }

  const isFinished = queue.length > 0 && cursor >= queue.length;
  const current = queue[cursor];

  return (
    <>
      <PageHeader title="WhatsApp campaigns" description="Reach the right guests, at the right hour." />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="rounded-2xl lg:col-span-3">
          <CardHeader><CardTitle className="font-display">Create campaign</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Campaign name</Label><Input placeholder="July birthday delight" /></div>
              <div className="space-y-1.5"><Label>Audience</Label>
                <Select defaultValue="birthday"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="birthday">Birthdays this week</SelectItem>
                    <SelectItem value="inactive">Inactive 60+ days</SelectItem>
                    <SelectItem value="vip">VIP tier</SelectItem>
                    <SelectItem value="all">All customers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Coupon</Label><Input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="BDAY20" /></div>
              <div className="space-y-1.5"><Label>Type</Label>
                <Select defaultValue="coupon"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coupon">Coupon</SelectItem>
                    <SelectItem value="festival">Festival</SelectItem>
                    <SelectItem value="update">Announcement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">Recipients</Label>
              </div>
              <RadioGroup value={recipientMode} onValueChange={(v) => setRecipientMode(v as "all" | "custom")} className="grid gap-2 sm:grid-cols-2">
                <label className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors", recipientMode === "all" && "border-primary bg-primary/5")}>
                  <RadioGroupItem value="all" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Send to All</p>
                    <p className="text-xs text-muted-foreground">Estimated {customers.length} customers</p>
                  </div>
                </label>
                <label className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors", recipientMode === "custom" && "border-primary bg-primary/5")}>
                  <RadioGroupItem value="custom" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Custom Selection</p>
                    <p className="text-xs text-muted-foreground">Pick specific customers</p>
                  </div>
                </label>
              </RadioGroup>

              {recipientMode === "custom" && (
                <div className="space-y-2 pt-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers…" className="pl-9" />
                  </div>
                  <ScrollArea className="h-56 rounded-lg border">
                    <div className="divide-y">
                      {filtered.map((c) => (
                        <label key={c.id} className="flex cursor-pointer items-center gap-3 p-2.5 transition-colors hover:bg-muted/50">
                          <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                          <Avatar className="h-8 w-8"><AvatarFallback className="gradient-brand text-primary-foreground text-xs">{c.initials}</AvatarFallback></Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{c.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{c.phone}</p>
                          </div>
                          <Badge variant="outline" className="rounded-full text-[10px]">{c.status}</Badge>
                        </label>
                      ))}
                      {filtered.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No matches</p>}
                    </div>
                  </ScrollArea>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Selected Customers:</span>
                    <Badge className="rounded-full">{selected.size}</Badge>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
              <p className="text-xs text-muted-foreground">Use <code>{"{{name}}"}</code> and <code>{"{{coupon}}"}</code> — they're replaced per customer.</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => toast("Scheduled for tomorrow 6:12 PM")}><Clock className="mr-1.5 h-4 w-4" /> Schedule</Button>
              <Button className="rounded-full gradient-brand text-primary-foreground transition-transform hover:scale-105 active:scale-95" onClick={handleSendClick}>
                <Send className="mr-1.5 h-4 w-4" /> Send Campaign ({recipients.length})
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader><CardTitle className="font-display">Preview</CardTitle></CardHeader>
          <CardContent>
            <div className="mx-auto max-w-xs rounded-3xl border-4 border-foreground/10 bg-background p-3">
              <div className="rounded-2xl bg-[oklch(0.94_0.05_150)] p-4 text-sm text-black">
                <p className="font-semibold">Aroma Bistro</p>
                <p className="mt-2 whitespace-pre-line leading-relaxed">{message.replace(/{{\s*name\s*}}/gi, "Sarah").replace(/{{\s*coupon\s*}}/gi, coupon || "BDAY20")}</p>
                <p className="mt-2 text-right text-[10px] opacity-60">6:12 PM ✓✓</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="font-display">Campaign history</CardTitle><Badge variant="secondary" className="rounded-full">{campaigns.length} total</Badge></CardHeader>
        <CardContent className="grid gap-3">
          {campaigns.map((c) => (
            <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto]">
              <div className="min-w-0"><p className="truncate font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.audience} · {c.channel}</p></div>
              <div className="hidden text-center sm:block"><p className="font-display font-semibold">{c.sent}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sent</p></div>
              <div className="hidden text-center sm:block"><p className="font-display font-semibold text-success">{c.opened}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Opened</p></div>
              <div className="hidden text-center sm:block"><p className="font-display font-semibold text-primary">{c.converted}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Converted</p></div>
              <Badge variant="outline" className={cn("rounded-full capitalize", statusStyle[c.status])}>{c.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Confirm modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-glow">
              <MessageCircle className="h-7 w-7" />
            </div>
            <DialogTitle className="text-center font-display">Send to {recipients.length} customers?</DialogTitle>
            <DialogDescription className="text-center">
              This campaign will open WhatsApp chats one by one. You will need to press Send inside WhatsApp for each customer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button className="rounded-full gradient-brand text-primary-foreground" onClick={startSending}>
              <Send className="mr-1.5 h-4 w-4" /> Start Sending
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sending flow */}
      <Dialog open={sendingOpen} onOpenChange={(o) => { if (!o) finishFlow(); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          {isFinished ? (
            <>
              <DialogHeader>
                <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-success/20 text-success">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <DialogTitle className="text-center font-display">Campaign Completed</DialogTitle>
                <DialogDescription className="text-center">
                  {queue.length} / {queue.length} customers processed.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-center">
                <Button className="rounded-full gradient-brand text-primary-foreground" onClick={finishFlow}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-glow">
                  <MessageCircle className="h-7 w-7" />
                </div>
                <DialogTitle className="text-center font-display">
                  Sending {cursor + 1} of {queue.length}
                </DialogTitle>
                <DialogDescription className="text-center">
                  WhatsApp opened for <span className="font-medium text-foreground">{current?.name}</span>. Press Send inside WhatsApp, then continue.
                </DialogDescription>
              </DialogHeader>
              {current && (
                <div className="flex items-center gap-3 rounded-xl border p-3">
                  <Avatar className="h-10 w-10"><AvatarFallback className="gradient-brand text-primary-foreground">{current.initials}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{current.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{current.phone}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="rounded-full" onClick={() => openFor(current)}>
                    Reopen
                  </Button>
                </div>
              )}
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full gradient-brand transition-all" style={{ width: `${((cursor + 1) / queue.length) * 100}%` }} />
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="ghost" className="rounded-full" onClick={finishFlow}>
                  <X className="mr-1.5 h-4 w-4" /> Stop
                </Button>
                <Button className="rounded-full gradient-brand text-primary-foreground" onClick={nextCustomer}>
                  {cursor + 1 === queue.length ? "Finish" : "Next Customer"} <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}