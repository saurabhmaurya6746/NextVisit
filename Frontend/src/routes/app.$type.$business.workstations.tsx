import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Scissors,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  Layers,
  Bed,
  DoorOpen,
  Armchair,
  UserCheck,
  Calendar,
  LogIn,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { SkeletonStatsGrid, SkeletonTablesGrid } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import {
  listSalonServiceAreasApi,
  listSalonChairsApi,
  getSalonChairMetricsApi,
  createSalonChairApi,
  updateSalonChairApi,
  updateSalonChairStatusApi,
  deleteSalonChairApi,
  createSalonServiceAreaApi,
  type SalonServiceArea,
  type SalonChair,
} from "@/lib/salon-chairs-api";
import { NewAppointmentDialog } from "@/routes/app.$type.$business.appointments";
import { AppointmentDetailSheet } from "@/components/appointment-detail-sheet";
import { useAppointments, updateAppointment, type Appointment } from "@/lib/appointments-store";
import { fmt } from "@/lib/currency";

export const Route = createFileRoute("/app/$type/$business/workstations")({
  component: WorkstationsPage,
});

const STATUS_CONFIG: Record<string, { label: string; badge: string; cardBorder: string }> = {
  Available: {
    label: "Available",
    badge: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold",
    cardBorder: "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50",
  },
  Occupied: {
    label: "Occupied",
    badge: "bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300 font-bold",
    cardBorder: "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50",
  },
};

function formatApptTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getApptDateStr(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function WorkstationTypeIcon({ type }: { type: string }) {
  switch (type.toLowerCase()) {
    case "bed":
      return <Bed className="h-4 w-4 text-primary" />;
    case "room":
      return <DoorOpen className="h-4 w-4 text-primary" />;
    case "station":
      return <Sparkles className="h-4 w-4 text-primary" />;
    case "chair":
    default:
      return <Armchair className="h-4 w-4 text-primary" />;
  }
}

function WorkstationsPage() {
  const qc = useQueryClient();

  // Queries
  const { data: serviceAreas = [], isLoading: loadingAreas } = useQuery<SalonServiceArea[]>({
    queryKey: ["salon-service-areas"],
    queryFn: listSalonServiceAreasApi,
  });

  const {
    data: chairs = [],
    isLoading: loadingChairs,
    isError,
    error,
  } = useQuery<SalonChair[]>({
    queryKey: ["salon-chairs"],
    queryFn: () => listSalonChairsApi(),
    refetchInterval: 5000,
  });

  const appointments = useAppointments();
  const [apptModalOpen, setApptModalOpen] = useState(false);
  const [selectedPresetAreaId, setSelectedPresetAreaId] = useState("");
  const [selectedPresetChairId, setSelectedPresetChairId] = useState("");
  const [activeApptSheet, setActiveApptSheet] = useState<Appointment | null>(null);

  // Available Workstation Action Dialog State
  const [availableActionChair, setAvailableActionChair] = useState<SalonChair | null>(null);

  // Modal States
  const [createOpen, setCreateOpen] = useState(false);
  const [createAreaOpen, setCreateAreaOpen] = useState(false);
  const [editChair, setEditChair] = useState<SalonChair | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form States
  const [chairName, setChairName] = useState("");
  const [chairNumber, setChairNumber] = useState("");
  const [workstationType, setWorkstationType] = useState<string>("Chair");
  const [areaId, setAreaId] = useState("");
  const [isActive, setIsActive] = useState(true);

  // New Area Form State
  const [newAreaName, setNewAreaName] = useState("");

  const isLoading = loadingAreas || loadingChairs;

  // Filter today's pending (unassigned) appointments
  const todayPendingAppointments = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return appointments.filter((a) => {
      if (a.status !== "pending") return false;
      const aDate = getApptDateStr(a.start);
      return aDate === todayStr;
    });
  }, [appointments]);

  function handleWorkstationClick(c: SalonChair) {
    if (c.status === "Available") {
      setAvailableActionChair(c);
    } else {
      const active =
        appointments.find(
          (a) => a.chairId === c.id && a.status !== "cancelled" && a.paymentStatus !== "paid"
        ) ||
        appointments.find((a) => a.chairId === c.id && a.status !== "cancelled");

      if (active) {
        setActiveApptSheet(active);
      } else {
        toast.info(`Workstation "${c.chair_name}" is Occupied`);
      }
    }
  }

  // Assign today's booked appointment to an available chair
  async function assignBookedAppointmentToChair(apptItem: Appointment, targetChair: SalonChair) {
    try {
      await updateSalonChairStatusApi(targetChair.id, "Occupied");
      qc.invalidateQueries({ queryKey: ["salon-chairs"] });
      qc.invalidateQueries({ queryKey: ["salon-chairs-metrics"] });
      qc.invalidateQueries({ queryKey: ["dashboard-analytics"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });

      updateAppointment(apptItem.id, {
        status: "checkedin",
        chairId: targetChair.id,
        chairName: targetChair.chair_name,
        serviceAreaId: targetChair.service_area_id,
      });

      toast.success(`Checked In ${apptItem.customerName || "Customer"} ✔ Workstation "${targetChair.chair_name}" is now Occupied`);
      setAvailableActionChair(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign workstation.");
    }
  }

  // Reset Form
  function resetForm() {
    setChairName("");
    setChairNumber("");
    setWorkstationType("Chair");
    setAreaId("");
    setIsActive(true);
  }

  // Open Edit Modal
  function openEdit(c: SalonChair) {
    setEditChair(c);
    setChairName(c.chair_name);
    setChairNumber(c.chair_number || "");
    setWorkstationType(c.workstation_type || "Chair");
    setAreaId(c.service_area_id);
    setIsActive(c.is_active);
  }

  // Create Area Handler
  async function handleCreateArea() {
    if (!newAreaName.trim()) {
      toast.error("Area name is required");
      return;
    }
    try {
      const created = await createSalonServiceAreaApi({ name: newAreaName.trim() });
      toast.success(`Service area "${created.name}" created`);
      qc.invalidateQueries({ queryKey: ["salon-service-areas"] });
      setNewAreaName("");
      setCreateAreaOpen(false);
      setAreaId(created.id);
    } catch (err: any) {
      toast.error(err?.message || "Failed creating service area");
    }
  }

  // Create Chair Handler
  async function handleCreateChair() {
    if (!chairName.trim()) {
      toast.error("Workstation name is required");
      return;
    }
    if (!areaId) {
      toast.error("Service area is required");
      return;
    }
    try {
      await createSalonChairApi({
        service_area_id: areaId,
        chair_name: chairName.trim(),
        chair_number: chairNumber.trim() || undefined,
        workstation_type: workstationType,
        is_active: isActive,
      });
      toast.success("Workstation created successfully");
      qc.invalidateQueries({ queryKey: ["salon-chairs"] });
      qc.invalidateQueries({ queryKey: ["salon-chairs-metrics"] });
      qc.invalidateQueries({ queryKey: ["dashboard-analytics"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setCreateOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || "Failed creating workstation");
    }
  }

  // Update Chair Handler
  async function handleUpdateChair() {
    if (!editChair) return;
    if (!chairName.trim()) {
      toast.error("Workstation name is required");
      return;
    }
    try {
      await updateSalonChairApi(editChair.id, {
        service_area_id: areaId,
        chair_name: chairName.trim(),
        chair_number: chairNumber.trim() || undefined,
        workstation_type: workstationType,
        is_active: isActive,
      });
      toast.success("Workstation updated");
      qc.invalidateQueries({ queryKey: ["salon-chairs"] });
      qc.invalidateQueries({ queryKey: ["salon-chairs-metrics"] });
      qc.invalidateQueries({ queryKey: ["dashboard-analytics"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setEditChair(null);
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || "Failed updating workstation");
    }
  }

  // Delete Chair Handler
  async function handleDeleteChair() {
    if (!deleteId) return;
    try {
      await deleteSalonChairApi(deleteId);
      toast.success("Workstation deleted");
      qc.invalidateQueries({ queryKey: ["salon-chairs"] });
      qc.invalidateQueries({ queryKey: ["salon-chairs-metrics"] });
      qc.invalidateQueries({ queryKey: ["dashboard-analytics"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed deleting workstation");
    }
  }

  // Group Chairs by Service Area
  const groupedChairs = useMemo(() => {
    return serviceAreas.map((area) => ({
      area,
      chairs: chairs.filter((c) => c.service_area_id === area.id),
    }));
  }, [serviceAreas, chairs]);

  // Counts
  const availableCount = useMemo(() => chairs.filter((c) => c.status === "Available").length, [chairs]);
  const occupiedCount = useMemo(() => chairs.filter((c) => c.status !== "Available").length, [chairs]);

  return (
    <PageTransition>
      <PageHeader
        title="Salon Workstations"
        description="Live workstation map · assign walk-ins or booked clients to styling chairs and beds"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => setCreateAreaOpen(true)}
            >
              <Layers className="mr-1.5 h-3.5 w-3.5 text-primary" /> Add Service Area
            </Button>
            <Button
              size="sm"
              className="rounded-full gradient-brand text-primary-foreground text-xs"
              onClick={() => {
                resetForm();
                if (serviceAreas.length > 0) setAreaId(serviceAreas[0].id);
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Workstation
            </Button>
          </div>
        }
      />

      {/* TOP SIMPLIFIED SUMMARY METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Card className="rounded-2xl border bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground block">Total Workstations</span>
            <span className="font-display text-3xl font-bold text-foreground">{chairs.length}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary font-bold">
            <Armchair className="h-5 w-5" />
          </div>
        </Card>

        <Card className="rounded-2xl border bg-emerald-500/10 border-emerald-500/20 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 block">Available</span>
            <span className="font-display text-3xl font-bold text-emerald-600">{availableCount}</span>
          </div>
          <Badge className="rounded-full bg-emerald-500 text-white font-bold text-xs px-3 py-1">
            Available
          </Badge>
        </Card>

        <Card className="rounded-2xl border bg-amber-500/10 border-amber-500/20 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 block">Occupied</span>
            <span className="font-display text-3xl font-bold text-amber-600">{occupiedCount}</span>
          </div>
          <Badge className="rounded-full bg-amber-500 text-white font-bold text-xs px-3 py-1">
            Occupied
          </Badge>
        </Card>
      </div>

      {isLoading && <SkeletonTablesGrid count={8} />}

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {(error as Error)?.message || "Failed to load salon workstations map."}
        </div>
      )}

      {!isLoading && !isError && serviceAreas.length === 0 && (
        <EmptyState
          title="No Service Areas Configured"
          description="Create your first service area (e.g. Hair Section, Facial Room) to start adding workstations."
          icon={<Layers className="h-8 w-8 text-primary" />}
          action={
            <Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => setCreateAreaOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Create Service Area
            </Button>
          }
        />
      )}

      {/* GROUPED SERVICE AREAS AND WORKSTATION CARDS */}
      {!isLoading && !isError && (
        <div className="space-y-6">
          {groupedChairs.map(({ area, chairs: areaChairs }) => (
            <div key={area.id} className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" /> {area.name}
                  </h3>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {areaChairs.length} Workstations
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-xs text-primary h-7"
                  onClick={() => {
                    resetForm();
                    setAreaId(area.id);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add to {area.name}
                </Button>
              </div>

              {areaChairs.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                  No workstations created in {area.name} yet. Click "Add Workstation" above to add chairs or beds.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {areaChairs.map((c) => {
                    const isAvailable = c.status === "Available";
                    const statusTheme = isAvailable ? STATUS_CONFIG.Available : STATUS_CONFIG.Occupied;
                    const activeAppt = appointments.find(
                      (a) => a.chairId === c.id && a.status !== "cancelled" && a.paymentStatus !== "paid"
                    );

                    return (
                      <Card
                        key={c.id}
                        className={`rounded-2xl border-2 p-4 transition-all hover:shadow-lg cursor-pointer ${statusTheme.cardBorder}`}
                        onClick={() => handleWorkstationClick(c)}
                      >
                        {/* CARD HEADER */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <WorkstationTypeIcon type={c.workstation_type} />
                              <h4 className="font-bold text-base text-foreground">
                                {c.chair_name} {c.chair_number ? `(#${c.chair_number})` : ""}
                              </h4>
                            </div>
                            <span className="text-[11px] text-muted-foreground block font-medium">{c.workstation_type} · {area.name}</span>
                          </div>

                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                              onClick={() => openEdit(c)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full text-destructive hover:text-destructive/80"
                              onClick={() => setDeleteId(c.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* CARD BODY CONTENT */}
                        {isAvailable ? (
                          <div className="mt-4 pt-3 border-t flex items-center justify-between">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Ready for Client
                            </span>
                            <Badge variant="outline" className={`rounded-full px-3 py-0.5 text-xs ${statusTheme.badge}`}>
                              Available
                            </Badge>
                          </div>
                        ) : (
                          <div className="mt-3 pt-3 border-t space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1">
                                <Clock className="h-3 w-3 animate-pulse" /> Active Service
                              </span>
                              <Badge variant="outline" className={`rounded-full px-3 py-0.5 text-xs ${statusTheme.badge}`}>
                                Occupied
                              </Badge>
                            </div>

                            {activeAppt ? (
                              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs space-y-1 text-foreground">
                                <p className="font-bold flex items-center gap-1">
                                  <User className="h-3.5 w-3.5 text-primary" /> {activeAppt.customerName || "Walk-in Client"}
                                </p>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span>{activeAppt.service}</span>
                                  <span className="font-mono font-bold text-primary">{fmt(activeAppt.price)}</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                                  <span>Staff: {activeAppt.staff || "Staff"}</span>
                                  <span>Start: {formatApptTime(activeAppt.start)}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-xl bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300 font-medium">
                                In Service · Click to view details
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* AVAILABLE WORKSTATION ACTION DIALOG */}
      {availableActionChair && (
        <Dialog open={!!availableActionChair} onOpenChange={(o) => !o && setAvailableActionChair(null)}>
          <DialogContent className="sm:max-w-md rounded-3xl p-6 text-foreground bg-card">
            <DialogHeader className="border-b pb-3 pr-10">
              <div className="flex items-center gap-2">
                <WorkstationTypeIcon type={availableActionChair.workstation_type} />
                <DialogTitle className="font-display text-lg font-bold">
                  {availableActionChair.chair_name} {availableActionChair.chair_number ? `(#${availableActionChair.chair_number})` : ""}
                </DialogTitle>
                <Badge className="ml-auto rounded-full bg-emerald-500 text-white text-xs px-3 py-1 font-semibold flex items-center gap-1.5 border-0 shadow-2xs">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Available
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* OPTION A: WALK-IN BOOKING */}
              <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-primary" /> New Walk-in Client
                  </h4>
                  <Badge variant="outline" className="rounded-full text-[10px]">Immediate Start</Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  Create a new walk-in appointment and start service immediately on this workstation.
                </p>
                <Button
                  className="w-full rounded-full gradient-brand text-primary-foreground text-xs mt-2"
                  onClick={() => {
                    setSelectedPresetAreaId(availableActionChair.service_area_id);
                    setSelectedPresetChairId(availableActionChair.id);
                    setAvailableActionChair(null);
                    setApptModalOpen(true);
                  }}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Start Walk-in Booking
                </Button>
              </div>

              {/* OPTION B: ASSIGN TODAY'S BOOKED APPOINTMENTS */}
              <div className="rounded-2xl border p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" /> Today's Booked Appointments ({todayPendingAppointments.length})
                  </h4>
                </div>

                {todayPendingAppointments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2 text-center">
                    No pending booked appointments scheduled for today.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {todayPendingAppointments.map((appt) => (
                      <div key={appt.id} className="flex items-center justify-between rounded-xl border bg-card p-3 shadow-xs">
                        <div className="space-y-0.5">
                          <p className="font-bold text-xs text-foreground flex items-center gap-1">
                            <User className="h-3 w-3 text-primary" /> {appt.customerName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {appt.service} · {formatApptTime(appt.start)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="rounded-full text-xs gradient-brand text-primary-foreground h-8 px-3"
                          onClick={() => assignBookedAppointmentToChair(appt, availableActionChair)}
                        >
                          <LogIn className="mr-1 h-3.5 w-3.5" /> Assign & Occupy
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* CREATE WORKSTATION DIALOG */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Add New Workstation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Service Area *</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Select Service Area…" /></SelectTrigger>
                <SelectContent>
                  {serviceAreas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Workstation Name *</Label>
                <Input
                  className="mt-1 rounded-xl"
                  placeholder="e.g. Chair 1, Bed 2"
                  value={chairName}
                  onChange={(e) => setChairName(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Workstation Number</Label>
                <Input
                  className="mt-1 rounded-xl"
                  placeholder="e.g. 01, B2"
                  value={chairNumber}
                  onChange={(e) => setChairNumber(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Workstation Type *</Label>
              <Select value={workstationType} onValueChange={setWorkstationType}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chair">Chair (Styling / Haircut)</SelectItem>
                  <SelectItem value="Bed">Bed (Facial / Massage)</SelectItem>
                  <SelectItem value="Station">Station (Nail / Makeup)</SelectItem>
                  <SelectItem value="Room">Room (Bridal / Spa Suite)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label className="text-xs font-semibold">Active Status</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="rounded-full gradient-brand text-primary-foreground" onClick={handleCreateChair}>Save Workstation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT WORKSTATION DIALOG */}
      <Dialog open={!!editChair} onOpenChange={(o) => !o && setEditChair(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Edit Workstation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Move to Service Area *</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Select Service Area…" /></SelectTrigger>
                <SelectContent>
                  {serviceAreas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Workstation Name *</Label>
                <Input
                  className="mt-1 rounded-xl"
                  value={chairName}
                  onChange={(e) => setChairName(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Workstation Number</Label>
                <Input
                  className="mt-1 rounded-xl"
                  value={chairNumber}
                  onChange={(e) => setChairNumber(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Workstation Type *</Label>
              <Select value={workstationType} onValueChange={setWorkstationType}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chair">Chair (Styling / Haircut)</SelectItem>
                  <SelectItem value="Bed">Bed (Facial / Massage)</SelectItem>
                  <SelectItem value="Station">Station (Nail / Makeup)</SelectItem>
                  <SelectItem value="Room">Room (Bridal / Spa Suite)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label className="text-xs font-semibold">Active Status</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setEditChair(null)}>Cancel</Button>
            <Button className="rounded-full gradient-brand text-primary-foreground" onClick={handleUpdateChair}>Update Workstation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE SERVICE AREA DIALOG */}
      <Dialog open={createAreaOpen} onOpenChange={setCreateAreaOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Add Service Area</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Service Area Name *</Label>
              <Input
                className="mt-1 rounded-xl"
                placeholder="e.g. Hair Section, Bridal Room, Nail Studio"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setCreateAreaOpen(false)}>Cancel</Button>
            <Button className="rounded-full gradient-brand text-primary-foreground" onClick={handleCreateArea}>Save Area</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-destructive">Delete Workstation?</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground py-2">
            Are you sure you want to delete this workstation? This action cannot be undone.
          </p>

          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" className="rounded-full" onClick={handleDeleteChair}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* APPOINTMENT MODAL FOR WALK-INS */}
      <NewAppointmentDialog
        open={apptModalOpen}
        onOpenChange={setApptModalOpen}
        presetServiceAreaId={selectedPresetAreaId}
        presetChairId={selectedPresetChairId}
      />

      {/* APPOINTMENT DETAIL SHEET FOR OCCUPIED WORKSTATIONS */}
      <AppointmentDetailSheet
        appt={activeApptSheet}
        open={!!activeApptSheet}
        onOpenChange={(o) => !o && setActiveApptSheet(null)}
      />
    </PageTransition>
  );
}
