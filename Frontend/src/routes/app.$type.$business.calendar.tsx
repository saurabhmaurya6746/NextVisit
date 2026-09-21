import { useState, useEffect, useMemo, useCallback } from "react";
import { createFileRoute } from "@/lib/route-compat";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Cake,
  Heart,
  Calendar as CalendarIcon,
  Megaphone,
  UserCog,
  FileText,
  Bell,
  CheckSquare,
  Sparkles,
  Clock,
  User,
  Phone,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  Repeat,
  Tag,
  AlertCircle,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import { listCustomersApi, type CustomerModel } from "@/lib/customers-api";
import { listStaffApi, type StaffMember } from "@/lib/staff-api";
import {
  listCalendarEventsApi,
  createCalendarEventApi,
  updateCalendarEventApi,
  deleteCalendarEventApi,
  type CalendarEventModel,
} from "@/lib/calendar-api";

export const Route = createFileRoute("/app/$type/$business/calendar")({ component: CalendarPage });

// Icon & Color mapping by Event Category
const categoryConfig: Record<
  string,
  { label: string; icon: any; badgeClass: string; borderClass: string; dotClass: string }
> = {
  BIRTHDAY: {
    label: "Birthdays",
    icon: Cake,
    badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    borderClass: "border-l-amber-500",
    dotClass: "bg-amber-500",
  },
  BOOKING: {
    label: "Bookings",
    icon: CalendarIcon,
    badgeClass: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
    borderClass: "border-l-sky-500",
    dotClass: "bg-sky-500",
  },
  APPOINTMENT: {
    label: "Appointments",
    icon: CalendarIcon,
    badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    borderClass: "border-l-blue-500",
    dotClass: "bg-blue-500",
  },
  CAMPAIGN: {
    label: "Campaigns",
    icon: Megaphone,
    badgeClass: "bg-primary/15 text-primary border-primary/30",
    borderClass: "border-l-primary",
    dotClass: "bg-primary",
  },
  ANNIVERSARY: {
    label: "Anniversaries",
    icon: Heart,
    badgeClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    borderClass: "border-l-rose-500",
    dotClass: "bg-rose-500",
  },
  STAFF: {
    label: "Staff",
    icon: UserCog,
    badgeClass: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
    borderClass: "border-l-slate-500",
    dotClass: "bg-slate-500",
  },
  NOTE: {
    label: "Notes",
    icon: FileText,
    badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    borderClass: "border-l-emerald-500",
    dotClass: "bg-emerald-500",
  },
  REMINDER: {
    label: "Reminders",
    icon: Bell,
    badgeClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
    borderClass: "border-l-violet-500",
    dotClass: "bg-violet-500",
  },
  TASK: {
    label: "Tasks",
    icon: CheckSquare,
    badgeClass: "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30",
    borderClass: "border-l-teal-500",
    dotClass: "bg-teal-500",
  },
  EVENT: {
    label: "Events",
    icon: Sparkles,
    badgeClass: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
    borderClass: "border-l-purple-500",
    dotClass: "bg-purple-500",
  },
};

const filterChips = [
  { id: "ALL", label: "All", icon: Sparkles },
  { id: "BIRTHDAY", label: "Birthdays", icon: Cake },
  { id: "BOOKING", label: "Bookings", icon: CalendarIcon },
  { id: "CAMPAIGN", label: "Campaigns", icon: Megaphone },
  { id: "ANNIVERSARY", label: "Anniversaries", icon: Heart },
  { id: "STAFF", label: "Staff", icon: UserCog },
  { id: "NOTE", label: "Notes", icon: FileText },
  { id: "TASK", label: "Tasks", icon: CheckSquare },
  { id: "REMINDER", label: "Reminders", icon: Bell },
];

