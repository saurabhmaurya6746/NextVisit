import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Printer, FileText, Plus, ShoppingBag, User, CheckCircle2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useOrders,
  updateOrder,
  statusLabel,
  paymentLabel,
  orderCode,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders-store";
import { CompletePaymentDialog } from "@/components/complete-payment-dialog";
import { AddItemsDialog } from "@/components/add-items-dialog";
import { InvoiceView } from "@/components/invoice-view";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};
const PAY_TONE: Record<PaymentStatus, string> = {
  unpaid: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

interface Props {
  orderId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function OrderDetailSheet({ orderId, open, onOpenChange }: Props) {
  const orders = useOrders();
  const order = useMemo(() => orders.find((o) => o.id === orderId) || null, [orders, orderId]);
  const [payOpen, setPayOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);

  function markCompleted() {
    if (!order) return;
    if (order.paymentStatus !== "paid") {
      toast.error("Collect payment before closing the session.");
      setPayOpen(true);
      return;
    }
    updateOrder(order.id, { status: "completed" });
    toast.success("Session closed · table is now empty");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        {!order ? (
          <div className="p-6 text-sm text-muted-foreground">Order not found.</div>
        ) : (
          <>
            <SheetHeader className="border-b p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <SheetTitle className="font-display text-lg">
                    {orderCode(order)}
                  </SheetTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Table {order.table} · {order.source === "qr" ? "QR self-order" : "Staff order"} ·{" "}
                    {new Date(order.createdAt).toLocaleDateString("en-GB")} · {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge className={`rounded-full ${STATUS_TONE[order.status]}`}>{statusLabel(order.status)}</Badge>
                    <Badge className={`rounded-full ${PAY_TONE[order.paymentStatus]}`}>{paymentLabel(order.paymentStatus)}</Badge>
                    {order.status === "completed" && (
                      <Badge className="rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="mr-1 h-3 w-3" /> Completed</Badge>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-4 p-5">
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-display text-sm font-semibold flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-primary" /> Items
                  </p>
                  {order.status !== "completed" && (
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAddOpen(true)}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Add more
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {order.items.map((i) => (
                    <div key={i.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-xl border p-3 text-sm">
                      <div>
                        <p className="font-medium">{i.name}</p>
                        {i.notes && <p className="text-xs text-muted-foreground">Note: {i.notes}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground">× {i.qty}</span>
                      <span className="text-xs text-muted-foreground">{fmt(i.price)}</span>
                      <span className="font-semibold tabular-nums">{fmt(i.price * i.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1 rounded-xl bg-muted/40 p-3 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
                  {order.gst > 0 && <div className="flex justify-between"><span>GST</span><span>{fmt(order.gst)}</span></div>}
                  <div className="flex justify-between border-t pt-1 font-display text-base font-semibold"><span>Total</span><span>{fmt(order.total)}</span></div>
                </div>
              </section>

              <section className="rounded-xl border p-3">
                <p className="font-display text-sm font-semibold flex items-center gap-2">
                  <User className="h-3.5 w-3.5" /> Customer
                </p>
                <div className="mt-2 text-sm">
                  {order.customerName ? (
                    <>
                      <p className="font-medium">{order.customerName}</p>
                      {order.customerPhone && <p className="text-muted-foreground">{order.customerPhone}</p>}
                      {order.customerId && (
                        <Link
                          to={"/app/customers/$id" as any}
                          params={{ id: order.customerId } as any}
                          className="mt-1 inline-block text-xs text-primary hover:underline"
                          onClick={() => onOpenChange(false)}
                        >
                          View profile →
                        </Link>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">Not linked yet. Collected at payment.</p>
                  )}
                </div>
              </section>

              <section className="grid gap-2">
                {order.status === "completed" ? (
                  <p className="rounded-xl bg-emerald-500/10 p-3 text-center text-xs text-emerald-700 dark:text-emerald-300">
                    This order is completed — actions are disabled.
                  </p>
                ) : null}
                {order.status !== "completed" && order.paymentStatus !== "paid" && (
                  <Button className="w-full rounded-full gradient-brand text-primary-foreground" onClick={() => setPayOpen(true)}>
                    <Check className="mr-1.5 h-4 w-4" /> Collect payment
                  </Button>
                )}
                {order.paymentStatus === "paid" && order.status !== "completed" && (
                  <Button className="w-full rounded-full gradient-brand text-primary-foreground" onClick={markCompleted}>
                    <Check className="mr-1.5 h-4 w-4" /> Close session
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="rounded-full" onClick={() => setInvOpen(true)}>
                    <FileText className="mr-1.5 h-4 w-4" /> View bill
                  </Button>
                  <Button variant="outline" className="rounded-full" onClick={() => { setInvOpen(true); setTimeout(() => window.print(), 250); }}>
                    <Printer className="mr-1.5 h-4 w-4" /> Print
                  </Button>
                </div>
              </section>
            </div>

            <CompletePaymentDialog order={order} open={payOpen} onOpenChange={setPayOpen} />
            <AddItemsDialog order={order} open={addOpen} onOpenChange={setAddOpen} />
            <Dialog open={invOpen} onOpenChange={setInvOpen}>
              <DialogContent className="max-w-md rounded-2xl">
                <DialogHeader><DialogTitle className="font-display">Bill</DialogTitle></DialogHeader>
                <div className="print-area"><InvoiceView order={order} /></div>
                <div className="flex justify-end gap-2 print:hidden">
                  <Button variant="outline" className="rounded-full" onClick={() => window.print()}>
                    <Printer className="mr-1.5 h-4 w-4" /> Print
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}