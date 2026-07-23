import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, ShoppingBag, Check, Save, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMenu, menuCategories, type MenuItem } from "@/lib/menu-store";
import { useProfile } from "@/lib/business-profile";
import { appendItemsToActiveOrder, getActiveOrderForTable, calcTotals, type OrderItem } from "@/lib/orders-store";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { fmt } from "@/lib/currency";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; presetTable?: string }

export function NewOrderDialog({ open, onOpenChange, presetTable }: Props) {
  const menu = useMenu();
  const profile = useProfile("restaurant");
  const navigate = useNavigate();
  const [step, setStep] = useState(presetTable ? 1 : 0);
  const [table, setTable] = useState<string>(presetTable || "");
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");

  // If parent updates presetTable while the dialog is open, jump straight
  // to the menu step with that table selected (no intermediate picker).
  useEffect(() => {
    if (open && presetTable) { setTable(presetTable); setStep(1); }
  }, [open, presetTable]);

  const cats = useMemo(() => menuCategories(menu), [menu]);
  const current = activeCat || cats[0] || "";
  const totals = calcTotals(cart, profile.gstPercent, profile.gstEnabled);

  function reset() {
    setStep(presetTable ? 1 : 0); setTable(presetTable || ""); setCart([]); setActiveCat("");
  }
  function close() { reset(); onOpenChange(false); }

  function addToCart(m: MenuItem) {
    setCart((c) => {
      const idx = c.findIndex((x) => x.id === m.id);
      if (idx >= 0) { const copy = [...c]; copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 }; return copy; }
      return [...c, { id: m.id, name: m.name, price: m.price, qty: 1 }];
    });
  }
  function bump(id: string, d: number) {
    setCart((c) => c.flatMap((i) => i.id === id ? (i.qty + d <= 0 ? [] : [{ ...i, qty: i.qty + d }]) : [i]));
  }

  function pickTable(t: string) { setTable(t); setStep(1); }

  function saveTemp() {
    const active = getActiveOrderForTable(table);
    const order = appendItemsToActiveOrder({
      table, items: cart, source: "staff",
      gstPercent: profile.gstPercent, gstEnabled: profile.gstEnabled,
    });
    toast.success(active
      ? `Added to active session on ${table}`
      : `Order ${order.id.slice(-6)} saved · attached to ${table}`);
    close();
    navigate({ to: "/app/orders/$id" as any, params: { id: order.id } as any });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-4xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" /> New staff order
            {table && <span className="ml-2 rounded-full bg-primary/10 px-3 py-0.5 text-sm font-medium text-primary">{table}</span>}
          </DialogTitle>
          <p className="pt-1 text-xs text-muted-foreground">
            {step === 0 ? "Step 1 of 2 · Select a table" : `Step 2 of 2 · Add items to ${table}`}
          </p>
        </DialogHeader>

        <div className="min-h-[360px]">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p className="mb-3 text-sm text-muted-foreground">Tap a table to continue. Customer & payment are collected at checkout.</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {profile.tableNames.map((t) => (
                    <TableChip key={t} label={t} active={table === t} onClick={() => pickTable(t)} />
                  ))}
                  {profile.parcel && <TableChip label="Parcel" active={table === "Parcel"} onClick={() => pickTable("Parcel")} />}
                  {profile.takeaway && <TableChip label="Take Away" active={table === "Take Away"} onClick={() => pickTable("Take Away")} />}
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="grid gap-3 md:grid-cols-[140px_1fr_260px]">
                <div className="space-y-1">
                  {cats.map((c) => (
                    <button key={c} onClick={() => setActiveCat(c)} className={cn("w-full rounded-xl px-3 py-2 text-left text-sm transition-all",
                      c === current ? "gradient-brand text-primary-foreground shadow-elegant" : "hover:bg-muted")}>{c}</button>
                  ))}
                </div>
                <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {menu.filter((m) => m.category === current && m.available).map((m) => (
                    <button key={m.id} onClick={() => addToCart(m)} className="group rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-glow">
                      {m.image && <img src={m.image} alt="" className="mb-2 h-20 w-full rounded-lg object-cover" />}
                      <p className="font-medium">{m.name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-semibold">{fmt(m.price)}</span>
                        <Plus className="h-4 w-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </button>
                  ))}
                </div>
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cart · {table}</p>
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
                  <div className="mt-3 space-y-1 border-t pt-2 text-xs">
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(totals.subtotal)}</span></div>
                    {profile.gstEnabled && <div className="flex items-center justify-between"><span className="text-muted-foreground">GST ({profile.gstPercent}%)</span><span>{fmt(totals.gst)}</span></div>}
                    <div className="flex items-center justify-between border-t pt-1 text-sm"><span className="text-muted-foreground">Total</span><span className="font-display text-base font-semibold">{fmt(totals.total)}</span></div>
                  </div>
                  <Button className="mt-3 w-full rounded-full gradient-brand text-primary-foreground" disabled={cart.length === 0} onClick={saveTemp}>
                    <Save className="mr-1.5 h-4 w-4" /> Save order
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step === 1 && !presetTable && (
          <div className="mt-2 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => { setStep(0); setCart([]); }}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Change table
            </Button>
            <span className="text-xs text-muted-foreground">{cart.reduce((s, i) => s + i.qty, 0)} items</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TableChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("rounded-xl border px-3 py-4 text-sm font-medium transition-all",
      active ? "gradient-brand text-primary-foreground shadow-elegant" : "hover:-translate-y-0.5 hover:border-primary")}>{label}</button>
  );
}

// silence unused imports for check tolerant builds
void Check;