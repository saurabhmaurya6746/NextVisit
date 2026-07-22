import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Minus, ShoppingBag, Check, Utensils, User, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useMenu, menuCategories, type MenuItem } from "@/lib/menu-store";
import { useProfile } from "@/lib/business-profile";
import { appendItemsToActiveOrder, calcTotals, findCustomerByPhone, createCustomerFromOrder, getActiveOrderForTable, type OrderItem } from "@/lib/orders-store";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";
import { awardPointsForOrder, useLoyaltySettings, calcPointsForAmount } from "@/lib/loyalty-store";

export function QrOrderView({ table }: { table: string }) {
  const menu = useMenu();
  const profile = useProfile("restaurant");
  const loyalty = useLoyaltySettings();
  const navigate = useNavigate();
  const cats = useMemo(() => menuCategories(menu), [menu]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [placed, setPlaced] = useState<{ orderId: string; code: string; name: string; total: number; earned: number; balance: number; prepMins: number } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [bday, setBday] = useState("");
  const [anni, setAnni] = useState("");
  const [gender, setGender] = useState("");
  void gender;
  const current = activeCat || cats[0] || "";
  const totals = calcTotals(cart, profile.gstPercent, profile.gstEnabled);

  const rawDecoded = decodeURIComponent(table);
  // The Tables page keys sessions by the display name ("Table 1"); QR links
  // pass a slug ("table-1"). Resolve the slug back to the real table name
  // so the merchant's Tables grid picks up the active order immediately.
  const allTables = [
    ...profile.tableNames,
    ...(profile.parcel ? ["Parcel"] : []),
    ...(profile.takeaway ? ["Take Away"] : []),
  ];
  const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
  const decoded =
    allTables.find((t) => slugify(t) === rawDecoded.toLowerCase()) ||
    allTables.find((t) => t.toLowerCase() === rawDecoded.toLowerCase()) ||
    rawDecoded;
  const active = getActiveOrderForTable(decoded);
  const foundPreview = phone.trim().length >= 6 ? findCustomerByPhone(phone.trim()) : null;

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

  function submitDetails() {
    const p = phone.trim();
    if (p.length < 6) { toast.error("Please enter your phone number"); return; }
    const found = findCustomerByPhone(p);
    let cust: { id?: string; name: string; phone: string; returning: boolean; visits: number };
    if (found) {
      cust = { id: found.id, name: found.name, phone: found.phone, returning: true, visits: (found as any).visits ?? 0 };
    } else {
      if (!name.trim()) { toast.error("Please enter your name"); return; }
      const c = createCustomerFromOrder({
        phone: p, name: name.trim(),
        birthday: bday || undefined, anniversary: anni || undefined,
        spent: 0, visitDate: new Date().toISOString().slice(0, 10),
      });
      cust = { id: c.id, name: c.name, phone: c.phone, returning: false, visits: 0 };
    }
    const o = appendItemsToActiveOrder({
      table: decoded, items: cart, source: "qr",
      gstPercent: profile.gstPercent, gstEnabled: profile.gstEnabled,
      customer: { id: cust.id, name: cust.name, phone: cust.phone },
    });
    const cartTotals = calcTotals(cart, profile.gstPercent, profile.gstEnabled);
    // Award points for THIS placement (idempotent per unique key)
    const awardKey = `${o.id}:${Date.now()}`;
    const rewarded = awardPointsForOrder(awardKey, cust.id, cartTotals.total, cust.returning ? undefined : { signupBonus: true });
    const prepMins = 10 + Math.min(20, cart.reduce((s, i) => s + i.qty, 0) * 2);
    setDetailsOpen(false);
    setPlaced({ orderId: o.id, code: o.code || o.id.slice(-6), name: cust.name, total: cartTotals.total, earned: rewarded.earned, balance: rewarded.balance, prepMins });
    toast.success("Order placed — the kitchen has it!");
  }

  if (placed) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md p-6 text-center">
          <div className="mx-auto mt-10 grid h-16 w-16 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-glow">
            <Check className="h-8 w-8" />
          </div>
          <p className="mt-4 font-display text-2xl font-semibold">Order Received 🎉</p>
          <p className="mt-1 text-sm text-muted-foreground">Thanks {placed.name.split(" ")[0]} — Table {decoded}</p>
          <div className="mx-auto mt-5 grid gap-2">
            <Card className="rounded-2xl p-4 text-left">
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Order number</span><span className="font-mono font-semibold">{placed.code}</span></div>
              <div className="mt-2 flex items-center justify-between text-sm"><span className="text-muted-foreground">Estimated prep time</span><span className="font-semibold">~ {placed.prepMins} min</span></div>
              <div className="mt-2 flex items-center justify-between text-sm"><span className="text-muted-foreground">Order total</span><span className="font-semibold">{fmt(placed.total)}</span></div>
            </Card>
            <Card className="rounded-2xl p-4 gradient-brand text-primary-foreground text-left">
              <p className="flex items-center gap-2 text-xs opacity-90"><Sparkles className="h-3.5 w-3.5" /> Loyalty</p>
              <p className="mt-1 font-display text-2xl font-semibold">You earned {placed.earned} points</p>
              <p className="mt-1 text-xs opacity-90">Current balance: {placed.balance} pts</p>
            </Card>
          </div>
          <div className="mt-6 grid gap-2">
            <Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => { setCart([]); setPlaced(null); }}>Order More</Button>
            <Button variant="ghost" className="rounded-full" onClick={() => navigate({ to: "/" })}>Close</Button>
          </div>
        </div>
      </div>
    );
  }
  void loyalty; void Heart;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="font-display text-lg font-semibold">{profile.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Utensils className="h-3 w-3" /> {decoded} · Self order</p>
          </div>
          <Badge className="rounded-full gradient-brand text-primary-foreground">Menu</Badge>
        </div>
        {active && active.items.length > 0 && (
          <div className="border-t bg-primary/5 px-4 py-2 text-xs text-center">
            Your table has an active session · {active.items.reduce((s, i) => s + i.qty, 0)} items · new orders will be added to it
          </div>
        )}
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-4">
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {cats.map((c) => (
            <button key={c} onClick={() => setActiveCat(c)}
              className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                c === current ? "gradient-brand text-primary-foreground border-transparent" : "hover:border-primary")}>
              {c}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {menu.filter((m) => m.category === current && m.available).map((m) => (
            <Card key={m.id} className="flex items-center justify-between rounded-2xl p-3">
              <div className="min-w-0">
                {m.image && <img src={m.image} alt="" className="mb-2 h-20 w-full rounded-lg object-cover" />}
                <p className="font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{fmt(m.price)}</p>
              </div>
              <Button size="sm" className="ml-2 rounded-full gradient-brand text-primary-foreground" onClick={() => addToCart(m)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur">
          <div className="mx-auto max-w-3xl p-4">
            <div className="mb-3 max-h-40 space-y-1 overflow-y-auto">
              {cart.map((i) => (
                <div key={i.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-2 text-sm">
                  <span className="truncate">{i.name}</span>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => bump(i.id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-5 text-center">{i.qty}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => bump(i.id, +1)}><Plus className="h-3 w-3" /></Button>
                    <span className="ml-2 w-14 text-right font-semibold">{fmt(i.price * i.qty)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total {profile.gstEnabled && `(incl. GST)`}</p>
                <p className="font-display text-xl font-semibold">{fmt(totals.total)}</p>
              </div>
              <Button size="lg" className="rounded-full gradient-brand text-primary-foreground" onClick={() => setDetailsOpen(true)}>
                <ShoppingBag className="mr-1.5 h-4 w-4" /> Place order
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Complete your order</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">We use your phone to recognize you next time. Visit count updates only after you pay.</p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Phone number *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9876543210" inputMode="tel" />
            </div>
            {foundPreview ? (
              <div className="rounded-lg bg-primary/5 p-3 text-sm">Welcome back, <strong>{foundPreview.name}</strong> — we'll attach this order to your profile.</div>
            ) : phone.trim().length >= 6 ? (
              <div className="grid gap-2">
                <div><Label className="text-xs">Full name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Birthday</Label><Input type="date" value={bday} onChange={(e) => setBday(e.target.value)} /></div>
                  <div><Label className="text-xs">Anniversary</Label><Input type="date" value={anni} onChange={(e) => setAnni(e.target.value)} /></div>
                </div>
                <div>
                  <Label className="text-xs">Gender</Label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                    <option value="">Prefer not to say</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
            ) : null}
            <Button className="w-full rounded-full gradient-brand text-primary-foreground" onClick={submitDetails}>
              <Check className="mr-1.5 h-4 w-4" /> Submit order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}