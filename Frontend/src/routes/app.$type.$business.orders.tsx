import { AppLink } from "@/lib/app-nav";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, ShoppingBag, QrCode, ExternalLink, Copy } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { NewOrderDialog } from "@/components/new-order-dialog";
import { OrderDetailSheet } from "@/components/order-detail-sheet";
import { SkeletonRows, useShortMountFlag } from "@/components/skeletons";
import { useOrders, statusLabel, paymentLabel, orderCode, type OrderStatus, type PaymentStatus } from "@/lib/orders-store";
import { useProfile } from "@/lib/business-profile";
import { toast } from "sonner";
import { fmt } from "@/lib/currency";

export const Route = createFileRoute("/app/$type/$business/orders")({
  component: OrdersPage,
  validateSearch: (s: Record<string, unknown>) => ({
    payment: s.payment === "unpaid" || s.payment === "paid" ? (s.payment as "unpaid" | "paid") : undefined,
  }),
});

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};
const PAY_TONE: Record<PaymentStatus, string> = {
  unpaid: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

function OrdersPage() {
  const live = useOrders();
  const profile = useProfile("restaurant");
  const [open, setOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const search = Route.useSearch();
  const [payFilter, setPayFilter] = useState<"all" | PaymentStatus>(search.payment ?? "all");
  useEffect(() => { if (search.payment) setPayFilter(search.payment); }, [search.payment]);
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "week" | "month" | "all" | "custom">("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [tab, setTab] = useState<"staff" | "qr">("staff");
  const [openId, setOpenId] = useState<string | null>(null);
  const loading = useShortMountFlag();

  const filtered = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startYesterday = startToday - 86_400_000;
    // This week = Monday to Sunday
    const dow = (new Date(startToday).getDay() + 6) % 7; // Mon=0
    const startWeek = startToday - dow * 86_400_000;
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const from = customFrom ? new Date(customFrom).getTime() : 0;
    const to = customTo ? new Date(customTo).getTime() + 86_400_000 : Number.MAX_SAFE_INTEGER;
    const list = live.filter((o) => {
      if (o.source !== tab) return false;
      if (filter !== "all" && o.status !== filter) return false;
      if (payFilter !== "all" && o.paymentStatus !== payFilter) return false;
      const t = new Date(o.createdAt).getTime();
      if (dateFilter === "today") return t >= startToday;
      if (dateFilter === "yesterday") return t >= startYesterday && t < startToday;
      if (dateFilter === "week") return t >= startWeek;
      if (dateFilter === "month") return t >= startMonth;
      if (dateFilter === "custom") return t >= from && t < to;
      return true;
    });
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [live, tab, filter, payFilter, dateFilter, customFrom, customTo]);

  const tables = [...profile.tableNames, ...(profile.parcel ? ["Parcel"] : []), ...(profile.takeaway ? ["Take Away"] : [])];
  const bizSlug = (profile.name || "business").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "business";

  return (
    <PageTransition>
      <PageHeader
        title="Orders"
        description={`${live.length} orders total · ${live.filter((o) => o.status !== "completed").length} live`}
        actions={
          <>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setQrOpen(true)}>
              <QrCode className="mr-1.5 h-4 w-4" /> QR self-order links
            </Button>
            <Button size="sm" className="rounded-full gradient-brand text-primary-foreground transition-transform hover:scale-105 active:scale-95" onClick={() => setOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> New staff order
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="rounded-full">
          <TabsTrigger value="staff" className="rounded-full">Staff orders</TabsTrigger>
          <TabsTrigger value="qr" className="rounded-full">QR orders</TabsTrigger>
        </TabsList>

        {(["staff", "qr"] as const).map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(["all", "pending", "completed"] as const).map((s) => (
                <button key={s} onClick={() => setFilter(s)}
                  className={`rounded-full border px-3 py-1 text-xs transition-all ${filter === s ? "gradient-brand text-primary-foreground border-transparent" : "hover:border-primary"}`}>
                  {s === "all" ? "All" : statusLabel(s as OrderStatus)}
                </button>
              ))}
              <span className="mx-1 h-5 w-px bg-border" />
              {(["all", "unpaid", "paid"] as const).map((p) => (
                <button key={p} onClick={() => setPayFilter(p)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize transition-all ${payFilter === p ? "gradient-brand text-primary-foreground border-transparent" : "hover:border-primary"}`}>
                  {p === "all" ? "All payments" : p}
                </button>
              ))}
              <span className="mx-1 h-5 w-px bg-border" />
              {(["today", "yesterday", "week", "month", "all", "custom"] as const).map((d) => (
                <button key={d} onClick={() => setDateFilter(d)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize transition-all ${dateFilter === d ? "gradient-brand text-primary-foreground border-transparent" : "hover:border-primary"}`}>
                  {d === "week" ? "This week" : d === "month" ? "This month" : d}
                </button>
              ))}
              {dateFilter === "custom" && (
                <div className="ml-2 flex items-center gap-1">
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-full border bg-background px-2 py-0.5 text-xs" />
                  <span className="text-xs text-muted-foreground">→</span>
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-full border bg-background px-2 py-0.5 text-xs" />
                </div>
              )}
            </div>

            {loading ? (
              <SkeletonRows rows={5} cols={8} />
            ) : filtered.length === 0 ? (
              <EmptyState
                title={t === "qr" ? "No QR self-orders yet" : "No staff orders yet"}
                description={t === "qr" ? "Share a QR link with a table — orders arrive here automatically." : "Create your first table order to get started."}
                icon={<ShoppingBag className="h-7 w-7" />}
                action={t === "qr"
                  ? <Button className="rounded-full" variant="outline" onClick={() => setQrOpen(true)}><QrCode className="mr-1.5 h-4 w-4" /> View QR links</Button>
                  : <Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> New staff order</Button>}
              />
            ) : (
              <Card className="rounded-2xl p-2 sm:p-4">
                <div className="-mx-2 overflow-x-auto sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((o) => (
                      <TableRow key={o.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setOpenId(o.id)}>
                        <TableCell className="font-mono text-xs">{orderCode(o)}</TableCell>
                        <TableCell>{o.table}</TableCell>
                        <TableCell className="font-medium" onClick={(e) => o.customerId && e.stopPropagation()}>
                          {o.customerId ? (
                            <AppLink path="customers/$id" params={{ id: o.customerId }} className="hover:text-primary hover:underline">
                              {o.customerName || o.customerPhone}
                            </AppLink>
                          ) : (o.customerName || o.customerPhone || <span className="text-muted-foreground">—</span>)}
                        </TableCell>
                        <TableCell>{o.items.reduce((s, i) => s + i.qty, 0)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(o.total)}</TableCell>
                        <TableCell><Badge className={`rounded-full ${STATUS_TONE[o.status]}`}>{statusLabel(o.status)}</Badge></TableCell>
                        <TableCell><Badge className={`rounded-full ${PAY_TONE[o.paymentStatus]}`}>{paymentLabel(o.paymentStatus)}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">{new Date(o.createdAt).toLocaleDateString("en-GB")}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}><Button size="sm" variant="ghost" className="min-h-[44px] rounded-full px-4" onClick={() => setOpenId(o.id)}>Open</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <NewOrderDialog open={open} onOpenChange={setOpen} />
      <OrderDetailSheet orderId={openId} open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} />

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" /> QR self-order links</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Print a QR pointing to each URL and place it on the table. Customers scan → order → order lands in QR orders.</p>
          <div className="max-h-[380px] space-y-2 overflow-y-auto">
            {tables.map((t) => {
              const slug = t.toLowerCase().replace(/\s+/g, "-");
              const path = `/qr/${bizSlug}/${encodeURIComponent(slug)}`;
              const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
              return (
                <div key={t} className="flex items-center justify-between rounded-xl border p-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{url}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}><Copy className="h-4 w-4" /></Button>
                    <a href={path} target="_blank" rel="noreferrer"><Button size="icon" variant="ghost"><ExternalLink className="h-4 w-4" /></Button></a>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}