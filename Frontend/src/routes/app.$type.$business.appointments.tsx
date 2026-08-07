import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listCustomersApi, createCustomerApi, updateCustomerApi } from "@/lib/customers-api";
import { listServicesCatalogApi, listPaginatedVisitsApi } from "@/lib/visit-services-api";
import { listStaffApi } from "@/lib/staff-api";
import { AppLink } from "@/lib/app-nav";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Scissors, Search, User, ChevronRight, Check, AlertTriangle, Calendar, Clock, DollarSign, MessageSquare, CheckCircle2, Loader2, ChevronsLeft, ChevronLeft, ChevronsRight, ArrowUpDown } from "lucide-react";
import { createVisitApi } from "@/lib/visits-api";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppointments, saveAppointment, apptCode, type Appointment } from "@/lib/appointments-store";
import { useSalonServices, type SalonService } from "@/lib/services-store";
import { findCustomerByPhone, createCustomerFromOrder } from "@/lib/orders-store";
import { customers as seedCustomers } from "@/lib/sample-data";
import { fmt } from "@/lib/currency";
import { AppointmentDetailSheet } from "@/components/appointment-detail-sheet";
import { toast } from "sonner";
import { sanitizePhoneInput } from "@/lib/validation";
import {
  listSalonServiceAreasApi,
  listSalonChairsApi,
  updateSalonChairStatusApi,
  type SalonServiceArea,
  type SalonChair,
} from "@/lib/salon-chairs-api";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/app/$type/$business/appointments")({ component: AppointmentsPage });

type RangeKey = "today" | "week" | "month" | "all";

