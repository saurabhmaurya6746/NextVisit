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
import { Sparkles, MessageCircle, Download } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { downloadInvoicePdfApi } from "@/lib/visit-services-api";
import { redeemCouponApi, CouponValidateResponse } from "@/lib/coupons-api";
import { useQuery } from "@tanstack/react-query";
import { getBusinessSettingsApi } from "@/lib/business-settings-api";

interface Props {
  order: Order;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCompleted?: (o: Order) => void;
}

export function CompletePaymentDialog({ order, open, onOpenChange, onCompleted }: Props) {
  const profile = useProfile("restaurant");
  const { data: bizSettings } = useQuery({
    queryKey: ["business-settings"],
    queryFn: getBusinessSettingsApi,
    staleTime: 5000,
  });
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
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidateResponse | null>(null);
  const [success, setSuccess] = useState<{ customerId?: string; customerName: string; customerPhone: string; earned: number; balance: number } | null>(null);

  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const handleDownloadInvoice = async () => {
    if (!order) return;
    setDownloadingInvoice(true);
    const orderNum = orderCode(order);
    const invNo = `INV-${orderNum.replace("ORD-", "")}`;
    const restaurantName = profile?.name || "Jail Restaurant";
    const address = bizSettings?.address || [bizSettings?.city, bizSettings?.state].filter(Boolean).join(", ") || profile?.address || "Main Branch";
    const phoneNum = bizSettings?.phone || bizSettings?.whatsapp_number || profile?.phone || "";
    const gstNumber = bizSettings?.gst_number || "33AAAAA0000A1Z5";
    const tableNo = order.table || "Table";
    const customerName = success?.customerName || order.customerName || "Guest Customer";
    const dateStr = new Date(order.createdAt || Date.now()).toLocaleString();
    const paymentMode = payment || "cash";

    try {
      const itemsHtml = (order.items || []).map((i: any) => `
        <div style="margin-bottom: 6px;">
          <div style="font-weight: 700; font-size: 12px; color: #000;">${i.name}</div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #222; font-family: monospace; margin-top: 1px;">
            <span>${i.qty} x ₹${i.price}</span>
            <span style="font-weight: 700;">₹${i.qty * i.price}</span>
          </div>
        </div>
      `).join("");

      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "-9999px";
      container.style.width = "300px";
      container.style.background = "#ffffff";
      container.style.color = "#000000";
      container.style.fontFamily = "'Courier New', Courier, monospace";
      container.style.padding = "16px 14px";
      container.style.boxSizing = "border-box";
      container.style.lineHeight = "1.35";

      container.innerHTML = `
        <div style="text-align: center; margin-bottom: 8px;">
          <div style="font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">${restaurantName}</div>
          ${address ? `<div style="font-size: 10px; color: #333; margin-top: 2px;">${address}</div>` : ""}
          ${phoneNum ? `<div style="font-size: 10px; color: #333;">Ph: ${phoneNum}</div>` : ""}
          ${gstNumber ? `<div style="font-size: 10px; color: #333;">GSTIN: ${gstNumber}</div>` : ""}
          <div style="display: inline-block; margin-top: 6px; padding: 2px 8px; background: #000; color: #fff; font-size: 9px; font-weight: 800; border-radius: 4px; text-transform: uppercase;">TAX INVOICE</div>
        </div>

        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

        <div style="font-size: 10px; font-family: monospace;">
          <div>Inv No : <strong>${invNo}</strong></div>
          <div>Order No: ${orderNum}</div>
          <div>Date    : ${dateStr}</div>
          <div>Table   : ${tableNo} | Cust: ${customerName}</div>
        </div>

        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

        <div>
          ${itemsHtml}
        </div>

        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

        <div style="font-size: 11px; font-family: monospace;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>Subtotal:</span>
            <span>₹${subtotalVal}</span>
          </div>
          ${taxAmount > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>GST (${gstRate}%):</span>
            <span>₹${taxAmount}</span>
          </div>
          ` : ""}
          ${couponDiscount > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px; color: #b91c1c;">
            <span>Discount:</span>
            <span>-₹${couponDiscount}</span>
          </div>
          ` : ""}
          <div style="border-top: 1px solid #000; margin: 6px 0;"></div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 900;">
            <span>GRAND TOTAL:</span>
            <span>₹${finalTotal}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 4px;">
            <span>Status:</span>
            <strong>PAID (${paymentMode.toUpperCase()})</strong>
          </div>
        </div>

        <div style="border-top: 1px dashed #000; margin: 10px 0 8px 0;"></div>

        <div style="text-align: center; font-size: 10px;">
          <div style="font-weight: 700;">Thank you for dining with us!</div>
          <div style="font-size: 8px; color: #555; margin-top: 2px;">Powered by NextVisit POS</div>
        </div>
      `;

      document.body.appendChild(container);

      try {
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });

        const imgData = canvas.toDataURL("image/png");
        const mmWidth = 80;
        const mmHeight = Math.max(120, (canvas.height * mmWidth) / canvas.width);

        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [mmWidth, mmHeight],
        });

        pdf.addImage(imgData, "PNG", 0, 0, mmWidth, mmHeight);
        pdf.save(`Invoice_${invNo}.pdf`);
        toast.success("Invoice downloaded successfully!");
      } finally {
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
      }
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const cleanPhone = phone.replace(/\D/g, "");
  const isExact10 = cleanPhone.length === 10;
  const found = isExact10 ? findCustomerByPhone(phone) : null;

  // Calculation Engine: Subtotal -> Apply Coupon -> Taxable -> GST -> Grand Total
  const subtotalVal = order.subtotal || order.total;
  const couponDiscount = appliedCoupon?.calculated_discount || 0;
  const netVal = Math.max(0, subtotalVal - couponDiscount);
  const gstRate = profile.gstEnabled ? (profile.gstPercent || 18) : 0;
  const isInclusive = (profile as any)?.priceIncludesGst ?? false;
  const taxAmount = isInclusive ? Math.round(netVal - (netVal / (1 + gstRate / 100))) : Math.round((netVal * gstRate) / 100);
  const finalTotal = isInclusive ? netVal : netVal + taxAmount;

  let taxableVal = netVal;
  let gstVal = 0;
  let finalTotal = netVal;

  if (profile.gstEnabled && gstRate > 0) {
    if (isInclusive) {
      finalTotal = netVal;
      taxableVal = Math.round((finalTotal / (1 + gstRate / 100)) * 100) / 100;
      gstVal = Math.round((finalTotal - taxableVal) * 100) / 100;
    } else {
      taxableVal = netVal;
      gstVal = Math.round((taxableVal * (gstRate / 100)) * 100) / 100;
      finalTotal = Math.round((taxableVal + gstVal) * 100) / 100;
    }
  }

  function reset() { setStep(0); setPhone(order.customerPhone || ""); setName(order.customerName || ""); setEmail(""); setBday(""); setAnni(""); setGender(""); setPayment("cash"); setAppliedCoupon(null); setSuccess(null); }
  function close() { reset(); onOpenChange(false); }

  async function complete() {
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
          bumpExtraCustomer(found.id, { spent: finalTotal, visitDate, favorite });
        }
      } else {
        const c = createCustomerFromOrder({ phone: phone.trim(), name: name || undefined, birthday: bday || undefined, anniversary: anni || undefined, spent: 0, visitDate, favorite });
        if (gender) (c as any).gender = gender;
        customerId = c.id; customerName = c.name;
        if (!order.visitCounted) bumpExtraCustomer(c.id, { spent: finalTotal, visitDate, favorite });
      }
    }

    // Redeem coupon if applied
    if (appliedCoupon && appliedCoupon.coupon) {
      try {
        await redeemCouponApi({
          code: appliedCoupon.coupon.code,
          customer_id: customerId,
          order_amount: subtotalVal,
          order_id: order.id,
        });
      } catch (err) {
        console.warn("Failed redeeming coupon in backend:", err);
      }
    }

    const updated = markOrderPaid(order.id, payment, { id: customerId, name: customerName, phone: customerPhone });
    if (customerId) markPending(customerId, visitDate, finalTotal);
    const rewarded = awardPointsForOrder(order.id, customerId, finalTotal, { visitBonus: true });
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
              <Button
                variant="outline"
                className="rounded-full text-xs gap-1.5"
                onClick={handleDownloadInvoice}
                disabled={downloadingInvoice}
              >
                <Download className={`h-3.5 w-3.5 text-primary ${downloadingInvoice ? "animate-spin" : ""}`} />
                {downloadingInvoice ? "Downloading…" : "Download Invoice"}
              </Button>
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
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="Enter 10-digit phone number…"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="pl-9 font-mono"
                  />
                </div>
                {isExact10 && found && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-primary/5 p-3 text-sm">
                    <div className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /><span>Existing: <strong>{found.name}</strong></span></div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full text-[10px]">Will link & update</Badge>
                      {(found as any).status === "VIP" && (
                        <Badge className="rounded-full text-[10px] bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold border-0">
                          👑 VIP Client
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                {isExact10 && !found && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium text-primary">New customer</p>
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
                <Button
                  className="rounded-full gradient-brand text-primary-foreground"
                  disabled={!phone.trim()}
                  onClick={() => {
                    const cleanDigits = phone.replace(/\D/g, "");
                    if (cleanDigits.length !== 10) {
                      toast.error("Please enter a valid 10-digit phone number.");
                      return;
                    }
                    setStep(1);
                  }}
                >
                  Next · payment
                </Button>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="c1" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-4 md:grid-cols-[1fr_1fr] items-start">
              <div className="grid gap-2 grid-cols-2">
                <Chip label="UPI / QR" icon={Smartphone} active={payment === "upi"} onClick={() => setPayment("upi")} />
                <Chip label="Cash" icon={Banknote} active={payment === "cash"} onClick={() => setPayment("cash")} />

                {/* PAYMENT COUPON SECTION */}
                <PaymentCouponSection
                  subtotal={order.subtotal || order.total}
                  customerId={found?.id}
                  appliedCoupon={appliedCoupon}
                  onCouponApplied={setAppliedCoupon}
                />

                {/* FINANCIAL BREAKDOWN WITH TAX & COUPON */}
                <div className="mt-2 rounded-xl bg-card border p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between"><span>Table</span><span className="font-medium">{order.table}</span></div>
                  <div className="flex items-center justify-between"><span>Items</span><span className="font-medium">{order.items.reduce((s, i) => s + i.qty, 0)}</span></div>
                  <div className="flex items-center justify-between"><span>Subtotal</span><span className="font-mono">{fmt(subtotalVal)}</span></div>
                  {couponDiscount > 0 && (
                    <div className="flex items-center justify-between text-emerald-600 font-semibold">
                      <span>Coupon Discount ({appliedCoupon?.coupon?.code})</span>
                      <span className="font-mono">-{fmt(couponDiscount)}</span>
                    </div>
                  )}
                  {profile.gstEnabled && (
                    <>
                      <div className="flex items-center justify-between text-muted-foreground"><span>Taxable Amount</span><span className="font-mono">{fmt(taxableVal)}</span></div>
                      <div className="flex items-center justify-between text-violet-600 dark:text-violet-400"><span>GST ({profile.gstPercent}%)</span><span className="font-mono">{fmt(gstVal)}</span></div>
                    </>
                  )}
                  <div className="mt-1 flex items-center justify-between border-t pt-2 font-bold text-sm">
                    <span className="text-foreground">Grand Total</span>
                    <span className="font-display text-lg font-semibold text-primary">{fmt(finalTotal)}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border p-4 text-center">
                {payment === "upi" ? (() => {
                  const upiId = (bizSettings?.payment_upi_id || "").trim();
                  const payeeName = (bizSettings?.payment_payee_name || (bizSettings as any)?.payment_payee_name || "").trim();
                  const payableTotal = finalTotal || order.total || 0;
                  const formattedPayable = payableTotal.toFixed(2);

                  if (upiId && payeeName) {
                    const rawUpiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${formattedPayable}&cu=INR`;
                    const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=8&data=${encodeURIComponent(rawUpiUri)}`;
                    return (
                      <div className="space-y-2 text-center">
                        <p className="text-xs font-bold text-foreground">Scan QR Code to Pay</p>
                        <p className="text-[11px] text-muted-foreground font-semibold">{payeeName}</p>
                        <img src={dynamicQrUrl} alt={`Dynamic Payment QR for ${payeeName}`} className="mx-auto h-48 w-48 rounded-xl border bg-white p-2 shadow-sm object-contain" />
                        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                          <span className="text-[11px] font-mono font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                            UPI: {upiId}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                            ₹{formattedPayable}
                          </span>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-300 text-xs space-y-1 text-center">
                        <p className="font-semibold text-xs">No Payment QR Configured</p>
                        <p className="text-[11px] text-muted-foreground">
                          Please enter your UPI ID & Payee Name in Setup ➔ Payment Configuration.
                        </p>
                      </div>
                    );
                  }
                })() : (
                  <div className="mx-auto grid h-52 w-52 place-items-center rounded-xl bg-muted/40 text-muted-foreground">
                    Confirm payment received
                  </div>
                )}
                <p className="mt-3 text-sm font-medium">Amount due · {fmt(finalTotal)}</p>
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