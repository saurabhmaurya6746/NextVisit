import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Sparkles, Search, Layers, Pencil, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkeletonRows } from "@/components/skeletons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import { sanitizeNumberInput } from "@/lib/validation";

import {
  listServicesCatalogApi,
  createServiceCatalogItemApi,
  updateServiceCatalogItemApi,
  deleteServiceCatalogItemApi,
  type ServiceCatalogItem,
} from "@/lib/visit-services-api";
import {
  listSalonServiceCategoriesApi,
  type SalonServiceCategory,
} from "@/lib/salon-categories-api";
import { fmt } from "@/lib/currency";

export const Route = createFileRoute("/app/$type/$business/services")({ component: ServicesPage });

function ServicesPage() {
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  const [editItem, setEditItem] = useState<ServiceCatalogItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [delItem, setDelItem] = useState<ServiceCatalogItem | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Live queries from PostgreSQL
  const { data: categories = [], isLoading: loadingCats } = useQuery<SalonServiceCategory[]>({
    queryKey: ["salon-service-categories"],
    queryFn: listSalonServiceCategoriesApi,
  });

  const { data: services = [], isLoading: loadingServices, isError, error } = useQuery<ServiceCatalogItem[]>({
    queryKey: ["services-catalog"],
    queryFn: listServicesCatalogApi,
  });

  // Dynamic Categories list for horizontal scrollable tabs
  const categoryTabs = useMemo(() => {
    const activeDbCats = categories.filter((c) => c.is_active).map((c) => c.name);
    const existingServiceCats = services.map((s) => s.category_name || s.category || "General").filter(Boolean);
    const set = Array.from(new Set([...activeDbCats, ...existingServiceCats]));
    return ["all", ...set];
  }, [categories, services]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const cat = s.category_name || s.category || "General";
      const matchCat = activeCat === "all" || cat.toLowerCase() === activeCat.toLowerCase();
      const matchSearch = !q || s.name.toLowerCase().includes(q.toLowerCase()) || cat.toLowerCase().includes(q.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [services, activeCat, q]);

  function resetForm() {
    setName("");
    setDescription("");
    setPrice("");
    setDuration("30");
    setCategoryId("");
    setCategoryName("");
    setIsActive(true);
  }

  function openCreate() {
    resetForm();
    if (categories.length > 0) {
      setCategoryId(categories[0].id);
      setCategoryName(categories[0].name);
    }
    setIsCreating(true);
  }

  function openEdit(s: ServiceCatalogItem) {
    setEditItem(s);
    setName(s.name);
    setDescription(s.description || "");
    setPrice(String(s.price || 0));
    setDuration(String(s.duration_minutes || 30));
    setCategoryId(s.category_id || "");
    setCategoryName(s.category_name || s.category || "");
    setIsActive(s.is_active !== false);
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("Service name is required"); return; }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) { toast.error("Enter a valid price"); return; }
    const numDuration = parseInt(duration, 10);
    if (isNaN(numDuration) || numDuration <= 0) { toast.error("Enter a valid duration in minutes"); return; }

    const matchedCat = categories.find((c) => c.id === categoryId);
    const catName = matchedCat?.name || categoryName || "General";

    setSubmitting(true);
    try {
      if (editItem) {
        await updateServiceCatalogItemApi(editItem.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          price: numPrice,
          duration_minutes: numDuration,
          category: catName,
          category_id: categoryId || undefined,
          is_active: isActive,
        });
        toast.success("Service updated successfully!");
      } else {
        await createServiceCatalogItemApi({
          name: name.trim(),
          description: description.trim() || undefined,
          price: numPrice,
          duration_minutes: numDuration,
          category: catName,
          category_id: categoryId || undefined,
          is_active: isActive,
        });
        toast.success("Service created successfully!");
      }

      qc.invalidateQueries({ queryKey: ["services-catalog"] });
      setEditItem(null);
      setIsCreating(false);
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save service.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!delItem) return;
    try {
      await deleteServiceCatalogItemApi(delItem.id);
      toast.success("Service deleted");
      qc.invalidateQueries({ queryKey: ["services-catalog"] });
      setDelItem(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed deleting service");
    }
  }

  async function handleToggleActive(s: ServiceCatalogItem) {
    try {
      await updateServiceCatalogItemApi(s.id, { is_active: !s.is_active });
      toast.success(`Service "${s.name}" ${!s.is_active ? "activated" : "deactivated"}`);
      qc.invalidateQueries({ queryKey: ["services-catalog"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to toggle service status");
    }
  }

  return (
    <PageTransition>
      <PageHeader
        title="Salon Services"
        description={`${services.length} services · ${categories.length} categories configured in PostgreSQL`}
        actions={
          <Button size="sm" className="rounded-full gradient-brand text-primary-foreground text-xs" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Service
          </Button>
        }
      />

      {/* FILTER BAR & HORIZONTAL CATEGORY TABS */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search services by name or category…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="rounded-full pl-9 h-10"
            />
          </div>
        </div>

        {/* HORIZONTAL SCROLLABLE CATEGORY TABS */}
        <div className="w-full min-w-0 max-w-full overflow-x-auto pb-2 custom-scrollbar">
          <div className="flex items-center gap-2 whitespace-nowrap min-w-max px-0.5">
            {categoryTabs.map((c) => {
              const isSelected = activeCat.toLowerCase() === c.toLowerCase();
              const label = c === "all" ? "All Services" : c;
              return (
                <Button
                  key={c}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full text-xs shrink-0 transition-all ${
                    isSelected ? "gradient-brand text-primary-foreground border-transparent shadow-xs font-semibold" : "hover:border-primary text-foreground"
                  }`}
                  onClick={() => setActiveCat(c)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SERVICES LIST */}
      <Card className="rounded-2xl border bg-card p-4">
        <CardContent className="p-0">
          {loadingServices ? (
            <SkeletonRows rows={6} cols={2} />
          ) : isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {(error as Error)?.message || "Failed to load services catalog"}
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="grid place-items-center py-12 text-center text-muted-foreground space-y-2">
              <Sparkles className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-semibold text-foreground">No services found</p>
              <p className="text-xs">Try selecting another category or click "Add Service" to create one.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredServices.map((i) => {
                const catDisplay = i.category_name || i.category || "General";
                return (
                  <div
                    key={i.id}
                    className={`flex items-center justify-between rounded-2xl border p-4 transition-all hover:shadow-md ${
                      i.is_active ? "bg-card hover:border-primary/40" : "bg-muted/30 opacity-60"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold text-base text-foreground">{i.name}</p>
                        <Badge variant="outline" className="rounded-full text-[10px] px-2.5 py-0.5">
                          {catDisplay}
                        </Badge>
                        {!i.is_active && (
                          <Badge variant="secondary" className="rounded-full text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {i.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{i.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground font-medium pt-0.5">
                        Duration: <span className="font-semibold text-foreground">{i.duration_minutes || 30} min</span> · Price: <span className="font-mono font-bold text-primary">{fmt(i.price || 0)}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 ml-3">
                      <Switch checked={i.is_active !== false} onCheckedChange={() => handleToggleActive(i)} />
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive hover:text-destructive/80" onClick={() => setDelItem(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE / EDIT SERVICE DIALOG */}
      <Dialog open={isCreating || !!editItem} onOpenChange={(o) => { if (!o) { setIsCreating(false); setEditItem(null); } }}>
        <DialogContent className="max-w-md rounded-2xl p-6 text-foreground bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold">
              {editItem ? "Edit Salon Service" : "New Salon Service"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Service Name *</Label>
              <Input
                placeholder="e.g. Premium Hair Cut & Style"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Category *</Label>
              {categories.length > 0 ? (
                <Select
                  value={categoryId}
                  onValueChange={(val) => {
                    setCategoryId(val);
                    const selected = categories.find((c) => c.id === val);
                    if (selected) setCategoryName(selected.name);
                  }}
                >
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue placeholder="Select Category…" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="Category (e.g. Hair, Skin, Nails)"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="mt-1 rounded-xl"
                />
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea
                rows={2}
                placeholder="Brief description of what this service includes…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Duration (minutes) *</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="30"
                  value={duration}
                  onChange={(e) => setDuration(sanitizeNumberInput(e.target.value, false))}
                  className="mt-1 rounded-xl"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Price (₹) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="500"
                  value={price}
                  onChange={(e) => setPrice(sanitizeNumberInput(e.target.value, true))}
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Label className="text-xs font-semibold">Active Status</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter className="gap-2 border-t pt-3">
            <Button variant="ghost" className="rounded-full text-xs" onClick={() => { setIsCreating(false); setEditItem(null); }}>
              Cancel
            </Button>
            <Button
              className="rounded-full gradient-brand text-primary-foreground text-xs"
              disabled={submitting}
              onClick={handleSave}
            >
              {submitting ? "Saving…" : "Save Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        open={!!delItem}
        onOpenChange={(o) => !o && setDelItem(null)}
        title={`Delete ${delItem?.name}?`}
        description="Are you sure you want to delete this service from your catalog? This action cannot be undone."
        confirmLabel="Delete Service"
        onConfirm={handleDelete}
      />
    </PageTransition>
  );
}