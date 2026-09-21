import { AppLink } from "@/lib/app-nav";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, ShoppingBag, QrCode, ExternalLink, Copy, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { NewOrderDialog } from "@/components/new-order-dialog";
import { OrderDetailSheet } from "@/components/order-detail-sheet";
import { SkeletonRows } from "@/components/skeletons";
import { useQuery } from "@tanstack/react-query";
import { listOrdersApi, getTablesMapApi, type BackendOrder } from "@/lib/orders-api";
import { useProfile } from "@/lib/business-profile";
import { toast } from "sonner";
import { fmt } from "@/lib/currency";

export const Route = createFileRoute("/app/$type/$business/orders")({
  component: OrdersPage,
  validateSearch: (s: Record<string, unknown>) => ({
    payment: s.payment === "unpaid" || s.payment === "paid" ? (s.payment as "unpaid" | "paid") : undefined,
  }),
});

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  PREPARING: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  READY: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  SERVED: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  CANCELLED: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

function OrdersPage() {
  const profile = useProfile("restaurant");
  const [open, setOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const search = Route.useSearch();
  const [payFilter, setPayFilter] = useState<string>(search.payment ?? "all");
  useEffect(() => {
    if (search.payment) setPayFilter(search.payment);
  }, [search.payment]);

  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "week" | "month" | "all" | "custom">("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [tab, setTab] = useState<"POS" | "QR">("POS");
  const [openId, setOpenId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data Fetching via React Query
  // ---------------------------------------------------------------------------
  const {
    data: liveOrders = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrdersApi(),
    refetchInterval: 10000,
  });

  const { data: diningAreas = [] } = useQuery({
    queryKey: ["tables", "map"],
    queryFn: getTablesMapApi,
  });

  const tableMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const area of diningAreas) {
      for (const t of area.tables) {
        map.set(t.id, t.table_name);
      }
    }
    return map;
  }, [diningAreas]);

  const filtered = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startYesterday = startToday - 86_400_000;
    const dow = (new Date(startToday).getDay() + 6) % 7; // Mon=0
    const startWeek = startToday - dow * 86_400_000;
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const from = customFrom ? new Date(customFrom).getTime() : 0;
    const to = customTo ? new Date(customTo).getTime() + 86_400_000 : Number.MAX_SAFE_INTEGER;

    const list = liveOrders.filter((o) => {
      if (o.order_source !== tab) return false;
      if (filter !== "all" && o.status !== filter) return false;
      const t = new Date(o.created_at).getTime();
      if (dateFilter === "today") return t >= startToday;
      if (dateFilter === "yesterday") return t >= startYesterday && t < startToday;
      if (dateFilter === "week") return t >= startWeek;
      if (dateFilter === "month") return t >= startMonth;
      if (dateFilter === "custom") return t >= from && t < to;
      return true;
    });

    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [liveOrders, tab, filter, dateFilter, customFrom, customTo]);

  const allTablesList = useMemo(() => {
    return diningAreas.flatMap((a) => a.tables.map((t) => t.table_name));
  }, [diningAreas]);

  const bizSlug =
    (profile.name || "business")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "business";

  return (
    <PageTransition>
      <PageHeader
        title="Orders"
        description={`${liveOrders.length} orders total · ${
          liveOrders.filter((o) => o.status !== "CANCELLED").length
        } active`}
        actions={
          <>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setQrOpen(true)}>
              <QrCode className="mr-1.5 h-4 w-4" /> QR self-order links
            </Button>
            <Button
              size="sm"
              className="rounded-full gradient-brand text-primary-foreground transition-transform hover:scale-105 active:scale-95"
              onClick={() => setOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" /> New staff order
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="rounded-full">
          <TabsTrigger value="POS" className="rounded-full">
            Staff orders
          </TabsTrigger>
          <TabsTrigger value="QR" className="rounded-full">
            QR orders
          </TabsTrigger>
        </TabsList>

        {(["POS", "QR"] as const).map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(["all", "OPEN", "PREPARING", "READY", "SERVED", "CANCELLED"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`rounded-full border px-3 py-1 text-xs transition-all ${
                    filter === s
                      ? "gradient-brand text-primary-foreground border-transparent"
                      : "hover:border-primary"
                  }`}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
              <span className="mx-1 h-5 w-px bg-border" />
              {(["today", "yesterday", "week", "month", "all", "custom"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDateFilter(d)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize transition-all ${
                    dateFilter === d
                      ? "gradient-brand text-primary-foreground border-transparent"
                      : "hover:border-primary"
                  }`}
                >
                  {d === "week" ? "This week" : d === "month" ? "This month" : d}
                </button>
              ))}
              {dateFilter === "custom" && (
                <div className="ml-2 flex items-center gap-1">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-full border bg-background px-2 py-0.5 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">→</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded-full border bg-background px-2 py-0.5 text-xs"
                  />
                </div>
              )}
            </div>

            {isLoading ? (
              <SkeletonRows rows={5} cols={8} />
            ) : isError ? (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {(error as Error)?.message || "Failed to load orders."}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={t === "QR" ? "No QR self-orders yet" : "No staff orders yet"}
                description={
                  t === "QR"
                    ? "Share a QR link with a table — orders arrive here automatically."
                    : "Create your first table order to get started."
                }
                icon={<ShoppingBag className="h-7 w-7" />}
                action={
                  t === "QR" ? (
                    <Button className="rounded-full" variant="outline" onClick={() => setQrOpen(true)}>
                      <QrCode className="mr-1.5 h-4 w-4" /> View QR links
                    </Button>
                  ) : (
                    <Button
                      className="rounded-full gradient-brand text-primary-foreground"
                      onClick={() => setOpen(true)}
                    >
                      <Plus className="mr-1.5 h-4 w-4" /> New staff order
                    </Button>
                  )
                }
              />
            ) : (
              <Card className="rounded-2xl p-2 sm:p-4">
                <div className="-mx-2 overflow-x-auto sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Table</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((o) => {
                        const tableName = tableMap.get(o.table_id) || `Table`;
                        const itemCount = o.items.reduce((s, i) => s + i.quantity, 0);

                        return (
                          <TableRow
                            key={o.id}
                            className="cursor-pointer hover:bg-muted/40"
                            onClick={() => setOpenId(o.id)}
                          >
                            <TableCell className="font-mono text-xs font-semibold">{o.order_number}</TableCell>
                            <TableCell className="font-medium">{tableName}</TableCell>
                            <TableCell
                              className="font-medium"
                              onClick={(e) => o.customer_id && e.stopPropagation()}
                            >
                              {o.customer_id ? (
                                <AppLink
                                  path="customers/$id"
                                  params={{ id: o.customer_id }}
                                  className="hover:text-primary hover:underline"
                                >
                                  Customer #{o.customer_id.slice(-6)}
                                </AppLink>
                              ) : (
                                <span className="text-muted-foreground">Guest</span>
                              )}
                            </TableCell>
                            <TableCell>{itemCount}</TableCell>
                            <TableCell className="text-right font-semibold">{fmt(o.total_amount)}</TableCell>
                            <TableCell>
                              <Badge className={`rounded-full ${STATUS_TONE[o.status] || "bg-muted"}`}>
                                {o.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground tabular-nums">
                              {new Date(o.created_at).toLocaleDateString("en-GB")}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(o.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="min-h-[36px] rounded-full px-3"
                                onClick={() => setOpenId(o.id)}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" /> QR self-order links
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Print a QR pointing to each URL and place it on the table. Customers scan → order → order lands in QR orders.
          </p>
          <div className="max-h-[380px] space-y-2 overflow-y-auto">
            {allTablesList.map((t) => {
              const slug = t.toLowerCase().replace(/\s+/g, "-");
              const path = `/qr/${bizSlug}/${encodeURIComponent(slug)}`;
              const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
              return (
                <div key={t} className="flex items-center justify-between rounded-xl border p-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{url}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        toast.success("Link copied");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <a href={path} target="_blank" rel="noreferrer">
                      <Button size="icon" variant="ghost">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
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