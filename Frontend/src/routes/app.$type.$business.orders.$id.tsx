import { AppLink } from "@/lib/app-nav";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Printer, FileText, Plus, ShoppingBag, User } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrders, updateOrder, statusLabel, paymentLabel, type OrderStatus, type PaymentStatus } from "@/lib/orders-store";
import { CompletePaymentDialog } from "@/components/complete-payment-dialog";
import { AddItemsDialog } from "@/components/add-items-dialog";
import { InvoiceView } from "@/components/invoice-view";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { fmt } from "@/lib/currency";

export const Route = createFileRoute("/app/$type/$business/orders/$id")({ component: OrderDetail });

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};
const PAY_TONE: Record<PaymentStatus, string> = {
  unpaid: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

function OrderDetail() {
  const { id } = Route.useParams();
  const orders = useOrders();
  const order = useMemo(() => orders.find((o) => o.id === id), [orders, id]);
  const navigate = useNavigate();
  const [payOpen, setPayOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  if (!order) {
    return (
      <PageTransition>
        <PageHeader title="Order not found" description="It may have been removed or the link is invalid." />
        <Button variant="outline" className="rounded-full" onClick={() => navigate({ to: "/app/orders" as any })}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to orders</Button>
      </PageTransition>
    );
  }

  const markCompleted = () => {
    if (order.paymentStatus !== "paid") {
      toast.error("Collect payment before completing the order.");
      setPayOpen(true);
      return;
    }
    updateOrder(order.id, { status: "completed" });
    toast.success("Order completed");
  };

  return (
    <PageTransition>
      <PageHeader
        title={`Order ${order.id.slice(-6)}`}
        description={`Table ${order.table} · ${new Date(order.createdAt).toLocaleString()} · ${order.source === "qr" ? "QR self-order" : "Staff order"}`}
        actions={
          <>
            <AppLink path="orders"><Button variant="outline" size="sm" className="rounded-full"><ArrowLeft className="mr-1.5 h-4 w-4" /> Orders</Button></AppLink>
            <Badge className={`rounded-full ${STATUS_TONE[order.status]}`}>{statusLabel(order.status)}</Badge>
            <Badge className={`rounded-full ${PAY_TONE[order.paymentStatus]}`}>{paymentLabel(order.paymentStatus)}</Badge>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-primary" /> Items</CardTitle>
            {order.status !== "completed" && (
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add more items
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {order.items.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">{i.name} <span className="text-muted-foreground">× {i.qty}</span></p>
                  {i.notes && <p className="text-xs text-muted-foreground">Note: {i.notes}</p>}
                </div>
                <span className="font-semibold">{fmt(i.price * i.qty)}</span>
              </div>
            ))}
            <div className="mt-3 space-y-1 rounded-xl bg-muted/40 p-3 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
              {order.gst > 0 && <div className="flex justify-between"><span>GST</span><span>{fmt(order.gst)}</span></div>}
              <div className="flex justify-between border-t pt-1 font-display text-lg font-semibold"><span>Total</span><span>{fmt(order.total)}</span></div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="font-display text-sm">Workspace</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div className={`rounded-md py-1 text-center ${order.status === "pending" ? "gradient-brand text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Pending</div>
                <div className={`rounded-md py-1 text-center ${order.status === "completed" ? "gradient-brand text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Completed</div>
              </div>
              {order.paymentStatus !== "paid" && (
                <Button className="w-full rounded-full gradient-brand text-primary-foreground" onClick={() => setPayOpen(true)}>
                  <Check className="mr-1.5 h-4 w-4" /> Collect payment
                </Button>
              )}
              {order.paymentStatus === "paid" && order.status !== "completed" && (
                <Button className="w-full rounded-full gradient-brand text-primary-foreground" onClick={markCompleted}>
                  <Check className="mr-1.5 h-4 w-4" /> Mark completed
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="font-display text-sm flex items-center gap-2"><User className="h-3.5 w-3.5" /> Customer</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {order.customerName ? (
                <>
                  <p className="font-medium">{order.customerName}</p>
                  {order.customerPhone && <p className="text-muted-foreground">{order.customerPhone}</p>}
                  {order.customerId && <AppLink path="customers/$id" params={{ id: order.customerId }} className="mt-1 inline-block text-xs text-primary hover:underline">View profile →</AppLink>}
                </>
              ) : (
                <p className="text-muted-foreground">Not linked yet. Collected at payment.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="font-display text-sm">Bill</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setInvOpen(true)}><FileText className="mr-1.5 h-4 w-4" /> View bill</Button>
              <Button variant="outline" className="rounded-full" onClick={() => { setInvOpen(true); setTimeout(() => window.print(), 250); }}><Printer className="mr-1.5 h-4 w-4" /> Print bill</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <CompletePaymentDialog order={order} open={payOpen} onOpenChange={setPayOpen} />
      <AddItemsDialog order={order} open={addOpen} onOpenChange={setAddOpen} />

      <Dialog open={invOpen} onOpenChange={setInvOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="font-display">Bill</DialogTitle></DialogHeader>
          <div className="print-area"><InvoiceView order={order} /></div>
          <div className="flex justify-end gap-2 print:hidden">
            <Button variant="outline" className="rounded-full" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" /> Print</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}