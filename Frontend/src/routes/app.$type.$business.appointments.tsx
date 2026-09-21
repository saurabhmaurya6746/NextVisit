import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listCustomersApi } from "@/lib/customers-api";
import { listPaginatedVisitsApi } from "@/lib/visit-services-api";
import { AppLink } from "@/lib/app-nav";
import { createFileRoute } from "@/lib/route-compat";
import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Scissors, Search, ChevronRight, ArrowUpDown, ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppointments, apptCode, type Appointment } from "@/lib/appointments-store";
import { fmt } from "@/lib/currency";
import { AppointmentDetailSheet } from "@/components/appointment-detail-sheet";
import { NewAppointmentDialog } from "@/components/salon/NewAppointmentDialog";

export { NewAppointmentDialog };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/app/$type/$business/appointments")({ component: AppointmentsPage });

type RangeKey = "today" | "week" | "month" | "all";

function inRange(iso: string, range: RangeKey) {
  if (!iso) return true;
  const d = new Date(iso);
  const n = new Date();
  if (isNaN(d.getTime())) return true;

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (range === "today") return sameDay(d, n);
  if (range === "week") {
    const day = (n.getDay() + 6) % 7;
    const start = new Date(n);
    start.setDate(n.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return d >= start && d < end;
  }
  if (range === "month") return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
  return true;
}

const statusColor: Record<string, string> = {
  pending: "bg-warning/15 text-warning-foreground border-warning/30",
  checkedin: "bg-info/15 text-info border-info/30",
  completed: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  paid: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

function getDisplayStatus(a: Appointment) {
  if (a.status === "cancelled") return { label: "Cancelled", color: statusColor.cancelled };
  if (a.status === "pending") return { label: "Pending", color: statusColor.pending };
  if (a.status === "checkedin") return { label: "In Service", color: statusColor.checkedin };
  if (a.status === "completed") {
    if (a.paymentStatus === "paid" || a.paidAt) {
      return { label: "Paid", color: statusColor.paid };
    }
    return { label: "Completed", color: statusColor.completed };
  }
  return { label: a.status, color: "bg-muted text-muted-foreground" };
}

export default function AppointmentsPage() {
  const appts = useAppointments();
  const { data: backendCustomers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: listCustomersApi,
    staleTime: 30000,
  });
  const [range, setRange] = useState<RangeKey>("today");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentStatus, setPaymentStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [openNew, setOpenNew] = useState(false);
  const [detail, setDetail] = useState<Appointment | null>(null);

  const rows = useMemo(() => {
    return appts
      .filter((a) => inRange(a.start, range))
      .filter((a) => {
        if (statusFilter === "all") return true;
        const sf = statusFilter.toLowerCase();
        const st = (a.status || "").toLowerCase();
        if (sf === "open") return st === "pending" || st === "checkedin" || st === "open";
        return st === sf;
      })
      .filter((a) => {
        if (paymentStatus === "all") return true;
        const ps = (a.paymentStatus || (a.paidAt ? "paid" : "unpaid")).toLowerCase();
        return ps === paymentStatus.toLowerCase();
      })
      .filter((a) => !q || (a.customerName || "").toLowerCase().includes(q.toLowerCase()) || (a.customerPhone || "").includes(q) || (a.services || []).some((s) => s.name.toLowerCase().includes(q.toLowerCase())))
      .sort((a, b) => {
        if (sortBy === "oldest") return new Date(a.start).getTime() - new Date(b.start).getTime();
        if (sortBy === "highest_amount") return (b.price || 0) - (a.price || 0);
        if (sortBy === "lowest_amount") return (a.price || 0) - (b.price || 0);
        return new Date(b.start).getTime() - new Date(a.start).getTime();
      });
  }, [appts, range, statusFilter, paymentStatus, q, sortBy]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  const fromItem = total > 0 ? (page - 1) * limit + 1 : 0;
  const toItem = Math.min(page * limit, total);

  const visibleRows = useMemo(() => {
    return rows.slice((page - 1) * limit, page * limit);
  }, [rows, page, limit]);

  useEffect(() => {
    if (page > totalPages && totalPages >= 1) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <PageTransition>
      <PageHeader
        title="Appointments"
        description={`Showing ${total} appointments · Real-time Sync`}
        actions={<Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={() => setOpenNew(true)}><Plus className="mr-1.5 h-4 w-4" /> New appointment</Button>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <TabsList className="rounded-full">
            <TabsTrigger value="today" className="rounded-full">Today</TabsTrigger>
            <TabsTrigger value="week" className="rounded-full">This Week</TabsTrigger>
            <TabsTrigger value="month" className="rounded-full">This Month</TabsTrigger>
            <TabsTrigger value="all" className="rounded-full">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[160px] rounded-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="checkedin">Checked In</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={paymentStatus}
          onValueChange={(val) => {
            setPaymentStatus(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[150px] rounded-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sortBy}
          onValueChange={(val) => {
            setSortBy(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[160px] rounded-full"><ArrowUpDown className="mr-1.5 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="highest_amount">Highest Amount</SelectItem>
            <SelectItem value="lowest_amount">Lowest Amount</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search customer, phone, staff, ID…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="rounded-full pl-9"
          />
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <EmptyState title="No appointments found" description={q ? "No appointments match your search or filters." : "Book your first appointment to see it here."} icon={<Scissors className="h-7 w-7" />} action={<Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => setOpenNew(true)}><Plus className="mr-1.5 h-4 w-4" /> New appointment</Button>} />
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="p-0">
            <div className="hidden grid-cols-[100px_1fr_1.1fr_100px_100px_130px_100px_36px] items-center gap-2 border-b px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground md:grid">
              <div>ID</div><div>Customer</div><div>Services</div><div>Source</div><div>Staff</div><div>Date & Time</div><div>Status</div><div />
            </div>
            {visibleRows.map((a, i) => {
              const svcs = a.services && a.services.length ? a.services : [{ name: a.service, price: a.price, duration: a.duration || 0 }];
              const cleanPhone = (a.customerPhone || "").replace(/\D/g, "");
              const matchedCustomer = backendCustomers.find(
                (c) => (a.customerId && UUID_REGEX.test(a.customerId) && c.id === a.customerId) || (cleanPhone && (c.phone || "").replace(/\D/g, "").includes(cleanPhone))
              );
              const targetCustId = matchedCustomer?.id || (a.customerId && UUID_REGEX.test(a.customerId) ? a.customerId : null);
              const isSelected = detail?.id === a.id;

              return (
                <motion.div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.015, duration: 0.2 }}
                  onClick={() => setDetail(a)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDetail(a);
                    }
                  }}
                  className={`group grid w-full cursor-pointer grid-cols-[100px_1fr_1.1fr_100px_100px_130px_100px_36px] items-center gap-2 border-b px-4 py-3.5 text-left text-sm last:border-0 transition-all duration-200 ease-in-out ${
                    isSelected
                      ? "bg-primary/10 border-l-4 border-l-primary"
                      : "hover:bg-accent/50 hover:border-l-4 hover:border-l-primary/50"
                  }`}
                >
                  <div>
                    <span className="font-mono text-xs font-semibold px-2 py-1 rounded-md bg-muted/60 border text-foreground/90">
                      {apptCode(a)}
                    </span>
                  </div>
                  <div className="min-w-0 pr-2">
                    {targetCustId ? (
                      <AppLink
                        path="customers/$id"
                        params={{ id: targetCustId }}
                        className="truncate font-semibold text-foreground hover:text-primary hover:underline block"
                        onClick={(e: any) => e.stopPropagation()}
                      >
                        {a.customerName || "Walk-in"}
                      </AppLink>
                    ) : (
                      <p className="truncate font-semibold text-foreground">{a.customerName || "Walk-in"}</p>
                    )}
                    <p className="truncate text-xs text-muted-foreground mt-0.5">{a.customerPhone || "—"}</p>
                  </div>
                  <div className="min-w-0 pr-2">
                    <p className="truncate font-medium text-foreground">{svcs.map((s) => s.name).join(", ")}</p>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{fmt(a.price)}</p>
                  </div>
                  <div>
                    {a.isWalkIn ? (
                      <Badge variant="outline" className="rounded-full text-[10px] px-2.5 py-0.5 font-medium border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        Walk-In
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full text-[10px] px-2.5 py-0.5 font-medium border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                        Appointment
                      </Badge>
                    )}
                  </div>
                  <div className="truncate text-xs font-medium text-muted-foreground">{a.staff}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.start ? new Date(a.start).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—"}
                  </div>
                  <div>
                    {(() => {
                      const st = getDisplayStatus(a);
                      return (
                        <Badge variant="outline" className={`rounded-full text-[10px] px-2.5 py-0.5 font-medium ${st.color}`}>
                          {st.label}
                        </Badge>
                      );
                    })()}
                  </div>
                  <div className="text-muted-foreground group-hover:text-primary transition-colors">
                    <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform duration-200" />
                  </div>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {total > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:flex-row">
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground font-medium">
              Showing <strong className="text-foreground">{fromItem}–{toItem}</strong> of <strong className="text-foreground">{total}</strong> appointments
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Per page:</span>
              <Select
                value={String(limit)}
                onValueChange={(val) => {
                  setLimit(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-16 text-xs rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg px-2.5 text-xs"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPrevious}
              title="Previous Page"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
            </Button>
            <span className="px-3 text-xs font-semibold text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg px-2.5 text-xs"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={!hasNext}
              title="Next Page"
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <NewAppointmentDialog open={openNew} onOpenChange={setOpenNew} />
      <AppointmentDetailSheet appt={detail} open={!!detail} onOpenChange={(o) => !o && setDetail(null)} />
    </PageTransition>
  );
}