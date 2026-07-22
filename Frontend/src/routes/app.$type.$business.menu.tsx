import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, BookOpen, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMenu, menuCategories, upsertMenuItem, removeMenuItem, type MenuItem } from "@/lib/menu-store";
import { fmt } from "@/lib/currency";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$type/$business/menu")({ component: MenuPage });

function MenuPage() {
  const items = useMenu();
  const cats = useMemo(() => menuCategories(items), [items]);
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [edit, setEdit] = useState<MenuItem | null>(null);
  const [del, setDel] = useState<MenuItem | null>(null);

  const filtered = items.filter((i) =>
    (activeCat === "all" || i.category === activeCat) &&
    (q ? i.name.toLowerCase().includes(q.toLowerCase()) : true)
  );

  function newItem() {
    setEdit({ id: `m${Date.now().toString(36)}`, name: "", price: 0, category: cats[0] || "Mains", available: true });
  }

  return (
    <PageTransition>
      <PageHeader
        title="Menu"
        description={`${items.length} items · ${cats.length} categories`}
        actions={<Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={newItem}><Plus className="mr-1.5 h-4 w-4" /> Add item</Button>}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search dishes…" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-full pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setActiveCat("all")} className={`rounded-full border px-3 py-1 text-xs ${activeCat === "all" ? "gradient-brand text-primary-foreground border-transparent" : "hover:border-primary"}`}>All</button>
          {cats.map((c) => (
            <button key={c} onClick={() => setActiveCat(c)} className={`rounded-full border px-3 py-1 text-xs ${activeCat === c ? "gradient-brand text-primary-foreground border-transparent" : "hover:border-primary"}`}>{c}</button>
          ))}
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-3">
          {filtered.length === 0 ? (
            <div className="grid place-items-center py-12 text-center text-muted-foreground">
              <BookOpen className="mb-2 h-8 w-8" />
              <p className="text-sm">No dishes match. Add your first item.</p>
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {filtered.map((i) => (
                <div key={i.id} className="flex items-center justify-between rounded-xl border p-3 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{i.name}</p>
                      <Badge variant="outline" className="rounded-full text-[10px]">{i.category}</Badge>
                      {!i.available && <Badge variant="secondary" className="rounded-full text-[10px]">Unavailable</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{fmt(i.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={i.available} onCheckedChange={(v) => upsertMenuItem({ ...i, available: v })} />
                    <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setEdit(i)}>Edit</Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDel(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="font-display">{edit && items.some((i) => i.id === edit.id) ? "Edit item" : "New item"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label className="text-xs">Name</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Price (₹)</Label><Input type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) || 0 })} /></div>
                <div><Label className="text-xs">Category</Label><Input list="cats" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /><datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></div>
              </div>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <Label className="text-sm">Available on menu</Label>
                <Switch checked={edit.available} onCheckedChange={(v) => setEdit({ ...edit, available: v })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
                <Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => {
                  if (!edit.name.trim()) { toast.error("Enter a name"); return; }
                  upsertMenuItem(edit); toast.success("Saved"); setEdit(null);
                }}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete ${del?.name}?`} description="This removes the item from your menu." confirmLabel="Delete" onConfirm={() => { if (del) { removeMenuItem(del.id); toast.success("Deleted"); } setDel(null); }} />
    </PageTransition>
  );
}