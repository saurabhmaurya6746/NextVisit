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

export function ServicesPageView() {
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

  const openCreateModal = () => {
    setName("");
    setDescription("");
    setPrice("");
    setDuration("30");
    setCategoryId(categories[0]?.id || "");
    setCategoryName(categories[0]?.name || "General");
    setIsActive(true);
    setIsCreating(true);
  };

  const openEditModal = (item: ServiceCatalogItem) => {
    setEditItem(item);
    setName(item.name);
    setDescription(item.description || "");
    setPrice(item.price ? String(item.price) : "");
    setDuration(item.duration_minutes ? String(item.duration_minutes) : "30");
    setCategoryId(item.category_id || "");
    setCategoryName(item.category_name || item.category || "General");
    setIsActive(item.is_active !== false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a service name");
      return;
    }
    const parsedPrice = parseFloat(price) || 0;
    const parsedDuration = parseInt(duration, 10) || 30;

    setSubmitting(true);
    try {
      if (isCreating) {
        await createServiceCatalogItemApi({
          name,
          description,
          price: parsedPrice,
          duration_minutes: parsedDuration,
          category_id: categoryId || undefined,
          category_name: categoryName || "General",
          is_active: isActive,
        });
        toast.success("Service added successfully");
      } else if (editItem) {
        await updateServiceCatalogItemApi(editItem.id, {
          name,
          description,
          price: parsedPrice,
          duration_minutes: parsedDuration,
          category_id: categoryId || undefined,
          category_name: categoryName || "General",
          is_active: isActive,
        });
        toast.success("Service updated successfully");
      }
      qc.invalidateQueries({ queryKey: ["services-catalog"] });
      setIsCreating(false);
      setEditItem(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save service");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!delItem) return;
    setSubmitting(true);
    try {
      await deleteServiceCatalogItemApi(delItem.id);
      toast.success("Service deleted successfully");
      qc.invalidateQueries({ queryKey: ["services-catalog"] });
      setDelItem(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete service");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Salon Services & Pricing"
          subtitle="Manage service menu, pricing tiers, duration, and staff assignments."
        >
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" /> Add New Service
          </Button>
        </PageHeader>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search services..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {categoryTabs.map((cat) => (
              <Badge
                key={cat}
                variant={activeCat.toLowerCase() === cat.toLowerCase() ? "default" : "outline"}
                className="cursor-pointer capitalize whitespace-nowrap px-3 py-1 text-xs"
                onClick={() => setActiveCat(cat)}
              >
                {cat === "all" ? "All Services" : cat}
              </Badge>
            ))}
          </div>
        </div>

        {/* Loading Skeleton */}
        {(loadingCats || loadingServices) && <SkeletonRows count={5} />}

        {/* Error Card */}
        {isError && (
          <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <h3 className="font-semibold text-base">Failed to load salon services</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {error instanceof Error ? error.message : "Backend service temporarily unavailable."}
            </p>
          </Card>
        )}

        {/* Services Grid */}
        {!loadingServices && !isError && (
          <div>
            {filteredServices.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
                <Layers className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
                <h3 className="font-semibold text-base">No Services Found</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {q
                    ? `No services match "${q}". Try clearing filters.`
                    : "Add your first salon service to get started with client booking."}
                </p>
                {!q && (
                  <Button onClick={openCreateModal} className="mt-4" size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Add Service Now
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredServices.map((service) => (
                  <Card key={service.id} className="flex flex-col justify-between p-5 hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge variant="secondary" className="text-[10px] uppercase font-semibold mb-1">
                            {service.category_name || service.category || "General"}
                          </Badge>
                          <h4 className="font-display font-semibold text-base text-foreground leading-snug">
                            {service.name}
                          </h4>
                        </div>
                        <div className="text-right">
                          <span className="font-display font-bold text-lg text-primary">
                            {fmt(service.price)}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {service.duration_minutes} mins
                          </span>
                        </div>
                      </div>

                      {service.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {service.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-4 border-t text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            service.is_active !== false ? "bg-emerald-500" : "bg-muted-foreground"
                          }`}
                        />
                        <span className="text-muted-foreground font-medium">
                          {service.is_active !== false ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => openEditModal(service)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => setDelItem(service)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------------------------------- */}
        {/* Create / Edit Service Modal */}
        {/* --------------------------------------------------------------------- */}
        <Dialog open={isCreating || !!editItem} onOpenChange={(open) => !open && (setIsCreating(false), setEditItem(null))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-lg">
                {isCreating ? "Add New Salon Service" : "Edit Salon Service"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSave} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="service-name">Service Name *</Label>
                <Input
                  id="service-name"
                  placeholder="e.g., Haircut & Styling, Gold Facial"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="service-price">Price (₹) *</Label>
                  <Input
                    id="service-price"
                    type="text"
                    placeholder="e.g. 499"
                    value={price}
                    onChange={(e) => setPrice(sanitizeNumberInput(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service-duration">Duration (Minutes) *</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger id="service-duration">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 Mins</SelectItem>
                      <SelectItem value="30">30 Mins</SelectItem>
                      <SelectItem value="45">45 Mins</SelectItem>
                      <SelectItem value="60">60 Mins (1 hr)</SelectItem>
                      <SelectItem value="90">90 Mins (1.5 hrs)</SelectItem>
                      <SelectItem value="120">120 Mins (2 hrs)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-category">Category</Label>
                <Select
                  value={categoryId}
                  onValueChange={(val) => {
                    setCategoryId(val);
                    const found = categories.find((c) => c.id === val);
                    if (found) setCategoryName(found.name);
                  }}
                >
                  <SelectTrigger id="service-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-desc">Description</Label>
                <Textarea
                  id="service-desc"
                  placeholder="Optional service details or inclusion instructions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Service Available</Label>
                  <p className="text-xs text-muted-foreground">Visible for client booking</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setEditItem(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : isCreating ? "Create Service" : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* --------------------------------------------------------------------- */}
        {/* Delete Confirmation Modal */}
        {/* --------------------------------------------------------------------- */}
        <ConfirmDialog
          open={!!delItem}
          onOpenChange={(open) => !open && setDelItem(null)}
          title="Delete Service?"
          description={`Are you sure you want to delete "${delItem?.name}"? This action cannot be undone.`}
          confirmText="Delete Service"
          variant="destructive"
          onConfirm={handleDelete}
        />
      </div>
    </PageTransition>
  );
}
