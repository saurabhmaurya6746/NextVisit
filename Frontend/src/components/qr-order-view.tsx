import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Minus,
  ShoppingBag,
  Check,
  Utensils,
  User,
  Sparkles,
  Loader2,
  Search,
  Phone,
  MapPin,
  Clock,
  Flame,
  X,
  UtensilsCrossed,
  Heart,
  ChevronRight,
  ChevronLeft,
  Info,
  ExternalLink,
  Crown,
  Gift,
  ShieldCheck,
  FileText,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listMenuCategoriesApi, type BackendMenuItem } from "@/lib/menu-api";
import {
  getTablesMapApi,
  createOrderApi,
  autoDetectCustomerApi,
  addOrderItemApi,
  getOrderByIdApi,
  getPublicQrBootstrapApi,
  type OrderItemCreatePayload,
  type CustomerAutoDetectResult,
  type BackendOrder,
} from "@/lib/orders-api";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";
import { getSession } from "@/lib/auth";
import { pushQrNotification } from "@/lib/notifications-store";

interface CartItem {
  menu_item_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  tax_rate: number;
  discount: number;
}

/**
 * Helper to dynamically calculate if restaurant is open now based on backend time strings.
 */
function isRestaurantOpenNow(openingTimeStr?: string | null, closingTimeStr?: string | null): boolean {
  if (!openingTimeStr || !closingTimeStr) return true;

  const parseTimeToMinutes = (str: string): number | null => {
    try {
      const match = str.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (!match) return null;
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const period = match[3]?.toUpperCase();

      if (period === "PM" && hours < 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;
      return hours * 60 + minutes;
    } catch {
      return null;
    }
  };

  const openMinutes = parseTimeToMinutes(openingTimeStr);
  const closeMinutes = parseTimeToMinutes(closingTimeStr);

  if (openMinutes === null || closeMinutes === null) return true;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (closeMinutes > openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  } else {
    return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
  }
}

export function QrOrderView({ table, business }: { table: string; business?: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // ---------------------------------------------------------------------------
  // Visit Token & Session Storage Setup
  // ---------------------------------------------------------------------------
  const [storedVisitToken, setStoredVisitToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(`nextvisit:vt:${table}`) || localStorage.getItem(`nextvisit:vt:${table}`) || null;
  });

  // ---------------------------------------------------------------------------
  // Data Fetching via React Query (100% Data-Isolated per URL)
  // ---------------------------------------------------------------------------
  const {
    data: qrBootstrap,
    isLoading: loadingTables,
    isError: qrError,
    error: qrErrorObj,
  } = useQuery({
    queryKey: ["qr", "bootstrap", business, table, storedVisitToken],
    queryFn: () => getPublicQrBootstrapApi(table, business, storedVisitToken),
    refetchInterval: 10000,
    staleTime: 0,
  });

  // Auto-clear stored visit token if server marks session as expired or inactive
  useEffect(() => {
    if (qrBootstrap?.session?.session_expired || (qrBootstrap?.session && !qrBootstrap.session.is_active)) {
      try {
        sessionStorage.removeItem(`nextvisit:vt:${table}`);
        sessionStorage.removeItem(`nextvisit:order_id:${table}`);
        sessionStorage.removeItem(`nextvisit:visit_id:${table}`);
        sessionStorage.removeItem(`nextvisit:customer_id:${table}`);
        localStorage.removeItem(`nextvisit:vt:${table}`);
        localStorage.removeItem(`nextvisit:order_id:${table}`);
      } catch {}
      setStoredVisitToken(null);
      setCreatedOrderId(null);
    }
  }, [qrBootstrap?.session?.session_expired, qrBootstrap?.session?.is_active, table]);

  const bizProfile = qrBootstrap?.business || null;
  const tableData = qrBootstrap?.table || null;
  const sessionData = qrBootstrap?.session || null;
  const diningAreas = qrBootstrap?.dining_areas || [];
  const menuCategories = qrBootstrap?.categories || [];

  const restaurantName = bizProfile?.name || "Restaurant Menu";
  const phoneContact = bizProfile?.phone || null;
  const addressFormatted = bizProfile?.address || null;
  const openingTime = bizProfile?.opening_time || null;
  const closingTime = bizProfile?.closing_time || null;
  const logoUrl = bizProfile?.logo_url || null;
  const coverImageUrl = bizProfile?.cover_image || null;
  const mapsUrl = bizProfile?.review_link || bizProfile?.booking_link || null;
  const taxPercentage = bizProfile?.tax_percentage ?? 0;

  const isOpenNow = isRestaurantOpenNow(openingTime, closingTime);

  const displayTableName = tableData?.table_name || decodeURIComponent(table);
  const areaName = tableData?.dining_area_name || null;
  const tableId = tableData?.id || table;

  const [createdOrderId, setCreatedOrderId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(`nextvisit:order_id:${table}`) || null;
  });

  // Active Table & Visit Session Resolution
  const activeOrderId =
    tableData?.status === "OCCUPIED" && tableData?.current_order_id
      ? tableData.current_order_id
      : createdOrderId;

  const { data: activeOrder } = useQuery({
    queryKey: ["order", activeOrderId],
    queryFn: () => getOrderByIdApi(activeOrderId!),
    enabled: !!activeOrderId,
    refetchInterval: 10000,
  });

  // Formatted Hierarchy: e.g., "Main Hall · Table 1"
  const tableHierarchyLabel = areaName ? `${areaName} · ${displayTableName}` : `Table ${displayTableName}`;

  // Local UI & Search States
  const [activeCatId, setActiveCatId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dietFilter, setDietFilter] = useState<"ALL" | "VEG" | "NONVEG" | "POPULAR">("ALL");

  const [cart, setCart] = useState<CartItem[]>([]);

  // Multi-Step Checkout Modal State
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"REVIEW" | "PHONE" | "CONFIRM">("REVIEW");
  const [custType, setCustType] = useState<"EXISTING" | "NEW" | "GUEST">("GUEST");

  const [phone, setPhone] = useState("");
  const [searchingPhone, setSearchingPhone] = useState(false);
  const [autoDetectData, setAutoDetectData] = useState<CustomerAutoDetectResult | null>(null);

  // New Customer Details Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bday, setBday] = useState("");
  const [anni, setAnni] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  const [placedOrder, setPlacedOrder] = useState<{
    orderNumber: string;
    totalAmount: number;
    prepMins: number;
    customerName: string;
    isAddOn?: boolean;
  } | null>(null);

  // Filtered Menu Items Logic
  const allAvailableItems = useMemo(() => {
    const itemsList: (BackendMenuItem & { categoryName: string })[] = [];
    menuCategories.forEach((cat) => {
      cat.items.forEach((item) => {
        if (item.is_available) {
          itemsList.push({ ...item, categoryName: cat.name });
        }
      });
    });
    return itemsList;
  }, [menuCategories]);

  // Dynamic filter detection based on actual loaded items
  const hasVegDishes = useMemo(() => allAvailableItems.some((i) => i.is_veg === true), [allAvailableItems]);
  const hasNonVegDishes = useMemo(() => allAvailableItems.some((i) => i.is_veg === false), [allAvailableItems]);
  const hasPopularDishes = useMemo(
    () => allAvailableItems.some((i) => (i as any).is_popular || i.price >= 250),
    [allAvailableItems]
  );

  const filteredItems = useMemo(() => {
    return allAvailableItems.filter((item) => {
      if (activeCatId !== "ALL" && item.category_id !== activeCatId) {
        return false;
      }
      if (dietFilter === "VEG" && !item.is_veg) return false;
      if (dietFilter === "NONVEG" && item.is_veg) return false;
      if (dietFilter === "POPULAR" && item.price < 250 && !(item as any).is_popular) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchDesc = item.description ? item.description.toLowerCase().includes(q) : false;
        const matchCat = item.categoryName.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchCat) return false;
      }

      return true;
    });
  }, [allAvailableItems, activeCatId, dietFilter, searchQuery]);

  // Financial Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const taxAmount = (subtotal * taxPercentage) / 100;
  const totalAmount = subtotal + taxAmount;
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function getCartQty(menuItemId: string): number {
    const item = cart.find((i) => i.menu_item_id === menuItemId);
    return item ? item.quantity : 0;
  }

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
    toast.success(`${m.name} added to order`, {
      description: fmt(m.price),
      icon: "🍽️",
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

  // ---------------------------------------------------------------------------
  // Customer Auto-Detection & Identification Workflow
  // ---------------------------------------------------------------------------
  async function handleDetectCustomer(inputPhone?: string) {
    const targetPhone = (inputPhone || phone).trim();
    const cleanPhone = targetPhone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    setSearchingPhone(true);
    try {
      const res = await autoDetectCustomerApi(targetPhone, totalAmount);
      setAutoDetectData(res);

      if (res.exists && res.customer_id) {
        setCustType("EXISTING");
        toast.success(`Welcome back, ${res.name || "Customer"}!`);
      } else {
        setCustType("NEW");
        toast.info("New phone number detected. Please complete registration to earn points.");
      }
      setCheckoutStep("CONFIRM");
    } catch (err: any) {
      console.error("[QR ORDER] Auto-detect error:", err);
      toast.error("Could not verify phone number. You may continue as Guest.");
    } finally {
      setSearchingPhone(false);
    }
  }

  function handleContinueAsGuest() {
    setCustType("GUEST");
    setAutoDetectData(null);
    setCheckoutStep("CONFIRM");
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
      qc.invalidateQueries({ queryKey: ["dashboard"] });

      const prepMins = 10 + Math.min(20, cart.reduce((s, i) => s + i.quantity, 0) * 2);
      const custDisplayName =
        custType === "EXISTING" && autoDetectData?.name
          ? autoDetectData.name
          : custType === "NEW" && name.trim()
          ? name.trim()
          : "Guest";

      // ─── Fire notification + sound via existing notification store ───
      const tableName = tableHierarchyLabel;
      pushQrNotification({
        orderId: res.id,
        table: tableName,
        customerName: custDisplayName !== "Guest" ? custDisplayName : undefined,
        items: res.items.reduce((s, i) => s + i.quantity, 0),
        total: res.total_amount,
        orderNumber: res.order_number,
      });
      // ─────────────────────────────────────────────────────────────────

      if (res.id) {
        try {
          sessionStorage.setItem(`nextvisit:order_id:${table}`, res.id);
          setCreatedOrderId(res.id);
        } catch {}
      }
      if (res.visit_token) {
        try {
          sessionStorage.setItem(`nextvisit:vt:${table}`, res.visit_token);
          setStoredVisitToken(res.visit_token);
        } catch {}
      }

      qc.invalidateQueries({ queryKey: ["qr", "bootstrap"] });

      setDetailsOpen(false);
      setCart([]);
      setPlacedOrder({
        orderNumber: res.order_number,
        totalAmount: res.total_amount,
        prepMins,
        customerName: custDisplayName,
      });
      toast.success("Order placed — the kitchen has received it!", {
        icon: "🎉",
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to place order.");
    },
  });

  // ---------------------------------------------------------------------------
  // Append Items Mutation (Repeat Ordering on Active Visit)
  // ---------------------------------------------------------------------------
  const appendItemsMut = useMutation({
    mutationFn: async (itemsPayload: OrderItemCreatePayload[]) => {
      if (!activeOrderId) throw new Error("Active order not found.");
      let latestOrder: BackendOrder | null = null;
      for (const item of itemsPayload) {
        latestOrder = await addOrderItemApi(activeOrderId, item);
      }
      return latestOrder!;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["tables", "map"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", activeOrderId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });

      const addedCount = cart.reduce((s, i) => s + i.quantity, 0);
      const custDisplayName =
        custType === "EXISTING" && autoDetectData?.name
          ? autoDetectData.name
          : custType === "NEW" && name.trim()
          ? name.trim()
          : "Customer";

      const tableName = tableHierarchyLabel;

      pushQrNotification({
        orderId: res.id,
        table: tableName,
        customerName: custDisplayName !== "Guest" ? custDisplayName : undefined,
        items: addedCount,
        total: res.total_amount,
        orderNumber: res.order_number,
      });

      setDetailsOpen(false);
      setCart([]);
      setPlacedOrder({
        orderNumber: res.order_number,
        totalAmount: res.total_amount,
        prepMins: 10 + Math.min(20, addedCount * 2),
        customerName: custDisplayName,
        isAddOn: true,
      });
      toast.success("Additional items sent to kitchen!", { icon: "🍳" });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to add items to order.");
    },
  });

  // UUID v4 format validation helper
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function handleSubmitOrder() {
    if (cart.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }

    // Guard: tableId must be a valid database UUID.
    // If diningAreas hasn't loaded yet, tableId is still the raw URL slug.
    if (!UUID_REGEX.test(tableId)) {
      toast.error(
        loadingTables
          ? "Table data is still loading. Please wait a moment."
          : "Could not resolve table. Please scan the QR code again."
      );
      return;
    }

    const itemsPayload: OrderItemCreatePayload[] = cart.map((i) => ({
      menu_item_id: i.menu_item_id,
      item_name: i.item_name,
      unit_price: i.unit_price,
      quantity: i.quantity,
      tax_rate: i.tax_rate,
      discount: i.discount,
      notes: orderNotes.trim() || null,
    }));

    // If active order exists on this table, append items to existing visit & order!
    if (activeOrderId) {
      appendItemsMut.mutate(itemsPayload);
      return;
    }

    let customer_id: string | null = null;
    let customer_details = null;

    if (custType === "EXISTING" && autoDetectData?.customer_id) {
      customer_id = autoDetectData.customer_id;
    } else if (custType === "NEW") {
      if (!name.trim() || !phone.trim()) {
        toast.error("Full Name and Phone Number are required.");
        return;
      }
      customer_details = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        birth_date: bday || null,
        anniversary_date: anni || null,
        notes: null,
      };
    }

    createOrderMut.mutate({
      table_id: tableId,
      customer_id,
      customer_details,
      order_source: "QR",
      notes: orderNotes.trim() || null,
      tax_amount: taxAmount,
      items: itemsPayload,
    });
  }

  function openCheckoutModal() {
    setCheckoutStep("REVIEW");
    setDetailsOpen(true);
  }

  // ---------------------------------------------------------------------------
  // RENDER BLOCKED OCCUPIED TABLE SCREEN (NEW SESSION BLOCKED)
  // ---------------------------------------------------------------------------
  if (sessionData?.table_occupied_blocked || (sessionData?.is_active && !sessionData?.token_matches)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-950/20 via-background to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-5 rounded-3xl border-rose-500/30 bg-card/95 shadow-xl backdrop-blur">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20 shadow-inner">
            <Lock className="h-8 w-8" />
          </div>
          <div>
            <Badge className="rounded-full bg-rose-500/20 text-rose-600 border-rose-500/30 px-3 py-1 text-xs font-semibold mb-2">
              Table Occupied
            </Badge>
            <h2 className="font-display text-2xl font-bold text-foreground">Table Currently Occupied</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Table <span className="font-semibold text-foreground">{tableHierarchyLabel}</span> at <span className="font-semibold text-foreground">{restaurantName}</span>
            </p>
          </div>

          <div className="rounded-2xl bg-muted/40 border p-4 text-left text-xs text-muted-foreground space-y-2 leading-relaxed">
            <p className="font-semibold text-foreground">This table already has an active dining session.</p>
            <p>If you are the same customer, please continue using the device where the session was started.</p>
            <p>If the previous guests have already left, please ask the restaurant staff to complete payment and release the table before scanning again.</p>
          </div>

          <div className="space-y-2 pt-1">
            <Button
              className="w-full rounded-full gradient-brand text-primary-foreground font-bold py-5 text-sm shadow-md"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>

            {phoneContact && (
              <Button
                variant="outline"
                asChild
                className="w-full rounded-full text-xs font-semibold h-10 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
              >
                <a href={`tel:${phoneContact}`}>
                  <Phone className="mr-2 h-4 w-4" /> Contact Restaurant Staff ({phoneContact})
                </a>
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER EXPIRED DINING SESSION ALERT SCREEN
  // ---------------------------------------------------------------------------
  if (sessionData?.session_expired) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-950/20 via-background to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-5 rounded-3xl border-amber-500/30 bg-card/95 shadow-xl backdrop-blur">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 shadow-inner">
            <Clock className="h-8 w-8" />
          </div>
          <div>
            <Badge className="rounded-full bg-amber-500/20 text-amber-600 border-amber-500/30 px-3 py-1 text-xs font-semibold mb-2">
              Session Expired
            </Badge>
            <h2 className="font-display text-2xl font-bold text-foreground">Dining Session Ended</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Your previous dining session for {tableHierarchyLabel} at <span className="font-semibold text-foreground">{restaurantName}</span> has been completed and settled.
            </p>
          </div>
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-left text-xs text-amber-700 dark:text-amber-300 space-y-1">
            <p className="font-semibold">🔒 Security Notice:</p>
            <p>Your previous Visit Token has been destroyed. To start a new order, please scan the physical table QR code again.</p>
          </div>
          <Button
            className="w-full rounded-full gradient-brand text-primary-foreground font-bold py-6 text-base shadow-lg shadow-primary/20"
            onClick={() => window.location.reload()}
          >
            Start New Order
          </Button>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER SUCCESS RECEIPT SCREEN
  // ---------------------------------------------------------------------------
  if (placedOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-950/20 via-background to-background flex items-center justify-center p-4">
        <div className="mx-auto max-w-md w-full text-center space-y-6">
          <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-3xl gradient-brand text-primary-foreground shadow-2xl shadow-primary/30">
            <Check className="h-10 w-10 animate-bounce" />
          </div>

          <div>
            <Badge className="rounded-full bg-success/20 text-success border-success/30 px-3 py-1 text-xs font-semibold mb-2">
              {placedOrder.isAddOn ? "Items Added to Order" : "Order Confirmed"}
            </Badge>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {placedOrder.isAddOn ? "Items Sent to Kitchen! 🍳" : "Order Received! 🎉"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Thank you, <span className="font-semibold text-foreground">{placedOrder.customerName.split(" ")[0]}</span> · {tableHierarchyLabel}
            </p>
          </div>

          <Card className="rounded-3xl p-5 text-left shadow-lg border-amber-500/20 bg-card/80 backdrop-blur space-y-3">
            <div className="flex items-center justify-between text-sm border-b pb-2.5">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Utensils className="h-4 w-4 text-primary" /> Order Number
              </span>
              <span className="font-mono font-bold text-base text-primary">{placedOrder.orderNumber}</span>
            </div>
            <div className="flex items-center justify-between text-sm border-b pb-2.5">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-500" /> Estimated Prep Time
              </span>
              <span className="font-semibold text-foreground">~ {placedOrder.prepMins} mins</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Order Total</span>
              <span className="font-display text-xl font-bold text-foreground">{fmt(placedOrder.totalAmount)}</span>
            </div>
          </Card>

          <p className="text-xs text-muted-foreground">
            Our kitchen team is now preparing your delicious food. Please sit back and relax!
          </p>

          <div className="grid gap-2.5 pt-2">
            <Button
              size="lg"
              className="rounded-full gradient-brand text-primary-foreground font-semibold shadow-lg shadow-primary/20"
              onClick={() => {
                setCart([]);
                setPlacedOrder(null);
              }}
            >
              Order More Items
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => navigate({ to: "/" })}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER HERO HEADER & QR MENU
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-background text-foreground pb-36 selection:bg-primary/20">
      {/* HERO SECTION */}
      <section
        className={cn(
          "relative overflow-hidden text-white rounded-b-3xl shadow-2xl border-b border-amber-500/20 px-4 pt-8 pb-10 sm:px-8 bg-cover bg-center",
          coverImageUrl
            ? "bg-stone-900"
            : "bg-gradient-to-br from-amber-950 via-slate-900 to-stone-900"
        )}
        style={coverImageUrl ? { backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.95)), url(${coverImageUrl})` } : undefined}
      >
        <div className="mx-auto max-w-3xl relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Table & Area Hierarchy Badge */}
            <Badge className="rounded-full bg-amber-500/20 text-amber-300 border-amber-500/30 px-3.5 py-1 text-xs font-semibold backdrop-blur flex items-center gap-1.5">
              <Utensils className="h-3.5 w-3.5 text-amber-400" /> {tableHierarchyLabel}
            </Badge>

            {/* Active Table Session Badge */}
            {activeOrderId && (
              <Badge className="rounded-full bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1 text-xs font-semibold backdrop-blur flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Active Order #{activeOrder?.order_number || activeOrderId.slice(-6)}
              </Badge>
            )}

            {/* Calculated Open/Closed Status */}
            <Badge
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1.5 backdrop-blur",
                isOpenNow
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-300 border-rose-500/30"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isOpenNow ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                )}
              />
              {isOpenNow ? "Open Now" : "Closed"}
            </Badge>
          </div>

          <div className="flex items-start gap-4 pt-1">
            {/* Restaurant Logo Avatar or Uploaded Logo */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={restaurantName}
                className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-2xl object-cover border-2 border-amber-500/30 shadow-xl"
              />
            ) : (
              <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 p-0.5 shadow-xl shadow-amber-500/20 flex items-center justify-center">
                <div className="h-full w-full rounded-[14px] bg-slate-950/80 backdrop-blur flex items-center justify-center text-amber-400">
                  <Utensils className="h-8 w-8 sm:h-10 sm:w-10" />
                </div>
              </div>
            )}

            {/* Restaurant Details */}
            <div className="space-y-1">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                {restaurantName}
              </h1>

              {(openingTime || closingTime) && (
                <div className="flex items-center gap-2 pt-1 text-xs text-stone-300">
                  <span className="flex items-center gap-1 text-stone-300">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    {openingTime && closingTime ? `${openingTime} - ${closingTime}` : openingTime || closingTime}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Welcome Tagline Banner */}
          <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/10 p-3 flex items-center justify-between text-xs text-amber-100">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="font-medium">Welcome! Scan, order & enjoy your meal right from your table.</span>
            </span>
          </div>
        </div>
      </section>

      {/* STICKY SEARCH & CATEGORY FILTER BAR */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b shadow-sm py-3 px-4 transition-all">
        <div className="mx-auto max-w-3xl space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search dishes, starters, beverages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 h-11 rounded-2xl bg-muted/50 border-border/80 focus:bg-background transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Diet & Dynamic Quick Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              onClick={() => setDietFilter("ALL")}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 font-medium transition-all border",
                dietFilter === "ALL"
                  ? "bg-foreground text-background border-foreground font-semibold shadow-sm"
                  : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
              )}
            >
              All Items
            </button>

            {hasVegDishes && (
              <button
                onClick={() => setDietFilter("VEG")}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 font-medium transition-all border flex items-center gap-1.5",
                  dietFilter === "VEG"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
                )}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Veg Only
              </button>
            )}

            {hasNonVegDishes && (
              <button
                onClick={() => setDietFilter("NONVEG")}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 font-medium transition-all border flex items-center gap-1.5",
                  dietFilter === "NONVEG"
                    ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                    : "bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/20"
                )}
              >
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Non-Veg Only
              </button>
            )}

            {hasPopularDishes && (
              <button
                onClick={() => setDietFilter("POPULAR")}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 font-medium transition-all border flex items-center gap-1.5",
                  dietFilter === "POPULAR"
                    ? "bg-amber-500 text-slate-950 border-amber-500 font-semibold shadow-sm"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20"
                )}
              >
                <Flame className="h-3.5 w-3.5 text-amber-500" /> Bestsellers
              </button>
            )}
          </div>

          {/* Category Tabs Pill Bar */}
          {menuCategories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 no-scrollbar border-t border-border/40">
              <button
                onClick={() => setActiveCatId("ALL")}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-all",
                  activeCatId === "ALL"
                    ? "gradient-brand text-primary-foreground border-transparent shadow-md"
                    : "border-border/60 bg-card hover:border-primary text-muted-foreground hover:text-foreground"
                )}
              >
                All Categories
              </button>
              {menuCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCatId(c.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-all",
                    c.id === activeCatId
                      ? "gradient-brand text-primary-foreground border-transparent shadow-md"
                      : "border-border/60 bg-card hover:border-primary text-muted-foreground hover:text-foreground"
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MAIN MENU CONTENT */}
      <main className="mx-auto max-w-3xl px-4 pt-6 space-y-8">
        {loadingTables ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Preparing menu…</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center space-y-4 max-w-md mx-auto">
            <div className="mx-auto h-16 w-16 rounded-3xl bg-muted/60 flex items-center justify-center text-muted-foreground">
              <UtensilsCrossed className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">No dishes available</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                We couldn't find any dishes matching your current search or category filter.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setSearchQuery("");
                setActiveCatId("ALL");
                setDietFilter("ALL");
              }}
            >
              Reset Search & Filters
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Showing {filteredItems.length} dish{filteredItems.length === 1 ? "" : "es"}</span>
              <span className="font-medium text-foreground">{tableHierarchyLabel}</span>
            </div>

            {/* Menu Items Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredItems.map((m) => {
                const qty = getCartQty(m.id);
                return (
                  <Card
                    key={m.id}
                    className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-primary/40 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        {/* Veg / Non-Veg Indicator */}
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-2",
                              m.is_veg ? "border-emerald-600" : "border-rose-600"
                            )}
                          >
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                m.is_veg ? "bg-emerald-600" : "bg-rose-600"
                              )}
                            />
                          </span>
                          <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                            {m.is_veg ? "Veg" : "Non-Veg"}
                          </span>
                        </div>

                        {/* Bestseller Badge */}
                        {((m as any).is_popular || m.price >= 250) && (
                          <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-600 border-amber-500/20 font-medium">
                            <Flame className="mr-1 h-3 w-3 text-amber-500 inline" /> Bestseller
                          </Badge>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="font-display font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                          {m.name}
                        </h3>
                        {m.description && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {m.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer: Price & Add/Counter Button */}
                    <div className="mt-4 flex items-center justify-between pt-2 border-t border-border/40">
                      <div>
                        <p className="font-display text-lg font-bold text-foreground">
                          {fmt(m.price)}
                        </p>
                      </div>

                      {/* Add Button OR Quantity Counter */}
                      {qty === 0 ? (
                        <Button
                          size="sm"
                          className="rounded-full gradient-brand text-primary-foreground px-4 shadow-sm hover:shadow-md transition-all"
                          onClick={() => addToCart(m)}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" /> Add
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 rounded-full gradient-brand text-primary-foreground p-1 shadow-md">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-full text-primary-foreground hover:bg-white/20"
                            onClick={() => bumpQty(m.id, -1)}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="font-bold text-sm min-w-[18px] text-center">
                            {qty}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-full text-primary-foreground hover:bg-white/20"
                            onClick={() => bumpQty(m.id, +1)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* RESTAURANT INFORMATION SECTION (Loaded from Backend) */}
        {(addressFormatted || phoneContact || openingTime || closingTime || mapsUrl) && (
          <section className="pt-6 border-t space-y-4">
            <Card className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base">About {restaurantName}</h3>
                  <p className="text-xs text-muted-foreground">Restaurant Details & Direct Contact</p>
                </div>
              </div>

              <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3 pt-1">
                {addressFormatted && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Address</p>
                      <p>{addressFormatted}</p>
                    </div>
                  </div>
                )}
                {(openingTime || closingTime) && (
                  <div className="flex items-start gap-2.5">
                    <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Opening Hours</p>
                      <p>{openingTime && closingTime ? `${openingTime} - ${closingTime}` : openingTime || closingTime}</p>
                    </div>
                  </div>
                )}
                {phoneContact && (
                  <div className="flex items-start gap-2.5">
                    <Phone className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Phone</p>
                      <p>{phoneContact}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {phoneContact && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs"
                    onClick={() => window.open(`tel:${phoneContact.replace(/[^\d+]/g, "")}`)}
                  >
                    <Phone className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> Call Restaurant
                  </Button>
                )}
                {mapsUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs"
                    onClick={() => window.open(mapsUrl, "_blank")}
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5 text-primary" /> View Location / Reviews
                  </Button>
                )}
              </div>
            </Card>
          </section>
        )}
      </main>

      {/* STICKY FLOATING CART BAR */}
      {cart.length > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-30 max-w-xl mx-auto">
          <div className="bg-slate-950/95 text-white backdrop-blur-md p-3.5 rounded-2xl shadow-2xl border border-amber-500/30 flex items-center justify-between animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-center gap-3 pl-1">
              <div className="relative">
                <div className="h-10 w-10 rounded-xl gradient-brand flex items-center justify-center text-primary-foreground shadow-md">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-bold flex items-center justify-center shadow">
                  {totalCartCount}
                </span>
              </div>
              <div>
                <p className="text-[11px] text-stone-400 uppercase tracking-wider font-semibold">Your Cart</p>
                <p className="font-display text-lg font-bold text-amber-300">{fmt(totalAmount)}</p>
              </div>
            </div>

            <Button
              size="lg"
              className="rounded-full gradient-brand text-primary-foreground font-bold shadow-lg hover:brightness-110 disabled:opacity-60"
              onClick={openCheckoutModal}
              disabled={loadingTables || !tableData}
              title={loadingTables ? "Resolving table…" : !tableData ? "Table not found" : undefined}
            >
              {loadingTables ? (
                <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Resolving Table…</>
              ) : (
                <>View Cart & Place Order <ChevronRight className="ml-1 h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* NEXTVISIT STEP-BY-STEP CUSTOMER JOURNEY DIALOG */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-7">
          {/* STEP 1: ORDER REVIEW */}
          {checkoutStep === "REVIEW" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <DialogHeader>
                <DialogTitle className="font-display flex items-center justify-between text-xl">
                  <span className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-primary" /> Order Review
                  </span>
                  <Badge variant="outline" className="rounded-full font-mono text-xs">
                    {tableHierarchyLabel}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              {/* Items List */}
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {cart.map((i) => (
                  <div key={i.menu_item_id} className="flex items-center justify-between rounded-2xl bg-muted/60 p-3 text-xs">
                    <span className="font-semibold text-sm truncate max-w-[160px]">{i.item_name}</span>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full bg-background shadow-sm" onClick={() => bumpQty(i.menu_item_id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center font-bold text-sm">{i.quantity}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full bg-background shadow-sm" onClick={() => bumpQty(i.menu_item_id, +1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <span className="ml-2 w-16 text-right font-bold text-foreground">{fmt(i.unit_price * i.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Special Instructions */}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="qr-order-notes" className="text-xs font-semibold flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" /> Special Instructions (Optional)
                </Label>
                <Textarea
                  id="qr-order-notes"
                  placeholder="Notes for chef (e.g. less spicy, allergies, extra napkins)..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  rows={2}
                  className="rounded-2xl text-xs bg-muted/40"
                />
              </div>

              {/* Bill Details */}
              <Card className="rounded-2xl p-4 bg-muted/30 border-border/60 space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-semibold text-foreground">{fmt(subtotal)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxes & Charges ({taxPercentage}%)</span>
                    <span className="font-semibold text-foreground">{fmt(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-2 border-t text-foreground">
                  <span>Grand Total</span>
                  <span className="text-primary font-display text-lg">{fmt(totalAmount)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1">
                  <Clock className="h-3 w-3 text-amber-500" /> Estimated preparation time ~ 15-20 mins
                </p>
              </Card>

              {/* Active Session Notice */}
              {activeOrderId && (
                <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>
                    Active session detected. New items will be added directly to Order #{activeOrder?.order_number || activeOrderId.slice(-6)}.
                  </span>
                </div>
              )}

              <Button
                className="w-full rounded-full gradient-brand text-primary-foreground font-bold py-6 text-base shadow-lg shadow-primary/20 mt-2"
                onClick={activeOrderId ? handleSubmitOrder : () => setCheckoutStep("PHONE")}
                disabled={appendItemsMut.isPending}
              >
                {appendItemsMut.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : activeOrderId ? (
                  <>
                    <Check className="mr-2 h-5 w-5" /> Add to Order #{activeOrder?.order_number || activeOrderId.slice(-6)} ({fmt(totalAmount)})
                  </>
                ) : (
                  <>
                    Proceed to Customer Identification <ChevronRight className="ml-1 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* STEP 2: PHONE NUMBER LOOKUP / AUTO DETECT */}
          {checkoutStep === "PHONE" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b pb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full h-8 px-2 text-xs"
                  onClick={() => setCheckoutStep("REVIEW")}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back to Review
                </Button>
                <span className="text-xs text-muted-foreground font-medium">Step 2 of 3</span>
              </div>

              <div className="text-center space-y-1">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <Phone className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold text-xl">Enter Phone Number</h3>
                <p className="text-xs text-muted-foreground">
                  We'll check your profile for instant loyalty rewards & digital receipts.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs font-semibold">Mobile Number *</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      placeholder="Enter 10-digit mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="rounded-2xl text-base h-12 tracking-wide font-mono"
                      type="tel"
                      maxLength={15}
                    />
                  </div>
                </div>

                <Button
                  className="w-full rounded-full gradient-brand text-primary-foreground font-bold py-6 text-base shadow-lg shadow-primary/20"
                  onClick={() => handleDetectCustomer()}
                  disabled={searchingPhone || !phone.trim()}
                >
                  {searchingPhone ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Verify & Check Profile <ChevronRight className="ml-1.5 h-5 w-5" />
                    </>
                  )}
                </Button>

                <div className="relative py-2 flex items-center justify-center">
                  <div className="border-t w-full absolute" />
                  <span className="bg-background px-3 text-[11px] text-muted-foreground relative uppercase font-semibold">
                    Or
                  </span>
                </div>

                <Button
                  variant="outline"
                  className="w-full rounded-full border-dashed text-xs py-5"
                  onClick={handleContinueAsGuest}
                >
                  Continue as Guest (No Loyalty Points)
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3A: EXISTING CUSTOMER CARD */}
          {checkoutStep === "CONFIRM" && custType === "EXISTING" && autoDetectData?.customer_id && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b pb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full h-8 px-2 text-xs"
                  onClick={() => setCheckoutStep("PHONE")}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Change Phone
                </Button>
                <Badge className="rounded-full bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-xs">
                  Existing Member
                </Badge>
              </div>

              {/* Welcome Back Premium Card */}
              <Card className="rounded-3xl p-5 border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card space-y-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl gradient-brand text-primary-foreground flex items-center justify-center text-lg font-bold">
                    {(autoDetectData.name || "C").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg leading-snug">
                      👋 Welcome Back, {autoDetectData.name || "Valued Member"}!
                    </h3>
                    <p className="text-xs text-muted-foreground">{autoDetectData.phone}</p>
                  </div>
                </div>

                {/* Loyalty Metrics */}
                {autoDetectData.loyalty && (
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="rounded-2xl bg-muted/60 p-2.5">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase">Current Points</p>
                      <p className="font-display font-bold text-base text-amber-500">
                        {autoDetectData.loyalty.current_points} pts
                      </p>
                    </div>
                    <div className="rounded-2xl bg-muted/60 p-2.5">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase">Earned Today</p>
                      <p className="font-display font-bold text-base text-emerald-600">
                        +{autoDetectData.loyalty.points_earned} pts
                      </p>
                    </div>
                    <div className="rounded-2xl bg-muted/60 p-2.5">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase">After Payment</p>
                      <p className="font-display font-bold text-base text-primary">
                        {autoDetectData.loyalty.current_points + autoDetectData.loyalty.points_earned} pts
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Loyalty points will be credited after payment is completed at your table.</span>
                </p>
              </Card>

              <Button
                className="w-full rounded-full gradient-brand text-primary-foreground font-bold py-6 text-base shadow-lg shadow-primary/20 mt-2"
                onClick={handleSubmitOrder}
                disabled={createOrderMut.isPending}
              >
                {createOrderMut.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Check className="mr-2 h-5 w-5" /> Confirm & Send to Kitchen ({fmt(totalAmount)})
                  </>
                )}
              </Button>
            </div>
          )}

          {/* STEP 3B: NEW CUSTOMER REGISTRATION */}
          {checkoutStep === "CONFIRM" && custType === "NEW" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b pb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full h-8 px-2 text-xs"
                  onClick={() => setCheckoutStep("PHONE")}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Change Phone
                </Button>
                <Badge className="rounded-full bg-primary/20 text-primary border-primary/30 text-xs">
                  New Customer
                </Badge>
              </div>

              <div className="text-center space-y-1">
                <h3 className="font-display font-bold text-lg">🎉 Complete Registration</h3>
                <p className="text-xs text-muted-foreground">
                  Earn points on this bill ({fmt(totalAmount)}) and unlock rewards on future visits!
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-semibold">Full Name *</Label>
                    <Input
                      placeholder="e.g. Rahul Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="rounded-2xl text-xs"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Phone Number *</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="rounded-2xl text-xs bg-muted/40 font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Email Address (Optional)</Label>
                  <Input
                    type="email"
                    placeholder="rahul@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-2xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-semibold">Date of Birth (Optional)</Label>
                    <Input
                      type="date"
                      value={bday}
                      onChange={(e) => setBday(e.target.value)}
                      className="rounded-2xl text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold font-medium">Anniversary (Optional)</Label>
                    <Input
                      type="date"
                      value={anni}
                      onChange={(e) => setAnni(e.target.value)}
                      className="rounded-2xl text-xs"
                    />
                  </div>
                </div>

                <Button
                  className="w-full rounded-full gradient-brand text-primary-foreground font-bold py-6 text-base shadow-lg shadow-primary/20 mt-2"
                  onClick={handleSubmitOrder}
                  disabled={createOrderMut.isPending}
                >
                  {createOrderMut.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="mr-2 h-5 w-5" /> Complete Profile & Place Order ({fmt(totalAmount)})
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3C: GUEST ORDER CONFIRMATION */}
          {checkoutStep === "CONFIRM" && custType === "GUEST" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b pb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full h-8 px-2 text-xs"
                  onClick={() => setCheckoutStep("PHONE")}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Badge variant="outline" className="rounded-full text-xs">
                  Guest Order
                </Badge>
              </div>

              <Card className="rounded-3xl p-5 border-border/80 bg-muted/30 text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg">Guest Order Confirmation</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your order will be sent to the kitchen without attaching a customer profile.
                  </p>
                </div>
                <p className="text-[11px] text-amber-600 bg-amber-500/10 rounded-xl p-2.5 font-medium">
                  Note: Loyalty points will not be accumulated for guest orders.
                </p>
              </Card>

              <Button
                className="w-full rounded-full gradient-brand text-primary-foreground font-bold py-6 text-base shadow-lg shadow-primary/20 mt-2"
                onClick={handleSubmitOrder}
                disabled={createOrderMut.isPending}
              >
                {createOrderMut.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Check className="mr-2 h-5 w-5" /> Confirm Guest Order ({fmt(totalAmount)})
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* FOOTER (100% Data-Driven Restaurant Name) */}
      <footer className="mt-16 border-t py-10 px-4 text-center space-y-2 bg-muted/30">
        <p className="font-display font-semibold text-sm text-foreground">
          Thank you for choosing {restaurantName}
        </p>
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          We hope you enjoy your meal <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500 inline" />
        </p>
      </footer>
    </div>
  );
}