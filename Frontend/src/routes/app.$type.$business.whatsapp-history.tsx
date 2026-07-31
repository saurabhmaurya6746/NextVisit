import { AppLink } from "@/lib/app-nav";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MessageCircle, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { useWhatsAppHistory, fetchBackendCampaignLogsApi, type WhatsAppKind, type WhatsAppLog } from "@/lib/whatsapp-history";
import { useOrders, useExtraCustomers } from "@/lib/orders-store";
import { useAppointments } from "@/lib/appointments-store";
import { customers } from "@/lib/sample-data";
import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/app/$type/$business/whatsapp-history")({ component: WhatsAppHistoryPage });

const kindMeta: Record<WhatsAppKind, { label: string; tone: string }> = {
  birthday: { label: "Birthday", tone: "border-primary/40 text-primary" },
  anniversary: { label: "Anniversary", tone: "border-accent/40 text-accent-foreground" },
  recovery: { label: "Recovery", tone: "border-warning/40 text-warning-foreground" },
  review: { label: "Review", tone: "border-info/40 text-info" },
  campaign: { label: "Campaign", tone: "border-primary/40 text-primary" },
  manual: { label: "Manual", tone: "border-muted-foreground/40 text-muted-foreground" },
};

function WhatsAppHistoryPage() {
  const session = getSession();
  const localLogs = useWhatsAppHistory();
  const orders = useOrders();
  const appts = useAppointments();
  const extras = useExtraCustomers();

  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | WhatsAppKind>("all");
  const [range, setRange] = useState<"all" | "today" | "week" | "month">("all");

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Fetch real backend SENT campaign logs
  const { data: backendLogs = [] } = useQuery({
    queryKey: ["backend-whatsapp-logs", session?.clientId],
    queryFn: fetchBackendCampaignLogsApi,
    refetchInterval: 30000,
  });

  const lookup = useMemo(() => {
    const map = new Map<string, { name: string; phone: string }>();
    for (const c of customers) map.set(c.id, { name: c.name, phone: c.phone });
    for (const c of extras) map.set(c.id, { name: c.name, phone: c.phone });
    for (const o of orders) if (o.customerId) map.set(o.customerId, { name: o.customerName || "Guest", phone: o.customerPhone || "—" });
    for (const a of appts) if (a.customerId) map.set(a.customerId, { name: a.customerName || "Guest", phone: a.customerPhone || "—" });
    return map;
  }, [orders, appts, extras]);

  // Combine backend & local logs, avoiding duplicates
  const allMergedLogs = useMemo(() => {
    const map = new Map<string, WhatsAppLog>();
    for (const l of backendLogs) {
      map.set(l.id, l);
    }
    for (const l of localLogs) {
      if (!map.has(l.id)) {
        map.set(l.id, l);
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [backendLogs, localLogs]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const now = Date.now();
    const dayMs = 86_400_000;
    return allMergedLogs.filter((m) => {
      if (kind !== "all" && m.kind !== kind) return false;
      const t = new Date(m.date).getTime();
      if (range === "today" && now - t > dayMs) return false;
      if (range === "week" && now - t > 7 * dayMs) return false;
      if (range === "month" && now - t > 30 * dayMs) return false;
      if (q) {
        const c = lookup.get(m.customerId);
        const nameStr = m.customerName || c?.name || "";
        const phoneStr = m.customerPhone || c?.phone || "";
        const hay = `${nameStr} ${phoneStr} ${m.message}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [allMergedLogs, q, kind, range, lookup]);

  // Pagination Math
  const totalItems = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const currentPage = Math.min(page, totalPages);

  const startIndex = (currentPage - 1) * limit;
  const endIndex = Math.min(startIndex + limit, totalItems);
  const paginatedRows = useMemo(() => {
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, startIndex, endIndex]);

  const handleFilterChange = (setter: (val: any) => void) => (val: any) => {
    setter(val);
    setPage(1);
  };

  return (
    <PageTransition>
      <PageHeader title="WhatsApp History" description="Every message you've sent from NextVisit, in one place." />
      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="p-4 sm:p-6">
          {/* SEARCH & FILTERS BAR */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search customer, phone or message"
                className="pl-9 rounded-full"
              />
            </div>
            <Select value={kind} onValueChange={handleFilterChange(setKind)}>
              <SelectTrigger className="w-[160px] rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="birthday">Birthday</SelectItem>
                <SelectItem value="anniversary">Anniversary</SelectItem>
                <SelectItem value="recovery">Recovery</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="campaign">Campaign</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={range} onValueChange={handleFilterChange(setRange)}>
              <SelectTrigger className="w-[140px] rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* TABLE AREA */}
          {filteredRows.length === 0 ? (
            <EmptyState
              title="No WhatsApp messages found"
              description="Messages you send from campaigns, recovery, or profiles will appear here."
              icon={<MessageCircle className="h-7 w-7" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((m) => {
                    const c = lookup.get(m.customerId);
                    const custName = m.customerName || c?.name || "Guest";
                    const custPhone = m.customerPhone || c?.phone || "—";
                    const meta = kindMeta[m.kind] ?? kindMeta.manual;

                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <AppLink path="customers/$id" params={{ id: m.customerId }} className="font-medium hover:underline">
                            {custName}
                          </AppLink>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{custPhone}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`rounded-full text-[10px] ${meta.tone}`}>
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[360px] truncate text-sm text-muted-foreground">{m.message}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(m.date).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-full text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                            Sent
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* PAGINATION CONTROLS BAR */}
          {totalItems > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="text-xs">Rows per page:</span>
                <Select
                  value={limit.toString()}
                  onValueChange={(v) => {
                    setLimit(Number(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px] rounded-md text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="ml-2 text-xs">
                  Showing {startIndex + 1}–{Math.min(endIndex, totalItems)} of {totalItems} entries
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs rounded-md"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - currentPage) <= 1
                  )
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                      <span key={p} className="flex items-center">
                        {showEllipsis && <span className="px-1 text-xs">…</span>}
                        <Button
                          variant={currentPage === p ? "default" : "outline"}
                          size="sm"
                          className={`h-8 w-8 p-0 text-xs rounded-md ${
                            currentPage === p ? "font-bold" : ""
                          }`}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </Button>
                      </span>
                    );
                  })}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs rounded-md"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}