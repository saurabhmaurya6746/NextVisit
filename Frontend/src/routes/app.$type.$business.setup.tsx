import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SkeletonRows } from "@/components/skeletons";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Store,
  CheckCircle2,
  Lock,
  Layers,
  Utensils,
  BookOpen,
  QrCode,
  Save,
  Loader2,
  Plus,
  Trash2,
  Upload,
  AlertCircle,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Pencil,
  Palette,
  Search,
  MoveRight,
  Users,
  Leaf,
  RefreshCw,
} from "lucide-react";
import {
  getRestaurantSetupSettingsApi,
  saveRestaurantSetupSettingsApi,
  uploadPaymentQRApi,
  deletePaymentQRApi,
  getBusinessSettingsApi,
  updateBusinessSettingsApi,
  type RestaurantSetupSettings,
} from "@/lib/business-settings-api";
import {
  listDiningAreasApi,
  createDiningAreaApi,
  updateDiningAreaApi,
  deleteDiningAreaApi,
  reorderDiningAreasApi,
  type DiningArea,
} from "@/lib/dining-area-api";
import {
  listRestaurantTablesApi,
  createRestaurantTableApi,
  updateRestaurantTableApi,
  deleteRestaurantTableApi,
  type RestaurantTable,
} from "@/lib/tables-api";
import {
  listMenuCategoriesApi,
  createMenuCategoryApi,
  updateMenuCategoryApi,
  deleteMenuCategoryApi,
  listMenuItemsApi,
  createMenuItemApi,
  updateMenuItemApi,
  deleteMenuItemApi,
  type BackendMenuCategory,
  type BackendMenuItem,
} from "@/lib/menu-api";
import { fmt } from "@/lib/currency";
import { API_BASE_URL } from "@/lib/auth";

export const Route = createFileRoute("/app/$type/$business/setup")({
  component: RestaurantSetupPage,
});

function RestaurantSetupPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("settings");

  // ---------------------------------------------------------------------------
  // Step 1: Business Settings Query
  // ---------------------------------------------------------------------------
  const {
    data: setupSettings,
    isLoading: loadingSettings,
    isError: settingsError,
  } = useQuery({
    queryKey: ["setup", "business-settings"],
    queryFn: getRestaurantSetupSettingsApi,
  });

  const isSettingsSaved = !!setupSettings?.is_saved;

  return (
    <PageTransition>
      <PageHeader
        title="Restaurant Setup"
        description="Configure your business profile, dining areas, tables, menu, and payment QR."
        actions={
          <Badge variant="outline" className="rounded-full flex items-center gap-1.5 px-3 py-1">
            {isSettingsSaved ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Setup Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <AlertCircle className="h-3.5 w-3.5" /> Step 1 Pending
              </span>
            )}
          </Badge>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 rounded-full p-1 bg-muted/60">
          <TabsTrigger value="settings" className="rounded-full text-xs flex items-center gap-1.5">
            <Store className="h-3.5 w-3.5" /> 1. Business Settings
          </TabsTrigger>
          <TabsTrigger
            value="areas"
            disabled={!isSettingsSaved}
            className="rounded-full text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {!isSettingsSaved ? <Lock className="h-3 w-3" /> : <Layers className="h-3.5 w-3.5" />} 2. Dining Areas
          </TabsTrigger>
          <TabsTrigger
            value="tables"
            disabled={!isSettingsSaved}
            className="rounded-full text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {!isSettingsSaved ? <Lock className="h-3 w-3" /> : <Utensils className="h-3.5 w-3.5" />} 3. Tables
          </TabsTrigger>
          <TabsTrigger
            value="menu"
            disabled={!isSettingsSaved}
            className="rounded-full text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {!isSettingsSaved ? <Lock className="h-3 w-3" /> : <BookOpen className="h-3.5 w-3.5" />} 4. Menu
          </TabsTrigger>
          <TabsTrigger
            value="payment"
            disabled={!isSettingsSaved}
            className="rounded-full text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {!isSettingsSaved ? <Lock className="h-3 w-3" /> : <QrCode className="h-3.5 w-3.5" />} 5. Payment QR
          </TabsTrigger>
        </TabsList>

        {/* STEP 1: BUSINESS SETTINGS */}
        <TabsContent value="settings">
          {loadingSettings ? (
            <Card className="rounded-2xl p-6">
              <SkeletonRows rows={8} cols={2} />
            </Card>
          ) : settingsError ? (
            <Card className="rounded-2xl p-6 text-center text-destructive">
              Failed to load business settings. Please try refreshing.
            </Card>
          ) : (
            <BusinessSettingsStep
              initialData={setupSettings!}
              onSuccess={() => {
                qc.invalidateQueries({ queryKey: ["setup", "business-settings"] });
                qc.invalidateQueries({ queryKey: ["business", "profile"] });
              }}
            />
          )}
        </TabsContent>

        {/* STEP 2: DINING AREAS */}
        <TabsContent value="areas">
          <DiningAreasStep />
        </TabsContent>

        {/* STEP 3: TABLES */}
        <TabsContent value="tables">
          <TablesStep />
        </TabsContent>

        {/* STEP 4: MENU */}
        <TabsContent value="menu">
          <MenuStep />
        </TabsContent>

        {/* STEP 5: PAYMENT QR */}
        <TabsContent value="payment">
          <PaymentQrStep />
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}

