import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Printer, Plus, ShoppingBag, User, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOrderByIdApi, getTablesMapApi } from "@/lib/orders-api";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";

interface Props {
  orderId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  PREPARING: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  READY: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  SERVED: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  CANCELLED: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export function OrderDetailSheet({ orderId, open, onOpenChange }: Props) {
  const qc = useQueryClient();

  // ---------------------------------------------------------------------------
  // Data Fetching via React Query
  // ---------------------------------------------------------------------------
  const {
    data: order,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["orders", orderId],
    queryFn: () => getOrderByIdApi(orderId!),
    enabled: !!orderId && open,
  });

  const { data: diningAreas = [] } = useQuery({
    queryKey: ["tables", "map"],
    queryFn: getTablesMapApi,
    enabled: open,
  });

  const tableName = (() => {
    if (!order) return "";
    for (const area of diningAreas) {
      for (const t of area.tables) {
        if (t.id === order.table_id) return t.table_name;
      }
    }
    return `Table`;
  })();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading order details…
          </div>
        ) : isError || !order ? (
          <div className="p-6 text-sm text-muted-foreground">Order not found.</div>
        ) : (
          <>
            <SheetHeader className="border-b p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <SheetTitle className="font-display text-lg">
                    {order.order_number}
                  </SheetTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {tableName} · {order.order_source === "QR" ? "QR self-order" : "Staff order"} ·{" "}
                    {new Date(order.created_at).toLocaleDateString("en-GB")} ·{" "}
                    {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge className={`rounded-full ${STATUS_TONE[order.status] || "bg-muted"}`}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-4 p-5">
              {/* Items Section */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-display text-sm font-semibold flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-primary" /> Order Items
                  </p>
                </div>
                <div className="space-y-2">
                  {order.items.map((i) => (
                    <div
                      key={i.id}
                      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-xl border p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{i.item_name}</p>
                        {i.notes && <p className="text-xs text-muted-foreground">Note: {i.notes}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground">× {i.quantity}</span>
                      <span className="text-xs text-muted-foreground">{fmt(i.unit_price)}</span>
                      <span className="font-semibold tabular-nums">{fmt(i.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1 rounded-xl bg-muted/40 p-3 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{fmt(order.subtotal)}</span>
                  </div>
                  {order.tax_amount > 0 && (
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span>{fmt(order.tax_amount)}</span>
                    </div>
                  )}
                  {order.discount_amount > 0 && (
                    <div className="flex justify-between text-rose-500">
                      <span>Discount</span>
                      <span>-{fmt(order.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 font-display text-base font-semibold">
                    <span>Total Amount</span>
                    <span>{fmt(order.total_amount)}</span>
                  </div>
                </div>
              </section>

              {/* Customer Section */}
              <section className="rounded-xl border p-3">
                <p className="font-display text-sm font-semibold flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-primary" /> Customer Profile
                </p>
                <div className="mt-2 text-sm">
                  {order.customer_id ? (
                    <div>
                      <p className="font-medium">Attached Customer</p>
                      <p className="text-xs text-muted-foreground font-mono">{order.customer_id}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Guest Order (No customer profile attached)</p>
                  )}
                </div>
              </section>

              {order.notes && (
                <section className="rounded-xl border p-3 bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground">Order Notes</p>
                  <p className="text-sm mt-1">{order.notes}</p>
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}