export default function CalendarPage() {
  const routerParams = useParams({ strict: false }) as Record<string, string>;
  const isSalon = routerParams?.type === "salon";

  // Date State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Data State
  const [events, setEvents] = useState<CalendarEventModel[]>([]);
  const [customers, setCustomers] = useState<CustomerModel[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Selected Day Details Drawer
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Selected Event Details Sheet
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventModel | null>(null);

  // Add/Edit Event Dialog State
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventModel | null>(null);

  // Form State
  const [formType, setFormType] = useState<string>("EVENT");
  const [formTitle, setFormTitle] = useState<string>("");
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [formTime, setFormTime] = useState<string>("09:00");
  const [formRepeat, setFormRepeat] = useState<string>("NONE");
  const [formCustomerId, setFormCustomerId] = useState<string>("none");
  const [formStaffId, setFormStaffId] = useState<string>("none");
  const [formReminder, setFormReminder] = useState<string>("none");
  const [formDescription, setFormDescription] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  // -------------------------------------------------------------------
  // DATA LOADING
  // -------------------------------------------------------------------
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Calculate date window based on viewMode and currentDate
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      let startWindow: Date;
      let endWindow: Date;

      if (viewMode === "month") {
        startWindow = new Date(year, month - 1, 1);
        endWindow = new Date(year, month + 2, 0);
      } else if (viewMode === "week") {
        const dayOfWeek = currentDate.getDay();
        const diff = currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
        startWindow = new Date(currentDate);
        startWindow.setDate(diff - 7);
        endWindow = new Date(startWindow);
        endWindow.setDate(startWindow.getDate() + 28);
      } else {
        startWindow = new Date(currentDate);
        startWindow.setDate(currentDate.getDate() - 7);
        endWindow = new Date(currentDate);
        endWindow.setDate(currentDate.getDate() + 7);
      }

      const [evData, custData, staffRes] = await Promise.all([
        listCalendarEventsApi({
          start_date: startWindow.toISOString(),
          end_date: endWindow.toISOString(),
        }).catch(() => []),
        listCustomersApi().catch(() => []),
        listStaffApi("", "ALL", 1, 100).catch(() => ({ items: [] })),
      ]);

      setEvents(evData);
      setCustomers(custData);
      setStaffList(staffRes.items || []);
    } catch (err: any) {
      console.error("[CALENDAR] Error loading calendar data:", err);
      toast.error("Failed to load calendar events.");
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // -------------------------------------------------------------------
  // DATE NAVIGATION CONTROLS
  // -------------------------------------------------------------------
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === "month") {
      next.setMonth(next.getMonth() - 1);
    } else if (viewMode === "week") {
      next.setDate(next.getDate() - 7);
    } else {
      next.setDate(next.getDate() - 1);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === "month") {
      next.setMonth(next.getMonth() + 1);
    } else if (viewMode === "week") {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Header Title Text
  const headerDateText = useMemo(() => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    if (viewMode === "month") {
      return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    }
    // Week
    const dayOfWeek = currentDate.getDay();
    const monday = new Date(currentDate);
    monday.setDate(currentDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `Week of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }, [currentDate, viewMode]);

  // -------------------------------------------------------------------
  // EVENT FILTERING
  // -------------------------------------------------------------------
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      // Category filter
      if (activeCategory !== "ALL") {
        const type = (e.event_type || "EVENT").toUpperCase();
        if (activeCategory === "BOOKING" && type !== "BOOKING" && type !== "APPOINTMENT") return false;
        if (activeCategory !== "BOOKING" && type !== activeCategory) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = e.title.toLowerCase().includes(q);
        const matchDesc = e.description?.toLowerCase().includes(q);
        const matchCust = e.customer?.name.toLowerCase().includes(q);
        const matchStaff = e.staff?.name.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCust && !matchStaff) return false;
      }
      return true;
    });
  }, [events, activeCategory, searchQuery]);

  // -------------------------------------------------------------------
  // OPEN ADD / EDIT EVENT MODAL
  // -------------------------------------------------------------------
  const openAddModal = (presetDate?: Date, presetType?: string) => {
    setEditingEvent(null);
    const dt = presetDate || currentDate;
    setFormDate(dt.toISOString().split("T")[0]);
    setFormTime("10:00");
    setFormType(presetType || "EVENT");
    setFormTitle("");
    setFormDescription("");
    setFormRepeat("NONE");
    setFormCustomerId("none");
    setFormStaffId("none");
    setFormReminder("none");
    setAddModalOpen(true);
  };

  const openEditModal = (ev: CalendarEventModel) => {
    setEditingEvent(ev);
    const dt = new Date(ev.start_at);
    setFormDate(dt.toISOString().split("T")[0]);
    setFormTime(dt.toTimeString().slice(0, 5));
    setFormType(ev.event_type || "EVENT");
    setFormTitle(ev.title);
    setFormDescription(ev.description || "");
    setFormRepeat(ev.recurrence_rule || "NONE");
    setFormCustomerId(ev.customer_id || "none");
    setFormStaffId(ev.staff_id || "none");
    setFormReminder(ev.reminder_minutes ? String(ev.reminder_minutes) : "none");
    setAddModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Event title is required.");
      return;
    }
    setSaving(true);
    try {
      const startIso = new Date(`${formDate}T${formTime || "09:00"}:00`).toISOString();
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        event_type: formType,
        start_at: startIso,
        customer_id: formCustomerId === "none" ? undefined : formCustomerId,
        staff_id: formStaffId === "none" ? undefined : formStaffId,
        reminder_minutes: formReminder === "none" ? undefined : parseInt(formReminder, 10),
        recurrence_rule: formRepeat,
      };

      if (editingEvent) {
        await updateCalendarEventApi(editingEvent.id, payload);
        toast.success("Event updated successfully!");
      } else {
        await createCalendarEventApi(payload);
        toast.success("New event added to calendar!");
      }
      setAddModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save calendar event");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTaskCompletion = async (ev: CalendarEventModel, isCompleted: boolean) => {
    if (ev.is_system) return;
    try {
      await updateCalendarEventApi(ev.id, { is_completed: isCompleted });
      toast.success(isCompleted ? "Task marked complete! ✓" : "Task marked incomplete");
      setEvents((prev) =>
        prev.map((item) => (item.id === ev.id ? { ...item, is_completed: isCompleted } : item))
      );
      if (selectedEvent && selectedEvent.id === ev.id) {
        setSelectedEvent((prev) => (prev ? { ...prev, is_completed: isCompleted } : null));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update task");
    }
  };

  const handleDeleteEvent = async (ev: CalendarEventModel) => {
    if (ev.is_system) {
      toast.error("System-generated calendar events (Birthdays, Bookings, Campaigns) cannot be deleted directly.");
      return;
    }
    if (!confirm(`Are you sure you want to delete '${ev.title}'?`)) return;
    try {
      await deleteCalendarEventApi(ev.id);
      toast.success("Event deleted from calendar.");
      setSelectedEvent(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete event");
    }
  };

  // -------------------------------------------------------------------
  // WEEK VIEW CALCULATION
  // -------------------------------------------------------------------
  const weekDays = useMemo(() => {
    const dayOfWeek = currentDate.getDay();
    const monday = new Date(currentDate);
    monday.setDate(currentDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];

      const dayEvs = filteredEvents.filter((e) => {
        const eDateStr = new Date(e.start_at).toISOString().split("T")[0];
        return eDateStr === dateStr;
      });

      days.push({
        date: d,
        dateStr,
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        dayNum: d.getDate(),
        monthName: d.toLocaleDateString("en-US", { month: "short" }),
        isToday: d.toDateString() === new Date().toDateString(),
        items: dayEvs,
      });
    }
    return days;
  }, [currentDate, filteredEvents]);

  // -------------------------------------------------------------------
  // MONTH VIEW CALCULATION
  // -------------------------------------------------------------------
  const monthGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sun
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(firstDayOfMonth.getDate() - (startDayOfWeek === 0 ? 6 : startDayOfWeek - 1));

    const cells = [];
    for (let i = 0; i < 35; i++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + i);
      const dateStr = cellDate.toISOString().split("T")[0];

      const cellEvs = filteredEvents.filter((e) => {
        const eDateStr = new Date(e.start_at).toISOString().split("T")[0];
        return eDateStr === dateStr;
      });

      cells.push({
        date: cellDate,
        dateStr,
        dayNum: cellDate.getDate(),
        isCurrentMonth: cellDate.getMonth() === month,
        isToday: cellDate.toDateString() === new Date().toDateString(),
        items: cellEvs,
      });
    }
    return cells;
  }, [currentDate, filteredEvents]);

  // -------------------------------------------------------------------
  // DAY DETAILS DRAWER ITEMS
  // -------------------------------------------------------------------
  const dayDrawerItems = useMemo(() => {
    if (!selectedDay) return [];
    const targetStr = selectedDay.toISOString().split("T")[0];
    return filteredEvents.filter((e) => {
      const eDateStr = new Date(e.start_at).toISOString().split("T")[0];
      return eDateStr === targetStr;
    });
  }, [selectedDay, filteredEvents]);

  return (
    <>
      <div className="space-y-4">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <PageHeader
            title="Calendar"
            description="Birthdays, bookings, campaigns and staff — one view."
          />
          <div className="flex items-center gap-2">
            <Button
              className="rounded-full gradient-brand text-primary-foreground font-semibold text-xs shadow-sm hover:shadow"
              onClick={() => openAddModal()}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Event
            </Button>
          </div>
        </div>

        {/* NAVIGATION & VIEW SWITCHER CONTROL BAR */}
        <Card className="rounded-2xl shadow-sm border bg-card p-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* DATE CONTROL & TODAY */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 rounded-full text-xs font-semibold px-3" onClick={handleToday}>
                Today
              </Button>
              <div className="flex items-center gap-1 border rounded-full p-0.5 bg-muted/40">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={handlePrev}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-display font-bold text-sm px-3 min-w-[140px] text-center text-foreground">
                  {headerDateText}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={handleNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* SEARCH INPUT & VIEW MODE SWITCHER */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[180px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-3 text-xs rounded-full bg-background"
                />
              </div>

              <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                <TabsList className="h-8 rounded-full bg-muted/60 p-1">
                  <TabsTrigger value="day" className="rounded-full text-xs px-3">Day</TabsTrigger>
                  <TabsTrigger value="week" className="rounded-full text-xs px-3">Week</TabsTrigger>
                  <TabsTrigger value="month" className="rounded-full text-xs px-3">Month</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* INTERACTIVE EVENT CATEGORY FILTER CHIPS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-3 border-t mt-3 pb-1">
            {filterChips.map((chip) => {
              const isActive = activeCategory === chip.id;
              const Icon = chip.icon;
              const cfg = categoryConfig[chip.id];
              return (
                <Badge
                  key={chip.id}
                  variant={isActive ? "default" : "outline"}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs transition-all shrink-0 flex items-center gap-1.5 ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                  onClick={() => setActiveCategory(chip.id)}
                >
                  <Icon className={`h-3 w-3 ${isActive ? "" : cfg ? cfg.dotClass : ""}`} />
                  <span>{chip.label}</span>
                </Badge>
              );
            })}
          </div>
        </Card>

        {/* LOADING INDICATOR */}
        {loading ? (
          <div className="py-16 text-center flex flex-col items-center justify-center space-y-3 bg-card border rounded-2xl">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading calendar schedule...</p>
          </div>
        ) : (
          <>
            {/* VIEW 1: WEEK VIEW */}
            {viewMode === "week" && (
              <Card className="rounded-2xl border shadow-sm">
                <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {weekDays.map((day) => (
                    <div
                      key={day.dateStr}
                      className={`rounded-2xl border p-3 flex flex-col justify-between min-h-[220px] transition-all group ${
                        day.isToday
                          ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20"
                          : "bg-card hover:border-primary/30"
                      }`}
                    >
                      <div>
                        {/* DAY HEADER */}
                        <div className="flex items-center justify-between border-b pb-2 mb-2">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {day.dayName}
                            </p>
                            <div className="flex items-baseline gap-1">
                              <span className="font-display font-bold text-xl text-foreground">{day.dayNum}</span>
                              <span className="text-[10px] text-muted-foreground">{day.monthName}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {day.isToday && (
                              <Badge className="rounded-full text-[9px] px-1.5 py-0 bg-primary text-primary-foreground">
                                Today
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-opacity"
                              title="Quick Add Event"
                              onClick={() => openAddModal(day.date)}
                            >
                              <Plus className="h-3.5 w-3.5 text-primary" />
                            </Button>
                          </div>
                        </div>

                        {/* DAY EVENT ITEMS */}
                        <div className="space-y-1.5">
                          {day.items.length === 0 ? (
                            <p
                              className="text-[11px] text-muted-foreground/50 py-3 text-center cursor-pointer hover:text-primary transition-colors"
                              onClick={() => setSelectedDay(day.date)}
                            >
                              No events
                            </p>
                          ) : (
                            day.items.slice(0, 4).map((it) => {
                              const cfg = categoryConfig[it.event_type] || categoryConfig.EVENT;
                              const Icon = cfg.icon;
                              return (
                                <div
                                  key={it.id}
                                  className={`group/item flex items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-[11px] border-l-2 transition-all cursor-pointer shadow-2xs hover:scale-[1.02] ${
                                    cfg.borderClass
                                  } ${cfg.badgeClass} ${it.is_completed ? "opacity-60 line-through" : ""}`}
                                  onClick={() => setSelectedEvent(it)}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Icon className="h-3 w-3 shrink-0" />
                                    <span className="truncate font-medium">{it.title}</span>
                                  </div>

                                  {it.event_type === "TASK" && !it.is_system && (
                                    <input
                                      type="checkbox"
                                      checked={it.is_completed}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleToggleTaskCompletion(it, e.target.checked);
                                      }}
                                      className="h-3 w-3 rounded border-primary text-primary focus:ring-0 shrink-0 cursor-pointer"
                                    />
                                  )}
                                </div>
                              );
                            })
                          )}
                          {day.items.length > 4 && (
                            <p
                              className="text-[10px] font-semibold text-primary text-center pt-1 cursor-pointer hover:underline"
                              onClick={() => setSelectedDay(day.date)}
                            >
                              + {day.items.length - 4} more
                            </p>
                          )}
                        </div>
                      </div>

                      {/* VIEW DAY DETAILS ACTION */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-[10px] h-6 mt-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        onClick={() => setSelectedDay(day.date)}
                      >
                        View Details
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* VIEW 2: DAY VIEW */}
            {viewMode === "day" && (
              <Card className="rounded-2xl border shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-foreground">
                      {currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {weekDays.find((d) => d.isToday)?.dateStr === currentDate.toISOString().split("T")[0]
                        ? "Today's Detailed Schedule"
                        : "Detailed Day Schedule"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-full text-xs gradient-brand text-primary-foreground"
                    onClick={() => openAddModal(currentDate)}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Event for Today
                  </Button>
                </div>

                {filteredEvents.filter(
                  (e) => new Date(e.start_at).toISOString().split("T")[0] === currentDate.toISOString().split("T")[0]
                ).length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">No events scheduled</h3>
                      <p className="text-xs text-muted-foreground">Your day is completely clear.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-xs border-primary/40 text-primary"
                      onClick={() => openAddModal(currentDate)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add Event
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredEvents
                      .filter(
                        (e) => new Date(e.start_at).toISOString().split("T")[0] === currentDate.toISOString().split("T")[0]
                      )
                      .map((it) => {
                        const cfg = categoryConfig[it.event_type] || categoryConfig.EVENT;
                        const Icon = cfg.icon;
                        const timeStr = new Date(it.start_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                        return (
                          <div
                            key={it.id}
                            className={`p-4 rounded-xl border-l-4 bg-card border shadow-xs flex items-center justify-between gap-4 hover:border-primary/40 transition-all cursor-pointer ${cfg.borderClass}`}
                            onClick={() => setSelectedEvent(it)}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`p-2.5 rounded-xl ${cfg.badgeClass}`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h4 className={`font-semibold text-sm text-foreground ${it.is_completed ? "line-through opacity-60" : ""}`}>
                                    {it.title}
                                  </h4>
                                  <Badge variant="outline" className={`rounded-full text-[10px] ${cfg.badgeClass}`}>
                                    {cfg.label}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground flex items-center gap-3">
                                  <span className="flex items-center gap-1 font-mono">
                                    <Clock className="h-3 w-3" /> {timeStr}
                                  </span>
                                  {it.customer && (
                                    <span className="flex items-center gap-1 font-medium">
                                      <User className="h-3 w-3" /> {it.customer.name}
                                    </span>
                                  )}
                                  {it.staff && (
                                    <span className="flex items-center gap-1">
                                      <UserCog className="h-3 w-3" /> Staff: {it.staff.name}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {it.event_type === "TASK" && !it.is_system && (
                                <Button
                                  size="sm"
                                  variant={it.is_completed ? "outline" : "default"}
                                  className="h-7 text-xs rounded-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleTaskCompletion(it, !it.is_completed);
                                  }}
                                >
                                  {it.is_completed ? "Mark Incomplete" : "✓ Complete"}
                                </Button>
                              )}
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </Card>
            )}

            {/* VIEW 3: MONTH VIEW */}
            {viewMode === "month" && (
              <Card className="rounded-2xl border shadow-sm overflow-hidden">
                {/* MONTH HEADER DAYS */}
                <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-xs font-bold text-muted-foreground py-2">
                  <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                </div>

                <div className="grid grid-cols-7 border-collapse">
                  {monthGrid.map((cell, idx) => (
                    <div
                      key={idx}
                      className={`min-h-[100px] border-b border-r p-1.5 flex flex-col justify-between transition-colors group ${
                        !cell.isCurrentMonth
                          ? "bg-muted/10 opacity-50"
                          : cell.isToday
                          ? "bg-primary/5 ring-1 ring-primary/20"
                          : "bg-card hover:bg-muted/20"
                      }`}
                      onClick={() => setSelectedDay(cell.date)}
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span
                            className={`font-bold rounded-full h-5 w-5 grid place-items-center ${
                              cell.isToday
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {cell.dayNum}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAddModal(cell.date);
                            }}
                          >
                            <Plus className="h-3 w-3 text-primary" />
                          </Button>
                        </div>

                        {/* EVENT DOTS & PILLS */}
                        <div className="space-y-1">
                          {cell.items.slice(0, 2).map((it) => {
                            const cfg = categoryConfig[it.event_type] || categoryConfig.EVENT;
                            return (
                              <div
                                key={it.id}
                                className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium border-l-2 cursor-pointer ${cfg.borderClass} ${cfg.badgeClass}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEvent(it);
                                }}
                              >
                                {it.title}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {cell.items.length > 2 && (
                        <p className="text-[9px] font-bold text-primary text-right pr-1 pt-1">
                          + {cell.items.length - 2} more
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* DAY DETAILS DRAWER (Right-side Sheet) */}
      {/* ------------------------------------------------------------------- */}
      <Sheet open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <SheetContent className="sm:max-w-md w-full rounded-l-2xl p-6 overflow-y-auto space-y-4">
          {selectedDay && (
            <>
              <SheetHeader className="border-b pb-3 space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="rounded-full text-xs text-primary border-primary/30">
                    Day Schedule
                  </Badge>
                  <Button
                    size="sm"
                    className="rounded-full h-7 text-xs gradient-brand text-primary-foreground"
                    onClick={() => {
                      const dt = selectedDay;
                      setSelectedDay(null);
                      openAddModal(dt);
                    }}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Event
                  </Button>
                </div>
                <SheetTitle className="font-display text-lg font-bold text-foreground">
                  {selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-4 py-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Events ({dayDrawerItems.length})
                </h4>

                {dayDrawerItems.length === 0 ? (
                  <div className="py-12 text-center space-y-3 bg-muted/20 border rounded-2xl p-4">
                    <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto" />
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">No events scheduled</h4>
                      <p className="text-xs text-muted-foreground">Your day is clear.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-xs border-primary/40 text-primary"
                      onClick={() => {
                        const dt = selectedDay;
                        setSelectedDay(null);
                        openAddModal(dt);
                      }}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add Event
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {dayDrawerItems.map((it) => {
                      const cfg = categoryConfig[it.event_type] || categoryConfig.EVENT;
                      const Icon = cfg.icon;
                      const timeStr = new Date(it.start_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <div
                          key={it.id}
                          className={`p-3 rounded-xl border border-l-4 bg-card shadow-2xs flex items-center justify-between gap-3 hover:border-primary/40 transition-all cursor-pointer ${cfg.borderClass}`}
                          onClick={() => {
                            setSelectedDay(null);
                            setSelectedEvent(it);
                          }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className={`h-4 w-4 shrink-0 ${cfg.badgeClass.split(" ")[1]}`} />
                            <div className="space-y-0.5">
                              <p className={`font-semibold text-xs text-foreground ${it.is_completed ? "line-through opacity-60" : ""}`}>
                                {it.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-2 font-mono">
                                <Clock className="h-3 w-3" /> {timeStr}
                                {it.customer && <span>· Customer: {it.customer.name}</span>}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className={`rounded-full text-[9px] px-2 ${cfg.badgeClass}`}>
                            {cfg.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ------------------------------------------------------------------- */}
      {/* EVENT DETAILS DRAWER (Right-side Sheet) */}
      {/* ------------------------------------------------------------------- */}
      <Sheet open={!!selectedEvent} onOpenChange={(o) => !o && setSelectedEvent(null)}>
        <SheetContent className="sm:max-w-md w-full rounded-l-2xl p-6 overflow-y-auto space-y-4">
          {selectedEvent && (
            <>
              {(() => {
                const cfg = categoryConfig[selectedEvent.event_type] || categoryConfig.EVENT;
                const Icon = cfg.icon;
                const dt = new Date(selectedEvent.start_at);
                const dateStr = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                const timeStr = dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

                return (
                  <div className="space-y-4">
                    <SheetHeader className="border-b pb-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={`rounded-full text-xs font-semibold ${cfg.badgeClass}`}>
                          <Icon className="mr-1 h-3.5 w-3.5 inline" /> {cfg.label}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          Source: {selectedEvent.source}
                        </Badge>
                      </div>
                      <SheetTitle className="font-display text-lg font-bold text-foreground pt-1">
                        {selectedEvent.title}
                      </SheetTitle>
                      <SheetDescription className="text-xs flex items-center gap-3 pt-1 text-foreground font-mono">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3.5 w-3.5 text-primary" /> {dateStr}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-primary" /> {timeStr}
                        </span>
                      </SheetDescription>
                    </SheetHeader>

                    {/* RECURRENCE & REMINDER BADGES */}
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedEvent.recurrence_rule && selectedEvent.recurrence_rule !== "NONE" && (
                        <Badge variant="outline" className="rounded-full text-xs flex items-center gap-1">
                          <Repeat className="h-3 w-3 text-primary" /> Repeats: {selectedEvent.recurrence_rule}
                        </Badge>
                      )}
                      {selectedEvent.reminder_minutes && (
                        <Badge variant="outline" className="rounded-full text-xs flex items-center gap-1 text-violet-600 border-violet-200">
                          <Bell className="h-3 w-3" /> Reminder: {selectedEvent.reminder_minutes} mins before
                        </Badge>
                      )}
                    </div>

                    {/* DESCRIPTION */}
                    {selectedEvent.description && (
                      <div className="space-y-1.5 p-3 rounded-xl bg-muted/40 border">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase">Description</span>
                        <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                          {selectedEvent.description}
                        </p>
                      </div>
                    )}

                    {/* LINKED CUSTOMER CONTEXT CARD */}
                    {selectedEvent.customer && (
                      <div className="p-3.5 rounded-xl border bg-card space-y-2">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                            <User className="h-4 w-4 text-primary" /> Customer Context
                          </div>
                          <span className="text-[10px] text-muted-foreground">ID: {selectedEvent.customer.id.slice(0, 8)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Name</span>
                            <span className="font-semibold text-foreground">{selectedEvent.customer.name}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Phone</span>
                            <span className="font-mono text-foreground">{selectedEvent.customer.phone}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Previous Visits</span>
                            <span className="font-semibold text-foreground">{selectedEvent.customer.visit_count} visits</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Total Spent</span>
                            <span className="font-semibold text-foreground">{formatCurrency(selectedEvent.customer.total_spent)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* LINKED STAFF CONTEXT */}
                    {selectedEvent.staff && (
                      <div className="p-3 rounded-xl border bg-card flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <UserCog className="h-4 w-4 text-primary" />
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Assigned Staff</span>
                            <span className="font-semibold text-foreground">{selectedEvent.staff.name}</span>
                          </div>
                        </div>
                        {selectedEvent.staff.role && (
                          <Badge variant="secondary" className="rounded-full text-[10px]">
                            {selectedEvent.staff.role}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* ACTIONS BAR */}
                    <div className="pt-4 border-t space-y-2">
                      {selectedEvent.event_type === "TASK" && !selectedEvent.is_system && (
                        <Button
                          variant={selectedEvent.is_completed ? "outline" : "default"}
                          className="w-full rounded-full text-xs font-semibold"
                          onClick={() => handleToggleTaskCompletion(selectedEvent, !selectedEvent.is_completed)}
                        >
                          {selectedEvent.is_completed ? "Mark Task Incomplete" : "✓ Mark Task Complete"}
                        </Button>
                      )}

                      {!selectedEvent.is_system && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            className="rounded-full text-xs font-semibold"
                            onClick={() => {
                              const ev = selectedEvent;
                              setSelectedEvent(null);
                              openEditModal(ev);
                            }}
                          >
                            <Edit2 className="mr-1.5 h-3.5 w-3.5" /> Edit Event
                          </Button>
                          <Button
                            variant="destructive"
                            className="rounded-full text-xs font-semibold"
                            onClick={() => handleDeleteEvent(selectedEvent)}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                          </Button>
                        </div>
                      )}

                      {selectedEvent.is_system && (
                        <p className="text-[11px] text-muted-foreground text-center italic pt-1">
                          System event automatically generated from {selectedEvent.source}.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ------------------------------------------------------------------- */}
      {/* ADD / EDIT EVENT MODAL */}
      {/* ------------------------------------------------------------------- */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              {editingEvent ? "Edit Calendar Event" : "Add New Event"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingEvent ? "Update event details and timing." : "Create a new note, task, reminder, or appointment."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEvent} className="space-y-3 py-2">
            {/* EVENT TYPE SELECTOR */}
            <div className="space-y-1">
              <Label className="text-xs">Event Type *</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOTE">📝 Note</SelectItem>
                  <SelectItem value="REMINDER">🔔 Reminder</SelectItem>
                  <SelectItem value="TASK">✓ Task</SelectItem>
                  <SelectItem value="APPOINTMENT">🗓 Appointment</SelectItem>
                  <SelectItem value="EVENT">✨ Event</SelectItem>
                  <SelectItem value="STAFF">👤 Staff Leave / Schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* TITLE */}
            <div className="space-y-1">
              <Label className="text-xs">Title *</Label>
              <Input
                type="text"
                placeholder="e.g. Bridal Trial Preparation, Call VIP Customer, Check Inventory"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                className="h-9 text-xs rounded-xl"
              />
            </div>

            {/* DATE & TIME */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date *</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Time (Optional)</Label>
                <Input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="h-9 text-xs rounded-xl font-mono"
                />
              </div>
            </div>

            {/* CUSTOMER & STAFF SELECTION */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Link Customer (Optional)</Label>
                <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue placeholder="Select customer..." /></SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="none">-- None --</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{isSalon ? "Assigned Stylist / Staff" : "Assigned Staff"}</Label>
                <Select value={formStaffId} onValueChange={setFormStaffId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue placeholder="Select staff..." /></SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="none">-- None --</SelectItem>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* REPEAT & REMINDER */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Repeat</Label>
                <Select value={formRepeat} onValueChange={setFormRepeat}>
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Does not repeat</SelectItem>
                    <SelectItem value="DAILY">Every day</SelectItem>
                    <SelectItem value="WEEKLY">Every week</SelectItem>
                    <SelectItem value="MONTHLY">Every month</SelectItem>
                    <SelectItem value="YEARLY">Every year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Reminder</Label>
                <Select value={formReminder} onValueChange={setFormReminder}>
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="15">15 minutes before</SelectItem>
                    <SelectItem value="30">30 minutes before</SelectItem>
                    <SelectItem value="60">1 hour before</SelectItem>
                    <SelectItem value="1440">1 day before</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* DESCRIPTION */}
            <div className="space-y-1">
              <Label className="text-xs">Description (Optional)</Label>
              <Textarea
                rows={3}
                placeholder="Add notes, instructions, or specific details for this event..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" className="rounded-full text-xs" onClick={() => setAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="rounded-full text-xs gradient-brand text-primary-foreground font-semibold">
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  editingEvent ? "Save Changes" : "Save Event"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}