import { AppLink } from "@/lib/app-nav";
import { useParams } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ShoppingBag,
  User,
  Loader2,
  AlertCircle,
  RefreshCw,
  FileText,
  CreditCard,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getOrderByIdApi, getTablesMapApi } from "@/lib/orders-api";
import { OrderDetailSheet } from "@/components/order-detail-sheet";
import { InvoiceView } from "@/components/invoice-view";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmt } from "@/lib/currency";

export const Route = createFileRoute("/app/$type/$business/orders/$id")({
  loader: ({ params }) => ({ id: params.id }),
  component: OrderDetail,
});

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  PREPARING: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  READY: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  SERVED: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  COMPLETED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  CANCELLED: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

const PAY_TONE: Record<string, string> = {
  UNPAID: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  PAID: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

export default function OrderDetail() {
  const { id } = useParams<{ id?: string }>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);

  // Fetch real backend order data by order ID
  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrderByIdApi(id),
    enabled: !!id,
  });

  // Fetch dining areas to display table name
  const { data: diningAreas = [] } = useQuery({
    queryKey: ["tables", "map"],
    queryFn: getTablesMapApi,
    enabled: !!order?.table_id,
  });

  const tableName = useMemo(() => {
    if (!order?.table_id) return "Table N/A";
    if (Array.isArray(diningAreas)) {
      for (const area of diningAreas) {
        if (Array.isArray(area?.tables)) {
          for (const t of area.tables) {
            if (t?.id === order.table_id) return t.table_name || "Table";
          }
        }
      }
    }
    return "Table";
  }, [order?.table_id, diningAreas]);

  // Loading State
  if (isLoading) {
    return (
      <PageTransition>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">
            Loading order details...
          </p>
        </div>
      </PageTransition>
    );
  }

  // Error State
  if (isError || !order) {
    return (
      <PageTransition>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <h3 className="font-display text-lg font-semibold">Unable to load order details</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {(error as Error)?.message || "The order could not be found or has been removed."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-full text-xs" onClick={() => refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try Again
            </Button>
            <AppLink path="orders">
              <Button className="rounded-full text-xs">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Orders
              </Button>
            </AppLink>
          </div>
        </div>
      </PageTransition>
    );
  }

  const formattedDate = order.created_at
    ? new Date(order.created_at).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  return (
    <PageTransition>
      <PageHeader
        title={`Order #${order.order_number || order.id.slice(-6)}`}
        description={`${tableName} · ${formattedDate} · ${
          order.order_source === "QR" ? "QR Self-order" : "Staff Order"
        }`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <AppLink path="orders">
              <Button variant="outline" size="sm" className="rounded-full text-xs">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Orders
              </Button>
            </AppLink>
            <Badge
              variant="outline"
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                STATUS_TONE[order.status] || "bg-muted"
              }`}
            >
              {order.status}
            </Badge>
            {order.payment_status && (
              <Badge
                variant="outline"
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  PAY_TONE[order.payment_status] || "bg-muted"
                }`}
              >
                {order.payment_status}
              </Badge>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Main Items Card */}
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" /> Ordered Items ({order.items?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!order.items || order.items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No items added to this order yet.
              </p>
            ) : (
              order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border p-3 text-xs bg-card"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {item.item_name} <span className="text-muted-foreground font-normal">× {item.quantity}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {fmt(item.unit_price)} each
                    </p>
                    {item.notes && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                        Note: {item.notes}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold font-mono text-sm text-foreground">
                    {fmt(item.unit_price * item.quantity)}
                  </span>
                </div>
              ))
            )}

            {/* Pricing Breakdown */}
            <div className="mt-4 space-y-1.5 rounded-xl bg-muted/40 p-3.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono font-medium">{fmt(order.subtotal || 0)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount</span>
                  <span className="font-mono font-medium">-{fmt(order.discount_amount)}</span>
                </div>
              )}
              {order.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax / GST</span>
                  <span className="font-mono font-medium">{fmt(order.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-display text-base font-bold text-foreground">
                <span>Total Amount</span>
                <span className="font-mono text-primary">{fmt(order.total_amount || 0)}</span>
              </div>
            </div>

            {order.notes && (
              <div className="mt-2 text-xs border rounded-xl p-3 bg-muted/20">
                <span className="font-semibold text-foreground">Order Notes: </span>
                <span className="text-muted-foreground">{order.notes}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar Cards */}
        <div className="space-y-4">
          {/* Order Actions / Manage Card */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="font-display text-sm">Order Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full rounded-full gradient-brand text-primary-foreground text-xs font-semibold"
                onClick={() => setSheetOpen(true)}
              >
                <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Manage & Settle Order
              </Button>
            </CardContent>
          </Card>

          {/* Customer Card */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="font-display text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              {order.customer ? (
                <>
                  <p className="font-semibold text-sm text-foreground">{order.customer.name}</p>
                  {order.customer.phone && (
                    <p className="text-muted-foreground">{order.customer.phone}</p>
                  )}
                  {order.customer.email && (
                    <p className="text-muted-foreground">{order.customer.email}</p>
                  )}
                  <AppLink
                    path="customers/$id"
                    params={{ id: order.customer.id }}
                    className="mt-2 inline-block font-medium text-primary hover:underline"
                  >
                    View Customer Profile →
                  </AppLink>
                </>
              ) : (
                <p className="text-muted-foreground">Guest / Walk-in Customer</p>
              )}
            </CardContent>
          </Card>

          {/* Bill & Receipt Card */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="font-display text-sm">Invoice & Receipt</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button
                variant="outline"
                className="w-full rounded-full text-xs"
                onClick={() => setInvOpen(true)}
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" /> View Bill / Invoice
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Order Detail Sheet Modal */}
      <OrderDetailSheet
        orderId={id}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      {/* Invoice Modal */}
      <Dialog open={invOpen} onOpenChange={setInvOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Order Invoice</DialogTitle>
          </DialogHeader>
          <div className="print-area max-h-[70vh] overflow-y-auto">
            <InvoiceView order={order as any} />
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}