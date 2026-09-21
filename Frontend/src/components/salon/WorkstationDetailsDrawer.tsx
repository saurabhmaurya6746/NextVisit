import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Scissors,
  UserCheck,
  User,
  Phone,
  Clock,
  CreditCard,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Sparkles,
  Layers,
  Armchair,
  Bed,
  DoorOpen,
  X,
  Edit,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { fmt } from "@/lib/currency";
import type { SalonChair } from "@/lib/salon-chairs-api";
import type { Appointment } from "@/lib/appointments-store";

export interface WorkstationDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workstation: SalonChair | null;
  serviceAreaName?: string;
  activeAppointment?: Appointment | null;
  onCollectPayment?: (appointment: Appointment) => void;
  onEditAppointment?: (appointment: Appointment) => void;
  onCancelAppointment?: (appointment: Appointment) => void;
  onReleaseWorkstation?: (workstation: SalonChair) => void;
}

function WorkstationTypeIcon({ type }: { type?: string }) {
  switch (type?.toLowerCase()) {
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

function formatTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

import { useQuery } from "@tanstack/react-query";
import { getBusinessSettingsApi } from "@/lib/business-settings-api";

export function WorkstationDetailsDrawer({
  open,
  onOpenChange,
  workstation,
  serviceAreaName = "Service Section",
  activeAppointment,
  onCollectPayment,
  onEditAppointment,
  onCancelAppointment,
  onReleaseWorkstation,
}: WorkstationDetailsDrawerProps) {
  if (!workstation) return null;

  const { data: businessSettings } = useQuery({
    queryKey: ["business-settings"],
    queryFn: getBusinessSettingsApi,
    staleTime: 5000,
    enabled: open,
  });

  const taxPct = Number((businessSettings as any)?.tax_percentage ?? (businessSettings as any)?.tax_rate ?? 5);

  // Extract booked services list
  const servicesList = useMemo(() => {
    if (!activeAppointment) return [];
    if (activeAppointment.services && activeAppointment.services.length > 0) {
      return activeAppointment.services;
    }
    if (activeAppointment.service) {
      return [
        {
          name: activeAppointment.service,
          price: activeAppointment.price || 0,
          duration: activeAppointment.duration || 30,
        },
      ];
    }
    return [];
  }, [activeAppointment]);

  // Financial Breakdown calculations
  const subtotal = useMemo(() => {
    if (servicesList.length > 0) {
      return servicesList.reduce((acc, s) => acc + (s.price || 0), 0);
    }
    return activeAppointment?.price || 0;
  }, [servicesList, activeAppointment]);

  // Tax calculation (configured GST for Salon services)
  const tax = useMemo(() => Math.round(((subtotal * taxPct) / 100) * 100) / 100, [subtotal, taxPct]);
  const totalAmount = useMemo(() => Math.round((subtotal + tax) * 100) / 100, [subtotal, tax]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col bg-card text-foreground shadow-2xl border-l"
      >
        {/* HEADER SECTION */}
        <SheetHeader className="p-6 border-b bg-muted/20 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <WorkstationTypeIcon type={workstation.workstation_type} />
                <SheetTitle className="font-display text-xl font-bold tracking-tight">
                  {workstation.chair_name}{" "}
                  {workstation.chair_number ? `(#${workstation.chair_number})` : ""}
                </SheetTitle>
              </div>
              <SheetDescription className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                <Layers className="h-3.5 w-3.5 text-primary" />
                {serviceAreaName} · {workstation.workstation_type || "Styling Station"}
              </SheetDescription>
            </div>

            <Badge
              variant="outline"
              className="rounded-full px-3 py-1 text-xs font-bold bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300 flex items-center gap-1.5 shadow-2xs"
            >
              <Clock className="h-3.5 w-3.5 animate-pulse" />
              Occupied
            </Badge>
          </div>
        </SheetHeader>

        {/* BODY SCROLL CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {activeAppointment ? (
            <>
              {/* ASSIGNED STYLIST & CLIENT PROFILE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Stylist Info */}
                <Card className="rounded-2xl border bg-card p-3.5 shadow-xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block flex items-center gap-1">
                    <UserCheck className="h-3 w-3 text-primary" /> Stylist / Staff
                  </span>
                  <p className="font-bold text-sm text-foreground">
                    {activeAppointment.staff || "Assigned Stylist"}
                  </p>
                  <span className="text-[10px] text-muted-foreground block">
                    Started at {formatTime(activeAppointment.start)}
                  </span>
                </Card>

                {/* Client Profile */}
                <Card className="rounded-2xl border bg-card p-3.5 shadow-xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block flex items-center gap-1">
                    <User className="h-3 w-3 text-primary" /> Client Profile
                  </span>
                  <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    {activeAppointment.customerName || "Walk-in Guest"}
                    {activeAppointment.customerGender && (
                      <Badge variant="secondary" className="rounded-full text-[9px] px-1.5 py-0">
                        {activeAppointment.customerGender}
                      </Badge>
                    )}
                  </p>
                  {activeAppointment.customerPhone ? (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {activeAppointment.customerPhone}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">
                      Walk-in / No phone linked
                    </span>
                  )}
                </Card>
              </div>

              {/* BOOKED SERVICES LIST */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Scissors className="h-3.5 w-3.5 text-primary" /> Booked Salon Services ({servicesList.length})
                  </h4>
                  {activeAppointment.status && (
                    <Badge variant="outline" className="rounded-full text-[10px] uppercase">
                      Status: {activeAppointment.status}
                    </Badge>
                  )}
                </div>

                <Card className="rounded-2xl border bg-card overflow-hidden shadow-xs">
                  <CardContent className="p-0 divide-y">
                    {servicesList.map((srv, idx) => (
                      <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-muted/10 transition-colors">
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <p className="font-semibold text-xs text-foreground truncate">
                            {srv.name}
                          </p>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {srv.duration || 30} mins
                          </span>
                        </div>
                        <span className="font-mono font-bold text-xs text-primary shrink-0">
                          {fmt(srv.price)}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* FINANCIAL BREAKDOWN */}
              <Card className="rounded-2xl border bg-primary/5 border-primary/20 p-4 space-y-2.5 shadow-xs">
                <h4 className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> Financial Breakdown
                </h4>

                <div className="space-y-1.5 pt-1 border-t border-primary/10">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Services Subtotal</span>
                    <span className="font-mono font-medium">{fmt(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>GST / Service Tax ({taxPct}%)</span>
                    <span className="font-mono font-medium">{fmt(tax)}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm font-bold text-foreground pt-2 border-t border-primary/20">
                    <span>Total Amount Payable</span>
                    <span className="font-mono text-base text-primary">{fmt(totalAmount)}</span>
                  </div>
                </div>

                {activeAppointment.paymentStatus && (
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Payment Status:
                    </span>
                    <Badge
                      className={`rounded-full text-[10px] font-bold px-2.5 py-0.5 ${
                        activeAppointment.paymentStatus === "paid"
                          ? "bg-emerald-500 text-white"
                          : "bg-amber-500 text-white"
                      }`}
                    >
                      {activeAppointment.paymentStatus === "paid" ? "PAID ✔" : "UNPAID"}
                    </Badge>
                  </div>
                )}
              </Card>

              {/* APPOINTMENT NOTES */}
              {activeAppointment.notes && (
                <div className="rounded-xl border bg-muted/20 p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Notes
                  </span>
                  <p className="text-xs text-foreground italic">{activeAppointment.notes}</p>
                </div>
              )}
            </>
          ) : (
            /* FALLBACK WHEN NO APPOINTMENT IS DIRECTLY LINKED */
            <div className="space-y-4 py-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 grid place-items-center text-amber-600">
                <Clock className="h-6 w-6 animate-pulse" />
              </div>

              <div className="space-y-1 max-w-xs mx-auto">
                <h4 className="font-bold text-sm text-foreground">Active Workstation Service</h4>
                <p className="text-xs text-muted-foreground">
                  Workstation "{workstation.chair_name}" is currently set to Occupied in the live salon map.
                </p>
              </div>

              <Card className="rounded-2xl border bg-muted/20 p-4 text-left space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Workstation ID:</span>
                  <span className="font-mono text-[10px]">{workstation.id.slice(0, 8)}...</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge className="bg-amber-500 text-white text-[10px]">Occupied</Badge>
                </div>
              </Card>

              {onReleaseWorkstation && (
                <Button
                  variant="outline"
                  className="w-full rounded-full border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 text-xs"
                  onClick={() => onReleaseWorkstation(workstation)}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Force Release to Available
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ACTION FOOTER */}
        <SheetFooter className="p-4 border-t bg-muted/20 flex-col sm:flex-col gap-2">
          {activeAppointment ? (
            <>
              {/* PRIMARY ACTION BUTTON */}
              <Button
                className="w-full rounded-full gradient-brand text-primary-foreground font-semibold shadow-glow text-xs h-10"
                onClick={() => {
                  onOpenChange(false);
                  if (onCollectPayment) {
                    onCollectPayment(activeAppointment);
                  }
                }}
              >
                <CreditCard className="mr-2 h-4 w-4" /> Collect Payment / Complete Service
              </Button>

              {/* SECONDARY ACTION BUTTON */}
              <div className="grid grid-cols-2 gap-2 w-full">
                <Button
                  variant="outline"
                  className="rounded-full text-xs h-9"
                  onClick={() => {
                    onOpenChange(false);
                    if (onEditAppointment) {
                      onEditAppointment(activeAppointment);
                    }
                  }}
                >
                  <Edit className="mr-1.5 h-3.5 w-3.5 text-primary" /> Edit Service
                </Button>

                <Button
                  variant="outline"
                  className="rounded-full text-xs h-9 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                  onClick={() => {
                    onOpenChange(false);
                    if (onCancelAppointment) {
                      onCancelAppointment(activeAppointment);
                    }
                  }}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Cancel Service
                </Button>
              </div>
            </>
          ) : (
            <Button
              variant="secondary"
              className="w-full rounded-full text-xs h-10"
              onClick={() => onOpenChange(false)}
            >
              Close Drawer
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
