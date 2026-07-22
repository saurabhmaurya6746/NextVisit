import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, User, Banknote, Smartphone, CreditCard, QrCode, Check, Printer, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/business-profile";
import { markOrderPaid, findCustomerByPhone, createCustomerFromOrder, bumpExtraCustomer, orderCode, type Order, type Payment } from "@/lib/orders-store";
import { markPending } from "@/lib/review-store";
import { toast } from "sonner";
import { fmt } from "@/lib/currency";
import { awardPointsForOrder, useLoyaltySettings } from "@/lib/loyalty-store";
import { openWhatsApp } from "@/lib/celebration-utils";
import { logWhatsApp } from "@/lib/whatsapp-history";
import { Sparkles, MessageCircle } from "lucide-react";

interface Props {
  order: Order;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCompleted?: (o: Order) => void;
}

export function CompletePaymentDialog({ order, open, onOpenChange, onCompleted }: Props) {
  const profile = useProfile("restaurant");
  const loyalty = useLoyaltySettings();
  void loyalty;
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState(order.customerPhone || "");
  const [name, setName] = useState(order.customerName || "");
  const [email, setEmail] = useState("");
  const [bday, setBday] = useState("");
  const [anni, setAnni] = useState("");
  const [gender, setGender] = useState("");
  const [payment, setPayment] = useState<Payment>("cash");
  const [success, setSuccess] = useState<{ customerId?: string; customerName: string; customerPhone: string; earned: number; balance: number } | null>(null);

  const found = phone.trim().length >= 6 ? findCustomerByPhone(phone) : null;

  function reset() { setStep(0); setPhone(order.customerPhone || ""); setName(order.customerName || ""); setEmail(""); setBday(""); setAnni(""); setGender(""); setPayment("cash"); setSuccess(null); }
  function close() { reset(); onOpenChange(false); }

  function complete() {
    let customerId: string | undefined;
    let customerName: string | undefined;
    let customerPhone: string | undefined = phone.trim() || undefined;
    const favorite = order.items[0]?.name;
    const visitDate = new Date().toISOString().slice(0, 10);

    if (phone.trim()) {
      if (found) {
        customerId = found.id;
        customerName = found.name;
        // Only bump visit if this session hasn't been counted before
        if (found.source === "extra" && !order.visitCounted) {
          bumpExtraCustomer(found.id, { spent: order.total, visitDate, favorite });
        }
      } else {
        const c = createCustomerFromOrder({ phone: phone.trim(), name: name || undefined, birthday: bday || undefined, anniversary: anni || undefined, spent: 0, visitDate, favorite });
        if (gender) (c as any).gender = gender;
        customerId = c.id; customerName = c.name;
        if (!order.visitCounted) bumpExtraCustomer(c.id, { spent: order.total, visitDate, favorite });
      }
    }

    const updated = markOrderPaid(order.id, payment, { id: customerId, name: customerName, phone: customerPhone });
    if (customerId) markPending(customerId, visitDate, order.total);
    const rewarded = awardPointsForOrder(order.id, customerId, order.total, { visitBonus: true });
    if (updated) onCompleted?.(updated);
    setSuccess({
      customerId,
      customerName: customerName || "Guest",
      customerPhone: customerPhone || "",
      earned: rewarded.earned,
      balance: rewarded.balance,
    });
  }

  function sendWa() {
    if (!success) return;
    const first = success.customerName.split(" ")[0];
    const msg = `🎉 Thank you ${first}! Your bill of ${fmt(order.total)} at ${profile.name} is paid.\nYou earned ${success.earned} loyalty points.\nCurrent balance: ${success.balance} pts.`;
    openWhatsApp(success.customerPhone, msg);
    if (success.customerId) logWhatsApp({ customerId: success.customerId, kind: "manual", message: msg });
    toast.success("WhatsApp opened");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl rounded-2xl">
        {success ? (
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-glow">
              <Check className="h-7 w-7" />
            </div>
            <p className="mt-3 font-display text-2xl font-semibold">Payment Successful</p>
            <p className="mt-1 text-sm text-muted-foreground">{orderCode(order)} · {fmt(order.total)} · {payment.toUpperCase()}</p>
            <div className="mx-auto mt-5 grid max-w-sm gap-3">
              <div className="rounded-2xl border p-4">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Sparkles className="h-3.5 w-3.5 text-primary" /> {success.customerName} earned</p>
                <p className="mt-1 font-display text-3xl font-semibold text-primary">{success.earned} pts</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Current balance</p>
                <p className="mt-1 font-display text-2xl font-semibold">{success.balance} pts</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button className="rounded-full gradient-brand text-primary-foreground" onClick={sendWa} disabled={!success.customerPhone}>
                <MessageCircle className="mr-1.5 h-4 w-4" /> Send WhatsApp
              </Button>
              <Button variant="outline" className="rounded-full" onClick={close}>Close</Button>
            </div>
          </div>
        ) : (<>
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Check className="h-5 w-5 text-primary" /> Complete payment · {orderCode(order)}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Step {step + 1} of 2 · {step === 0 ? "Customer details" : "Payment method"}</p>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="c0" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="rounded-xl border p-4">
                <p className="font-display text-sm font-semibold">Customer</p>
                <p className="mt-1 text-xs text-muted-foreground">Phone is required. We'll look up existing customer, or create a new one.</p>
                <div className="mt-3 relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Enter phone number…" value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-9" />
                </div>
                {phone && found && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-primary/5 p-3 text-sm">
                    <div className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /><span>Existing: <strong>{found.name}</strong></span></div>
                    <Badge variant="outline" className="rounded-full text-[10px]">Will link & update</Badge>
                  </div>
                )}
                {phone && !found && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">New customer</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                      <div><Label className="text-xs">Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                      <div><Label className="text-xs">Birthday</Label><Input type="date" value={bday} onChange={(e) => setBday(e.target.value)} /></div>
                      <div><Label className="text-xs">Anniversary</Label><Input type="date" value={anni} onChange={(e) => setAnni(e.target.value)} /></div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Gender</Label>
                        <select value={gender} onChange={(e) => setGender(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                          <option value="">Prefer not to say</option>
                          <option>Female</option>
                          <option>Male</option>
                          <option>Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={close}>Cancel</Button>
                <Button className="rounded-full gradient-brand text-primary-foreground" disabled={!phone.trim()} onClick={() => setStep(1)}>Next · payment</Button>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="c1" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-4 md:grid-cols-[1fr_1fr] items-start">
              <div className="grid gap-2">
                <Chip label="Cash" icon={Banknote} active={payment === "cash"} onClick={() => setPayment("cash")} />
                <Chip label="UPI" icon={Smartphone} active={payment === "upi"} onClick={() => setPayment("upi")} />
                <Chip label="Card" icon={CreditCard} active={payment === "card"} onClick={() => setPayment("card")} />
                <div className="mt-3 rounded-xl bg-muted/40 p-3 text-sm">
                  <div className="flex items-center justify-between"><span>Table</span><span className="font-medium">{order.table}</span></div>
                  <div className="flex items-center justify-between"><span>Items</span><span className="font-medium">{order.items.reduce((s, i) => s + i.qty, 0)}</span></div>
                  {profile.gstEnabled && (
                    <>
                      <div className="flex items-center justify-between"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
                      <div className="flex items-center justify-between"><span>GST ({profile.gstPercent}%)</span><span>{fmt(order.gst)}</span></div>
                    </>
                  )}
                  <div className="mt-1 flex items-center justify-between border-t pt-2"><span className="text-muted-foreground">Total</span><span className="font-display text-lg font-semibold">{fmt(order.total)}</span></div>
                </div>
              </div>
              <div className="rounded-2xl border p-4 text-center">
                {payment === "upi" ? (
                  profile.upiQr ? (
                    <img src={profile.upiQr} alt="UPI QR" className="mx-auto h-52 w-52 rounded-xl object-contain" />
                  ) : (
                    <div className="mx-auto grid h-52 w-52 place-items-center rounded-xl bg-muted/60">
                      <div className="text-center">
                        <QrCode className="mx-auto h-16 w-16 text-primary" />
                        <p className="mt-2 text-xs text-muted-foreground">Add UPI QR in Settings to display it here.</p>
                        {profile.upiId && <p className="mt-1 text-[11px] font-mono">{profile.upiId}</p>}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="mx-auto grid h-52 w-52 place-items-center rounded-xl bg-muted/40 text-muted-foreground">
                    Confirm payment received
                  </div>
                )}
                <p className="mt-3 text-sm font-medium">Amount due · {fmt(order.total)}</p>
              </div>
              <div className="md:col-span-2 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
                <Button className="rounded-full gradient-brand text-primary-foreground" onClick={complete}>
                  <Check className="mr-1.5 h-4 w-4" /> Mark as paid
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </>)}
      </DialogContent>
    </Dialog>
  );
}

function Chip({ label, icon: Icon, active, onClick }: { label: string; icon: any; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-3 rounded-xl border p-3 text-sm font-medium transition-all",
      active ? "border-primary bg-primary/5 shadow-elegant" : "hover:-translate-y-0.5 hover:border-primary/60")}>
      <div className={cn("grid h-9 w-9 place-items-center rounded-lg", active ? "gradient-brand text-primary-foreground" : "bg-muted text-muted-foreground")}>
        <Icon className="h-4 w-4" />
      </div>
      {label}
    </button>
  );
}

// silence unused
void Printer; void FileText;