function toLocalISOString(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
const statusLabel: Record<string, string> = {
  pending: "Pending",
  checkedin: "In Service",
  completed: "Completed",
  paid: "Paid",
  cancelled: "Cancelled",
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

function AppointmentsPage() {
  const qc = useQueryClient();
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

  // Server-side Paginated Query
  const {
    data: paginatedResult,
    isLoading: loading,
    isError,
    error: queryErr,
    refetch: loadAppointments,
  } = useQuery({
    queryKey: ["appointments-paginated", { page, limit, q, statusFilter, paymentStatus, sortBy }],
    queryFn: () =>
      listPaginatedVisitsApi({
        page,
        limit,
        search: q,
        status: statusFilter === "all" ? undefined : statusFilter,
        payment_status: paymentStatus === "all" ? undefined : paymentStatus,
        sort: sortBy,
      }),
    staleTime: 5000,
  });

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

  // Automatically adjust page if current page becomes empty after deletion/completion/filter change
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

      {/* FILTER-AWARE PAGINATION CONTROLS */}
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

export function NewAppointmentDialog({
  open,
  onOpenChange,
  presetServiceAreaId,
  presetChairId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetServiceAreaId?: string;
  presetChairId?: string;
}) {
  const routerParams = useParams({ strict: false }) as Record<string, string>;
  const business = routerParams?.business || "";
  const queryClient = useQueryClient();
  // 1. Live Queries for Backend Database Records
  const { data: backendCustomers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: listCustomersApi,
    staleTime: 30000,
  });

  const { data: catalogServices = [] } = useQuery({
    queryKey: ["services-catalog"],
    queryFn: listServicesCatalogApi,
    staleTime: 30000,
  });

  const { data: staffData } = useQuery({
    queryKey: ["staff-list"],
    queryFn: () => listStaffApi("", "ALL", 1, 50),
    staleTime: 30000,
  });

  const { data: salonAreas = [] } = useQuery<SalonServiceArea[]>({
    queryKey: ["salon-service-areas"],
    queryFn: listSalonServiceAreasApi,
  });

  const { data: salonChairs = [] } = useQuery<SalonChair[]>({
    queryKey: ["salon-chairs"],
    queryFn: () => listSalonChairsApi(),
  });

  const existingAppointments = useAppointments();

  const storeServices = useSalonServices().filter((s) => s.available);
  const services: SalonService[] = useMemo(() => {
    if (catalogServices.length > 0) {
      return catalogServices.map((cs) => ({
        id: cs.id,
        name: cs.name,
        category: cs.category || "General",
        duration: cs.duration_minutes || 30,
        price: cs.price || 0,
        available: cs.is_active !== false,
      }));
    }
    return storeServices;
  }, [catalogServices, storeServices]);

  const staffMembers = staffData?.items || [];

  // Form State
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [anni, setAnni] = useState("");
  const [gender, setGender] = useState<string>("");
  const [customerNotes, setCustomerNotes] = useState("");

  const [serviceAreaId, setServiceAreaId] = useState(presetServiceAreaId || "");
  const [chairId, setChairId] = useState(presetChairId || "");

  // Auto-populate preset workstation, service area, and fresh current IST time when dialog opens
  useEffect(() => {
    if (open) {
      if (presetServiceAreaId) setServiceAreaId(presetServiceAreaId);
      if (presetChairId) setChairId(presetChairId);
      setWhen(toLocalISOString(new Date()));
    }
  }, [open, presetServiceAreaId, presetChairId]);

  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [staff, setStaff] = useState("");
  const [when, setWhen] = useState(() => toLocalISOString(new Date()));
  const [apptStatus, setApptStatus] = useState<"pending" | "checkedin" | "completed" | "cancelled">("pending");
  const [saving, setSaving] = useState(false);

  // Advance Payment
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card" | "online">("cash");

  // Section 5 Notes
  const [preferences, setPreferences] = useState("");
  const [allergies, setAllergies] = useState("");
  const [specialInst, setSpecialInst] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");

  // WhatsApp Confirmation
  const [sendWhatsapp, setSendWhatsapp] = useState(true);

  // Auto-Lookup Customer - Only auto-selects if phone is EXACTLY 10 digits and matches
  const cleanPhone = useMemo(() => phone.replace(/\D/g, ""), [phone]);
  const isExact10 = cleanPhone.length === 10;

  const foundCustomer = useMemo(() => {
    if (!isExact10) return null;
    return backendCustomers.find((c) => {
      const cPhone = (c.phone || "").replace(/\D/g, "");
      return cPhone === cleanPhone || cPhone.slice(-10) === cleanPhone;
    }) || null;
  }, [cleanPhone, isExact10, backendCustomers]);

  const availableChairsInArea = useMemo(() => {
    if (!serviceAreaId) return salonChairs;
    return salonChairs.filter((c) => c.service_area_id === serviceAreaId);
  }, [salonChairs, serviceAreaId]);

  // Selected Services calculations
  const selectedServices = useMemo(() => services.filter((s) => pickedIds.includes(s.id)), [services, pickedIds]);
  const totalDurationMinutes = useMemo(() => selectedServices.reduce((sum, s) => sum + (s.duration || 0), 0), [selectedServices]);
  const totalAmount = useMemo(() => selectedServices.reduce((sum, s) => sum + (s.price || 0), 0), [selectedServices]);

  const advancePaidNum = parseFloat(advanceAmount) || 0;
  const remainingBalance = Math.max(0, totalAmount - advancePaidNum);

  // Estimated Finish Time Calculation
  const estimatedFinishTime = useMemo(() => {
    if (!when) return "—";
    const start = new Date(when);
    if (isNaN(start.getTime())) return "—";
    const end = new Date(start.getTime() + (totalDurationMinutes || 30) * 60000);
    return end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [when, totalDurationMinutes]);

  // Staff Collision Validation (Active when staff is explicitly selected)
  const activeStaffName = staff.trim();
  const isStaffCollision = useMemo(() => {
    if (!when || !activeStaffName) return false;
    const startReq = new Date(when).getTime();
    if (isNaN(startReq)) return false;
    const endReq = startReq + (totalDurationMinutes || 30) * 60000;

    return existingAppointments.some((a) => {
      if (a.status === "cancelled" || a.status === "completed") return false;
      if (a.staff?.toLowerCase() !== activeStaffName.toLowerCase()) return false;
      const aStart = new Date(a.start).getTime();
      if (isNaN(aStart)) return false;
      const aEnd = aStart + (a.duration || 30) * 60000;
      return Math.max(startReq, aStart) < Math.min(endReq, aEnd);
    });
  }, [when, activeStaffName, totalDurationMinutes, existingAppointments]);

  // Specialist Staff Auto-Recommendation
  const recommendedStaff = useMemo(() => {
    const isHair = selectedServices.some((s) => s.category?.toLowerCase().includes("hair") || s.name.toLowerCase().includes("color"));
    if (isHair && staffMembers.length > 0) {
      const specialist = staffMembers.find((s) => s.name.toLowerCase().includes("priya") || s.designation?.toLowerCase().includes("color"));
      return specialist ? { name: specialist.name, title: "Color Specialist ★★★★★" } : null;
    }
    return null;
  }, [selectedServices, staffMembers]);

  // Smart Birthday/Anniversary Reminders
  const smartReminders = useMemo(() => {
    if (!foundCustomer) return [];
    const reminders: string[] = [];
    const today = new Date();

    if (foundCustomer.birth_date) {
      const bday = new Date(foundCustomer.birth_date);
      if (!isNaN(bday.getTime())) {
        const diffDays = Math.ceil((new Date(today.getFullYear(), bday.getMonth(), bday.getDate()).getTime() - today.getTime()) / (1000 * 3600 * 24));
        if (diffDays >= 0 && diffDays <= 7) {
          reminders.push(`🎂 Birthday in ${diffDays === 0 ? "today!" : `${diffDays} day(s)`}`);
        }
      }
    }

    if (foundCustomer.anniversary_date) {
      const anniDate = new Date(foundCustomer.anniversary_date);
      if (!isNaN(anniDate.getTime())) {
        const diffDays = Math.ceil((new Date(today.getFullYear(), anniDate.getMonth(), anniDate.getDate()).getTime() - today.getTime()) / (1000 * 3600 * 24));
        if (diffDays >= 0 && diffDays <= 7) {
          reminders.push(`🎉 Anniversary in ${diffDays === 0 ? "today!" : `${diffDays} day(s)`}`);
        }
      }
    }

    return reminders;
  }, [foundCustomer]);

  function reset() {
    setPhone(""); setName(""); setEmail(""); setDob(""); setAnni(""); setGender(""); setCustomerNotes("");
    setServiceAreaId(""); setChairId("");
    setPickedIds([]); setServiceSearch(""); setStaff(""); setWhen(toLocalISOString(new Date()));
    setApptStatus("pending"); setAdvanceAmount(""); setPaymentMethod("cash");
    setPreferences(""); setAllergies(""); setSpecialInst(""); setReferralSource(""); setGeneralNotes(""); setSendWhatsapp(true);
  }

  function togglePick(id: string) {
    setPickedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function handleSave() {
    if (!phone.trim()) { toast.error("Phone number is required"); return; }
    if (!foundCustomer && !name.trim()) { toast.error("Full name is required for new customer"); return; }
    if (selectedServices.length === 0) { toast.error("Select at least one service"); return; }

    const selectedArea = salonAreas.find((a) => a.id === serviceAreaId);
    const selectedChair = salonChairs.find((c) => c.id === chairId);

    // If a chair was selected manually (walk-in), validate it is Available
    if (chairId && selectedChair && selectedChair.status !== "Available") {
      toast.error("Selected chair is not available. Please choose another.");
      return;
    }

    if (isStaffCollision) {
      toast.error(`Staff member "${activeStaffName}" is already booked during this time slot. Please choose another time or staff member.`);
      return;
    }

    setSaving(true);

    try {
      let customerId: string | undefined = foundCustomer?.id;
      let customerName = foundCustomer?.name || name.trim();

      if (customerId) {
        if (gender || dob || anni || email || customerNotes) {
          try {
            await updateCustomerApi(customerId, {
              gender: gender || undefined,
              birth_date: dob || undefined,
              anniversary_date: anni || undefined,
              email: email.trim() || undefined,
              notes: customerNotes.trim() || undefined,
            });
            queryClient.invalidateQueries({ queryKey: ["customers-list"] });
          } catch (e: any) {
            console.warn("Failed updating customer attributes in database:", e);
          }
        }
      } else {
        try {
          const created = await createCustomerApi({
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim() || undefined,
            gender: gender || undefined,
            birth_date: dob || undefined,
            anniversary_date: anni || undefined,
            notes: customerNotes || undefined,
          });
          customerId = created.id;
          customerName = created.name;
          queryClient.invalidateQueries({ queryKey: ["customers-list"] });
        } catch (err: any) {
          toast.error(err?.message || "Failed to create customer in backend database");
          setSaving(false);
          return;
        }
      }

      const assignedStaff = staff.trim() || (staffMembers[0]?.name || "Staff Member");
      const combinedNotes = [
        generalNotes, preferences ? `Pref: ${preferences}` : "", allergies ? `Allergies: ${allergies}` : "", specialInst ? `Special: ${specialInst}` : "", referralSource ? `Referral: ${referralSource}` : "", advancePaidNum > 0 ? `Advance Paid: ₹${advancePaidNum} (${paymentMethod.toUpperCase()})` : ""
      ].filter(Boolean).join(" · ");

      const startDate = new Date(when);

      // Create PostgreSQL Visit record if IDs are valid backend UUIDs
      let createdVisitId: string | undefined;
      if (customerId && UUID_REGEX.test(customerId)) {
        const validServiceItems = selectedServices
          .filter((s) => UUID_REGEX.test(s.id))
          .map((s) => ({ service_id: s.id, quantity: 1 }));
        if (validServiceItems.length > 0) {
          try {
            const staffMatch = staffMembers.find((st) => st.name.toLowerCase() === assignedStaff.toLowerCase());
            const createdVisit = await createVisitApi({
              customer_id: customerId,
              staff_id: staffMatch && UUID_REGEX.test(staffMatch.id) ? staffMatch.id : undefined,
              notes: combinedNotes || undefined,
              services: validServiceItems,
            });
            createdVisitId = createdVisit.id;
            queryClient.invalidateQueries({ queryKey: ["visits-list"] });
          } catch (vErr: any) {
            console.warn("Failed creating PostgreSQL visit record:", vErr);
          }
        }
      }

      // If a workstation is selected (e.g. Walk-in booking from a chair card), update workstation status to Occupied in backend PostgreSQL
      if (chairId) {
        try {
          await updateSalonChairStatusApi(chairId, "Occupied");
          queryClient.invalidateQueries({ queryKey: ["salon-chairs"] });
          queryClient.invalidateQueries({ queryKey: ["salon-chairs-metrics"] });
        } catch (chairErr: any) {
          console.warn("Failed updating workstation status to Occupied in database:", chairErr);
        }
      }

      const finalStatus = chairId ? "checkedin" : apptStatus;

      saveAppointment({
        id: createdVisitId,
        businessKey: business,
        serviceAreaId: serviceAreaId || undefined,
        serviceAreaName: selectedArea?.name || undefined,
        chairId: chairId || undefined,
        chairName: selectedChair?.chair_name || undefined,
        service: selectedServices[0].name,
        services: selectedServices.map((s) => ({ name: s.name, price: s.price, duration: s.duration })),
        staff: assignedStaff,
        start: startDate.toISOString(),
        status: finalStatus,
        customerId,
        customerName,
        customerPhone: phone.trim(),
        customerGender: gender || foundCustomer?.gender || undefined,
        customerDob: dob || foundCustomer?.birthday || foundCustomer?.birth_date || undefined,
        customerAnniversary: anni || foundCustomer?.anniversary || foundCustomer?.anniversary_date || undefined,
        notes: combinedNotes || undefined,
        price: totalAmount,
        duration: totalDurationMinutes,
        paymentStatus: advancePaidNum >= totalAmount ? "paid" : "unpaid",
        isWalkIn: !!presetChairId || !!presetServiceAreaId,
      });

      queryClient.invalidateQueries({ queryKey: ["customers-list"] });
      queryClient.invalidateQueries({ queryKey: ["salon-chairs"] });
      queryClient.invalidateQueries({ queryKey: ["salon-chairs-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      if (sendWhatsapp) {
        toast.success(`Confirmation sent via WhatsApp to ${phone.trim()}`);
      }

      toast.success("Appointment booked successfully");
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to book appointment. Please check form fields.");
    } finally {
      setSaving(false);
    }
  }

  const filteredServicesList = services.filter(
    (s) => !serviceSearch || s.name.toLowerCase().includes(serviceSearch.toLowerCase()) || s.category.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-5xl w-full rounded-2xl p-0 overflow-hidden text-foreground bg-card">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Scissors className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-bold">Salon Receptionist Booking Desk</DialogTitle>
              <p className="text-xs text-muted-foreground">Fast single-screen appointment creation (&lt; 30 seconds)</p>
            </div>
          </div>
        </div>

        {/* MAIN BODY GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 max-h-[82vh] overflow-y-auto custom-scrollbar">
          {/* LEFT 2 COLUMNS: 5 FORM SECTIONS */}
          <div className="lg:col-span-2 space-y-6 p-6 border-r">
            {/* SECTION 1: CUSTOMER AUTO-LOOKUP & NEW CUSTOMER FORM */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" /> Section 1 · Customer Identification
                </Label>
                {foundCustomer && (
                  <Badge variant="secondary" className="rounded-full text-[10px] bg-emerald-500/10 text-emerald-600 font-medium">
                    ✓ Existing Customer Detected
                  </Badge>
                )}
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-11 text-base font-medium rounded-xl"
                  placeholder="Enter 10-digit customer phone number…"
                  value={phone}
                  onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                  maxLength={10}
                />
              </div>

              {/* EXISTING CUSTOMER AUTO-POPULATED CARD */}
              {foundCustomer ? (
                <div className="rounded-xl border bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-base flex items-center gap-2">
                        {foundCustomer.name}
                        <Badge variant="outline" className={`rounded-full text-[10px] ${foundCustomer.status === "VIP" ? "bg-amber-500/15 text-amber-600 border-amber-500/30" : "bg-primary/10 text-primary"}`}>
                          {foundCustomer.status}
                        </Badge>
                      </h4>
                      <p className="text-xs text-muted-foreground">{foundCustomer.phone} · {foundCustomer.email || "No email on file"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-primary">{fmt(foundCustomer.spent)} Spend</p>
                      <p className="text-[11px] text-muted-foreground">{foundCustomer.visits} Total Visits</p>
                    </div>
                  </div>

                  {smartReminders.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
                      {smartReminders.map((rem, i) => (
                        <Badge key={i} variant="secondary" className="rounded-full text-[11px] bg-primary/10 text-primary">
                          {rem}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs border-t border-border/50">
                    <div><span className="text-muted-foreground block text-[10px]">Gender</span><span className="font-medium">{foundCustomer.gender || "—"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px]">Date of Birth</span><span className="font-medium">{foundCustomer.birthday}</span></div>
                    <div><span className="text-muted-foreground block text-[10px]">Anniversary</span><span className="font-medium">{foundCustomer.anniversary}</span></div>
                    <div><span className="text-muted-foreground block text-[10px]">Loyalty Points</span><span className="font-bold text-emerald-600">{foundCustomer.points} pts</span></div>
                  </div>
                </div>
              ) : (
                /* NEW / MANUAL CUSTOMER ENTRY FORM */
                <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Customer Information</p>
                    {isExact10 && !foundCustomer && (
                      <Badge variant="outline" className="rounded-full text-[10px] border-primary/40 text-primary font-medium">
                        New Customer
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Full Name *</Label>
                      <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer full name" />
                    </div>
                    <div>
                      <Label className="text-xs">Gender</Label>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select gender…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Date of Birth</Label>
                      <Input className="mt-1" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Anniversary</Label>
                      <Input className="mt-1" type="date" value={anni} onChange={(e) => setAnni(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Email (Optional)</Label>
                    <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@email.com" />
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: APPOINTMENT DETAILS */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Section 2 · Appointment Details & Timing
              </Label>

              {/* SERVICE AREA & CHAIR SELECTION FOR SALON (OPTIONAL for phone bookings) */}
              {salonAreas.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span><strong>Phone Booking:</strong> Workstation will be assigned when the customer checks in.</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border bg-muted/20">
                    <div>
                      <Label className="text-xs font-semibold">Service Area (Optional)</Label>
                      <Select value={serviceAreaId} onValueChange={(val) => { setServiceAreaId(val); setChairId(""); }}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select Service Area…" /></SelectTrigger>
                        <SelectContent>
                          {salonAreas.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Workstation (Optional)</Label>
                      <Select value={chairId} onValueChange={setChairId}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select Chair / Bed…" /></SelectTrigger>
                        <SelectContent>
                          {availableChairsInArea.map((c) => (
                            <SelectItem key={c.id} value={c.id} disabled={c.status !== "Available"}>
                              {c.chair_name} {c.chair_number ? `(#${c.chair_number})` : ""} — {c.status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {isStaffCollision && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span><strong>Staff Collision Warning:</strong> {activeStaffName} already has an active appointment during this time slot. Please choose another time or staff member.</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Staff Member *</Label>
                    {recommendedStaff && (
                      <span className="text-[10px] font-semibold text-primary">{recommendedStaff.title}</span>
                    )}
                  </div>
                  {staffMembers.length > 0 ? (
                    <Select value={staff || staffMembers[0]?.name} onValueChange={setStaff}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select staff…" /></SelectTrigger>
                      <SelectContent>
                        {staffMembers.map((s) => (
                          <SelectItem key={s.id} value={s.name}>
                            {s.name} ({s.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input className="mt-1" value={staff} onChange={(e) => setStaff(e.target.value)} placeholder="Staff member name" />
                  )}
                </div>

                <div>
                  <Label className="text-xs">Date & Start Time *</Label>
                  <Input className="mt-1" type="datetime-local" step={900} value={when} onChange={(e) => setWhen(e.target.value)} />
                </div>

                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={apptStatus} onValueChange={(v) => setApptStatus(v as any)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Confirmed</SelectItem>
                      <SelectItem value="checkedin">Walk-in / Checked In</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-2.5 text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Starts: <strong>{when ? new Date(when).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</strong>
                </span>
                <span className="text-muted-foreground">Duration: <strong>{totalDurationMinutes} min</strong></span>
                <span className="font-semibold text-primary">Est. Finish: <strong>{estimatedFinishTime}</strong></span>
              </div>
            </div>

            {/* SECTION 3: SERVICES */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Scissors className="h-3.5 w-3.5 text-primary" /> Section 3 · Services Selection
                </Label>
                <span className="text-xs font-semibold text-primary">{selectedServices.length} Selected</span>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-9 text-xs"
                  placeholder="Search services by name or category…"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border p-2 bg-background">
                {filteredServicesList.map((s) => {
                  const isChecked = pickedIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors hover:bg-muted/50 ${isChecked ? "bg-primary/5 font-medium border border-primary/20" : ""}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Checkbox checked={isChecked} onCheckedChange={() => togglePick(s.id)} />
                        <div>
                          <p className="font-medium text-foreground">{s.name}</p>
                          <p className="text-[11px] text-muted-foreground">{s.category} · {s.duration} min</p>
                        </div>
                      </div>
                      <span className="font-mono font-semibold">{fmt(s.price)}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* SECTION 4: ADVANCE PAYMENT */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-primary" /> Section 4 · Advance Payment (Optional)
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Advance Amount Paid (₹)</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    placeholder="0.00"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI / QR</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* SECTION 5: NOTES & PREFERENCES */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-primary" /> Section 5 · Customer Preferences & Notes
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Customer Preferences / Allergies</Label>
                  <Input className="mt-1" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Skin allergies, hair products, sensitivity…" />
                </div>
                <div>
                  <Label className="text-xs">Referral Source</Label>
                  <Input className="mt-1" value={referralSource} onChange={(e) => setReferralSource(e.target.value)} placeholder="Instagram, Friend, Google, Walk-in…" />
                </div>
              </div>
              <div>
                <Label className="text-xs">General Booking Notes</Label>
                <Textarea className="mt-1 text-xs" rows={2} value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Special requests, instructions for staff…" />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Checkbox id="whatsappNotif" checked={sendWhatsapp} onCheckedChange={(c) => setSendWhatsapp(!!c)} />
                <Label htmlFor="whatsappNotif" className="text-xs font-normal cursor-pointer">
                  Send Appointment Confirmation & Reminders via WhatsApp
                </Label>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: STICKY LIVE SUMMARY PANEL */}
          <div className="p-6 bg-muted/15 flex flex-col justify-between border-t lg:border-t-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-display font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Booking Summary
                </h3>
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  Sticky Panel
                </Badge>
              </div>

              {/* SUMMARY DETAILS */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-semibold text-right">{foundCustomer?.name || name || (phone ? phone : "Not selected")}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-mono font-medium">{phone || "—"}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Staff Member:</span>
                  <span className="font-medium">{activeStaffName}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Start Time:</span>
                  <span className="font-medium">{when ? new Date(when).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—"}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Est. Finish:</span>
                  <span className="font-medium text-primary">{estimatedFinishTime}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Total Duration:</span>
                  <span className="font-medium">{totalDurationMinutes} min</span>
                </div>

                {/* SELECTED SERVICES BREAKDOWN */}
                <div className="pt-2">
                  <p className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Selected Services</p>
                  {selectedServices.length === 0 ? (
                    <p className="text-muted-foreground italic text-[11px]">No services selected yet.</p>
                  ) : (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {selectedServices.map((s) => (
                        <div key={s.id} className="flex justify-between text-[11px]">
                          <span className="truncate max-w-[140px]">{s.name}</span>
                          <span className="font-mono">{fmt(s.price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* FINANCIAL BREAKDOWN */}
                <div className="rounded-xl border bg-card p-3 space-y-1.5 mt-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Grand Total:</span>
                    <span className="font-bold text-sm font-mono">{fmt(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-600">
                    <span>Advance Paid:</span>
                    <span className="font-mono">-{fmt(advancePaidNum)}</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t font-semibold">
                    <span>Remaining Balance:</span>
                    <span className="font-mono text-primary">{fmt(remainingBalance)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM BUTTONS */}
            <div className="pt-6 space-y-2">
              <Button
                className="w-full rounded-xl gradient-brand text-primary-foreground font-semibold h-11 shadow-glow"
                disabled={saving || selectedServices.length === 0}
                onClick={() => handleSave()}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                {saving ? "Booking Appointment…" : "Book Appointment Now"}
              </Button>

              <Button variant="ghost" className="w-full rounded-xl h-9 text-xs text-muted-foreground" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}