// =============================================================================
// STEP 1: BUSINESS SETTINGS COMPONENT
// =============================================================================
function BusinessSettingsStep({
  initialData,
  onSuccess,
}: {
  initialData: RestaurantSetupSettings;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<RestaurantSetupSettings>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const saveMutation = useMutation({
    mutationFn: saveRestaurantSetupSettingsApi,
    onSuccess: () => {
      toast.success("Business Settings saved successfully!");
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save business settings.");
    },
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = "Restaurant Name is required.";
    if (!formData.phone.trim()) errs.phone = "Phone Number is required.";
    if (!formData.email.trim()) errs.email = "Email Address is required.";
    if (!formData.address.trim()) errs.address = "Address is required.";
    if (!formData.country.trim()) errs.country = "Country is required.";
    if (!formData.currency.trim()) errs.currency = "Currency is required.";
    if (!formData.timezone.trim()) errs.timezone = "Timezone is required.";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="border-b pb-4">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" /> Step 1: Business Settings
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Configure your core restaurant details, features, tax settings, and operating hours.
          </p>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Section 1: Core Details */}
          <div>
            <h4 className="font-display text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground">
              Restaurant Details
            </h4>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div>
                <Label className="text-xs">Restaurant Name *</Label>
                <Input
                  className="mt-1"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Royal Spice Bistro"
                />
                {errors.name && <span className="text-[11px] text-destructive">{errors.name}</span>}
              </div>

              <div>
                <Label className="text-xs">Phone Number *</Label>
                <Input
                  className="mt-1"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 9876543210"
                />
                {errors.phone && <span className="text-[11px] text-destructive">{errors.phone}</span>}
              </div>

              <div>
                <Label className="text-xs">Email Address *</Label>
                <Input
                  className="mt-1"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@restaurant.com"
                />
                {errors.email && <span className="text-[11px] text-destructive">{errors.email}</span>}
              </div>

              <div className="sm:col-span-2 md:col-span-3">
                <Label className="text-xs">Address *</Label>
                <Input
                  className="mt-1"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street name, landmark, building number"
                />
                {errors.address && <span className="text-[11px] text-destructive">{errors.address}</span>}
              </div>

              <div>
                <Label className="text-xs">City</Label>
                <Input
                  className="mt-1"
                  value={formData.city || ""}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g. Mumbai"
                />
              </div>

              <div>
                <Label className="text-xs">State</Label>
                <Input
                  className="mt-1"
                  value={formData.state || ""}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="e.g. Maharashtra"
                />
              </div>

              <div>
                <Label className="text-xs">Country *</Label>
                <Input
                  className="mt-1"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="e.g. India"
                />
                {errors.country && <span className="text-[11px] text-destructive">{errors.country}</span>}
              </div>

              <div>
                <Label className="text-xs">GST Number (Optional)</Label>
                <Input
                  className="mt-1"
                  value={formData.gst_number || ""}
                  onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                  placeholder="27AAAAA0000A1Z5"
                />
              </div>

              <div>
                <Label className="text-xs">Currency *</Label>
                <Input
                  className="mt-1"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  placeholder="INR"
                />
                {errors.currency && <span className="text-[11px] text-destructive">{errors.currency}</span>}
              </div>

              <div>
                <Label className="text-xs">Timezone *</Label>
                <Input
                  className="mt-1"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  placeholder="Asia/Kolkata"
                />
                {errors.timezone && <span className="text-[11px] text-destructive">{errors.timezone}</span>}
              </div>

              <div>
                <Label className="text-xs">Opening Time</Label>
                <Input
                  className="mt-1"
                  value={formData.opening_time || ""}
                  onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
                  placeholder="09:00 AM"
                />
              </div>

              <div>
                <Label className="text-xs">Closing Time</Label>
                <Input
                  className="mt-1"
                  value={formData.closing_time || ""}
                  onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
                  placeholder="11:00 PM"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Restaurant Features */}
          <div className="border-t pt-4">
            <h4 className="font-display text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground">
              Restaurant Features
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">QR Self Ordering</p>
                  <p className="text-xs text-muted-foreground">Allow customers to scan QR and order directly.</p>
                </div>
                <Switch
                  checked={formData.enable_qr_ordering}
                  onCheckedChange={(val) => setFormData({ ...formData, enable_qr_ordering: val })}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">Staff POS Ordering</p>
                  <p className="text-xs text-muted-foreground">Allow staff to take orders at tables.</p>
                </div>
                <Switch
                  checked={formData.enable_staff_ordering}
                  onCheckedChange={(val) => setFormData({ ...formData, enable_staff_ordering: val })}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">Parcel Service</p>
                  <p className="text-xs text-muted-foreground">Enable parcel packing and orders.</p>
                </div>
                <Switch
                  checked={formData.enable_parcel}
                  onCheckedChange={(val) => setFormData({ ...formData, enable_parcel: val })}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">Take Away Service</p>
                  <p className="text-xs text-muted-foreground">Enable takeaway counter orders.</p>
                </div>
                <Switch
                  checked={formData.enable_takeaway}
                  onCheckedChange={(val) => setFormData({ ...formData, enable_takeaway: val })}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Tax & Invoicing */}
          <div className="border-t pt-4">
            <h4 className="font-display text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground">
              Tax & Invoicing
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs">GST Percentage (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  className="mt-1"
                  value={formData.tax_percentage}
                  onChange={(e) => setFormData({ ...formData, tax_percentage: Number(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label className="text-xs">Invoice Prefix</Label>
                <Input
                  className="mt-1"
                  value={formData.invoice_prefix}
                  onChange={(e) => setFormData({ ...formData, invoice_prefix: e.target.value })}
                  placeholder="e.g. INV-"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              className="rounded-full gradient-brand text-primary-foreground px-6"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Save Business Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

// =============================================================================
// STEP 2: DINING AREAS COMPONENT
// =============================================================================
const COLOR_PRESETS = [
  "#8B5CF6", // Purple
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#F43F5E", // Rose
  "#6366F1", // Indigo
  "#0EA5E9", // Sky
  "#64748B", // Slate
];

function DiningAreasStep() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<DiningArea | null>(null);

  // Form State
  const [areaName, setAreaName] = useState("");
  const [areaColor, setAreaColor] = useState("#8B5CF6");
  const [areaIsActive, setAreaIsActive] = useState(true);

  // Drag & drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const { data: areas = [], isLoading } = useQuery<DiningArea[]>({
    queryKey: ["dining-areas"],
    queryFn: listDiningAreasApi,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["dining-areas"] });
    qc.invalidateQueries({ queryKey: ["tables", "map"] });
  };

  const createMut = useMutation({
    mutationFn: createDiningAreaApi,
    onSuccess: () => {
      invalidate();
      toast.success("Dining area created!");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create dining area."),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateDiningAreaApi(id, payload),
    onSuccess: () => {
      invalidate();
      toast.success("Dining area updated!");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update dining area."),
  });

  const deleteMut = useMutation({
    mutationFn: deleteDiningAreaApi,
    onSuccess: () => {
      invalidate();
      toast.success("Dining area deleted.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete area."),
  });

  const reorderMut = useMutation({
    mutationFn: reorderDiningAreasApi,
    onSuccess: (updated) => {
      qc.setQueryData(["dining-areas"], updated);
      qc.invalidateQueries({ queryKey: ["tables", "map"] });
      toast.success("Area ordering updated!");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to reorder areas."),
  });

  const openAddDialog = () => {
    setEditingArea(null);
    setAreaName("");
    setAreaColor("#8B5CF6");
    setAreaIsActive(true);
    setDialogOpen(true);
  };

  const openEditDialog = (area: DiningArea) => {
    setEditingArea(area);
    setAreaName(area.name);
    setAreaColor(area.color || "#8B5CF6");
    setAreaIsActive(area.is_active);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingArea(null);
    setAreaName("");
  };

  // Duplicate Check Validation
  const isDuplicateName = () => {
    const trimmed = areaName.trim().toLowerCase();
    if (!trimmed) return false;
    return areas.some(
      (a) => a.name.toLowerCase() === trimmed && (!editingArea || a.id !== editingArea.id)
    );
  };

  const handleSave = () => {
    const trimmed = areaName.trim();
    if (!trimmed) {
      toast.error("Please enter a valid area name.");
      return;
    }
    if (isDuplicateName()) {
      toast.error(`A dining area named "${trimmed}" already exists.`);
      return;
    }

    if (editingArea) {
      updateMut.mutate({
        id: editingArea.id,
        payload: {
          name: trimmed,
          color: areaColor,
          is_active: areaIsActive,
        },
      });
    } else {
      createMut.mutate({
        name: trimmed,
        display_order: areas.length + 1,
        color: areaColor,
        is_active: areaIsActive,
      });
    }
  };

  // Toggle active status directly
  const handleToggleActive = (area: DiningArea) => {
    updateMut.mutate({
      id: area.id,
      payload: { is_active: !area.is_active },
    });
  };

  // Move up/down order controls
  const handleMove = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= areas.length) return;

    const list = [...areas];
    const [moved] = list.splice(index, 1);
    list.splice(newIndex, 0, moved);

    const reorderedPayload = list.map((item, i) => ({
      id: item.id,
      display_order: i + 1,
    }));

    reorderMut.mutate(reorderedPayload);
  };

  // Drag & Drop reordering
  const handleDrop = (dropIndex: number) => {
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const list = [...areas];
    const [draggedItem] = list.splice(draggedIndex, 1);
    list.splice(dropIndex, 0, draggedItem);

    setDraggedIndex(null);

    const reorderedPayload = list.map((item, i) => ({
      id: item.id,
      display_order: i + 1,
    }));

    reorderMut.mutate(reorderedPayload);
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
        <div>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Step 2: Dining Areas
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your restaurant sections (Main Hall, Cabin, Outdoor, VIP, etc.). Drag or use arrows to reorder.
          </p>
        </div>
        <Button
          onClick={openAddDialog}
          className="rounded-full gradient-brand text-primary-foreground shrink-0 shadow-sm"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add Area
        </Button>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        {isLoading ? (
          <SkeletonRows rows={4} cols={2} />
        ) : areas.length === 0 ? (
          <div className="text-center py-10 rounded-xl border border-dashed p-6">
            <Layers className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">No Dining Areas Yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create your first dining area (e.g. Main Hall, Family Section, VIP, Outdoor) to group your tables.
            </p>
            <Button
              onClick={openAddDialog}
              className="mt-4 rounded-full gradient-brand text-primary-foreground size-sm px-5"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Create First Area
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {areas.map((area, index) => (
              <div
                key={area.id}
                draggable
                onDragStart={() => setDraggedIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                className={`flex items-center justify-between rounded-xl border p-3.5 bg-card hover:border-primary/40 transition-all ${
                  !area.is_active ? "opacity-60 bg-muted/30" : ""
                } ${draggedIndex === index ? "border-primary border-dashed shadow-md" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Color Badge */}
                  <div
                    className="h-4 w-4 rounded-full border shadow-sm shrink-0"
                    style={{ backgroundColor: area.color || "#8B5CF6" }}
                  />

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{area.name}</span>
                      {!area.is_active && (
                        <Badge variant="outline" className="text-[10px] rounded-full text-muted-foreground">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Display Order: #{area.display_order}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Reorder Buttons */}
                  <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-md"
                      disabled={index === 0 || reorderMut.isPending}
                      onClick={() => handleMove(index, "up")}
                      title="Move Up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-md"
                      disabled={index === areas.length - 1 || reorderMut.isPending}
                      onClick={() => handleMove(index, "down")}
                      title="Move Down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center gap-1.5 px-2 border-l border-r">
                    <span className="text-xs text-muted-foreground hidden sm:inline">Active</span>
                    <Switch
                      checked={area.is_active}
                      onCheckedChange={() => handleToggleActive(area)}
                      disabled={updateMut.isPending}
                    />
                  </div>

                  {/* Actions */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => openEditDialog(area)}
                    title="Edit Area"
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => deleteMut.mutate(area.id)}
                    disabled={deleteMut.isPending}
                    title="Delete Area"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* CREATE / EDIT DINING AREA DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              {editingArea ? "Edit Dining Area" : "Add Dining Area"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Area Name *</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Main Hall, VIP Lounge, Rooftop"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
              />
              {isDuplicateName() && (
                <span className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> Duplicate name not allowed. A dining area with this name already exists.
                </span>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>Color Theme</span>
                <span className="text-[11px] text-muted-foreground font-mono">{areaColor}</span>
              </Label>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAreaColor(color)}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${
                      areaColor === color ? "scale-110 border-primary ring-2 ring-primary/30" : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <div className="relative flex items-center gap-1 pl-2 border-l">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="color"
                    value={areaColor}
                    onChange={(e) => setAreaColor(e.target.value)}
                    className="h-7 w-7 cursor-pointer rounded-md border border-input bg-transparent p-0"
                    title="Custom Color"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Activation Status</p>
                <p className="text-xs text-muted-foreground">Enable this area for table assignments & ordering.</p>
              </div>
              <Switch checked={areaIsActive} onCheckedChange={setAreaIsActive} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-full" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending || !areaName.trim() || isDuplicateName()}
              className="rounded-full gradient-brand text-primary-foreground px-5"
            >
              {createMut.isPending || updateMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> {editingArea ? "Update Area" : "Save Area"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// =============================================================================
// STEP 3: TABLES COMPONENT
// =============================================================================
function TablesStep() {
  const qc = useQueryClient();

  const [selectedAreaId, setSelectedAreaId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog States
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);

  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingTable, setMovingTable] = useState<RestaurantTable | null>(null);
  const [targetAreaId, setTargetAreaId] = useState<string>("");

  // Form State for Add / Edit
  const [formAreaId, setFormAreaId] = useState<string>("");
  const [tableName, setTableName] = useState("");
  const [tableCapacity, setTableCapacity] = useState<number>(4);
  const [tableIsActive, setTableIsActive] = useState(true);

  // Queries
  const { data: areas = [] } = useQuery<DiningArea[]>({
    queryKey: ["dining-areas"],
    queryFn: listDiningAreasApi,
  });

  const { data: tables = [], isLoading: loadingTables } = useQuery<RestaurantTable[]>({
    queryKey: ["tables", "list"],
    queryFn: () => listRestaurantTablesApi(),
  });

  const invalidateTables = () => {
    qc.invalidateQueries({ queryKey: ["tables", "list"] });
    qc.invalidateQueries({ queryKey: ["tables", "map"] });
  };

  const createTableMut = useMutation({
    mutationFn: createRestaurantTableApi,
    onSuccess: () => {
      invalidateTables();
      toast.success("Table created successfully!");
      closeTableDialog();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create table."),
  });

  const updateTableMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateRestaurantTableApi(id, payload),
    onSuccess: () => {
      invalidateTables();
      toast.success("Table updated!");
      closeTableDialog();
      closeMoveDialog();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update table."),
  });

  const deleteTableMut = useMutation({
    mutationFn: deleteRestaurantTableApi,
    onSuccess: () => {
      invalidateTables();
      toast.success("Table deleted.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete table."),
  });

  const openAddTable = () => {
    setEditingTable(null);
    setFormAreaId(selectedAreaId !== "all" ? selectedAreaId : areas[0]?.id || "");
    setTableName("");
    setTableCapacity(4);
    setTableIsActive(true);
    setTableDialogOpen(true);
  };

  const openEditTable = (tbl: RestaurantTable) => {
    setEditingTable(tbl);
    setFormAreaId(tbl.dining_area_id);
    setTableName(tbl.table_name);
    setTableCapacity(tbl.capacity);
    setTableIsActive(tbl.is_active);
    setTableDialogOpen(true);
  };

  const closeTableDialog = () => {
    setTableDialogOpen(false);
    setEditingTable(null);
    setTableName("");
  };

  const openMoveDialog = (tbl: RestaurantTable) => {
    setMovingTable(tbl);
    const otherArea = areas.find((a) => a.id !== tbl.dining_area_id);
    setTargetAreaId(otherArea?.id || "");
    setMoveDialogOpen(true);
  };

  const closeMoveDialog = () => {
    setMoveDialogOpen(false);
    setMovingTable(null);
    setTargetAreaId("");
  };

  // Duplicate Check Validation within Target Area
  const isDuplicateTableName = () => {
    const trimmed = tableName.trim().toLowerCase();
    if (!trimmed || !formAreaId) return false;
    return tables.some(
      (t) =>
        t.dining_area_id === formAreaId &&
        t.table_name.toLowerCase() === trimmed &&
        (!editingTable || t.id !== editingTable.id)
    );
  };

  const handleSaveTable = () => {
    const trimmed = tableName.trim();
    if (!formAreaId) {
      toast.error("Please select a dining area.");
      return;
    }
    if (!trimmed) {
      toast.error("Please enter a valid table name.");
      return;
    }
    if (isDuplicateTableName()) {
      const areaObj = areas.find((a) => a.id === formAreaId);
      toast.error(`Table "${trimmed}" already exists in ${areaObj?.name || "this dining area"}.`);
      return;
    }

    if (editingTable) {
      updateTableMut.mutate({
        id: editingTable.id,
        payload: {
          dining_area_id: formAreaId,
          table_name: trimmed,
          capacity: tableCapacity,
          is_active: tableIsActive,
        },
      });
    } else {
      createTableMut.mutate({
        dining_area_id: formAreaId,
        table_name: trimmed,
        capacity: tableCapacity,
        display_order: tables.filter((t) => t.dining_area_id === formAreaId).length + 1,
        is_active: tableIsActive,
      });
    }
  };

  const handleMoveSubmit = () => {
    if (!movingTable || !targetAreaId) return;
    updateTableMut.mutate({
      id: movingTable.id,
      payload: { dining_area_id: targetAreaId },
    });
  };

  const handleToggleActive = (tbl: RestaurantTable) => {
    updateTableMut.mutate({
      id: tbl.id,
      payload: { is_active: !tbl.is_active },
    });
  };

  // Filtering
  const filteredTables = tables.filter((t) => {
    const matchesArea = selectedAreaId === "all" || t.dining_area_id === selectedAreaId;
    const matchesSearch =
      !searchQuery.trim() ||
      t.table_name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      String(t.capacity).includes(searchQuery.trim());
    return matchesArea && matchesSearch;
  });

  const getAreaObj = (areaId: string) => areas.find((a) => a.id === areaId);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Utensils className="h-5 w-5 text-primary" /> Step 3: Table Management
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure tables assigned to dining areas. Add, edit, move, or toggle table availability.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search table or capacity…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 rounded-full"
            />
          </div>

          <Button
            onClick={openAddTable}
            disabled={areas.length === 0}
            className="rounded-full gradient-brand text-primary-foreground shrink-0 shadow-sm h-9 px-4 text-xs"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Table
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {areas.length === 0 ? (
          <div className="text-center py-10 rounded-xl border border-dashed p-6">
            <Layers className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">No Dining Areas Found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Please create at least one Dining Area in Step 2 before adding tables.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-4">
            {/* LEFT PANEL: DINING AREAS SELECTOR */}
            <div className="md:col-span-1 space-y-1.5 border-r pr-0 md:pr-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-2">
                Dining Areas
              </h4>

              <button
                type="button"
                onClick={() => setSelectedAreaId("all")}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                  selectedAreaId === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>All Areas</span>
                <Badge
                  variant="outline"
                  className={`rounded-full text-[10px] ${
                    selectedAreaId === "all" ? "border-primary-foreground/30 text-primary-foreground" : ""
                  }`}
                >
                  {tables.length}
                </Badge>
              </button>

              {areas.map((area) => {
                const count = tables.filter((t) => t.dining_area_id === area.id).length;
                const isSelected = selectedAreaId === area.id;

                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => setSelectedAreaId(area.id)}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0 border"
                        style={{ backgroundColor: area.color || "#8B5CF6" }}
                      />
                      <span className="truncate">{area.name}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`rounded-full text-[10px] ${
                        isSelected ? "border-primary-foreground/30 text-primary-foreground" : ""
                      }`}
                    >
                      {count}
                    </Badge>
                  </button>
                );
              })}
            </div>

            {/* RIGHT PANEL: TABLES LIST */}
            <div className="md:col-span-3">
              {loadingTables ? (
                <SkeletonRows rows={4} cols={3} />
              ) : filteredTables.length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-dashed p-6">
                  <Utensils className="mx-auto h-9 w-9 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium">No Tables Found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {searchQuery
                      ? "No tables match your search query."
                      : "No tables created in this area yet."}
                  </p>
                  <Button
                    onClick={openAddTable}
                    className="mt-4 rounded-full gradient-brand text-primary-foreground size-sm px-4 text-xs"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add New Table
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredTables.map((table) => {
                    const areaObj = getAreaObj(table.dining_area_id);

                    return (
                      <div
                        key={table.id}
                        className={`rounded-xl border p-3.5 bg-card hover:border-primary/40 transition-all flex flex-col justify-between space-y-3 ${
                          !table.is_active ? "opacity-60 bg-muted/30" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-semibold text-sm">{table.table_name}</h4>
                            <div className="flex items-center gap-1.5 mt-1">
                              <div
                                className="h-2.5 w-2.5 rounded-full border shrink-0"
                                style={{ backgroundColor: areaObj?.color || "#8B5CF6" }}
                              />
                              <span className="text-[11px] text-muted-foreground truncate">
                                {areaObj?.name || "Unassigned"}
                              </span>
                            </div>
                          </div>

                          <Badge variant="secondary" className="rounded-full text-[10px] flex items-center gap-1 shrink-0">
                            <Users className="h-3 w-3" /> {table.capacity} seats
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between border-t pt-2.5 text-xs">
                          {/* Active Switch */}
                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={table.is_active}
                              onCheckedChange={() => handleToggleActive(table)}
                              disabled={updateTableMut.isPending}
                            />
                            <span className="text-[11px] text-muted-foreground">
                              {table.is_active ? "Active" : "Disabled"}
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => openMoveDialog(table)}
                              title="Move Area"
                            >
                              <MoveRight className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => openEditTable(table)}
                              title="Edit Table"
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => deleteTableMut.mutate(table.id)}
                              disabled={deleteTableMut.isPending}
                              title="Delete Table"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* ADD / EDIT TABLE DIALOG */}
      <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <Utensils className="h-5 w-5 text-primary" />
              {editingTable ? "Edit Restaurant Table" : "Add Restaurant Table"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Dining Area *</Label>
              <Select value={formAreaId} onValueChange={setFormAreaId}>
                <SelectTrigger className="mt-1.5 rounded-xl">
                  <SelectValue placeholder="Select Dining Area" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full border" style={{ backgroundColor: a.color || "#8B5CF6" }} />
                        <span>{a.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Table Name *</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Table 1, T2, Cabin 1, Parcel"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
              />
              {isDuplicateTableName() && (
                <span className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> Duplicate table name in this dining area is not allowed.
                </span>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">Seating Capacity</Label>
              <Input
                type="number"
                min="1"
                max="100"
                className="mt-1.5"
                value={tableCapacity}
                onChange={(e) => setTableCapacity(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Active Status</p>
                <p className="text-xs text-muted-foreground">Make table available for POS & QR ordering.</p>
              </div>
              <Switch checked={tableIsActive} onCheckedChange={setTableIsActive} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-full" onClick={closeTableDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTable}
              disabled={createTableMut.isPending || updateTableMut.isPending || !tableName.trim() || !formAreaId || isDuplicateTableName()}
              className="rounded-full gradient-brand text-primary-foreground px-5"
            >
              {createTableMut.isPending || updateTableMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> {editingTable ? "Update Table" : "Save Table"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MOVE TABLE DIALOG */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <MoveRight className="h-5 w-5 text-primary" /> Move Table Area
            </DialogTitle>
          </DialogHeader>

          {movingTable && (
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                Move <strong className="text-foreground">{movingTable.table_name}</strong> to a different dining area.
              </p>

              <div>
                <Label className="text-xs font-semibold">Target Dining Area</Label>
                <Select value={targetAreaId} onValueChange={setTargetAreaId}>
                  <SelectTrigger className="mt-1.5 rounded-xl">
                    <SelectValue placeholder="Select target dining area" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={a.id} disabled={a.id === movingTable.dining_area_id}>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full border" style={{ backgroundColor: a.color || "#8B5CF6" }} />
                          <span>{a.name} {a.id === movingTable.dining_area_id ? "(Current)" : ""}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-full" onClick={closeMoveDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleMoveSubmit}
              disabled={updateTableMut.isPending || !targetAreaId || targetAreaId === movingTable?.dining_area_id}
              className="rounded-full gradient-brand text-primary-foreground px-5"
            >
              {updateTableMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Moving…
                </>
              ) : (
                "Move Table"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// =============================================================================
// STEP 4: MENU COMPONENT
// =============================================================================
function MenuStep() {
  const qc = useQueryClient();

  const [selectedCatId, setSelectedCatId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dietFilter, setDietFilter] = useState<string>("all"); // "all" | "veg" | "non-veg"
  const [availFilter, setAvailFilter] = useState<string>("all"); // "all" | "available" | "disabled"

  // Category Dialog State
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<BackendMenuCategory | null>(null);
  const [catNameInput, setCatNameInput] = useState("");

  // Item Dialog State
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BackendMenuItem | null>(null);

  // Item Form State
  const [itemCatId, setItemCatId] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState<number>(100);
  const [itemGst, setItemGst] = useState<number>(5.0);
  const [itemDescription, setItemDescription] = useState("");
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [itemIsAvailable, setItemIsAvailable] = useState(true);

  // Queries
  const { data: menuCategories = [], isLoading: loadingCategories } = useQuery<BackendMenuCategory[]>({
    queryKey: ["menu", "categories"],
    queryFn: listMenuCategoriesApi,
  });

  const { data: menuItems = [], isLoading: loadingItems } = useQuery<BackendMenuItem[]>({
    queryKey: ["menu", "items"],
    queryFn: () => listMenuItemsApi(),
  });

  const invalidateMenu = () => {
    qc.invalidateQueries({ queryKey: ["menu", "categories"] });
    qc.invalidateQueries({ queryKey: ["menu", "items"] });
  };

  // Category Mutations
  const createCatMut = useMutation({
    mutationFn: createMenuCategoryApi,
    onSuccess: () => {
      invalidateMenu();
      toast.success("Category created!");
      closeCatDialog();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create category."),
  });

  const updateCatMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateMenuCategoryApi(id, payload),
    onSuccess: () => {
      invalidateMenu();
      toast.success("Category updated!");
      closeCatDialog();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update category."),
  });

  const deleteCatMut = useMutation({
    mutationFn: deleteMenuCategoryApi,
    onSuccess: () => {
      invalidateMenu();
      toast.success("Category deleted.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete category."),
  });

  // Item Mutations
  const createItemMut = useMutation({
    mutationFn: createMenuItemApi,
    onSuccess: () => {
      invalidateMenu();
      toast.success("Menu item created!");
      closeItemDialog();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create menu item."),
  });

  const updateItemMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateMenuItemApi(id, payload),
    onSuccess: () => {
      invalidateMenu();
      toast.success("Menu item updated!");
      closeItemDialog();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update menu item."),
  });

  const deleteItemMut = useMutation({
    mutationFn: deleteMenuItemApi,
    onSuccess: () => {
      invalidateMenu();
      toast.success("Menu item deleted.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete menu item."),
  });

  // Handlers for Category
  const openAddCat = () => {
    setEditingCat(null);
    setCatNameInput("");
    setCatDialogOpen(true);
  };

  const openEditCat = (cat: BackendMenuCategory) => {
    setEditingCat(cat);
    setCatNameInput(cat.name);
    setCatDialogOpen(true);
  };

  const closeCatDialog = () => {
    setCatDialogOpen(false);
    setEditingCat(null);
    setCatNameInput("");
  };

  const isDuplicateCategoryName = () => {
    const trimmed = catNameInput.trim().toLowerCase();
    if (!trimmed) return false;
    return menuCategories.some(
      (c) => c.name.toLowerCase() === trimmed && (!editingCat || c.id !== editingCat.id)
    );
  };

  const handleSaveCategory = () => {
    const trimmed = catNameInput.trim();
    if (!trimmed) {
      toast.error("Please enter a category name.");
      return;
    }
    if (isDuplicateCategoryName()) {
      toast.error(`Category "${trimmed}" already exists.`);
      return;
    }

    if (editingCat) {
      updateCatMut.mutate({ id: editingCat.id, payload: { name: trimmed } });
    } else {
      createCatMut.mutate({ name: trimmed, display_order: menuCategories.length + 1 });
    }
  };

  // Handlers for Item
  const openAddItem = () => {
    setEditingItem(null);
    setItemCatId(selectedCatId !== "all" ? selectedCatId : menuCategories[0]?.id || "");
    setItemName("");
    setItemPrice(100);
    setItemGst(5.0);
    setItemDescription("");
    setItemIsVeg(true);
    setItemIsAvailable(true);
    setItemDialogOpen(true);
  };

  const openEditItem = (item: BackendMenuItem) => {
    setEditingItem(item);
    setItemCatId(item.category_id);
    setItemName(item.name);
    setItemPrice(item.price);
    setItemGst(item.gst_percentage);
    setItemDescription(item.description || "");
    setItemIsVeg(item.is_veg);
    setItemIsAvailable(item.is_available);
    setItemDialogOpen(true);
  };

  const closeItemDialog = () => {
    setItemDialogOpen(false);
    setEditingItem(null);
    setItemName("");
  };

  const isDuplicateItemName = () => {
    const trimmed = itemName.trim().toLowerCase();
    if (!trimmed || !itemCatId) return false;
    return menuItems.some(
      (it) =>
        it.category_id === itemCatId &&
        it.name.toLowerCase() === trimmed &&
        (!editingItem || it.id !== editingItem.id)
    );
  };

  const handleSaveItem = () => {
    const trimmed = itemName.trim();
    if (!itemCatId) {
      toast.error("Please select a category.");
      return;
    }
    if (!trimmed) {
      toast.error("Please enter a valid item name.");
      return;
    }
    if (isDuplicateItemName()) {
      const catObj = menuCategories.find((c) => c.id === itemCatId);
      toast.error(`Item "${trimmed}" already exists in ${catObj?.name || "this category"}.`);
      return;
    }

    if (editingItem) {
      updateItemMut.mutate({
        id: editingItem.id,
        payload: {
          category_id: itemCatId,
          name: trimmed,
          description: itemDescription.trim() || undefined,
          price: Number(itemPrice),
          gst_percentage: Number(itemGst),
          is_veg: itemIsVeg,
          is_available: itemIsAvailable,
        },
      });
    } else {
      createItemMut.mutate({
        category_id: itemCatId,
        name: trimmed,
        description: itemDescription.trim() || undefined,
        price: Number(itemPrice),
        gst_percentage: Number(itemGst),
        is_veg: itemIsVeg,
        is_available: itemIsAvailable,
        display_order: menuItems.filter((i) => i.category_id === itemCatId).length + 1,
      });
    }
  };

  const handleToggleItemAvailable = (item: BackendMenuItem) => {
    updateItemMut.mutate({
      id: item.id,
      payload: { is_available: !item.is_available },
    });
  };

  // Filtered Menu Items
  const filteredItems = menuItems.filter((item) => {
    const matchesCat = selectedCatId === "all" || item.category_id === selectedCatId;
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    const matchesDiet =
      dietFilter === "all" ||
      (dietFilter === "veg" && item.is_veg) ||
      (dietFilter === "non-veg" && !item.is_veg);
    const matchesAvail =
      availFilter === "all" ||
      (availFilter === "available" && item.is_available) ||
      (availFilter === "disabled" && !item.is_available);

    return matchesCat && matchesSearch && matchesDiet && matchesAvail;
  });

  const getCategoryObj = (catId: string) => menuCategories.find((c) => c.id === catId);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Step 4: Menu Setup
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure menu categories and items for staff POS and QR self-ordering.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="relative w-full sm:w-48">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search menu item…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 rounded-full"
            />
          </div>

          {/* Diet Filter */}
          <Select value={dietFilter} onValueChange={setDietFilter}>
            <SelectTrigger className="h-9 w-28 rounded-full text-xs">
              <SelectValue placeholder="Diet Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Diets</SelectItem>
              <SelectItem value="veg">🟢 Veg</SelectItem>
              <SelectItem value="non-veg">🔴 Non-Veg</SelectItem>
            </SelectContent>
          </Select>

          {/* Avail Filter */}
          <Select value={availFilter} onValueChange={setAvailFilter}>
            <SelectTrigger className="h-9 w-32 rounded-full text-xs">
              <SelectValue placeholder="Availability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={openAddItem}
            disabled={menuCategories.length === 0}
            className="rounded-full gradient-brand text-primary-foreground shrink-0 shadow-sm h-9 px-4 text-xs"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Item
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="grid gap-6 md:grid-cols-4">
          {/* LEFT PANEL: CATEGORIES SELECTOR */}
          <div className="md:col-span-1 space-y-2 border-r pr-0 md:pr-4">
            <div className="flex items-center justify-between px-2 mb-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Categories
              </h4>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] rounded-full px-2 text-primary font-medium"
                onClick={openAddCat}
              >
                <Plus className="mr-1 h-3 w-3" /> Add Category
              </Button>
            </div>

            <button
              type="button"
              onClick={() => setSelectedCatId("all")}
              className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                selectedCatId === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>All Categories</span>
              <Badge
                variant="outline"
                className={`rounded-full text-[10px] ${
                  selectedCatId === "all" ? "border-primary-foreground/30 text-primary-foreground" : ""
                }`}
              >
                {menuItems.length}
              </Badge>
            </button>

            {loadingCategories ? (
              <SkeletonRows rows={4} cols={1} />
            ) : menuCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No categories created yet.</p>
            ) : (
              menuCategories.map((cat) => {
                const count = menuItems.filter((i) => i.category_id === cat.id).length;
                const isSelected = selectedCatId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className={`flex items-center justify-between rounded-xl px-3 py-1.5 text-xs font-medium transition-all group ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCatId(cat.id)}
                      className="flex-1 text-left truncate py-1"
                    >
                      <span className="truncate">{cat.name}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`rounded-full text-[10px] ${
                          isSelected ? "border-primary-foreground/30 text-primary-foreground" : ""
                        }`}
                      >
                        {count}
                      </Badge>

                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 rounded-md"
                          onClick={() => openEditCat(cat)}
                          title="Edit Category"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 rounded-md text-destructive"
                          onClick={() => deleteCatMut.mutate(cat.id)}
                          disabled={deleteCatMut.isPending}
                          title="Delete Category"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* RIGHT PANEL: MENU ITEMS LIST */}
          <div className="md:col-span-3">
            {menuCategories.length === 0 ? (
              <div className="text-center py-10 rounded-xl border border-dashed p-6">
                <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium">No Menu Categories Found</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Create your first menu category (e.g. Starters, Main Course, Beverages, Desserts) to add menu items.
                </p>
                <Button
                  onClick={openAddCat}
                  className="mt-4 rounded-full gradient-brand text-primary-foreground size-sm px-5"
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Create Category
                </Button>
              </div>
            ) : loadingItems ? (
              <SkeletonRows rows={4} cols={3} />
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-10 rounded-xl border border-dashed p-6">
                <BookOpen className="mx-auto h-9 w-9 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium">No Menu Items Found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {searchQuery
                    ? "No items match your search & filter criteria."
                    : "No menu items in this category."}
                </p>
                <Button
                  onClick={openAddItem}
                  className="mt-4 rounded-full gradient-brand text-primary-foreground size-sm px-4 text-xs"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Menu Item
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((item) => {
                  const catObj = getCategoryObj(item.category_id);

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3.5 bg-card hover:border-primary/40 transition-all flex flex-col justify-between space-y-3 ${
                        !item.is_available ? "opacity-60 bg-muted/30" : ""
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {item.is_veg ? (
                              <span className="inline-flex items-center justify-center h-4 w-4 rounded-sm border border-emerald-600 bg-emerald-50 dark:bg-emerald-950 text-[10px] text-emerald-600 font-bold" title="Vegetarian">
                                🟢
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center h-4 w-4 rounded-sm border border-rose-600 bg-rose-50 dark:bg-rose-950 text-[10px] text-rose-600 font-bold" title="Non-Vegetarian">
                                🔴
                              </span>
                            )}
                            <h4 className="font-semibold text-sm leading-tight">{item.name}</h4>
                          </div>

                          <span className="font-display font-bold text-sm text-primary shrink-0">
                            {fmt(item.price)}
                          </span>
                        </div>

                        {item.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <Badge variant="secondary" className="rounded-full text-[10px] px-2">
                            {catObj?.name || "Unassigned"}
                          </Badge>
                          {item.gst_percentage > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              GST {item.gst_percentage}%
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t pt-2.5 text-xs">
                        {/* Available Toggle */}
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={item.is_available}
                            onCheckedChange={() => handleToggleItemAvailable(item)}
                            disabled={updateItemMut.isPending}
                          />
                          <span className="text-[11px] text-muted-foreground">
                            {item.is_available ? "Available" : "Disabled"}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openEditItem(item)}
                            title="Edit Item"
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => deleteItemMut.mutate(item.id)}
                            disabled={deleteItemMut.isPending}
                            title="Delete Item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* CREATE / EDIT CATEGORY DIALOG */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {editingCat ? "Edit Menu Category" : "Add Menu Category"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Category Name *</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Starters, Main Course, Beverages, Desserts"
                value={catNameInput}
                onChange={(e) => setCatNameInput(e.target.value)}
              />
              {isDuplicateCategoryName() && (
                <span className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> Duplicate category name is not allowed.
                </span>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-full" onClick={closeCatDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveCategory}
              disabled={createCatMut.isPending || updateCatMut.isPending || !catNameInput.trim() || isDuplicateCategoryName()}
              className="rounded-full gradient-brand text-primary-foreground px-5"
            >
              {createCatMut.isPending || updateCatMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> {editingCat ? "Update Category" : "Save Category"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE / EDIT MENU ITEM DIALOG */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {editingItem ? "Edit Menu Item" : "Add Menu Item"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Category *</Label>
              <Select value={itemCatId} onValueChange={setItemCatId}>
                <SelectTrigger className="mt-1.5 rounded-xl">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {menuCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Item Name *</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Paneer Tikka, Butter Chicken, Cold Coffee"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
              {isDuplicateItemName() && (
                <span className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> Duplicate item name in this category is not allowed.
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-semibold">Price (₹) *</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  className="mt-1.5"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">GST Rate (%)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  className="mt-1.5"
                  value={itemGst}
                  onChange={(e) => setItemGst(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea
                className="mt-1.5 text-xs rounded-xl"
                rows={2}
                placeholder="Short item description, ingredients or preparation notes…"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/30">
                <div>
                  <p className="text-xs font-medium">Vegetarian</p>
                  <p className="text-[10px] text-muted-foreground">Is this item Veg or Non-Veg?</p>
                </div>
                <Switch checked={itemIsVeg} onCheckedChange={setItemIsVeg} />
              </div>

              <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/30">
                <div>
                  <p className="text-xs font-medium">Availability</p>
                  <p className="text-[10px] text-muted-foreground">Available for POS & QR ordering.</p>
                </div>
                <Switch checked={itemIsAvailable} onCheckedChange={setItemIsAvailable} />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-full" onClick={closeItemDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveItem}
              disabled={createItemMut.isPending || updateItemMut.isPending || !itemName.trim() || !itemCatId || isDuplicateItemName()}
              className="rounded-full gradient-brand text-primary-foreground px-5"
            >
              {createItemMut.isPending || updateItemMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> {editingItem ? "Update Item" : "Save Item"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// =============================================================================
// STEP 5: PAYMENT QR COMPONENT
// =============================================================================
// =============================================================================
// STEP 5: PAYMENT QR COMPONENT
// =============================================================================
function PaymentQrStep() {
  const qc = useQueryClient();
  const [upiId, setUpiId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["business-settings"],
    queryFn: getBusinessSettingsApi,
  });

  useEffect(() => {
    if (settings) {
      setUpiId(settings.payment_upi_id || "");
    }
  }, [settings]);

  const saveUpiMut = useMutation({
    mutationFn: updateBusinessSettingsApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-settings"] });
      toast.success("UPI ID saved successfully!");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save UPI ID."),
  });

  const validateFile = (file: File): boolean => {
    const allowedExts = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (!allowedExts.includes(file.type) && !["png", "jpg", "jpeg", "webp"].includes(ext || "")) {
      toast.error("Invalid file format. Only PNG, JPG, and JPEG files are allowed.");
      return false;
    }

    const maxSizeMB = 5;
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File size exceeds maximum limit of ${maxSizeMB}MB.`);
      return false;
    }

    return true;
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateFile(file)) {
      e.target.value = "";
      return;
    }

    const isReplace = Boolean(settings?.payment_qr_image);
    setUploading(true);

    try {
      await uploadPaymentQRApi(file);
      qc.invalidateQueries({ queryKey: ["business-settings"] });
      toast.success(isReplace ? "Payment QR image replaced successfully!" : "Payment QR image uploaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload Payment QR image.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteQr = async () => {
    setDeleting(true);
    try {
      await deletePaymentQRApi();
      qc.invalidateQueries({ queryKey: ["business-settings"] });
      toast.success("Payment QR deleted successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete Payment QR image.");
    } finally {
      setDeleting(false);
    }
  };

  const qrUrl = settings?.payment_qr_image
    ? settings.payment_qr_image.startsWith("http")
      ? settings.payment_qr_image
      : `${API_BASE_URL}${settings.payment_qr_image.startsWith("/") ? "" : "/"}${settings.payment_qr_image}`
    : null;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="border-b pb-4">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" /> Step 5: Payment QR Code
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Upload your restaurant's official UPI Payment QR Code. This QR image will be displayed to staff & customers for manual payment collection.
        </p>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* UPI ID SECTION */}
        <div className="rounded-xl border p-4 bg-muted/20 space-y-2">
          <Label className="text-xs font-semibold">Store UPI ID (Optional)</Label>
          <p className="text-[11px] text-muted-foreground">
            Enter your primary UPI ID (VPA) for manual verification (e.g. restaurant@upi, 9876543210@paytm).
          </p>
          <div className="flex gap-2 mt-2 sm:max-w-md">
            <Input
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. myrestaurant@upi"
              className="text-xs h-9 rounded-xl"
            />
            <Button
              className="rounded-full gradient-brand text-primary-foreground shrink-0 shadow-sm h-9 px-4 text-xs"
              onClick={() => saveUpiMut.mutate({ payment_upi_id: upiId.trim() || undefined })}
              disabled={saveUpiMut.isPending}
            >
              {saveUpiMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save UPI"}
            </Button>
          </div>
        </div>

        {/* PAYMENT QR UPLOAD & PREVIEW SECTION */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Payment QR Code Image
          </h4>

          {qrUrl ? (
            /* PREVIEW CARD */
            <div className="rounded-2xl border p-5 bg-card flex flex-col sm:flex-row items-center gap-6">
              {/* Image Preview Box */}
              <div
                className="relative h-44 w-44 rounded-xl border p-2 bg-white shadow-sm flex items-center justify-center cursor-pointer group"
                onClick={() => setPreviewOpen(true)}
                title="Click to view full preview"
              >
                <img
                  src={qrUrl}
                  alt="Payment QR Code"
                  className="h-full w-full object-contain rounded-lg transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white text-xs font-medium">
                  Click to Zoom
                </div>
              </div>

              {/* QR Details & Actions */}
              <div className="space-y-3 flex-1 text-center sm:text-left">
                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      Payment QR Active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your Payment QR code image is saved and configured for this business.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
                  {/* Replace Button */}
                  <Label
                    htmlFor="qr-replace-upload"
                    className="cursor-pointer inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium border bg-card hover:bg-muted shadow-sm transition-all"
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span>Replace QR</span>
                  </Label>
                  <input
                    id="qr-replace-upload"
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    className="hidden"
                    onChange={handleQrUpload}
                    disabled={uploading || deleting}
                  />

                  {/* Delete Button */}
                  <Button
                    variant="outline"
                    className="rounded-full text-xs text-destructive hover:bg-destructive/10 border-destructive/30 px-4 h-9"
                    onClick={handleDeleteQr}
                    disabled={deleting || uploading}
                  >
                    {deleting ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Delete QR
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* UPLOAD DROP ZONE */
            <div className="rounded-2xl border-2 border-dashed p-8 text-center bg-muted/10 hover:bg-muted/20 transition-all">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <QrCode className="h-6 w-6 text-primary" />
              </div>
              <h4 className="text-sm font-semibold">Upload Payment QR Code</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Supported file formats: <strong>PNG, JPG, JPEG</strong> (Max size: <strong>5 MB</strong>).
              </p>

              <div className="mt-5">
                <Label
                  htmlFor="qr-file-upload"
                  className="cursor-pointer inline-flex items-center gap-2 rounded-full gradient-brand text-primary-foreground px-6 py-2.5 text-xs font-medium shadow-sm hover:opacity-95 transition-all"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" /> Select QR Image File
                    </>
                  )}
                </Label>
                <input
                  id="qr-file-upload"
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="hidden"
                  onChange={handleQrUpload}
                  disabled={uploading}
                />
              </div>
            </div>
          )}
        </div>

        {/* FULL IMAGE ZOOM DIALOG */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl p-6 text-center">
            <DialogHeader>
              <DialogTitle className="font-display text-lg">Payment QR Code Preview</DialogTitle>
            </DialogHeader>

            {qrUrl && (
              <div className="py-2 flex justify-center">
                <img
                  src={qrUrl}
                  alt="Full Payment QR Code"
                  className="max-h-80 w-auto object-contain rounded-xl border p-2 bg-white"
                />
              </div>
            )}

            <DialogFooter className="sm:justify-center">
              <Button variant="outline" className="rounded-full px-6" onClick={() => setPreviewOpen(false)}>
                Close Preview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
