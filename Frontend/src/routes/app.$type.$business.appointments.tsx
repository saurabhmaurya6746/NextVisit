import { AppLink } from "@/lib/app-nav";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Scissors, Search, User, ChevronRight, Check } from "lucide-react";
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

export const Route = createFileRoute("/app/$type/$business/appointments")({ component: AppointmentsPage });

type RangeKey = "today" | "week" | "month" | "all";

function inRange(iso: string, range: RangeKey) {
  const d = new Date(iso); const n = new Date();
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (range === "today") return same(d, n);
  if (range === "week") { const day = (n.getDay() + 6) % 7; const start = new Date(n); start.setDate(n.getDate() - day); start.setHours(0,0,0,0); const end = new Date(start); end.setDate(start.getDate() + 7); return d >= start && d < end; }
  if (range === "month") return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
  return true;
}

const statusColor: Record<string, string> = {
  pending: "bg-warning/15 text-warning-foreground border-warning/30",
  checkedin: "bg-info/15 text-info border-info/30",
  completed: "bg-success/15 text-success-foreground border-success/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};
const statusLabel: Record<string, string> = { pending: "Pending", checkedin: "Checked In", completed: "Completed", cancelled: "Cancelled" };

function AppointmentsPage() {
  const appts = useAppointments();
  const [range, setRange] = useState<RangeKey>("today");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [detail, setDetail] = useState<Appointment | null>(null);

  const rows = useMemo(() => {
    return appts
      .filter((a) => inRange(a.start, range))
      .filter((a) => statusFilter === "all" || a.status === statusFilter)
      .filter((a) => !q || (a.customerName || "").toLowerCase().includes(q.toLowerCase()) || (a.customerPhone || "").includes(q) || (a.services || []).some((s) => s.name.toLowerCase().includes(q.toLowerCase())))
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  }, [appts, range, statusFilter, q]);

  return (
    <PageTransition>
      <PageHeader
        title="Appointments"
        description={`${rows.length} shown · ${appts.length} total`}
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[160px] rounded-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="checkedin">Checked In</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search customer, service, phone…" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-full pl-9" />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No appointments" description="Book your first appointment to see it here." icon={<Scissors className="h-7 w-7" />} action={<Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => setOpenNew(true)}><Plus className="mr-1.5 h-4 w-4" /> New appointment</Button>} />
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="p-0">
            <div className="hidden grid-cols-[110px_1fr_1.2fr_120px_140px_120px_36px] items-center gap-2 border-b px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground md:grid">
              <div>ID</div><div>Customer</div><div>Services</div><div>Staff</div><div>Date & Time</div><div>Status</div><div />
            </div>
            {rows.map((a, i) => {
              const svcs = a.services && a.services.length ? a.services : [{ name: a.service, price: a.price, duration: a.duration || 0 }];
              return (
                <motion.button
                  key={a.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                  onClick={() => setDetail(a)}
                  className="grid w-full grid-cols-[110px_1fr_1.2fr_120px_140px_120px_36px] items-center gap-2 border-b px-4 py-3 text-left text-sm last:border-0 hover:bg-muted/40"
                >
                  <div className="font-mono text-xs">{apptCode(a)}</div>
                  <div className="min-w-0">
                    {a.customerId ? (
                      <AppLink path="customers/$id" params={{ id: a.customerId }} className="truncate font-medium hover:text-primary hover:underline" onClick={(e: any) => e.stopPropagation()}>
                        {a.customerName || "Walk-in"}
                      </AppLink>
                    ) : (
                      <p className="truncate font-medium">{a.customerName || "Walk-in"}</p>
                    )}
                    <p className="truncate text-xs text-muted-foreground">{a.customerPhone || "—"}</p>
                  </div>
                  <div className="min-w-0"><p className="truncate">{svcs.map((s) => s.name).join(", ")}</p><p className="text-xs text-muted-foreground">{fmt(a.price)}</p></div>
                  <div className="truncate text-xs">{a.staff}</div>
                  <div className="text-xs">{new Date(a.start).toLocaleDateString()} · {new Date(a.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  <div><Badge variant="outline" className={`rounded-full text-[10px] ${statusColor[a.status]}`}>{statusLabel[a.status]}</Badge></div>
                  <div className="text-muted-foreground"><ChevronRight className="h-4 w-4" /></div>
                </motion.button>
              );
            })}
          </CardContent>
        </Card>
      )}

      <NewAppointmentDialog open={openNew} onOpenChange={setOpenNew} />
      <AppointmentDetailSheet appt={detail} open={!!detail} onOpenChange={(o) => !o && setDetail(null)} />
    </PageTransition>
  );
}

function NewAppointmentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const services = useSalonServices().filter((s) => s.available);
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [anni, setAnni] = useState("");
  const [gender, setGender] = useState<string>("");
  const [existingId, setExistingId] = useState<string | undefined>(undefined);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [staff, setStaff] = useState("Sarah");
  const [when, setWhen] = useState(new Date(Date.now() + 30 * 60000).toISOString().slice(0, 16));
  const [notes, setNotes] = useState("");

  const picked: SalonService[] = services.filter((s) => pickedIds.includes(s.id));
  const totalPrice = picked.reduce((s, x) => s + x.price, 0);
  const totalDuration = picked.reduce((s, x) => s + x.duration, 0);

  const found = phone.trim().length >= 6 ? findCustomerByPhone(phone) : null;

  function reset() { setStep(1); setPhone(""); setName(""); setDob(""); setAnni(""); setGender(""); setExistingId(undefined); setPickedIds([]); setNotes(""); }

  function togglePick(id: string) { setPickedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]); }

  function submit() {
    if (!phone.trim() || (!name.trim() && !found && !existingId)) { toast.error("Name and phone are required"); return; }
    if (picked.length === 0) { toast.error("Pick at least one service"); return; }
    let customerId: string | undefined = existingId || found?.id;
    let customerName = found?.name || name.trim();
    if (!customerId) {
      const c = createCustomerFromOrder({ phone: phone.trim(), name: name.trim(), birthday: dob || undefined, anniversary: anni || undefined, spent: 0, visitDate: when.slice(0, 10), favorite: picked[0]?.name });
      customerId = c.id; customerName = c.name;
    }
    saveAppointment({
      service: picked[0].name,
      services: picked.map((s) => ({ name: s.name, price: s.price, duration: s.duration })),
      staff, start: new Date(when).toISOString(), status: "pending",
      customerId, customerName, customerPhone: phone.trim(), notes,
      price: totalPrice, duration: totalDuration,
    });
    toast.success("Appointment booked");
    reset(); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Scissors className="h-5 w-5 text-primary" /> New appointment · Step {step}/4</DialogTitle></DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Customer</p>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Phone number…" value={phone} onChange={(e) => { setPhone(e.target.value); setExistingId(undefined); }} /></div>
            {phone && found && (
              <div className="flex items-center justify-between rounded-lg bg-primary/5 p-2 text-sm"><div className="flex items-center gap-2"><User className="h-4 w-4 text-primary" />{found.name}</div><Badge variant="outline" className="rounded-full text-[10px]">Will link</Badge></div>
            )}
            {phone && !found && (
              <>
                <div><Label className="text-xs">Full name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Date of birth</Label><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
                  <div><Label className="text-xs">Anniversary</Label><Input type="date" value={anni} onChange={(e) => setAnni(e.target.value)} /></div>
                </div>
                <div><Label className="text-xs">Gender</Label>
                  <Select value={gender} onValueChange={setGender}><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger><SelectContent><SelectItem value="Female">Female</SelectItem><SelectItem value="Male">Male</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select>
                </div>
              </>
            )}
            <div>
              <p className="mt-2 text-xs text-muted-foreground">Or pick an existing customer</p>
              <div className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-xl border p-2">
                {seedCustomers.slice(0, 6).map((c) => (
                  <button key={c.id} onClick={() => { setExistingId(c.id); setPhone(c.phone); setName(c.name); }} className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted ${existingId === c.id ? "bg-muted" : ""}`}>
                    <span>{c.name}</span><span className="text-xs text-muted-foreground">{c.phone}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Services</p>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border p-2">
              {services.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 hover:bg-muted/60">
                  <div className="flex items-center gap-3"><Checkbox checked={pickedIds.includes(s.id)} onCheckedChange={() => togglePick(s.id)} /><div><p className="text-sm font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.category} · {s.duration} min</p></div></div>
                  <p className="text-sm font-medium">{fmt(s.price)}</p>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total · {totalDuration} min</span><span className="font-semibold">{fmt(totalPrice)}</span>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div><Label className="text-xs">Staff</Label><Input value={staff} onChange={(e) => setStaff(e.target.value)} /></div>
            <div><Label className="text-xs">Date & time</Label><Input type="datetime-local" step={1800} value={when} onChange={(e) => setWhen(e.target.value)} /></div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div><Label className="text-xs">Notes (optional)</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, preferences, referrals…" /></div>
            <div className="rounded-xl border p-3 text-sm">
              <p className="font-medium">Summary</p>
              <p className="text-xs text-muted-foreground">{found?.name || name || "New customer"} · {phone}</p>
              <p className="text-xs text-muted-foreground">{picked.map((s) => s.name).join(", ") || "No services"}</p>
              <p className="text-xs text-muted-foreground">{new Date(when).toLocaleString()} · {staff}</p>
              <p className="mt-1 font-semibold">{fmt(totalPrice)} · {totalDuration} min</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <div className="flex w-full items-center justify-between">
            {step > 1 ? <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button> : <span />}
            {step < 4 ? (
              <Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => setStep(step + 1)}>Next</Button>
            ) : (
              <Button className="rounded-full gradient-brand text-primary-foreground" onClick={submit}><Check className="mr-1.5 h-4 w-4" /> Book appointment</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}