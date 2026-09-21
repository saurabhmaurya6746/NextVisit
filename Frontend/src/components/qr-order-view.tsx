import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Minus, ShoppingBag, Check, Utensils, User, Sparkles, Loader2, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listMenuCategoriesApi } from "@/lib/menu-api";
import {
  getTablesMapApi,
  createOrderApi,
  getCustomerByPhoneApi,
  type OrderItemCreatePayload,
} from "@/lib/orders-api";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";

interface CartItem {
  menu_item_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  tax_rate: number;
  discount: number;
}

export function QrOrderView({ table }: { table: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // ---------------------------------------------------------------------------
  // Data Fetching via React Query
  // ---------------------------------------------------------------------------
  const { data: menuCategories = [], isLoading: loadingMenu } = useQuery({
    queryKey: ["menu", "categories"],
    queryFn: listMenuCategoriesApi,
  });

  const { data: diningAreas = [] } = useQuery({
    queryKey: ["tables", "map"],
    queryFn: getTablesMapApi,
  });

  // Resolve table name/ID
  const rawDecoded = decodeURIComponent(table);
  const matchedTable = useMemo(() => {
    for (const area of diningAreas) {
      for (const t of area.tables) {
        if (
          t.table_name.toLowerCase() === rawDecoded.toLowerCase() ||
          t.id === rawDecoded
        ) {
          return t;
        }
      }
    }
    return null;
  }, [diningAreas, rawDecoded]);

  const displayTableName = matchedTable ? matchedTable.table_name : rawDecoded;
  const tableId = matchedTable ? matchedTable.id : rawDecoded;

  // Local states
  const [activeCatId, setActiveCatId] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Customer Details Form State
  const [custMode, setCustMode] = useState<"existing" | "new" | "guest">("existing");
  const [phone, setPhone] = useState("");
  const [foundCustomer, setFoundCustomer] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [searchingPhone, setSearchingPhone] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bday, setBday] = useState("");
  const [anni, setAnni] = useState("");
  const [notes, setNotes] = useState("");

  const [placedOrder, setPlacedOrder] = useState<{
    orderNumber: string;
    totalAmount: number;
    prepMins: number;
    customerName: string;
  } | null>(null);

  const currentCatId = activeCatId || menuCategories[0]?.id || "";
  const currentCatItems = useMemo(() => {
    const cat = menuCategories.find((c) => c.id === currentCatId);
    return cat ? cat.items.filter((i) => i.is_available) : [];
  }, [menuCategories, currentCatId]);

  const totalAmount = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  function addToCart(m: { id: string; name: string; price: number; gst_percentage?: number }) {
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.menu_item_id === m.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          menu_item_id: m.id,
          item_name: m.name,
          unit_price: m.price,
          quantity: 1,
          tax_rate: m.gst_percentage || 0,
          discount: 0,
        },
      ];
    });
  }

  function bumpQty(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev.flatMap((i) =>
        i.menu_item_id === menuItemId
          ? i.quantity + delta <= 0
            ? []
            : [{ ...i, quantity: i.quantity + delta }]
          : [i]
      )
    );
  }

  // Handle phone search for existing customer
  async function handlePhoneSearch() {
    if (!phone.trim()) return;
    setSearchingPhone(true);
    try {
      const cust = await getCustomerByPhoneApi(phone.trim());
      if (cust) {
        setFoundCustomer(cust);
        toast.success(`Welcome back, ${cust.name}!`);
      } else {
        setFoundCustomer(null);
        toast.info("No existing profile found with this phone. Switch to 'New Customer'.");
      }
    } catch {
      setFoundCustomer(null);
    } finally {
      setSearchingPhone(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Place Order Mutation
  // ---------------------------------------------------------------------------
  const createOrderMut = useMutation({
    mutationFn: createOrderApi,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["tables", "map"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["customers"] });

      const prepMins = 10 + Math.min(20, cart.reduce((s, i) => s + i.quantity, 0) * 2);
      const custDisplayName =
        custMode === "existing" && foundCustomer
          ? foundCustomer.name
          : custMode === "new" && name.trim()
          ? name.trim()
          : "Guest";

      setDetailsOpen(false);
      setPlacedOrder({
        orderNumber: res.order_number,
        totalAmount: res.total_amount,
        prepMins,
        customerName: custDisplayName,
      });
      toast.success("Order placed — the kitchen has received it!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to place order.");
    },
  });

  function handleSubmitOrder() {
    if (cart.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }

    const itemsPayload: OrderItemCreatePayload[] = cart.map((i) => ({
      menu_item_id: i.menu_item_id,
      item_name: i.item_name,
      unit_price: i.unit_price,
      quantity: i.quantity,
      tax_rate: i.tax_rate,
      discount: i.discount,
    }));

    let customer_id: string | null = null;
    let customer_details = null;

    if (custMode === "existing") {
      if (foundCustomer) {
        customer_id = foundCustomer.id;
      } else if (phone.trim()) {
        toast.error("Please search and select your phone profile, or switch to New / Guest.");
        return;
      }
    } else if (custMode === "new") {
      if (!name.trim() || !phone.trim()) {
        toast.error("Name and Phone number are required.");
        return;
      }
      customer_details = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        birth_date: bday || null,
        anniversary_date: anni || null,
        notes: notes.trim() || null,
      };
    }

    createOrderMut.mutate({
      table_id: tableId,
      customer_id,
      customer_details,
      order_source: "QR",
      items: itemsPayload,
    });
  }

  // ---------------------------------------------------------------------------
  // RENDER SUCCESS RECEIPT SCREEN
  // ---------------------------------------------------------------------------
  if (placedOrder) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md p-6 text-center">
          <div className="mx-auto mt-10 grid h-16 w-16 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-glow">
            <Check className="h-8 w-8" />
          </div>
          <p className="mt-4 font-display text-2xl font-semibold">Order Received 🎉</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thanks {placedOrder.customerName.split(" ")[0]} — Table {displayTableName}
          </p>

          <div className="mx-auto mt-5 grid gap-2">
            <Card className="rounded-2xl p-4 text-left">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Order Number</span>
                <span className="font-mono font-semibold">{placedOrder.orderNumber}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estimated Prep Time</span>
                <span className="font-semibold">~ {placedOrder.prepMins} min</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Order Total</span>
                <span className="font-semibold">{fmt(placedOrder.totalAmount)}</span>
              </div>
            </Card>
          </div>

          <div className="mt-6 grid gap-2">
            <Button
              className="rounded-full gradient-brand text-primary-foreground"
              onClick={() => {
                setCart([]);
                setPlacedOrder(null);
              }}
            >
              Order More Items
            </Button>
            <Button variant="ghost" className="rounded-full" onClick={() => navigate({ to: "/" })}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER QR MENU & CART SCREEN
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="font-display text-lg font-semibold flex items-center gap-1.5">
              <Utensils className="h-4 w-4 text-primary" /> Table {displayTableName}
            </p>
            <p className="text-xs text-muted-foreground">QR Self-Ordering Menu</p>
          </div>
          <Badge className="rounded-full gradient-brand text-primary-foreground">Live Menu</Badge>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-4">
        {loadingMenu ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading menu…
          </div>
        ) : menuCategories.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No menu items available right now.</div>
        ) : (
          <>
            {/* Categories scrollable pill list */}
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {menuCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCatId(c.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                    c.id === currentCatId
                      ? "gradient-brand text-primary-foreground border-transparent shadow-sm"
                      : "hover:border-primary"
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Menu Items Grid */}
            <div className="grid gap-2 sm:grid-cols-2">
              {currentCatItems.map((m) => (
                <Card key={m.id} className="flex items-center justify-between rounded-2xl p-3">
                  <div className="min-w-0 pr-2">
                    <p className="font-medium text-sm">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{fmt(m.price)}</p>
                  </div>
                  <Button
                    size="sm"
                    className="ml-2 rounded-full gradient-brand text-primary-foreground shrink-0"
                    onClick={() => addToCart(m)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add
                  </Button>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur">
          <div className="mx-auto max-w-3xl p-4">
            <div className="mb-3 max-h-40 space-y-1 overflow-y-auto">
              {cart.map((i) => (
                <div key={i.menu_item_id} className="flex items-center justify-between rounded-lg bg-muted/50 p-2 text-sm">
                  <span className="truncate max-w-[160px]">{i.item_name}</span>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => bumpQty(i.menu_item_id, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-5 text-center">{i.quantity}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => bumpQty(i.menu_item_id, +1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <span className="ml-2 w-14 text-right font-semibold">{fmt(i.unit_price * i.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-display text-xl font-semibold">{fmt(totalAmount)}</p>
              </div>
              <Button
                size="lg"
                className="rounded-full gradient-brand text-primary-foreground"
                onClick={() => setDetailsOpen(true)}
              >
                <ShoppingBag className="mr-1.5 h-4 w-4" /> Continue to Order
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Customer Details
            </DialogTitle>
          </DialogHeader>

          <Tabs value={custMode} onValueChange={(v: any) => setCustMode(v)} className="w-full">
            <TabsList className="grid grid-cols-3 rounded-full mb-3">
              <TabsTrigger value="existing" className="rounded-full text-xs">
                Existing
              </TabsTrigger>
              <TabsTrigger value="new" className="rounded-full text-xs">
                New Customer
              </TabsTrigger>
              <TabsTrigger value="guest" className="rounded-full text-xs">
                Guest
              </TabsTrigger>
            </TabsList>

            {/* Existing Customer Tab */}
            <TabsContent value="existing" className="space-y-3">
              <div>
                <Label className="text-xs">Phone Number *</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="Enter 10-digit phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={handlePhoneSearch}
                    disabled={searchingPhone}
                  >
                    {searchingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {foundCustomer && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{foundCustomer.name}</p>
                    <p className="text-muted-foreground">{foundCustomer.phone}</p>
                  </div>
                  <span className="rounded-full bg-primary/20 text-primary px-2.5 py-0.5 text-[10px] font-semibold">
                    Attached
                  </span>
                </div>
              )}
            </TabsContent>

            {/* New Customer Tab */}
            <TabsContent value="new" className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Full Name *</Label>
                  <Input placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Phone Number *</Label>
                  <Input placeholder="9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Email (optional)</Label>
                <Input type="email" placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Date of Birth</Label>
                  <Input type="date" value={bday} onChange={(e) => setBday(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Anniversary</Label>
                  <Input type="date" value={anni} onChange={(e) => setAnni(e.target.value)} />
                </div>
              </div>
            </TabsContent>

            {/* Guest Tab */}
            <TabsContent value="guest" className="py-3 text-center text-xs text-muted-foreground">
              Order will be placed without attaching customer information.
            </TabsContent>
          </Tabs>

          <Button
            className="w-full rounded-full gradient-brand text-primary-foreground mt-3"
            onClick={handleSubmitOrder}
            disabled={createOrderMut.isPending}
          >
            {createOrderMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="mr-1.5 h-4 w-4" /> Place Order ({fmt(totalAmount)})
              </>
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}