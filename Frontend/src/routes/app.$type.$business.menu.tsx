import { createFileRoute } from "@/lib/route-compat";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  BookOpen,
  Search,
  Pencil,
  Leaf,
  AlertCircle,
  Tag,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";
import {
  listMenuCategoriesApi,
  createMenuCategoryApi,
  updateMenuCategoryApi,
  deleteMenuCategoryApi,
  createMenuItemApi,
  updateMenuItemApi,
  deleteMenuItemApi,
  type BackendMenuCategory,
  type BackendMenuItem,
} from "@/lib/menu-api";

export const Route = createFileRoute("/app/$type/$business/menu")({ component: MenuPage });

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------
const MENU_CATS_KEY = ["menu", "categories"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function blankCategory() {
  return { name: "", display_order: 0, is_active: true };
}

function blankItem(categoryId: string) {
  return {
    category_id: categoryId,
    name: "",
    description: "",
    price: "",
    is_veg: true,
    is_available: true,
    display_order: 0,
  };
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function MenuPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [activeCatId, setActiveCatId] = useState<string>("all");

  // Dialog states
  const [catDialog, setCatDialog] = useState<{ open: boolean; mode: "create" | "edit"; data: BackendMenuCategory | null }>({ open: false, mode: "create", data: null });
  const [itemDialog, setItemDialog] = useState<{ open: boolean; mode: "create" | "edit"; data: BackendMenuItem | null; categoryId: string }>({ open: false, mode: "create", data: null, categoryId: "" });
  const [deleteCat, setDeleteCat] = useState<BackendMenuCategory | null>(null);
  const [deleteItem, setDeleteItem] = useState<BackendMenuItem | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetch
  // ---------------------------------------------------------------------------
  const {
    data: categories = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: MENU_CATS_KEY,
    queryFn: listMenuCategoriesApi,
  });

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  const allItems = categories.flatMap((c) => c.items);
  const filteredItems = allItems.filter(
    (i) =>
      (activeCatId === "all" || i.category_id === activeCatId) &&
      (q ? i.name.toLowerCase().includes(q.toLowerCase()) : true)
  );

  // ---------------------------------------------------------------------------
  // Category mutations
  // ---------------------------------------------------------------------------
  const createCatMut = useMutation({
    mutationFn: createMenuCategoryApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MENU_CATS_KEY });
      toast.success("Category created");
      setCatDialog({ open: false, mode: "create", data: null });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCatMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; display_order?: number; is_active?: boolean } }) =>
      updateMenuCategoryApi(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MENU_CATS_KEY });
      toast.success("Category updated");
      setCatDialog({ open: false, mode: "create", data: null });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCatMut = useMutation({
    mutationFn: deleteMenuCategoryApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MENU_CATS_KEY });
      toast.success("Category deleted");
      setDeleteCat(null);
      if (activeCatId !== "all") setActiveCatId("all");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---------------------------------------------------------------------------
  // Item mutations
  // ---------------------------------------------------------------------------
  const createItemMut = useMutation({
    mutationFn: createMenuItemApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MENU_CATS_KEY });
      toast.success("Item added");
      setItemDialog({ open: false, mode: "create", data: null, categoryId: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItemMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateMenuItemApi>[1] }) =>
      updateMenuItemApi(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MENU_CATS_KEY });
      toast.success("Item updated");
      setItemDialog({ open: false, mode: "create", data: null, categoryId: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItemMut = useMutation({
    mutationFn: deleteMenuItemApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MENU_CATS_KEY });
      toast.success("Item deleted");
      setDeleteItem(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <PageTransition>
      <PageHeader
        title="Menu"
        description={`${allItems.length} ${allItems.length === 1 ? "item" : "items"} · ${categories.length} ${categories.length === 1 ? "category" : "categories"}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full text-xs h-8 px-3 flex-1 sm:flex-none justify-center cursor-pointer"
              onClick={() => setCatDialog({ open: true, mode: "create", data: null })}
            >
              <Tag className="mr-1.5 h-3.5 w-3.5" /> New Category
            </Button>
            <Button
              size="sm"
              className="rounded-full gradient-brand text-primary-foreground text-xs h-8 px-3 flex-1 sm:flex-none justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
              disabled={categories.length === 0}
              onClick={() =>
                setItemDialog({ open: true, mode: "create", data: null, categoryId: categories[0]?.id ?? "" })
              }
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Item
            </Button>
          </div>
        }
      />

      {/* Search & Category Filter Chips Row */}
      <div className="space-y-3 mb-4">
        {/* Search Box */}
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search dishes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-full pl-9 h-9 text-xs"
          />
        </div>

        {/* Category Horizontal Scroll Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar max-w-full">
          <button
            onClick={() => setActiveCatId("all")}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-all cursor-pointer font-medium ${
              activeCatId === "all"
                ? "gradient-brand text-primary-foreground border-transparent shadow-2xs"
                : "hover:border-primary bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({allItems.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCatId(c.id)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-all cursor-pointer font-medium ${
                activeCatId === c.id
                  ? "gradient-brand text-primary-foreground border-transparent shadow-2xs"
                  : "hover:border-primary bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.name} ({c.items?.length || 0})
            </button>
          ))}
        </div>
      </div>

      {/* States */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading menu…
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {(error as Error)?.message || "Failed to load menu"}
        </div>
      )}

      {!isLoading && !isError && categories.length === 0 && (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="No menu yet"
          description="Create a category first, then add items."
          action={
            <Button
              size="sm"
              className="rounded-full gradient-brand text-primary-foreground"
              onClick={() => setCatDialog({ open: true, mode: "create", data: null })}
            >
              <Plus className="mr-1.5 h-4 w-4" /> New Category
            </Button>
          }
        />
      )}

      {/* Item list */}
      {!isLoading && !isError && categories.length > 0 && (
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <Card className="rounded-2xl p-8 text-center text-muted-foreground border bg-card">
              <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">No dishes match.</p>
              <p className="text-xs text-muted-foreground mt-0.5">Try a different search or filter.</p>
            </Card>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {filteredItems.map((item) => {
                const cat = categories.find((c) => c.id === item.category_id);
                return (
                  <Card
                    key={item.id}
                    className="rounded-2xl border p-3.5 bg-card shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-sm text-foreground break-words leading-tight">{item.name}</p>
                          {item.is_veg ? (
                            <Leaf className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <span className="h-3 w-3 rounded-full bg-rose-500 shrink-0 inline-block" />
                          )}
                        </div>
                        {cat && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <Badge variant="outline" className="rounded-full text-[10px] font-medium py-0 px-2">
                              {cat.name}
                            </Badge>
                            {!item.is_available && (
                              <Badge variant="secondary" className="rounded-full text-[10px] py-0 px-2">
                                Unavailable
                              </Badge>
                            )}
                          </div>
                        )}
                        {item.description && (
                          <p className="text-xs text-muted-foreground break-words line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/40 gap-2">
                      <span className="font-mono text-base font-bold text-foreground">
                        {fmt(item.price)}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Switch
                          checked={item.is_available}
                          onCheckedChange={(v) =>
                            updateItemMut.mutate({ id: item.id, payload: { is_available: v } })
                          }
                          aria-label="Toggle availability"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={() =>
                            setItemDialog({ open: true, mode: "edit", data: item, categoryId: item.category_id })
                          }
                          aria-label="Edit item"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 cursor-pointer"
                          onClick={() => setDeleteItem(item)}
                          aria-label="Delete item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Category by section (only when viewing all) */}
      {!isLoading && !isError && categories.length > 0 && activeCatId === "all" && q === "" && (
        <section className="mt-8 space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Tag className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Manage Categories
            </h3>
          </div>
          <div className="space-y-2.5">
            {categories.map((cat) => (
              <Card
                key={cat.id}
                className="flex flex-wrap sm:flex-nowrap items-center justify-between rounded-2xl border p-3.5 bg-card shadow-xs gap-3 hover:border-primary/30 transition-all"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-foreground break-words">{cat.name}</p>
                    {!cat.is_active && (
                      <Badge variant="secondary" className="rounded-full text-[10px]">Hidden</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{cat.items.length} {cat.items.length === 1 ? "item" : "items"}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-xs h-7 px-2.5 cursor-pointer"
                    onClick={() =>
                      setItemDialog({ open: true, mode: "create", data: null, categoryId: cat.id })
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Item
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => setCatDialog({ open: true, mode: "edit", data: cat })}
                    aria-label="Edit category"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-full text-destructive hover:bg-destructive/10 cursor-pointer"
                    onClick={() => setDeleteCat(cat)}
                    aria-label="Delete category"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Category Dialog */}
      <CategoryDialog
        open={catDialog.open}
        mode={catDialog.mode}
        initial={catDialog.data}
        onClose={() => setCatDialog({ open: false, mode: "create", data: null })}
        onSave={(payload) => {
          if (catDialog.mode === "create") {
            createCatMut.mutate(payload);
          } else if (catDialog.data) {
            updateCatMut.mutate({ id: catDialog.data.id, payload });
          }
        }}
        saving={createCatMut.isPending || updateCatMut.isPending}
      />

      {/* Item Dialog */}
      <ItemDialog
        open={itemDialog.open}
        mode={itemDialog.mode}
        initial={itemDialog.data}
        defaultCategoryId={itemDialog.categoryId}
        categories={categories}
        onClose={() => setItemDialog({ open: false, mode: "create", data: null, categoryId: "" })}
        onSave={(payload) => {
          if (itemDialog.mode === "create") {
            createItemMut.mutate(payload);
          } else if (itemDialog.data) {
            updateItemMut.mutate({ id: itemDialog.data.id, payload });
          }
        }}
        saving={createItemMut.isPending || updateItemMut.isPending}
      />

      {/* Delete Category Confirm */}
      <ConfirmDialog
        open={!!deleteCat}
        onOpenChange={(o) => !o && setDeleteCat(null)}
        title={`Delete "${deleteCat?.name}"?`}
        description="This will delete the category and all its items permanently."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteCat) deleteCatMut.mutate(deleteCat.id);
        }}
      />

      {/* Delete Item Confirm */}
      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(o) => !o && setDeleteItem(null)}
        title={`Delete "${deleteItem?.name}"?`}
        description="This will remove the item from your menu permanently."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteItem) deleteItemMut.mutate(deleteItem.id);
        }}
      />
    </PageTransition>
  );
}

// ---------------------------------------------------------------------------
// Category Dialog
// ---------------------------------------------------------------------------
interface CategoryDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initial: BackendMenuCategory | null;
  onClose: () => void;
  onSave: (payload: { name: string; display_order: number; is_active: boolean }) => void;
  saving: boolean;
}

function CategoryDialog({ open, mode, initial, onClose, onSave, saving }: CategoryDialogProps) {
  const [form, setForm] = useState(() =>
    initial
      ? { name: initial.name, display_order: initial.display_order, is_active: initial.is_active }
      : blankCategory()
  );

  // Reset form whenever the dialog opens with new data
  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? { name: initial.name, display_order: initial.display_order, is_active: initial.is_active }
          : blankCategory()
      );
    }
  }, [open, initial]);

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      onClose();
      setForm(blankCategory());
    }
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("Category name is required");
      return;
    }
    onSave({ name: form.name.trim(), display_order: form.display_order, is_active: form.is_active });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            {mode === "create" ? "New Category" : "Edit Category"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label className="text-xs">Category Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Starters, Mains, Drinks"
            />
          </div>
          <div>
            <Label className="text-xs">Display Order</Label>
            <Input
              type="number"
              min={0}
              value={form.display_order}
              onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <Label className="text-sm">Visible on menu</Label>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            className="rounded-full gradient-brand text-primary-foreground"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Item Dialog
// ---------------------------------------------------------------------------
interface ItemDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initial: BackendMenuItem | null;
  defaultCategoryId: string;
  categories: BackendMenuCategory[];
  onClose: () => void;
  onSave: (payload: any) => void;
  saving: boolean;
}

function ItemDialog({ open, mode, initial, defaultCategoryId, categories, onClose, onSave, saving }: ItemDialogProps) {
  const defaultForm = () =>
    initial
      ? {
          category_id: initial.category_id,
          name: initial.name,
          description: initial.description ?? "",
          price: initial.price !== undefined && initial.price !== null ? String(initial.price) : "",
          is_veg: initial.is_veg,
          is_available: initial.is_available,
          display_order: initial.display_order,
        }
      : blankItem(defaultCategoryId);

  const [form, setForm] = useState(defaultForm);

  // Sync form when dialog opens with new data
  useEffect(() => {
    if (open) setForm(defaultForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, defaultCategoryId]);

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      onClose();
      setForm(blankItem(defaultCategoryId));
    }
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("Item name is required");
      return;
    }
    if (!form.category_id) {
      toast.error("Please select a category");
      return;
    }
    const parsedPrice = Number(form.price);
    if (form.price === "" || isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Price must be 0 or more");
      return;
    }
    onSave({
      category_id: form.category_id,
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      price: parsedPrice,
      is_veg: form.is_veg,
      is_available: form.is_available,
      display_order: form.display_order,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            {mode === "create" ? "Add Menu Item" : "Edit Menu Item"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label className="text-xs">Item Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Butter Chicken"
            />
          </div>
          <div>
            <Label className="text-xs">Category *</Label>
            <Select
              value={form.category_id}
              onValueChange={(v) => setForm({ ...form, category_id: v })}
            >
              <SelectTrigger>
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
          <div>
            <Label className="text-xs">Price (₹) *</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short description of the dish…"
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between rounded-xl border p-3">
              <Label className="text-sm flex items-center gap-1.5">
                <Leaf className="h-3.5 w-3.5 text-emerald-500" /> Veg
              </Label>
              <Switch
                checked={form.is_veg}
                onCheckedChange={(v) => setForm({ ...form, is_veg: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <Label className="text-sm">Available</Label>
              <Switch
                checked={form.is_available}
                onCheckedChange={(v) => setForm({ ...form, is_available: v })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Display Order</Label>
            <Input
              type="number"
              min={0}
              value={form.display_order}
              onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            className="rounded-full gradient-brand text-primary-foreground"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}