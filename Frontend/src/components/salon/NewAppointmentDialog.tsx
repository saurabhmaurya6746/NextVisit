import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listCustomersApi, createCustomerApi } from "@/lib/customers-api";
import { listServicesCatalogApi } from "@/lib/visit-services-api";
import { listStaffApi } from "@/lib/staff-api";
import { createVisitApi } from "@/lib/visits-api";
import { getBusinessSettingsApi } from "@/lib/business-settings-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppointments, saveAppointment, apptCode, type Appointment } from "@/lib/appointments-store";
import { useSalonServices, type SalonService } from "@/lib/services-store";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";
import { sanitizePhoneInput } from "@/lib/validation";
import {
  listSalonServiceAreasApi,
  listSalonChairsApi,
  updateSalonChairStatusApi,
  type SalonServiceArea,
  type SalonChair,
} from "@/lib/salon-chairs-api";
import {
  Scissors,
  Search,
  User,
  CheckCircle2,
  Loader2,
  Sparkles,
  Receipt,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  Award,
  TrendingUp,
  Clock,
  MessageSquare,
  Tag,
  Edit2,
  Coins,
} from "lucide-react";

function toLocalISOString(date: Date): string {
  const pad = (num: number) => String(Math.floor(Math.abs(num))).padStart(2, "0");
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
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

  // Queries
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

  const { data: businessSettings } = useQuery({
    queryKey: ["business-settings"],
    queryFn: getBusinessSettingsApi,
    staleTime: 30000,
    enabled: open,
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

  // Booking Mode State ("appointment" vs "walkin")
  const [bookingMode, setBookingMode] = useState<"appointment" | "walkin">("appointment");

  // Step 1: Customer Information
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<string>("");
  const [dob, setDob] = useState("");
  const [anni, setAnni] = useState("");
  const [preferredComm, setPreferredComm] = useState<"whatsapp" | "sms" | "email" | "none">("whatsapp");
  const [customerSource, setCustomerSource] = useState<string>("Walk-in");
  const [customerNotes, setCustomerNotes] = useState("");
  const [showExtraProfileFields, setShowExtraProfileFields] = useState(false);

  // Step 2: Workstation & Staff Allocation
  const [serviceAreaId, setServiceAreaId] = useState(presetServiceAreaId || "");
  const [chairId, setChairId] = useState(presetChairId || "");
  const [staff, setStaff] = useState("");

  // Step 3: Service Selection
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");

  // Step 4: Time, Status & Advance Payment
  const [when, setWhen] = useState(() => toLocalISOString(new Date()));
  const [apptStatus, setApptStatus] = useState<"pending" | "checkedin" | "completed" | "cancelled">("pending");

  // Advance Payment State
  const [advanceType, setAdvanceType] = useState<"none" | "token" | "half" | "full" | "custom">("none");
  const [customAdvance, setCustomAdvance] = useState("");

  const [preferences, setPreferences] = useState("");
  const [allergies, setAllergies] = useState("");
  const [specialInst, setSpecialInst] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (presetServiceAreaId) setServiceAreaId(presetServiceAreaId);
      if (presetChairId) setChairId(presetChairId);
      setWhen(toLocalISOString(new Date()));
    }
  }, [open, presetServiceAreaId, presetChairId]);

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

  // Selected Services & Pricing Calculations
  const selectedServices = useMemo(() => services.filter((s) => pickedIds.includes(s.id)), [services, pickedIds]);
  const totalDurationMinutes = useMemo(() => selectedServices.reduce((sum, s) => sum + (s.duration || 0), 0), [selectedServices]);
  const subtotal = useMemo(() => selectedServices.reduce((sum, s) => sum + (s.price || 0), 0), [selectedServices]);

  const gstPct = useMemo(() => {
    if (businessSettings && (businessSettings as any).enable_gst === false) return 0;
    return businessSettings?.tax_percentage ?? 18;
  }, [businessSettings]);

  const gstAmount = useMemo(() => {
    if (subtotal <= 0 || gstPct <= 0) return 0;
    return Math.round((subtotal * gstPct) / 100);
  }, [subtotal, gstPct]);

  const grandTotal = useMemo(() => {
    return subtotal + gstAmount;
  }, [subtotal, gstAmount]);

  // Conditional Advance Payment Calculation
  const advancePaidNum = useMemo(() => {
    if (bookingMode === "walkin") return 0;
    if (advanceType === "none") return 0;
    if (advanceType === "token") return Math.min(500, grandTotal);
    if (advanceType === "half") return Math.round(grandTotal / 2);
    if (advanceType === "full") return grandTotal;
    if (advanceType === "custom") return parseFloat(customAdvance) || 0;
    return 0;
  }, [bookingMode, advanceType, grandTotal, customAdvance]);

  const remainingBalance = useMemo(() => {
    return Math.max(0, grandTotal - advancePaidNum);
  }, [grandTotal, advancePaidNum]);

  // Auto-populate when Customer is Found
  useEffect(() => {
    if (foundCustomer) {
      setName(foundCustomer.name || "");
      if (foundCustomer.email) setEmail(foundCustomer.email);
      if (foundCustomer.gender) setGender(foundCustomer.gender);
      if (foundCustomer.birth_date || (foundCustomer as any).birthday) {
        setDob(foundCustomer.birth_date || (foundCustomer as any).birthday);
      }
      if (foundCustomer.anniversary_date || (foundCustomer as any).anniversary) {
        setAnni(foundCustomer.anniversary_date || (foundCustomer as any).anniversary);
      }
      if (foundCustomer.notes) setCustomerNotes(foundCustomer.notes);
      setShowExtraProfileFields(false);
    }
  }, [foundCustomer]);

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return services;
    const q = serviceSearch.toLowerCase();
    return services.filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
  }, [services, serviceSearch]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Customer name is required.");
      return;
    }
    if (pickedIds.length === 0) {
      toast.error("Select at least one service.");
      return;
    }

    setSaving(true);
    try {
      let targetCustId = foundCustomer?.id;
      if (!targetCustId) {
        try {
          const created = await createCustomerApi({
            name: name.trim(),
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
            gender: gender || undefined,
            birth_date: dob || undefined,
            anniversary_date: anni || undefined,
            notes: customerNotes.trim() || undefined,
          });
          targetCustId = created.id;
          queryClient.invalidateQueries({ queryKey: ["customers-list"] });
        } catch {
          // Fallback if API fails
        }
      }

      const primaryServiceName = selectedServices.map((s) => s.name).join(", ");
      const selectedAreaName = salonAreas.find((a) => a.id === serviceAreaId)?.name || "";
      const selectedChairObj = salonChairs.find((c) => c.id === chairId);
      const selectedChairName = selectedChairObj?.chair_name || "";

      let visitStatusStr = "PENDING";
      if (bookingMode === "walkin") visitStatusStr = "IN_SERVICE";
      else if (apptStatus === "completed") visitStatusStr = "COMPLETED";

      let createdVisitId: string | null = null;
      try {
        const fullNotes = [
          generalNotes,
          advancePaidNum > 0 ? `Advance Paid: ₹${advancePaidNum}` : "",
          `Comm: ${commPref}`,
          `Source: ${custSource}`,
        ].filter(Boolean).join(" | ");

        const createdVisit = await createVisitApi({
          customer_id: targetCustId,
          services: pickedIds.map((id) => ({
            service_id: id,
            quantity: 1,
          })),
          notes: fullNotes || primaryServiceName,
          discount: discountAmount,
        });
        if (createdVisit?.id) {
          createdVisitId = createdVisit.id;
        }
      } catch (err) {
        console.warn("[VISIT_CREATE] Backend visit creation warning:", err);
      }

      if (chairId && bookingMode === "walkin") {
        try {
          await updateSalonChairStatusApi(chairId, "Occupied");
          queryClient.invalidateQueries({ queryKey: ["salon-chairs"] });
        } catch {
          // Fail-soft
        }
      }

      const finalApptId = createdVisitId || `apt-${Date.now()}`;
      const newAppt: Appointment = {
        id: finalApptId,
        code: apptCode({ id: finalApptId } as any),
        businessKey: business,
        service: primaryServiceName,
        services: selectedServices.map((s) => ({ name: s.name, price: s.price, duration: s.duration })),
        staff: staff.trim() || "Unassigned Staff",
        start: when,
        status: bookingMode === "walkin" ? "checkedin" : (apptStatus === "completed" ? "completed" : "pending"),
        price: grandTotal,
        duration: totalDurationMinutes,
        customerId: targetCustId,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerGender: gender,
        customerDob: dob,
        customerAnniversary: anni,
        serviceAreaId,
        serviceAreaName: selectedAreaName,
        chairId,
        chairName: selectedChairName,
        paymentStatus: advancePaidNum >= grandTotal && grandTotal > 0 ? "paid" : "unpaid",
        paidAt: advancePaidNum >= grandTotal ? new Date().toISOString() : undefined,
        advancePaid: advancePaidNum,
        notes: [
          advancePaidNum > 0 ? `Advance Paid: ₹${advancePaidNum}` : "",
          `Comm: ${preferredComm}`,
          `Source: ${customerSource}`,
          preferences,
          allergies,
          specialInst,
          customerNotes,
          generalNotes,
        ].filter(Boolean).join(" | "),
        isWalkIn: bookingMode === "walkin",
      };

      saveAppointment(newAppt);
      queryClient.invalidateQueries({ queryKey: ["dashboard-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["salon-chairs"] });

      toast.success(`Appointment booked for ${name.trim()}!`);
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to create appointment.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setBookingMode("appointment");
    setPhone("");
    setName("");
    setEmail("");
    setGender("");
    setDob("");
    setAnni("");
    setPreferredComm("whatsapp");
    setCustomerSource("Walk-in");
    setCustomerNotes("");
    setShowExtraProfileFields(false);
    setServiceAreaId("");
    setChairId("");
    setPickedIds([]);
    setServiceSearch("");
    setStaff("");
    setWhen(toLocalISOString(new Date()));
    setApptStatus("pending");
    setAdvanceType("none");
    setCustomAdvance("");
    setPreferences("");
    setAllergies("");
    setSpecialInst("");
    setGeneralNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 text-foreground bg-card shadow-2xl">
        <DialogHeader className="border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
                <Scissors className="h-5 w-5 text-primary" /> Book Salon Appointment / Walk-in
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Create new client appointment, auto-assign chair & staff, or start immediate walk-in service.
              </p>
            </div>

            {/* DYNAMIC BOOKING MODE SWITCH */}
            <div className="flex items-center bg-muted p-1 rounded-2xl border shrink-0">
              <button
                type="button"
                onClick={() => {
                  setBookingMode("appointment");
                  setApptStatus("pending");
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  bookingMode === "appointment"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                📅 Appointment
              </button>
              <button
                type="button"
                onClick={() => {
                  setBookingMode("walkin");
                  setApptStatus("checkedin");
                  setAdvanceType("none");
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  bookingMode === "walkin"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ⚡ Walk-in
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* MAIN RESPONSIVE TWO-COLUMN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 py-4 text-xs">
          {/* LEFT COLUMN: FORM STEPS */}
          <div className="lg:col-span-7 space-y-6">
            {/* EXPANDED STEP 1: CUSTOMER INFORMATION */}
            <div className="rounded-2xl border bg-muted/20 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" /> Step 1: Customer Information
                </h4>
                {isExact10 && (
                  <Badge className={`rounded-full text-[10px] px-2.5 py-0.5 ${foundCustomer ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"}`}>
                    {foundCustomer ? "★ Existing Client" : "✚ New Client"}
                  </Badge>
                )}
              </div>

              {/* GRID 1: PHONE & NAME */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="font-semibold text-xs">Phone Number *</Label>
                  <div className="relative mt-1">
                    <Input
                      type="tel"
                      placeholder="Enter 10-digit mobile..."
                      value={phone}
                      onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                      className="rounded-xl pl-8 font-mono text-xs"
                    />
                    <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-3" />
                  </div>
                </div>

                <div>
                  <Label className="font-semibold text-xs">Full Name *</Label>
                  <Input
                    placeholder="Client full name..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-xl mt-1 text-xs"
                  />
                </div>
              </div>

              {/* IF EXISTING CUSTOMER: RENDER CLEAN SMART PROFILE CARD */}
              {foundCustomer ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 p-3.5 space-y-3 text-xs">
                  {/* HEADER ROW */}
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                      <span>👋</span> Welcome Back, {foundCustomer.name}!
                    </div>
                    <span className="bg-emerald-600 text-white rounded-full text-[10px] px-2.5 py-0.5 font-bold shadow-2xs">
                      Existing Customer
                    </span>
                  </div>

                  {/* LOYALTY METRICS ROW (3 COLUMNS) */}
                  {(() => {
                    const currentPts = (foundCustomer as any).points ?? (foundCustomer as any).loyalty_points ?? (foundCustomer.raw as any)?.loyalty_points ?? 0;
                    const earnedPts = Math.floor(grandTotal / 10);
                    const totalAfter = currentPts + earnedPts;

                    return (
                      <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-emerald-500/20">
                        <div className="bg-card/70 dark:bg-card/40 p-2 rounded-xl border border-emerald-500/20">
                          <span className="text-[10px] text-muted-foreground block font-medium">Current Points</span>
                          <span className="font-mono font-bold text-xs text-foreground">{currentPts} pts</span>
                        </div>

                        <div className="bg-card/70 dark:bg-card/40 p-2 rounded-xl border border-emerald-500/20">
                          <span className="text-[10px] text-muted-foreground block font-medium">Earned Today</span>
                          <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">+{earnedPts} pts</span>
                        </div>

                        <div className="bg-card/70 dark:bg-card/40 p-2 rounded-xl border border-emerald-500/20">
                          <span className="text-[10px] text-muted-foreground block font-medium">After Payment</span>
                          <span className="font-mono font-extrabold text-xs text-emerald-700 dark:text-emerald-300">{totalAfter} pts</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* CRM QUICK STATS GRID */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-emerald-500/20">
                    <div className="bg-card/70 dark:bg-card/40 p-2 rounded-xl border border-emerald-500/20">
                      <span className="text-[10px] text-muted-foreground block font-medium">Total Visits</span>
                      <span className="font-mono font-bold text-xs text-foreground">
                        {foundCustomer.visits || (foundCustomer.raw as any)?.visit_count || 1} Visits
                      </span>
                    </div>

                    <div className="bg-card/70 dark:bg-card/40 p-2 rounded-xl border border-emerald-500/20">
                      <span className="text-[10px] text-muted-foreground block font-medium">Lifetime Spend</span>
                      <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        {fmt(foundCustomer.spent || (foundCustomer.raw as any)?.total_spent || 0)}
                      </span>
                    </div>

                    <div className="bg-card/70 dark:bg-card/40 p-2 rounded-xl border border-emerald-500/20">
                      <span className="text-[10px] text-muted-foreground block font-medium">Last Visit</span>
                      <span className="font-mono font-medium text-xs text-foreground truncate block">
                        {foundCustomer.lastVisit || (foundCustomer.raw as any)?.last_visit_at
                          ? new Date(foundCustomer.lastVisit || (foundCustomer.raw as any)?.last_visit_at).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })
                          : "First Visit Today"}
                      </span>
                    </div>
                  </div>

                  {/* ACTION: EDIT PROFILE TOGGLE BUTTON */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setShowExtraProfileFields(!showExtraProfileFields)}
                      className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="h-3 w-3" />
                      {showExtraProfileFields ? "Hide Edit Fields" : "Edit Profile Info"}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* ADDITIONAL REGISTRATION FIELDS (SHOW IF NEW CUSTOMER OR TOGGLED EDIT MODE) */}
              {(!foundCustomer || showExtraProfileFields) && (
                <div className="space-y-4 pt-2 border-t border-border/50">
                  {/* GRID 2: EMAIL & GENDER */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="font-semibold text-xs">Email Address</Label>
                      <Input
                        type="email"
                        placeholder="client@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="rounded-xl mt-1 text-xs"
                      />
                    </div>

                    <div>
                      <Label className="font-semibold text-xs">Gender</Label>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger className="rounded-xl mt-1 text-xs"><SelectValue placeholder="Select gender" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* GRID 3: BIRTHDAY & ANNIVERSARY */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="font-semibold text-xs">Date of Birth</Label>
                      <Input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="rounded-xl mt-1 text-xs"
                      />
                    </div>

                    <div>
                      <Label className="font-semibold text-xs">Anniversary Date</Label>
                      <Input
                        type="date"
                        value={anni}
                        onChange={(e) => setAnni(e.target.value)}
                        className="rounded-xl mt-1 text-xs"
                      />
                    </div>
                  </div>

                  {/* GRID 4: PREFERRED COMMUNICATION & SOURCE */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="font-semibold text-xs mb-1 block">Preferred Communication</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {[
                          { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
                          { id: "sms", label: "SMS", icon: Phone },
                          { id: "email", label: "Email", icon: Mail },
                          { id: "none", label: "None", icon: User },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setPreferredComm(item.id as any)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border flex items-center gap-1 transition-all ${
                              preferredComm === item.id
                                ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                                : "bg-card text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <item.icon className="h-3 w-3" /> {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="font-semibold text-xs">Customer Source</Label>
                      <Select value={customerSource} onValueChange={setCustomerSource}>
                        <SelectTrigger className="rounded-xl mt-1 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Walk-in">Walk-in Client</SelectItem>
                          <SelectItem value="Instagram">Instagram / Social</SelectItem>
                          <SelectItem value="Google">Google Search / Maps</SelectItem>
                          <SelectItem value="Referral">Referral / Friend</SelectItem>
                          <SelectItem value="WhatsApp">WhatsApp Campaign</SelectItem>
                          <SelectItem value="Other">Other Channel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* NOTES */}
                  <div>
                    <Label className="font-semibold text-xs">Customer Notes & Preferences</Label>
                    <Textarea
                      placeholder="Special preferences, allergies, hair history..."
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      className="rounded-xl mt-1 text-xs min-h-[50px]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SMART CUSTOMER INSIGHTS & HISTORY PANEL */}
            {foundCustomer && (
              <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-primary/10 p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary animate-pulse" />
                    <span className="font-bold text-xs uppercase tracking-wider text-foreground">
                      Customer Insights & CRM Analytics
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`rounded-full text-[10px] px-2.5 py-0.5 font-bold ${
                      foundCustomer.status === "VIP"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40"
                        : "bg-primary/10 text-primary border-primary/30"
                    }`}
                  >
                    {foundCustomer.status || "Returning Client"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  <div className="rounded-xl bg-card/80 p-2 border">
                    <p className="text-[10px] text-muted-foreground font-medium flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" /> Total Visits
                    </p>
                    <p className="font-extrabold text-sm text-foreground mt-0.5">
                      {foundCustomer.visits || (foundCustomer.raw as any)?.visit_count || 1} Visits
                    </p>
                  </div>

                  <div className="rounded-xl bg-card/80 p-2 border">
                    <p className="text-[10px] text-muted-foreground font-medium flex items-center justify-center gap-1">
                      <Coins className="h-3 w-3 text-emerald-600" /> Lifetime Spend
                    </p>
                    <p className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {fmt(foundCustomer.spent || (foundCustomer.raw as any)?.total_spent || 0)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-card/80 p-2 border">
                    <p className="text-[10px] text-muted-foreground font-medium flex items-center justify-center gap-1">
                      <TrendingUp className="h-3 w-3 text-blue-600" /> Avg Order Value
                    </p>
                    <p className="font-extrabold text-sm text-blue-600 dark:text-blue-400 mt-0.5">
                      {fmt(
                        (foundCustomer.visits || 1) > 0
                          ? (foundCustomer.spent || 0) / (foundCustomer.visits || 1)
                          : 0
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl bg-card/80 p-2 border">
                    <p className="text-[10px] text-muted-foreground font-medium flex items-center justify-center gap-1">
                      <Calendar className="h-3 w-3 text-purple-600" /> Last Visit
                    </p>
                    <p className="font-semibold text-xs text-foreground mt-0.5 truncate">
                      {foundCustomer.lastVisit || (foundCustomer.raw as any)?.last_visit_at
                        ? new Date(foundCustomer.lastVisit || (foundCustomer.raw as any)?.last_visit_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Recent"}
                    </p>
                  </div>
                </div>

                {foundCustomer.favorites && foundCustomer.favorites.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50">
                    <span className="text-[10px] text-muted-foreground font-medium">Frequent Services:</span>
                    {foundCustomer.favorites.map((fav, i) => (
                      <Badge key={i} variant="secondary" className="rounded-full text-[10px] bg-primary/10 text-primary">
                        {fav}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: WORKSTATION & STAFF ALLOCATION */}
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Scissors className="h-3.5 w-3.5 text-primary" /> Step 2: Workstation & Staff Allocation
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="font-semibold text-xs">Service Area</Label>
                  <Select value={serviceAreaId} onValueChange={(v) => { setServiceAreaId(v); setChairId(""); }}>
                    <SelectTrigger className="rounded-xl mt-1 text-xs"><SelectValue placeholder="Select Area" /></SelectTrigger>
                    <SelectContent>
                      {salonAreas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="font-semibold text-xs">Workstation / Chair</Label>
                  <Select value={chairId} onValueChange={setChairId}>
                    <SelectTrigger className="rounded-xl mt-1 text-xs"><SelectValue placeholder="Assign Chair" /></SelectTrigger>
                    <SelectContent>
                      {availableChairsInArea.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.chair_name} ({c.status})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="font-semibold text-xs">Assigned Staff</Label>
                  <Select value={staff} onValueChange={setStaff}>
                    <SelectTrigger className="rounded-xl mt-1 text-xs"><SelectValue placeholder="Assign Staff" /></SelectTrigger>
                    <SelectContent>
                      {staffMembers.map((s: any) => (
                        <SelectItem key={s.id || s.name} value={s.name}>{s.name} ({s.designation || "Staff"})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* SECTION 3: SERVICES SELECTION */}
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Step 3: Select Services ({selectedServices.length})
                </h4>
                <Badge variant="secondary" className="rounded-full font-mono text-xs">
                  {totalDurationMinutes} mins total
                </Badge>
              </div>

              <Input
                placeholder="Search services by name or category..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="rounded-xl text-xs"
              />

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {filteredServices.map((svc) => {
                  const isSelected = pickedIds.includes(svc.id);
                  return (
                    <div
                      key={svc.id}
                      onClick={() => {
                        setPickedIds((prev) =>
                          isSelected ? prev.filter((id) => id !== svc.id) : [...prev, svc.id]
                        );
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${isSelected ? "border-primary bg-primary/5 font-semibold" : "hover:bg-muted/40"}`}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox checked={isSelected} />
                        <div>
                          <span className="text-xs font-medium text-foreground">{svc.name}</span>
                          <span className="text-[10px] text-muted-foreground block">{svc.category} · {svc.duration} mins</span>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-primary">{fmt(svc.price)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 4: TIME & CONDITIONAL ADVANCE PAYMENT */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="font-semibold text-xs">Appointment Time *</Label>
                  <Input
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                    className="rounded-xl mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="font-semibold text-xs">Appointment Status</Label>
                  <Select value={apptStatus} onValueChange={(v: any) => setApptStatus(v)}>
                    <SelectTrigger className="rounded-xl mt-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Booked (Scheduled)</SelectItem>
                      <SelectItem value="checkedin">Checked In (In Service)</SelectItem>
                      <SelectItem value="completed">Completed & Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* CONDITIONAL ADVANCE PAYMENT SECTION */}
              {bookingMode === "appointment" && (
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-primary" /> Advance Deposit / Token Amount
                    </h4>
                    <Badge variant="outline" className="rounded-full font-mono text-[10px] bg-primary/5 text-primary border-primary/30">
                      Advance: {fmt(advancePaidNum)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                    {[
                      { id: "none", label: "No Advance", val: "₹0" },
                      { id: "token", label: "₹500 Token", val: fmt(Math.min(500, grandTotal)) },
                      { id: "half", label: "50% Deposit", val: fmt(Math.round(grandTotal / 2)) },
                      { id: "full", label: "100% Full", val: fmt(grandTotal) },
                      { id: "custom", label: "Custom", val: "Enter ₹" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAdvanceType(opt.id as any)}
                        className={`p-2 rounded-xl text-center border text-xs transition-all ${
                          advanceType === opt.id
                            ? "border-primary bg-primary/10 font-bold text-primary shadow-2xs"
                            : "hover:bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <span className="block text-[11px] font-semibold">{opt.label}</span>
                        <span className="block text-[10px] font-mono opacity-80">{opt.val}</span>
                      </button>
                    ))}
                  </div>

                  {advanceType === "custom" && (
                    <div className="pt-1">
                      <Label className="font-semibold text-xs">Enter Custom Advance Deposit Amount (₹)</Label>
                      <Input
                        type="number"
                        placeholder="Enter amount in ₹..."
                        value={customAdvance}
                        onChange={(e) => setCustomAdvance(e.target.value)}
                        className="rounded-xl mt-1 text-xs font-mono"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: STICKY LIVE APPOINTMENT SUMMARY PANEL */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-0 space-y-4">
              <div className="rounded-2xl border bg-muted/10 p-5 space-y-4 shadow-xs">
                {/* HEADER */}
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                    <Receipt className="h-4.5 w-4.5 text-primary" /> Appointment Summary
                  </h3>
                  <Badge variant="outline" className={`rounded-full text-[10px] ${bookingMode === "walkin" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"}`}>
                    {bookingMode === "walkin" ? "Mode: Walk-in" : "Mode: Appointment"}
                  </Badge>
                </div>

                {/* CUSTOMER INFORMATION */}
                <div className="rounded-xl bg-card p-3 border space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Customer
                  </span>
                  {name.trim() ? (
                    <div>
                      <p className="font-semibold text-xs text-foreground">{name.trim()}</p>
                      {phone.trim() && (
                        <p className="text-[11px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 text-muted-foreground" /> {phone.trim()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Customer not selected</p>
                  )}
                </div>

                {/* SELECTED SERVICES */}
                <div className="space-y-2 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Services ({selectedServices.length})
                    </span>
                  </div>

                  {selectedServices.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground bg-card/50">
                      No services selected
                    </div>
                  ) : (
                    <div className="max-h-44 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {selectedServices.map((svc) => (
                        <div key={svc.id} className="flex items-center justify-between rounded-xl bg-card p-2.5 border text-xs">
                          <div className="min-w-0 pr-2">
                            <p className="font-medium text-foreground truncate">{svc.name}</p>
                            <p className="text-[10px] text-muted-foreground">{svc.category} · {svc.duration} mins</p>
                          </div>
                          <span className="font-mono font-bold text-foreground shrink-0">{fmt(svc.price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* LIVE PRICING BREAKDOWN */}
                <div className="space-y-2.5 border-t pt-3 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono font-semibold text-foreground">{fmt(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>GST ({gstPct}%)</span>
                    <span className="font-mono font-semibold text-foreground">{fmt(gstAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2.5 font-bold text-sm text-foreground">
                    <span className="text-foreground">Total Amount</span>
                    <span className="font-mono text-base font-bold text-primary">{fmt(grandTotal)}</span>
                  </div>

                  {/* DYNAMIC REMAINING BALANCE (IF APPOINTMENT MODE & ADVANCE > 0) */}
                  {bookingMode === "appointment" && (
                    <>
                      <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                        <span>Advance Paid</span>
                        <span className="font-mono font-bold">-{fmt(advancePaidNum)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-dashed pt-2.5 bg-card p-2.5 rounded-xl border">
                        <span className="font-bold text-foreground">Remaining (Pay at Salon)</span>
                        <span className="font-mono text-base font-extrabold text-amber-600 dark:text-amber-400">
                          {fmt(remainingBalance)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t pt-4">
          <Button variant="ghost" className="rounded-full text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-full gradient-brand text-primary-foreground text-xs px-6 font-semibold"
            onClick={handleSave}
            disabled={saving || !name.trim() || pickedIds.length === 0}
          >
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
            {bookingMode === "walkin" ? "Start Immediate Walk-in" : "Confirm Appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
