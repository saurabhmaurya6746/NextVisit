import { AppLink } from "@/lib/app-nav";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, ShoppingBag, QrCode, ExternalLink, Copy, AlertCircle, Search,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // Server-side Pagination State
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  // Reset page to 1 whenever any filter or search term changes
  const handleTabChange = (val: string) => {
    setTab(val as "POS" | "QR");
    setPage(1);
  };

  const handleFilterChange = (statusVal: string) => {
    setFilter(statusVal);
    setPage(1);
  };

  const handleDateFilterChange = (dateVal: any) => {
    setDateFilter(dateVal);
    setPage(1);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setPage(1);
  };

  // ---------------------------------------------------------------------------
  // Server-Side Paginated Data Fetching via React Query
  // ---------------------------------------------------------------------------
  const {
    data: paginatedData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["orders", page, pageSize, tab, filter, dateFilter, searchQuery, customFrom, customTo],
    queryFn: () =>
      listOrdersApi({
        page,
        page_size: pageSize,
        order_source: tab,
        status: filter === "all" ? undefined : filter,
        date_filter: dateFilter === "all" ? undefined : dateFilter,
        search: searchQuery.trim() || undefined,
        start_date: dateFilter === "custom" && customFrom ? customFrom : undefined,
        end_date: dateFilter === "custom" && customTo ? customTo : undefined,
      }),
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

  const ordersList = paginatedData?.items || [];
  const totalItems = paginatedData?.total_items || 0;
  const totalPages = paginatedData?.total_pages || 1;
  const hasNext = paginatedData?.has_next || false;
  const hasPrevious = paginatedData?.has_previous || false;

  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  const allTablesList = useMemo(() => {
    return diningAreas.flatMap((a) => a.tables.map((t) => t.table_name));
  }, [diningAreas]);

  const bizSlug =
    (profile.name || "business")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "business";

  // Build page numbers list for desktop pagination
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <PageTransition>
      <PageHeader
        title="Orders"
        description={`${totalItems} orders found · Server-side paginated (${pageSize}/page)`}
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

      <Tabs value={tab} onValueChange={handleTabChange}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <TabsList className="rounded-full w-fit">
            <TabsTrigger value="POS" className="rounded-full">
              Staff orders
            </TabsTrigger>
            <TabsTrigger value="QR" className="rounded-full">
              QR orders
            </TabsTrigger>
          </TabsList>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customer, phone, order #..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 text-xs rounded-full h-9"
            />
          </div>
        </div>

        {(["POS", "QR"] as const).map((t) => (
          <TabsContent key={t} value={t} className="mt-0">
            <div className="mb-3 flex flex-wrap gap-1.5 items-center">
              {(["all", "OPEN", "PREPARING", "READY", "SERVED", "CANCELLED"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleFilterChange(s)}
                  className={`rounded-full border px-3 py-1 text-xs transition-all ${
                    filter === s
                      ? "gradient-brand text-primary-foreground border-transparent"
                      : "hover:border-primary"
                  }`}
                >
                  {s === "all" ? "All Statuses" : s}
                </button>
              ))}
              <span className="mx-1 h-5 w-px bg-border" />
              {(["today", "yesterday", "week", "month", "all", "custom"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => handleDateFilterChange(d)}
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
                    onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
                    className="rounded-full border bg-background px-2 py-0.5 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">→</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
                    className="rounded-full border bg-background px-2 py-0.5 text-xs"
                  />
                </div>
              )}
            </div>

            {isLoading ? (
              <SkeletonRows rows={6} cols={8} />
            ) : isError ? (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {(error as Error)?.message || "Failed to load orders."}
              </div>
            ) : ordersList.length === 0 ? (
              <EmptyState
                title={t === "QR" ? "No QR self-orders found" : "No staff orders found"}
                description={
                  searchQuery
                    ? `No orders matching "${searchQuery}". Try clearing your search.`
                    : t === "QR"
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
              <div className="space-y-4">
                <Card className="rounded-2xl p-2 sm:p-4 border shadow-sm">
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
                        {ordersList.map((o) => {
                          const tableName = tableMap.get(o.table_id) || `Table`;
                          const itemCount = o.items.reduce((s, i) => s + i.quantity, 0);

                          return (
                            <TableRow
                              key={o.id}
                              className="cursor-pointer hover:bg-muted/40 transition-colors"
                              onClick={() => setOpenId(o.id)}
                            >
                              <TableCell className="font-mono text-xs font-semibold text-foreground">{o.order_number}</TableCell>
                              <TableCell className="font-medium text-foreground">{tableName}</TableCell>
                              <TableCell
                                className="font-medium"
                                onClick={(e) => o.customer_id && e.stopPropagation()}
                              >
                                {o.customer ? (
                                  <AppLink
                                    path="customers/$id"
                                    params={{ id: o.customer.id }}
                                    className="hover:text-primary hover:underline text-foreground"
                                  >
                                    {o.customer.name} ({o.customer.phone})
                                  </AppLink>
                                ) : o.customer_id ? (
                                  <AppLink
                                    path="customers/$id"
                                    params={{ id: o.customer_id }}
                                    className="hover:text-primary hover:underline text-foreground"
                                  >
                                    Customer #{o.customer_id.slice(-6)}
                                  </AppLink>
                                ) : (
                                  <span className="text-muted-foreground">Guest Customer</span>
                                )}
                              </TableCell>
                              <TableCell className="text-foreground">{itemCount} items</TableCell>
                              <TableCell className="text-right font-semibold font-mono text-foreground">{fmt(o.total_amount)}</TableCell>
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
                                  className="min-h-[36px] rounded-full px-3 text-xs"
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

                {/* SERVER-SIDE PAGINATION CONTROLS */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border p-4 bg-card shadow-xs">
                  {/* Page Summary Information */}
                  <div className="text-xs text-muted-foreground text-center sm:text-left">
                    Showing <span className="font-semibold text-foreground">{startItem}–{endItem}</span> of{" "}
                    <span className="font-semibold text-foreground">{totalItems}</span> Orders · Page{" "}
                    <span className="font-semibold text-foreground">{page}</span> of{" "}
                    <span className="font-semibold text-foreground">{totalPages}</span>
                  </div>

                  {/* Desktop & Mobile Pagination Buttons */}
                  <div className="flex items-center gap-1.5">
                    {/* Previous Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs h-8 px-3"
                      disabled={!hasPrevious || page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                      <span className="hidden sm:inline">Previous</span>
                      <span className="sm:hidden">Prev</span>
                    </Button>

                    {/* Desktop Page Numbers */}
                    <div className="hidden sm:flex items-center gap-1">
                      {pageNumbers.map((pageNum) => (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? "default" : "outline"}
                          size="sm"
                          className={`rounded-full h-8 w-8 text-xs p-0 ${
                            page === pageNum ? "gradient-brand text-primary-foreground font-bold" : ""
                          }`}
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      ))}
                    </div>

                    {/* Mobile Page Counter Badge */}
                    <div className="sm:hidden text-xs font-semibold px-2">
                      {page} / {totalPages}
                    </div>

                    {/* Next Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs h-8 px-3"
                      disabled={!hasNext || page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <span className="hidden sm:inline">Next</span>
                      <span className="sm:hidden">Next</span>
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
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