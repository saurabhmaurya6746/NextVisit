import { useMemo, useState } from "react";
import { Plus, Minus, ShoppingBag, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMenu, menuCategories, type MenuItem } from "@/lib/menu-store";
import { useProfile } from "@/lib/business-profile";
import { appendItemsToActiveOrder, type Order, type OrderItem } from "@/lib/orders-store";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";

interface Props { order: Order; open: boolean; onOpenChange: (o: boolean) => void }

export function AddItemsDialog({ order, open, onOpenChange }: Props) {
  const menu = useMenu();
  const profile = useProfile("restaurant");
  const cats = useMemo(() => menuCategories(menu), [menu]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [cart, setCart] = useState<OrderItem[]>([]);
  const current = activeCat || cats[0] || "";

  function add(m: MenuItem) {
    setCart((c) => {
      const i = c.findIndex((x) => x.id === m.id);
      if (i >= 0) { const cp = [...c]; cp[i] = { ...cp[i], qty: cp[i].qty + 1 }; return cp; }
      return [...c, { id: m.id, name: m.name, price: m.price, qty: 1 }];
    });
  }
  function bump(id: string, d: number) {
    setCart((c) => c.flatMap((i) => i.id === id ? (i.qty + d <= 0 ? [] : [{ ...i, qty: i.qty + d }]) : [i]));
  }

  function save() {
    if (cart.length === 0) return;
    appendItemsToActiveOrder({
      table: order.table, items: cart, source: "staff",
      gstPercent: profile.gstPercent, gstEnabled: profile.gstEnabled,
      customer: order.customerId ? { id: order.customerId, name: order.customerName, phone: order.customerPhone } : undefined,
    });
    toast.success(`Added ${cart.reduce((s, i) => s + i.qty, 0)} item(s) to session`);
    setCart([]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" /> Add items · {order.table}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-[140px_1fr_260px]">
          <div className="space-y-1">
            {cats.map((c) => (
              <button key={c} onClick={() => setActiveCat(c)} className={cn("w-full rounded-xl px-3 py-2 text-left text-sm transition-all",
                c === current ? "gradient-brand text-primary-foreground shadow-elegant" : "hover:bg-muted")}>{c}</button>
            ))}
          </div>
          <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto pr-1">
            {menu.filter((m) => m.category === current && m.available).map((m) => (
              <button key={m.id} onClick={() => add(m)} className="group rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-glow">
                <p className="font-medium">{m.name}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">{fmt(m.price)}</span>
                  <Plus className="h-4 w-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </button>
            ))}
          </div>
          <div className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">New items</p>
            {cart.length === 0 ? (
              <p className="text-xs text-muted-foreground">Tap items to add.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {cart.map((i) => (
                  <div key={i.id} className="rounded-lg bg-muted/40 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{i.name}</span>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => bump(i.id, -1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-5 text-center text-sm">{i.qty}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => bump(i.id, +1)}><Plus className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{fmt(i.price)} × {i.qty}</span>
                      <span className="font-semibold text-foreground">{fmt(i.price * i.qty)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button className="mt-3 w-full rounded-full gradient-brand text-primary-foreground" disabled={cart.length === 0} onClick={save}>
              <Check className="mr-1.5 h-4 w-4" /> Add to session
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}