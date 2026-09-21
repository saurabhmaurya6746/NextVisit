import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, ShoppingBag, Check, ArrowLeft, User, Search, UserPlus, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listMenuCategoriesApi } from "@/lib/menu-api";
import { getTablesMapApi, createOrderApi, getCustomerByPhoneApi, type OrderItemCreatePayload } from "@/lib/orders-api";
import { toast } from "sonner";
import { fmt } from "@/lib/currency";
import { pushNotification } from "@/lib/notifications-store";

interface CartItem {
  menu_item_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  tax_rate: number;
  discount: number;
  notes?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetTable?: string;
  presetTableId?: string;
}

export function NewOrderDialog({ open, onOpenChange, presetTable, presetTableId }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(presetTable ? 1 : 0);
  const [selectedTableId, setSelectedTableId] = useState<string>(presetTableId || "");
  const [selectedTableName, setSelectedTableName] = useState<string>(presetTable || "");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCatId, setActiveCatId] = useState<string>("");
  const [mobileCartExpanded, setMobileCartExpanded] = useState(false);

  // Customer Details State (Step 2)
  const [custMode, setCustMode] = useState<"existing" | "new" | "guest">("existing");
  const [searchPhone, setSearchPhone] = useState("");
  const [foundCustomer, setFoundCustomer] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [searchingPhone, setSearchingPhone] = useState(false);

  // New Customer form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newBday, setNewBday] = useState("");
  const [newAnni, setNewAnni] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  // ---------------------------------------------------------------------------
  // Data Fetching via React Query
  // ---------------------------------------------------------------------------
  const { data: menuCategories = [] } = useQuery({
    queryKey: ["menu", "categories"],
    queryFn: listMenuCategoriesApi,
    enabled: open,
  });

  const { data: diningAreas = [] } = useQuery({
    queryKey: ["tables", "map"],
    queryFn: getTablesMapApi,
    enabled: open,
  });

  const allTables = useMemo(() => {
    return diningAreas.flatMap((area) => area.tables);
  }, [diningAreas]);

  useEffect(() => {
    if (open) {
      if (presetTableId) {
        setSelectedTableId(presetTableId);
        setSelectedTableName(presetTable || "");
        setStep(1);
      } else if (presetTable) {
        const match = allTables.find(
          (t) => t.table_name.toLowerCase() === presetTable.toLowerCase() || t.id === presetTable
        );
        if (match) {
          setSelectedTableId(match.id);
          setSelectedTableName(match.table_name);
          setStep(1);
        }
      }
    }
  }, [open, presetTable, presetTableId, allTables]);

  const currentCatId = activeCatId || menuCategories[0]?.id || "";
  const currentCatItems = useMemo(() => {
    const cat = menuCategories.find((c) => c.id === currentCatId);
    return cat ? cat.items.filter((i) => i.is_available) : [];
  }, [menuCategories, currentCatId]);

  // Cart calculations
  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const taxTotal = cart.reduce((s, i) => s + (i.unit_price * i.quantity * (i.tax_rate / 100)), 0);
  const total = subtotal + taxTotal;
  const totalItemsCount = cart.reduce((s, i) => s + i.quantity, 0);

  function reset() {
    setStep(presetTable ? 1 : 0);
    setSelectedTableId(presetTableId || "");
    setSelectedTableName(presetTable || "");
    setCart([]);
    setActiveCatId("");
    setMobileCartExpanded(false);
    setCustMode("existing");
    setSearchPhone("");
    setFoundCustomer(null);
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setNewBday("");
    setNewAnni("");
    setNewNotes("");
    setOrderNotes("");
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  function addToCart(item: { id: string; name: string; price: number; gst_percentage?: number }) {
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.menu_item_id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          item_name: item.name,
          unit_price: item.price,
          quantity: 1,
          tax_rate: item.gst_percentage || 0,
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

  function pickTable(tId: string, tName: string) {
    setSelectedTableId(tId);
    setSelectedTableName(tName);
    setStep(1);
  }

  useEffect(() => {
    const clean = searchPhone.replace(/\D/g, "");
    if (clean.length < 10) {
      setFoundCustomer(null);
    }
  }, [searchPhone]);

  // Handle phone search
  async function handlePhoneSearch() {
    const cleanPhone = searchPhone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    setSearchingPhone(true);
    try {
      const cust = await getCustomerByPhoneApi(cleanPhone);
      if (cust) {
        setFoundCustomer(cust);
        toast.success(`Found customer: ${cust.name}`);
      } else {
        setFoundCustomer(null);
        toast.info("No existing customer found with this 10-digit phone number. Switch to 'New Customer' to register.");
      }
    } catch {
      setFoundCustomer(null);
      toast.info("No existing customer found.");
    } finally {
      setSearchingPhone(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Place Order Mutation
  // ---------------------------------------------------------------------------
  const placeOrderMut = useMutation({
    mutationFn: createOrderApi,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["tables", "map"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });

      // ─── Fire notification + sound via existing notification store ───
      const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
      pushNotification({
        type: "staff_order",
        title: "🛍️ New Staff Order",
        body: [
          `Table: ${selectedTableName || "Unknown"}`,
          `Order: ${res.order_number}`,
          `Amount: ₹${res.total_amount.toFixed(2)}`,
          `Time: ${time}`,
        ].join(" · "),
        orderId: res.id,
        table: selectedTableName || "",
      });
      // ─────────────────────────────────────────────────────────────────

      toast.success(`Order ${res.order_number} created successfully!`);
      close();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to place order.");
    },
  });

  function handlePlaceOrder() {
    if (!selectedTableId) {
      toast.error("Please select a table.");
      return;
    }
    if (cart.length === 0) {
      toast.error("Cart is empty.");
      return;
    }

    const itemsPayload: OrderItemCreatePayload[] = cart.map((i) => ({
      menu_item_id: i.menu_item_id,
      item_name: i.item_name,
      unit_price: i.unit_price,
      quantity: i.quantity,
      tax_rate: i.tax_rate,
      discount: i.discount,
      notes: i.notes || undefined,
    }));

    let customer_id: string | null = null;
    let customer_details = null;

    if (custMode === "existing") {
      if (foundCustomer) {
        customer_id = foundCustomer.id;
      } else if (searchPhone.trim()) {
        // Fallback search inline
        toast.error("Please search and select an existing customer, or select New/Guest.");
        return;
      }
    } else if (custMode === "new") {
      if (!newName.trim() || !newPhone.trim()) {
        toast.error("Name and Phone are required for new customer.");
        return;
      }
      customer_details = {
        name: newName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || null,
        birth_date: newBday || null,
        anniversary_date: newAnni || null,
        notes: newNotes.trim() || null,
      };
    } // Guest: customer_id = null, customer_details = null

    placeOrderMut.mutate({
      table_id: selectedTableId,
      customer_id,
      customer_details,
      order_source: "POS",
      notes: orderNotes.trim() || null,
      items: itemsPayload,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-full h-[90dvh] max-h-[90dvh] sm:h-auto sm:max-h-[85vh] rounded-2xl flex flex-col p-3 sm:p-6 overflow-hidden gap-0">
        <DialogHeader className="shrink-0 pb-2 border-b border-border/40">
          <DialogTitle className="font-display flex items-center gap-2 text-base sm:text-lg">
            <ShoppingBag className="h-5 w-5 text-primary shrink-0" />
            <span>New staff order</span>
            {selectedTableName && (
              <span className="ml-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {selectedTableName}
              </span>
            )}
          </DialogTitle>
          <p className="pt-0.5 text-xs text-muted-foreground">
            {step === 0 ? "Step 1 of 2 · Select a table" : `Step 2 of 2 · Add items & place order for ${selectedTableName}`}
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col pt-2 h-full">
          <AnimatePresence mode="wait">
            {/* STEP 0: SELECT TABLE */}
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1 min-h-0 overflow-y-auto">
                <p className="mb-3 text-xs sm:text-sm text-muted-foreground">
                  Tap a table to start a staff temporary order. Customer details are collected at payment.
                </p>
                {allTables.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No tables configured. Please add tables in Table Setup.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 pb-4">
                    {allTables.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => pickTable(t.id, t.table_name)}
                        className={cn(
                          "rounded-xl border px-3 py-3.5 text-sm font-medium transition-all text-left min-h-[44px]",
                          selectedTableId === t.id
                            ? "gradient-brand text-primary-foreground shadow-elegant"
                            : t.status === "OCCUPIED"
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                            : "hover:-translate-y-0.5 hover:border-primary"
                        )}
                      >
                        <div className="font-semibold text-xs sm:text-sm">{t.table_name}</div>
                        <div className="text-[10px] opacity-80 mt-0.5">
                          {t.status === "OCCUPIED" ? "Occupied" : `Cap: ${t.capacity}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 1: MENU & CART (PLACE ORDER DIRECTLY) */}
            {step === 1 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-h-0 h-full flex flex-col md:grid md:grid-cols-[140px_1fr_260px] gap-2 md:gap-3 overflow-hidden"
              >
                {/* CATEGORIES: MOBILE HORIZONTAL SCROLL CHIPS */}
                <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-2 shrink-0 scrollbar-none snap-x">
                  {menuCategories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveCatId(c.id)}
                      className={cn(
                        "rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all shrink-0 min-h-[36px] flex items-center gap-1.5 snap-start",
                        c.id === currentCatId
                          ? "gradient-brand text-primary-foreground shadow-sm"
                          : "bg-muted/70 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                {/* CATEGORIES: DESKTOP VERTICAL SIDEBAR */}
                <div className="hidden md:flex md:flex-col space-y-1 overflow-y-auto max-h-[420px] pr-1 shrink-0">
                  {menuCategories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveCatId(c.id)}
                      className={cn(
                        "w-full rounded-xl px-3 py-2 text-left text-sm transition-all min-h-[40px] flex items-center justify-between",
                        c.id === currentCatId
                          ? "gradient-brand text-primary-foreground shadow-elegant"
                          : "hover:bg-muted"
                      )}
                    >
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>

                {/* MENU ITEMS GRID (PRIMARY VERTICAL SCROLL REGION) */}
                <div className="flex-1 min-h-0 h-full overflow-y-auto pr-1 text-left scroll-smooth">
                  {currentCatItems.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center">
                      <p>No available items in this category.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2 pb-4">
                      {currentCatItems.map((m) => {
                        const inCartItem = cart.find((i) => i.menu_item_id === m.id);
                        return (
                          <div
                            key={m.id}
                            className={cn(
                              "group rounded-xl border p-3 text-left transition-all flex flex-col justify-between bg-card",
                              inCartItem ? "border-primary/50 bg-primary/5" : "hover:border-primary/40"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium text-xs sm:text-sm text-foreground line-clamp-1">{m.name}</p>
                                </div>
                                {m.description && (
                                  <p className="text-[11px] text-muted-foreground line-clamp-1">{m.description}</p>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between pt-1 border-t border-border/40">
                              <span className="text-xs sm:text-sm font-semibold">{fmt(m.price)}</span>

                              {inCartItem ? (
                                <div className="flex items-center gap-1 bg-background rounded-lg border px-1 py-0.5">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    onClick={() => bumpQty(m.id, -1)}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-5 text-center text-xs font-semibold">{inCartItem.quantity}</span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    onClick={() => bumpQty(m.id, +1)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addToCart(m)}
                                  className="h-7 text-xs rounded-lg px-2.5 hover:bg-primary hover:text-primary-foreground font-medium"
                                >
                                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* DESKTOP CART DRAWER (HIDDEN ON MOBILE) */}
                <div className="hidden md:flex rounded-xl border p-3 flex-col justify-between max-h-[420px] shrink-0">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Cart · {selectedTableName}
                    </p>
                    {cart.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Tap items to add to order.</p>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {cart.map((i) => (
                          <div key={i.menu_item_id} className="rounded-lg bg-muted/40 p-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium truncate max-w-[120px]">{i.item_name}</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => bumpQty(i.menu_item_id, -1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-4 text-center text-xs">{i.quantity}</span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => bumpQty(i.menu_item_id, +1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>
                                {fmt(i.unit_price)} × {i.quantity}
                              </span>
                              <span className="font-semibold text-foreground">
                                {fmt(i.unit_price * i.quantity)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 border-t pt-2 space-y-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Kitchen Notes</Label>
                      <Textarea
                        placeholder="e.g. Extra spicy..."
                        rows={1}
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        className="text-xs resize-none rounded-lg h-7 min-h-0 py-1"
                      />
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{fmt(subtotal)}</span>
                      </div>
                      {taxTotal > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Estimated Tax</span>
                          <span>{fmt(taxTotal)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t pt-1 text-sm">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-display text-base font-semibold">{fmt(total)}</span>
                      </div>
                    </div>

                    <Button
                      className="w-full rounded-full gradient-brand text-primary-foreground"
                      disabled={cart.length === 0 || placeOrderMut.isPending}
                      onClick={handlePlaceOrder}
                    >
                      {placeOrderMut.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="mr-1.5 h-4 w-4" /> Place Order
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* MOBILE STICKY CART FOOTER (ACCESSIBLE AT ALL TIMES) */}
                <div className="shrink-0 md:hidden border-t pt-2 bg-card space-y-2">
                  {mobileCartExpanded && cart.length > 0 && (
                    <div className="space-y-2 max-h-[160px] overflow-y-auto p-2 bg-muted/30 rounded-xl border mb-2">
                      <div className="flex items-center justify-between border-b pb-1">
                        <span className="text-xs font-semibold">Cart Items ({totalItemsCount})</span>
                        <span className="text-xs text-muted-foreground">{selectedTableName}</span>
                      </div>
                      {cart.map((i) => (
                        <div key={i.menu_item_id} className="flex items-center justify-between text-xs py-1">
                          <span className="font-medium truncate max-w-[140px]">{i.item_name}</span>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => bumpQty(i.menu_item_id, -1)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-4 text-center font-semibold">{i.quantity}</span>
                              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => bumpQty(i.menu_item_id, +1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <span className="font-semibold text-foreground w-12 text-right">{fmt(i.unit_price * i.quantity)}</span>
                          </div>
                        </div>
                      ))}
                      <div className="pt-1">
                        <Input
                          placeholder="Kitchen notes"
                          value={orderNotes}
                          onChange={(e) => setOrderNotes(e.target.value)}
                          className="text-xs h-7 rounded-lg"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setMobileCartExpanded(!mobileCartExpanded)}
                      disabled={cart.length === 0}
                      className="flex items-center gap-2 text-left flex-1 px-1 disabled:opacity-50"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span>Cart · {selectedTableName}</span>
                          {totalItemsCount > 0 && (
                            <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[10px]">
                              {totalItemsCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Total: <strong className="text-foreground">{fmt(total)}</strong>
                        </p>
                      </div>
                      {cart.length > 0 && (
                        mobileCartExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" /> : <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />
                      )}
                    </button>

                    <Button
                      size="sm"
                      className="rounded-full gradient-brand text-primary-foreground px-4 h-10 font-semibold shadow-md shrink-0 text-xs"
                      disabled={cart.length === 0 || placeOrderMut.isPending}
                      onClick={handlePlaceOrder}
                    >
                      {placeOrderMut.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="mr-1 h-4 w-4" /> Place Order ({fmt(total)})
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}