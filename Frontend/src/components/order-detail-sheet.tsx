import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  Printer,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  User,
  Loader2,
  QrCode,
  CreditCard,
  Wallet,
  Banknote,
  Sparkles,
  Phone,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
  Search,
  FileText,
  Eye,
  Download,
  XCircle,
  Tag,
  RefreshCw,
} from "lucide-react";

export function formatOrderNumber(orderNumber: string | undefined | null): string {
  if (!orderNumber) return "ORD-000000";
  const match = orderNumber.match(/^ORD-(\d+)$/i);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    return `ORD-${num.toString().padStart(6, "0")}`;
  }
  return orderNumber;
}
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getOrderByIdApi,
  getTablesMapApi,
  autoDetectCustomerApi,
  settleOrderApi,
  addOrderItemApi,
  updateOrderApi,
  updateOrderItemApi,
  deleteOrderItemApi,
  type CustomerAutoDetectResult,
} from "@/lib/orders-api";
import { validateCouponApi, redeemCouponApi, type CouponValidateResponse } from "@/lib/coupons-api";
import { listMenuCategoriesApi } from "@/lib/menu-api";
import { getBusinessSettingsApi, getRestaurantSetupSettingsApi } from "@/lib/business-settings-api";
import { useProfile, useAuthenticatedBusiness } from "@/lib/business-profile";
import { getSession, API_BASE_URL } from "@/lib/auth";
import { openWhatsApp } from "@/lib/celebration-utils";
import { InvoiceView, printInvoiceDom, type InvoiceData } from "@/components/invoice-view";
import { fmt } from "@/lib/currency";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  orderId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  PREPARING: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  READY: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  SERVED: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  CANCELLED: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export function OrderDetailSheet({ orderId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const profile = useProfile("restaurant");
  const { name: authBizName, business: authBiz } = useAuthenticatedBusiness();
  const session = getSession();

  // Payment Modal States
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [autoDetectResult, setAutoDetectResult] = useState<CustomerAutoDetectResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("UPI");
  const [qrImageLoaded, setQrImageLoaded] = useState(false);
  const [qrImageError, setQrImageError] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);

  // Coupon States for Collect Payment Dialog
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidateResponse | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Add Extra Dishes Modal States
  const [addItemsOpen, setAddItemsOpen] = useState(false);
  const [activeCatId, setActiveCatId] = useState<string>("");
  const [extraCart, setExtraCart] = useState<
    Array<{ menu_item_id: string; item_name: string; unit_price: number; quantity: number; tax_rate: number }>
  >([]);
  const [addingExtra, setAddingExtra] = useState(false);

  // New Customer Form Fields (if not existing)
  const [custName, setCustName] = useState("");
  const [custBday, setCustBday] = useState("");
  const [custAnni, setCustAnni] = useState("");
  const [custGender, setCustGender] = useState("");

  // Data Fetching
  const { data: menuCategories = [] } = useQuery({
    queryKey: ["menu", "categories"],
    queryFn: listMenuCategoriesApi,
    enabled: addItemsOpen,
  });
  const {
    data: order,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["orders", orderId],
    queryFn: () => getOrderByIdApi(orderId!),
    enabled: !!orderId && open,
  });

  const { data: diningAreas = [] } = useQuery({
    queryKey: ["tables", "map"],
    queryFn: getTablesMapApi,
    enabled: open,
  });

  const {
    data: bizSettings,
    isLoading: isBizSettingsLoading,
    isError: isBizSettingsError,
    refetch: refetchBizSettings,
  } = useQuery({
    queryKey: ["business-settings"],
    queryFn: getBusinessSettingsApi,
    enabled: open,
  });

  const { data: setupSettings } = useQuery({
    queryKey: ["setup-business-settings"],
    queryFn: getRestaurantSetupSettingsApi,
    enabled: open,
  });

  // Dynamic order total calculation after promo discount
  const discountAmount = appliedCoupon?.valid ? (appliedCoupon.calculated_discount || 0) : 0;
  const baseOrderTotal = order?.total_amount ?? order?.subtotal ?? 0;
  const finalOrderTotal = Math.max(0, baseOrderTotal - discountAmount);

  // Reset QR loaded & error states when Collect Payment opens or payment method switches
  useEffect(() => {
    if (payDialogOpen && paymentMethod === "UPI") {
      setQrImageLoaded(false);
      setQrImageError(false);
    }
  }, [payDialogOpen, paymentMethod, finalOrderTotal]);

  // Calculate GST Percentage dynamically
  const calculatedGstPct =
    order && order.subtotal > 0 && order.tax_amount
      ? Math.round((order.tax_amount / order.subtotal) * 100)
      : 0;

  const gstPercentage =
    setupSettings?.gstPercentage ??
    (setupSettings as any)?.gst_percentage ??
    bizSettings?.tax_percentage ??
    (order as any)?.tax_rate ??
    (calculatedGstPct > 0 ? calculatedGstPct : 0);

  const tableName = (() => {
    if (!order) return "";
    if (Array.isArray(diningAreas)) {
      for (const area of diningAreas) {
        if (Array.isArray(area?.tables)) {
          for (const t of area.tables) {
            if (t?.id === order.table_id) return t.table_name || "Table";
          }
        }
      }
    }
    return `Table`;
  })();

const handleDownloadInvoice = async () => {
  if (!order) return;

  setDownloadingInvoice(true);

  try {
    // -----------------------------------------
    // 1. BASIC INFORMATION
    // -----------------------------------------
    const formattedCode = formatOrderNumber(order.order_number);

    const invNo =
      order.invoice_number ||
      `INV-${formattedCode.replace("ORD-", "")}`;

    const restaurantName =
      setupSettings?.name ||
      (profile as any)?.businessName ||
      "JAIL RESTAURANT";

    const address =
      setupSettings?.address ||
      bizSettings?.address ||
      "";

    const phone =
      setupSettings?.phone ||
      bizSettings?.phone ||
      "";

    const gstNumber =
      setupSettings?.gst_number ||
      bizSettings?.gst_number ||
      "";

    const tableNo =
      tableName ||
      order.table ||
      "Table";

    // -----------------------------------------
    // 2. CUSTOMER NAME
    // -----------------------------------------
    const customerName =
      order.customer?.name ||
      order.customer_name ||
      settleResult?.customer_name ||
      autoDetectResult?.name ||
      custName ||
      "Guest";

    // -----------------------------------------
    // 3. DATE & TIME
    // -----------------------------------------
    const createdAt =
      order.created_at || Date.now();

    const dateTimeStr = new Date(createdAt)
      .toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

    // -----------------------------------------
    // 4. ACTUAL PAYMENT METHOD (FOOLPROOF FIX)
    // -----------------------------------------
    const savedPaymentMethod =
      settleResult?.payment_method ||
      settleResult?.payment_mode ||
      (order as any)?.payment_method ||
      (order as any)?.payment_mode ||
      (order as any)?.payment_type;

    const rawPaymentMethod =
      savedPaymentMethod ||
      paymentMethod ||
      "UPI";

    const paymentMode = String(rawPaymentMethod)
      .trim()
      .toUpperCase();

    // -----------------------------------------
    // 5. ITEMS
    // -----------------------------------------
    const items = order.items || [];

    // -----------------------------------------
    // 6. DYNAMIC PDF HEIGHT & PAPER SIZE
    // -----------------------------------------
    const is58 = bizSettings?.receipt_paper_size === "58mm";
    const baseHeight = is58 ? 100 : 115;
    const itemsHeight = Math.max(items.length, 1) * 5.5;

    const totalHeight = baseHeight + itemsHeight;

    // -----------------------------------------
    // 7. CREATE THERMAL PDF
    // -----------------------------------------
    const doc = new jsPDF({
      unit: "mm",
      format: [is58 ? 58 : 80, totalHeight],
    });

    let y = is58 ? 6 : 10;
    const leftMargin = is58 ? 4 : 6;
    const rightMargin = is58 ? 54 : 74;
    const centerX = is58 ? 29 : 40;

    // -----------------------------------------
    // 8. DEFAULT STYLE
    // -----------------------------------------
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.25);

    // -----------------------------------------
    // 9. RESTAURANT HEADER
    // -----------------------------------------
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);

    doc.text(
      restaurantName,
      40,
      y,
      {
        align: "center",
      }
    );

    y += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    if (address) {
      doc.text(
        address,
        40,
        y,
        {
          align: "center",
        }
      );

      y += 3.5;
    }

    if (phone) {
      doc.text(
        `Ph: ${phone}`,
        40,
        y,
        {
          align: "center",
        }
      );

      y += 3.5;
    }

    if (gstNumber) {
      doc.text(
        `GSTIN: ${gstNumber}`,
        40,
        y,
        {
          align: "center",
        }
      );

      y += 3.5;
    }

    // -----------------------------------------
    // 10. DIVIDER
    // -----------------------------------------
    y += 2;

    doc.line(
      8,
      y,
      72,
      y
    );

    y += 5;

    // -----------------------------------------
    // 11. INVOICE NUMBER
    // -----------------------------------------
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);

    doc.text(
      "Invoice No:",
      8,
      y
    );

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);

    doc.text(
      invNo,
      72,
      y,
      {
        align: "right",
      }
    );

    y += 4;

    // -----------------------------------------
    // 12. ORDER NUMBER
    // -----------------------------------------
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);

    doc.text(
      "Order No:",
      8,
      y
    );

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);

    doc.text(
      formattedCode,
      72,
      y,
      {
        align: "right",
      }
    );

    y += 4;

    // -----------------------------------------
    // 13. DATE & TIME
    // -----------------------------------------
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);

    doc.text(
      "Date & Time:",
      8,
      y
    );

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);

    doc.text(
      dateTimeStr,
      72,
      y,
      {
        align: "right",
      }
    );

    y += 4;

    // -----------------------------------------
    // 14. TABLE
    // -----------------------------------------
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);

    doc.text(
      "Table:",
      8,
      y
    );

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);

    doc.text(
      String(tableNo),
      72,
      y,
      {
        align: "right",
      }
    );

    y += 4;

    // -----------------------------------------
    // 15. CUSTOMER
    // -----------------------------------------
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);

    doc.text(
      "Customer:",
      8,
      y
    );

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);

    const safeCustomerName =
      String(customerName).length > 28
        ? String(customerName).slice(0, 28) + "..."
        : String(customerName);

    doc.text(
      safeCustomerName,
      72,
      y,
      {
        align: "right",
      }
    );

    y += 4;

    // -----------------------------------------
    // 16. PAYMENT METHOD
    // -----------------------------------------
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);

    doc.text(
      "Payment Method:",
      8,
      y
    );

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);

    doc.text(
      paymentMode,
      72,
      y,
      {
        align: "right",
      }
    );

    y += 5;

    // -----------------------------------------
    // 17. ITEMS HEADER DIVIDER
    // -----------------------------------------
    doc.setDrawColor(180, 180, 180);

    doc.line(
      8,
      y,
      72,
      y
    );

    y += 4;

    // -----------------------------------------
    // 18. ITEMS HEADER
    // -----------------------------------------
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(70, 70, 70);

    doc.text(
      "Item",
      8,
      y
    );

    doc.text(
      "Qty",
      42,
      y,
      {
        align: "right",
      }
    );

    doc.text(
      "Price",
      57,
      y,
      {
        align: "right",
      }
    );

    doc.text(
      "Total",
      72,
      y,
      {
        align: "right",
      }
    );

    y += 4;

    doc.line(
      8,
      y,
      72,
      y
    );

    y += 5;

    // -----------------------------------------
    // 19. ITEMS
    // -----------------------------------------
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);

    items.forEach((item: any) => {
      const itemName = String(
        item.item_name ||
        item.name ||
        "Item"
      );

      const displayName =
        itemName.length > 18
          ? itemName.slice(0, 16) + ".."
          : itemName;

      const quantity =
        Number(item.quantity || 0);

      const unitPrice =
        Number(
          item.unit_price ||
          item.price ||
          0
        );

      const itemTotal =
        quantity * unitPrice;

      doc.text(
        displayName,
        8,
        y
      );

      doc.text(
        String(quantity),
        42,
        y,
        {
          align: "right",
        }
      );

      doc.text(
        `Rs.${unitPrice}`,
        57,
        y,
        {
          align: "right",
        }
      );

      doc.text(
        `Rs.${itemTotal}`,
        72,
        y,
        {
          align: "right",
        }
      );

      y += 5;
    });

    // -----------------------------------------
    // 20. SUMMARY DIVIDER
    // -----------------------------------------
    y += 1;

    doc.setDrawColor(180, 180, 180);

    doc.line(
      8,
      y,
      72,
      y
    );

    y += 5;

    // -----------------------------------------
    // 21. SUBTOTAL
    // -----------------------------------------
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);

    doc.text(
      "Subtotal",
      8,
      y
    );

    doc.setTextColor(0, 0, 0);

    doc.text(
      `Rs.${order.subtotal || 0}`,
      72,
      y,
      {
        align: "right",
      }
    );

    y += 4;

    // -----------------------------------------
    // 22. GST
    // -----------------------------------------
    if (order.tax_amount) {
      doc.setTextColor(90, 90, 90);

      doc.text(
        `GST (${gstPercentage}%)`,
        8,
        y
      );

      doc.setTextColor(0, 0, 0);

      doc.text(
        `Rs.${order.tax_amount}`,
        72,
        y,
        {
          align: "right",
        }
      );

      y += 4;
    }

    // -----------------------------------------
    // 23. DISCOUNT
    // -----------------------------------------
    const discountAmt = Number(
      order.discount_amount ||
      (order as any).coupon_discount ||
      settleResult?.discount_amount ||
      discountAmount ||
      0
    );
    const activeCouponCode = (
      (order as any).coupon_code ||
      (order as any).applied_coupon_code ||
      (order as any).couponCode ||
      appliedCoupon?.coupon?.code ||
      settleResult?.coupon_code ||
      (couponCode.trim() ? couponCode.trim().toUpperCase() : "BIRTHDAY20")
    ).toUpperCase();

    if (discountAmt > 0) {
      const couponLabel = `Coupon (${activeCouponCode})`;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(110, 110, 110);
      doc.text(couponLabel, leftMargin, y);

      doc.setTextColor(220, 38, 38); // Red color for discount
      doc.text(`-Rs.${discountAmt}`, rightMargin, y, { align: "right" });
      y += 4.5;
    }

    // -----------------------------------------
    // 24. GRAND TOTAL
    // -----------------------------------------
    y += 1;

    doc.setDrawColor(180, 180, 180);

    doc.line(
      8,
      y,
      72,
      y
    );

    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    doc.text(
      "Grand Total",
      8,
      y
    );

    doc.text(
      `Rs.${order.total_amount || 0}`,
      72,
      y,
      {
        align: "right",
      }
    );

    y += 6;

    // -----------------------------------------
    // 25. PAYMENT STATUS
    // -----------------------------------------
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);

    doc.text(
      "Payment Status:",
      8,
      y
    );

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);

    doc.text(
      `PAID (${paymentMode})`,
      72,
      y,
      {
        align: "right",
      }
    );

    y += 6;

    // -----------------------------------------
    // 26. FOOTER DIVIDER
    // -----------------------------------------
    doc.setDrawColor(180, 180, 180);

    doc.line(
      8,
      y,
      72,
      y
    );

    y += 6;

    // -----------------------------------------
    // 27. FOOTER
    // -----------------------------------------
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);

    doc.text(
      "Thank you for visiting!",
      40,
      y,
      {
        align: "center",
      }
    );

    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(90, 90, 90);

    doc.text(
      "We look forward to serving you again.",
      40,
      y,
      {
        align: "center",
      }
    );

    // -----------------------------------------
    // 28. DOWNLOAD PDF STREAM
    // -----------------------------------------
    doc.save(`Invoice_${invNo}.pdf`);
    toast.success("Invoice PDF downloaded successfully!");

  } catch (err: any) {
    console.error(
      "PDF generation error:",
      err
    );

    toast.error(
      "Failed to generate PDF invoice."
    );

  } finally {
    setDownloadingInvoice(false);
  }
};
  // Auto Detect Customer on phone change / search (exact 10 digits only)
  const handleDetectCustomer = async (num: string) => {
    const clean = num.replace(/\D/g, "");
    if (clean.length !== 10) {
      setAutoDetectResult(null);
      return;
    }

    setDetecting(true);
    try {
      const res = await autoDetectCustomerApi(clean, order?.total_amount || 0);
      setAutoDetectResult(res);
      if (res.exists && res.name) {
        setCustName(res.name);
      }
    } catch {
      setAutoDetectResult({ exists: false, customer_id: null, name: null, phone: clean, loyalty: null });
    } finally {
      setDetecting(false);
    }
  };

  // Auto-fill attached customer details when Collect Payment opens
  useEffect(() => {
    if (payDialogOpen && order) {
      setIsEditingCustomer(false);
      const attachedCust = order.customer;
      if (attachedCust) {
        setPhoneInput(attachedCust.phone);
        setCustName(attachedCust.name);
        handleDetectCustomer(attachedCust.phone);
      } else {
        setPhoneInput("");
        setCustName("");
        setAutoDetectResult(null);
      }
    }
  }, [payDialogOpen, order?.id, order?.customer?.phone]);

  // Extra items helpers & handlers
  const currentCatId = activeCatId || menuCategories[0]?.id || "";
  const currentCatItems = useMemo(() => {
    const cat = menuCategories.find((c) => c.id === currentCatId);
    return cat ? cat.items.filter((i) => i.is_available) : [];
  }, [menuCategories, currentCatId]);

  function addToExtraCart(item: { id: string; name: string; price: number; gst_percentage?: number }) {
    setExtraCart((prev) => {
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
        },
      ];
    });
  }

  function bumpExtraQty(menuItemId: string, delta: number) {
    setExtraCart((prev) =>
      prev.flatMap((i) =>
        i.menu_item_id === menuItemId
          ? i.quantity + delta <= 0
            ? []
            : [{ ...i, quantity: i.quantity + delta }]
          : [i]
      )
    );
  }

  const deleteItemMut = useMutation({
    mutationFn: (itemId: string) => deleteOrderItemApi(order!.id, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders", orderId] });
      qc.invalidateQueries({ queryKey: ["tables", "map"] });
      toast.success("Item removed from temporary order.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to remove item."),
  });

  const updateItemQtyMut = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      if (quantity <= 0) {
        return deleteOrderItemApi(order!.id, itemId);
      }
      return updateOrderItemApi(order!.id, itemId, { quantity });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders", orderId] });
      qc.invalidateQueries({ queryKey: ["tables", "map"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update quantity."),
  });

  async function handleSaveExtraItems() {
    if (!order || extraCart.length === 0) return;
    setAddingExtra(true);
    try {
      for (const item of extraCart) {
        await addOrderItemApi(order.id, {
          menu_item_id: item.menu_item_id,
          item_name: item.item_name,
          unit_price: item.unit_price,
          quantity: item.quantity,
          tax_rate: item.tax_rate,
        });
      }
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders", orderId] });
      qc.invalidateQueries({ queryKey: ["tables", "map"] });
      toast.success(`Added ${extraCart.length} extra dish(es) to Order ${order.order_number}!`);
      setExtraCart([]);
      setAddItemsOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add extra dishes.");
    } finally {
      setAddingExtra(false);
    }
  }

  // Payment Settlement Success & Auto Free Timer States
  const [settleResult, setSettleResult] = useState<any>(null);
  const [releaseCountdown, setReleaseCountdown] = useState<number>(30);
  const [tableFreed, setTableFreed] = useState<boolean>(false);

  // Auto Release Countdown Effect (Frees table in background at 0s WITHOUT closing popup)
  useEffect(() => {
    let timer: any;
    if (settleResult && releaseCountdown > 0) {
      timer = setInterval(() => {
        setReleaseCountdown((prev) => prev - 1);
      }, 1000);
    } else if (settleResult && releaseCountdown === 0 && !tableFreed) {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["tables", "map"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(`Table ${tableName} is now free & ready for next guest!`);
      setTableFreed(true);
    }
    return () => clearInterval(timer);
  }, [settleResult, releaseCountdown, tableFreed]);

  function handleCompleteRelease() {
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["tables", "map"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
    if (!tableFreed) {
      toast.success(`Table ${tableName} released cleanly! Ready for next guest.`);
    }
    setSettleResult(null);
    setPayDialogOpen(false);
    onOpenChange(false);
  }

  const settleMut = useMutation({
    mutationFn: (payload: any) => settleOrderApi(order!.id, payload),
    onSuccess: async (res) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["tables", "map"] });
      qc.invalidateQueries({ queryKey: ["customers"] });

      // Trigger Coupon Redemption on settlement to increment usage count (0/200 -> 1/200)
      const activeCouponCode = (
        appliedCoupon?.coupon?.code ||
        (order as any)?.coupon_code ||
        (order as any)?.applied_coupon_code ||
        (couponCode.trim() ? couponCode.trim().toUpperCase() : null)
      );

      if (activeCouponCode) {
        try {
          await redeemCouponApi({
            code: activeCouponCode,
            order_id: order?.id,
            customer_id: (order as any)?.customer_id || (order as any)?.customer?.id || res?.customer_id || autoDetectResult?.customer?.id || undefined,
            order_amount: order?.total_amount ?? order?.subtotal ?? 0,
          });
        } catch (couponErr) {
          console.error("Coupon redemption error:", couponErr);
        } finally {
          qc.invalidateQueries({ queryKey: ["coupons"] });
          qc.invalidateQueries({ queryKey: ["coupon"] });
          qc.invalidateQueries({ queryKey: ["business-coupons"] });
          qc.invalidateQueries({ queryKey: ["orders"] });
        }
      } else {
        qc.invalidateQueries({ queryKey: ["coupons"] });
        qc.invalidateQueries({ queryKey: ["coupon"] });
        qc.invalidateQueries({ queryKey: ["business-coupons"] });
      }

      setReleaseCountdown(30);
      setTableFreed(false);
      setSettleResult(res);
      toast.success(`Payment Successful! Order #${res.order_number} completed.`, {
        description: `Awarded +${res.earned_points} loyalty pts. Table auto-releasing in 30s.`,
      });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to settle payment."),
  });

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      return;
    }
    setIsValidatingCoupon(true);
    setCouponError(null);
    try {
      const res = await validateCouponApi({
        code: couponCode.trim().toUpperCase(),
        order_amount: baseOrderTotal,
        customer_id: order?.customer?.id || autoDetectResult?.customer?.id || undefined,
      });
      if (res.valid) {
        setAppliedCoupon(res);
        setCouponError(null);
        toast.success(`Coupon "${res.coupon?.code || couponCode.trim().toUpperCase()}" applied! Saved ${fmt(res.calculated_discount)}`);
      } else {
        setAppliedCoupon(null);
        setCouponError(res.reason || "Invalid promo code");
      }
    } catch (err: any) {
      console.error("Coupon validation error:", err);
      setAppliedCoupon(null);
      setCouponError(err?.message || "Failed to validate coupon");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleSettleSubmit = () => {
    const cleanPhone = phoneInput.replace(/\D/g, "").slice(0, 10);
    if (cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }
    if (!autoDetectResult?.exists && !custName.trim()) {
      toast.error("Please enter customer name.");
      return;
    }

    // Resolve exact Coupon Code string, Discount Amount, and Description
    const activeCode = appliedCoupon?.coupon?.code || (appliedCoupon?.valid ? couponCode.trim().toUpperCase() : undefined);
    const rewardVal = appliedCoupon?.coupon?.reward_value;
    const rewardDesc = rewardVal ? `${rewardVal}% OFF` : (appliedCoupon?.coupon?.reward_description || "Promo Discount");

    settleMut.mutate({
      phone: cleanPhone,
      customer_name: custName.trim() || undefined,
      birth_date: custBday || undefined,
      anniversary_date: custAnni || undefined,
      gender: custGender || undefined,
      payment_method: paymentMethod,
      coupon_code: activeCode,
      discount_amount: discountAmount > 0 ? Math.round(discountAmount) : undefined,
      discount_description: discountAmount > 0 ? rewardDesc : undefined,
      discount: discountAmount > 0 ? Math.round(discountAmount) : undefined,
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0 flex flex-col justify-between">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading order details…
            </div>
          ) : isError || !order ? (
            <div className="p-6 text-sm text-muted-foreground">Order not found.</div>
          ) : (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <SheetHeader className="border-b p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <SheetTitle className="font-display text-lg">
                        {formatOrderNumber(order.order_number)}
                      </SheetTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {tableName} · {order.order_source === "QR" ? "QR self-order" : "Staff order"}
                        {order.created_at ? (() => {
                          try {
                            const d = new Date(order.created_at);
                            if (isNaN(d.getTime())) return "";
                            return ` · ${d.toLocaleDateString("en-GB")} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                          } catch {
                            return "";
                          }
                        })() : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge className={`rounded-full ${STATUS_TONE[order.status] || "bg-muted"}`}>
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </SheetHeader>

                <div className="space-y-4 p-5">
                  {/* Items Section */}
                  <section>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-display text-sm font-semibold flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4 text-primary" /> Order Items
                      </p>
                      {order.status !== "SERVED" && order.status !== "CANCELLED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
                          onClick={() => setAddItemsOpen(true)}
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Items
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {(order.items || []).map((i) => {
                        const isUpdatingThisItem = updateItemQtyMut.isPending && updateItemQtyMut.variables?.itemId === i.id;
                        const isDeletingThisItem = deleteItemMut.isPending && deleteItemMut.variables === i.id;

                        return (
                          <div
                            key={i.id}
                            className="flex items-center justify-between gap-2 rounded-xl border p-3 text-sm"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{i.item_name}</p>
                              <p className="text-xs text-muted-foreground">{fmt(i.unit_price)} each</p>
                              {i.notes && <p className="text-[11px] text-muted-foreground">Note: {i.notes}</p>}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {order.status !== "SERVED" && order.status !== "CANCELLED" ? (
                                <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => updateItemQtyMut.mutate({ itemId: i.id, quantity: i.quantity - 1 })}
                                    disabled={isUpdatingThisItem || isDeletingThisItem}
                                    aria-label={`Decrease ${i.item_name} quantity`}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  {isUpdatingThisItem ? (
                                    <span className="w-5 flex items-center justify-center">
                                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                    </span>
                                  ) : (
                                    <span className="w-5 text-center text-xs font-semibold">{i.quantity}</span>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => updateItemQtyMut.mutate({ itemId: i.id, quantity: i.quantity + 1 })}
                                    disabled={isUpdatingThisItem || isDeletingThisItem}
                                    aria-label={`Increase ${i.item_name} quantity`}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">× {i.quantity}</span>
                              )}

                              <span className="font-semibold tabular-nums text-right min-w-[50px]">
                                {fmt(i.unit_price * i.quantity - (i.discount || 0))}
                              </span>

                              {order.status !== "SERVED" && order.status !== "CANCELLED" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-rose-500"
                                  onClick={() => deleteItemMut.mutate(i.id)}
                                  disabled={isDeletingThisItem || isUpdatingThisItem}
                                  aria-label={`Delete ${i.item_name}`}
                                >
                                  {isDeletingThisItem ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-destructive" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 space-y-1 rounded-xl bg-muted/40 p-3 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{fmt(order.subtotal)}</span>
                      </div>
                      {order.tax_amount > 0 && (
                        <div className="flex justify-between">
                          <span>GST ({gstPercentage}%):</span>
                          <span>{fmt(order.tax_amount)}</span>
                        </div>
                      )}
                      {/* Dynamic Coupon Code & Percentage Discount Row */}
{(() => {
  const discountVal = Number(order.discount_amount || (order as any).coupon_discount || settleResult?.discount_amount || discountAmount || 0);
  if (discountVal <= 0) return null;

  // Resolve actual code if available
  const rawCode = 
    order.coupon_code || 
    (order as any).applied_coupon_code || 
    (order as any).couponCode || 
    appliedCoupon?.coupon?.code ||
    settleResult?.coupon_code ||
    (couponCode.trim() ? couponCode.trim().toUpperCase() : "BIRTHDAY20");

  // Calculate percentage dynamically
  const calculatedPct = order.subtotal > 0 ? Math.round((discountVal / order.subtotal) * 100) : 0;
  
  // Format Label cleanly
  const labelText = `Discount (${rawCode.toUpperCase()})`;
  const badgeText = (order as any).discount_description || (order as any).coupon_description || (calculatedPct > 0 ? `${calculatedPct}% OFF` : "");

  return (
    <div className="flex justify-between items-center text-rose-500 font-medium my-1">
      <span className="flex items-center gap-1.5">
        <span className="font-semibold text-xs">{labelText}</span>
        {badgeText && (
          <Badge variant="outline" className="rounded-full text-[10px] bg-rose-500/10 text-rose-600 border-rose-500/30 px-2 py-0 font-extrabold">
            {badgeText}
          </Badge>
        )}
      </span>
      <span className="font-mono font-bold text-xs">-{fmt(discountVal)}</span>
    </div>
  );
})()}
                                          <div className="flex justify-between border-t pt-1 font-display text-base font-semibold">
                        <span>Total Amount</span>
                        <span>{fmt(order.total_amount)}</span>
                      </div>
                    </div>
                  </section>

                  {/* Customer Profile - EXPOSED ONLY WHEN ORDER IS ACTIVE */}
                  {order.status !== "SERVED" && order.status !== "CANCELLED" && (
                    <section className="rounded-xl border p-3.5 bg-card shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-display text-sm font-semibold flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" /> Customer Profile
                        </p>
                        {order.customer && (
                          <Badge className="bg-emerald-600 text-white text-[10px] rounded-full px-2 py-0.5 font-medium">
                            {order.customer.visit_count >= 5 || order.customer.total_spent >= 5000
                              ? "VIP Guest"
                              : order.customer.visit_count > 1
                              ? "Repeat Guest"
                              : "New Guest"}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-2.5">
                        {order.customer ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-sm text-foreground">{order.customer.name}</p>
                                <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                                  <Phone className="h-3 w-3 text-emerald-600" /> {order.customer.phone}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-xs border-t pt-2 mt-2">
                              <div>
                                <p className="text-muted-foreground text-[10px]">Total Visits</p>
                                <p className="font-bold text-xs text-foreground">{order.customer.visit_count || 1} visit(s)</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-[10px]">Loyalty Balance</p>
                                <p className="font-bold text-xs text-primary font-mono">{order.customer.loyalty_points || 0} pts</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-[10px]">Total Spent</p>
                                <p className="font-bold text-xs text-foreground font-mono">{fmt(order.customer.total_spent || 0)}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                            <span className="text-base">👤</span>
                            <div>
                              <p className="font-medium text-foreground">Guest Customer</p>
                              <p className="text-[11px] text-muted-foreground">No customer attached. Customer phone & details will be collected during payment.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Order Notes - EXPOSED ONLY WHEN ORDER IS ACTIVE */}
                  {order.status !== "SERVED" && order.status !== "CANCELLED" && order.notes && (
                    <section className="rounded-xl border p-3 bg-muted/20">
                      <p className="text-xs font-semibold text-muted-foreground">Order Notes</p>
                      <p className="text-sm mt-1">{order.notes}</p>
                    </section>
                  )}

                  {/* Invoice Section - EXPOSED ONLY AFTER PAYMENT IS COMPLETED (SERVED / PAID) */}
                  {order.status === "SERVED" && (
                    <section className="rounded-xl border p-3.5 space-y-2.5 bg-card shadow-sm border-emerald-500/30">
                      <div className="flex items-center justify-between">
                        <p className="font-display text-sm font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4 text-emerald-600" /> Tax Invoice
                        </p>
                        <Badge className="bg-emerald-600 text-white rounded-full text-[10px] px-2.5 py-0.5">
                          Paid & Generated
                        </Badge>
                      </div>

                      <div className="text-xs space-y-1 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-500/20">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Invoice No:</span>
                          <span className="font-mono font-bold text-foreground">INV-{order.order_number.replace("ORD-", "")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payment Status:</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Paid</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-0.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs gap-1.5 h-9 font-medium hover:bg-primary/5 hover:text-primary px-2"
                          onClick={() => setShowInvoiceModal(true)}
                        >
                          <Eye className="h-3.5 w-3.5 text-primary" /> View Invoice
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs gap-1.5 h-9 font-medium hover:bg-primary/5 hover:text-primary px-2"
                          onClick={() => {
                            setShowInvoiceModal(true);
                            setTimeout(() => printInvoiceDom("print-invoice"), 300);
                          }}
                        >
                          <Printer className="h-3.5 w-3.5 text-primary" /> Print Invoice
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs gap-1.5 h-9 font-medium hover:bg-primary/5 hover:text-primary px-2"
                          onClick={handleDownloadInvoice}
                          disabled={downloadingInvoice}
                        >
                          <Download className={`h-3.5 w-3.5 text-primary ${downloadingInvoice ? "animate-spin" : ""}`} />
                          {downloadingInvoice ? "Downloading…" : "Download Invoice"}
                        </Button>
                      </div>
                    </section>
                  )}
                </div>
              </div>

              {/* FOOTER ACTIONS: COLLECT PAYMENT & CANCEL ORDER */}
              {order.status !== "SERVED" && order.status !== "CANCELLED" && (
                <div className="border-t p-4 bg-card sticky bottom-0 space-y-2">
                  <Button
                    onClick={() => {
                      setPhoneInput("");
                      setAutoDetectResult(null);
                      setCustName("");
                      setCouponCode("");
                      setAppliedCoupon(null);
                      setCouponError(null);
                      setPayDialogOpen(true);
                    }}
                    className="w-full rounded-full gradient-brand text-primary-foreground h-11 text-sm font-semibold shadow-md"
                  >
                    <Banknote className="mr-2 h-5 w-5" /> Collect Payment ({fmt(finalOrderTotal)})
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setCancelDialogOpen(true)}
                    className="w-full rounded-full text-xs font-semibold h-9 border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> Cancel Order
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* CANCEL ORDER CONFIRMATION DIALOG */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-base flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" /> Cancel Order?
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 text-xs text-muted-foreground space-y-2">
            <p>
              Are you sure you want to cancel order <strong className="text-foreground">{formatOrderNumber(order?.order_number)}</strong> ({tableName})?
            </p>
            <p>This action will mark the order status as <strong>CANCELLED</strong> and release the table. Order history and items will be preserved.</p>
          </div>

          <DialogFooter className="border-t pt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-full text-xs"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancellingOrder}
            >
              Keep Order
            </Button>
            <Button
              variant="destructive"
              className="rounded-full text-xs font-semibold px-5"
              disabled={cancellingOrder}
              onClick={async () => {
                if (!order) return;
                setCancellingOrder(true);
                try {
                  await updateOrderApi(order.id, { status: "CANCELLED" as any });
                  qc.invalidateQueries({ queryKey: ["orders", orderId] });
                  qc.invalidateQueries({ queryKey: ["tables", "map"] });
                  toast.success(`Order ${formatOrderNumber(order.order_number)} cancelled successfully.`);
                  setCancelDialogOpen(false);
                } catch (err: any) {
                  toast.error(err?.message || "Failed to cancel order.");
                } finally {
                  setCancellingOrder(false);
                }
              }}
            >
              {cancellingOrder ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Cancelling…
                </>
              ) : (
                "Cancel Order"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COLLECT PAYMENT DIALOG */}
      <Dialog
        open={payDialogOpen}
        onOpenChange={(o) => {
          if (!o && settleResult) {
            handleCompleteRelease();
          } else {
            setPayDialogOpen(o);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-5 border-b shrink-0 bg-background">
            <DialogTitle className="font-display flex items-center gap-2 text-base">
              {settleResult ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Payment Success & Invoice
                </>
              ) : (
                <>
                  <Banknote className="h-5 w-5 text-primary" /> Collect Payment · {order?.order_number} ({tableName})
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* SCROLLABLE DIALOG BODY */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[calc(90vh-140px)]">
            {settleResult ? (
              /* SUCCESS VIEW - INVOICE PRIMARY, WHATSAPP SECONDARY */
              <div className="space-y-4 text-center py-2">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm animate-bounce">
                  <CheckCircle2 className="h-8 w-8" />
                </div>

                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">Payment Success & Invoice Generated!</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Order {order?.order_number} marked as <strong className="text-emerald-600 dark:text-emerald-400">SERVED / COMPLETED</strong>
                  </p>
                </div>

                {/* 1. PRIMARY CONFIRMATION: INVOICE PREVIEW CARD */}
                <div className="rounded-2xl border bg-card p-4 text-left space-y-3 max-w-md mx-auto shadow-sm">
                  <div className="flex items-center justify-between border-b pb-2.5">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-xs text-foreground">Tax Invoice Preview</span>
                    </div>
                    <Badge className="bg-emerald-600 text-white rounded-full text-[10px]">Generated</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase font-semibold">Invoice Number</p>
                      <p className="font-mono font-bold text-sm text-foreground">INV-{order?.order_number.replace("ORD-", "")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase font-semibold">Customer Name</p>
                      <p className="font-semibold text-sm text-foreground">{settleResult.customer_name || custName || "Guest"}</p>
                    </div>
                  </div>

                  {/* Items List */}
                  {order?.items && order.items.length > 0 && (
                    <div className="border-t border-b py-2 space-y-1.5 text-xs">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Order Items</p>
                      <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="truncate max-w-[180px]">{it.item_name} × {it.quantity}</span>
                            <span className="font-mono font-medium">{fmt((it as any).line_total ?? (it.quantity * it.unit_price))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary Totals */}
                   <div className="space-y-1 text-xs border-b pb-2">
  <div className="flex justify-between text-muted-foreground">
    <span>Subtotal</span>
    <span className="font-mono">{fmt(order?.subtotal || settleResult.total_amount)}</span>
  </div>
  
  {/* Add Coupon Discount Row Here */}
  {((order?.discount_amount || 0) > 0 || ((order as any)?.coupon_discount || 0) > 0 || (settleResult?.discount_amount || 0) > 0 || discountAmount > 0) ? (
    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
      <span>Coupon Discount ({
        appliedCoupon?.coupon?.code ||
        (order as any)?.coupon_code ||
        (order as any)?.applied_coupon_code ||
        (order as any)?.couponCode ||
        settleResult?.coupon_code ||
        (couponCode.trim() ? couponCode.trim().toUpperCase() : "COUPON")
      }):</span>
      <span className="font-mono font-bold">-{fmt(order?.discount_amount || (order as any)?.coupon_discount || settleResult?.discount_amount || discountAmount)}</span>
    </div>
  ) : null}

  {order?.tax_amount ? (
    <div className="flex justify-between text-muted-foreground">
      <span>GST ({gstPercentage}%):</span>
      <span className="font-mono">{fmt(order.tax_amount)}</span>
    </div>
  ) : null}
  <div className="flex justify-between font-bold text-sm pt-1 border-t">
    <span>Grand Total ({settleResult.payment_method || paymentMethod})</span>
    <span className="text-primary font-mono">{fmt(settleResult.total_amount)}</span>
  </div>
</div>

                  {/* Loyalty Points Section */}
                  <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-500/30 p-2.5 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground text-[10px]">Points Earned Today</p>
                      <p className="font-bold text-emerald-600 text-sm">+{settleResult.earned_points} pts</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px]">Current Balance</p>
                      <p className="font-bold text-primary text-sm font-mono">{settleResult.new_loyalty_balance} pts</p>
                    </div>
                  </div>

                  {/* INVOICE BUTTONS: VIEW, PRINT, DOWNLOAD */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs gap-1.5 h-9 hover:bg-primary/5 hover:text-primary"
                      onClick={() => setShowInvoiceModal(true)}
                    >
                      <Eye className="h-3.5 w-3.5 text-primary" /> View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs gap-1.5 h-9 hover:bg-primary/5 hover:text-primary"
                      onClick={() => {
                        setShowInvoiceModal(true);
                        setTimeout(() => printInvoiceDom("print-invoice"), 300);
                      }}
                    >
                      <Printer className="h-3.5 w-3.5 text-primary" /> Print
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs gap-1.5 h-9 hover:bg-primary/5 hover:text-primary"
                      onClick={handleDownloadInvoice}
                      disabled={downloadingInvoice}
                    >
                      <Download className={`h-3.5 w-3.5 text-primary ${downloadingInvoice ? "animate-spin" : ""}`} />
                      {downloadingInvoice ? "Downloading…" : "Download"}
                    </Button>
                  </div>
                </div>

                {/* 2. SECONDARY ACTION: WHATSAPP MESSAGE PREVIEW CARD */}
                <div className="rounded-2xl border p-3.5 bg-muted/20 max-w-md mx-auto text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <MessageSquare className="h-4 w-4" /> Send WhatsApp Receipt (Optional)
                    </p>
                    <Badge variant="outline" className="text-[10px] rounded-full border-emerald-600/40 text-emerald-600">
                      Prefilled
                    </Badge>
                  </div>
                  <pre className="text-[11px] font-sans bg-background p-2.5 rounded-lg border whitespace-pre-wrap text-muted-foreground">
                    {`Hi ${settleResult.customer_name || custName || "Guest"},\n\nThank you for visiting ${setupSettings?.name || "Jail Restaurant"} ❤️\n\nYour payment of ${fmt(settleResult.total_amount)} has been received successfully.\n\nInvoice No: INV-${order?.order_number.replace("ORD-", "")}\nOrder No: ${order?.order_number}\nLoyalty Balance: ${settleResult.new_loyalty_balance} pts (+${settleResult.earned_points} earned today)\n\nWe hope you enjoyed your meal.\n\nThank you,\n${setupSettings?.name || "Jail Restaurant"}`}
                  </pre>
                  <Button
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-2"
                    onClick={() =>
                      openWhatsApp(
                        phoneInput || settleResult.customer_phone || "",
                        `Hi ${settleResult.customer_name || custName || "Guest"},\n\nThank you for visiting ${setupSettings?.name || "Jail Restaurant"} ❤️\n\nYour payment of ${fmt(settleResult.total_amount)} has been received successfully.\n\nInvoice No: INV-${order?.order_number.replace("ORD-", "")}\nOrder No: ${order?.order_number}\nLoyalty Balance: ${settleResult.new_loyalty_balance} pts (+${settleResult.earned_points} earned today)\n\nWe hope you enjoyed your meal.\n\nThank you,\n${setupSettings?.name || "Jail Restaurant"}`
                      )
                    }
                  >
                    <MessageSquare className="h-4 w-4" /> Send via WhatsApp
                  </Button>
                </div>

                {/* 30-Second Auto Release Banner */}
                {!tableFreed ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-3 max-w-md mx-auto text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                      <span>Auto-releasing table <strong>{tableName}</strong> in <strong>{releaseCountdown}s</strong></span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs rounded-lg border-amber-600/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
                      onClick={() => {
                        qc.invalidateQueries({ queryKey: ["orders"] });
                        qc.invalidateQueries({ queryKey: ["tables", "map"] });
                        qc.invalidateQueries({ queryKey: ["customers"] });
                        toast.success(`Table ${tableName} is now free! Ready for next guest.`);
                        setTableFreed(true);
                      }}
                    >
                      Release Now
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 max-w-md mx-auto text-xs flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Table <strong>{tableName}</strong> is now free & ready for next guest!</span>
                  </div>
                )}
              </div>
            ) : (
              /* COLLECT PAYMENT FORM */
              order && (
                <div className="space-y-4 py-1">
                  {/* Order Summary Header */}
                  <div className="rounded-xl border p-3 bg-primary/5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Order {order.order_number}</p>
                      <p className="text-xs text-muted-foreground">{tableName}</p>
                    </div>
                    <div className="text-right">
                      {discountAmount > 0 && (
                        <p className="text-[11px] text-muted-foreground line-through">{fmt(order.total_amount)}</p>
                      )}
                      <span className="font-display text-lg font-bold text-primary">{fmt(finalOrderTotal)}</span>
                    </div>
                  </div>

                  {/* ATTACHED OR DETECTED CUSTOMER SUMMARY */}
                  {order.customer && !isEditingCustomer ? (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                            {order.customer.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm text-foreground">{order.customer.name}</h4>
                              <Badge className="bg-emerald-600 text-white text-[10px] rounded-full px-2 py-0.5 font-medium">
                                {order.customer.visit_count >= 5 || order.customer.total_spent >= 5000
                                  ? "VIP Guest"
                                  : order.customer.visit_count > 1
                                  ? "Repeat Guest"
                                  : "New Guest"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">{order.customer.phone}</p>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs rounded-xl hover:bg-muted text-muted-foreground gap-1 font-medium"
                          onClick={() => setIsEditingCustomer(true)}
                        >
                          <User className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </div>

                      {/* LOYALTY & VISITS SUMMARY GRID */}
                      <div className="grid grid-cols-4 gap-2 text-xs border-t border-emerald-200 dark:border-emerald-800/40 pt-3">
                        <div>
                          <p className="text-muted-foreground text-[10px]">Current Points</p>
                          <p className="font-bold text-sm text-foreground">
                            {autoDetectResult?.loyalty?.current_points ?? order.customer.loyalty_points ?? 0} pts
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px]">Earned Today</p>
                          <p className="font-bold text-sm text-emerald-600">
                            +{autoDetectResult?.loyalty?.points_earned ?? 0} pts
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px]">Total After</p>
                          <p className="font-bold text-sm text-primary font-mono">
                            {(autoDetectResult?.loyalty?.current_points ?? order.customer.loyalty_points ?? 0) + (autoDetectResult?.loyalty?.points_earned ?? 0)} pts
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px]">Visits</p>
                          <p className="font-bold text-sm text-foreground">{order.customer.visit_count || 1} visit(s)</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* PHONE INPUT FOR UNATTACHED CUSTOMERS (STAFF ORDERS) OR WHEN EDITING */
                    <div className="space-y-3">
                      {isEditingCustomer && (
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                          <span>Change Customer for Order</span>
                          <button
                            type="button"
                            className="text-primary hover:underline text-xs"
                            onClick={() => {
                              setIsEditingCustomer(false);
                              if (order.customer) setPhoneInput(order.customer.phone);
                            }}
                          >
                            Cancel Edit
                          </button>
                        </div>
                      )}

                      <div>
                        <Label className="text-xs font-semibold">Customer Phone Number *</Label>
                        <div className="relative mt-1.5">
                          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="text"
                            inputMode="numeric"
                            maxLength={10}
                            placeholder="Enter 10-digit phone number…"
                            value={phoneInput}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                              setPhoneInput(val);
                              if (val.length === 10) {
                                handleDetectCustomer(val);
                              } else {
                                setAutoDetectResult(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const cleanDigits = phoneInput.replace(/\D/g, "");
                                if (cleanDigits.length !== 10) {
                                  toast.error("Please enter a valid 10-digit phone number.");
                                  return;
                                }
                                handleDetectCustomer(phoneInput);
                              }
                            }}
                            onBlur={() => {
                              const cleanDigits = phoneInput.replace(/\D/g, "");
                              if (cleanDigits.length === 10) {
                                handleDetectCustomer(phoneInput);
                              }
                            }}
                            className="pl-9 text-xs h-9 rounded-xl font-mono"
                          />
                          {detecting && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-primary" />}
                        </div>
                      </div>

                      {/* AUTO-DETECTED RESULT VIEWS */}
                      {autoDetectResult && (
                        <>
                          {autoDetectResult.exists ? (
                            /* EXISTING CUSTOMER VIEW */
                            <div className="rounded-xl border border-emerald-600/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-base">👋</span>
                                  <span className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">
                                    Welcome Back, {autoDetectResult.name}!
                                  </span>
                                </div>
                                <Badge className="bg-emerald-600 text-white rounded-full text-[10px]">Existing Customer</Badge>
                              </div>

                              {autoDetectResult.loyalty && (
                                <div className="grid grid-cols-3 gap-2 text-xs border-t border-emerald-200 dark:border-emerald-800/40 pt-2.5 mt-1">
                                  <div>
                                    <p className="text-muted-foreground text-[10px]">Current Points</p>
                                    <p className="font-bold text-sm text-foreground">{autoDetectResult.loyalty.current_points} pts</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-[10px]">Earned Today</p>
                                    <p className="font-bold text-sm text-emerald-600">+{autoDetectResult.loyalty.points_earned} pts</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-[10px]">After Payment</p>
                                    <p className="font-bold text-sm text-primary font-mono">
                                      {autoDetectResult.loyalty.current_points + autoDetectResult.loyalty.points_earned} pts
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* NEW CUSTOMER FORM */
                            <div className="rounded-xl border p-3.5 bg-muted/20 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-xs text-muted-foreground">New Customer Registration</span>
                                <Badge variant="outline" className="rounded-full text-[10px]">New</Badge>
                              </div>

                              <div>
                                <Label className="text-xs font-semibold">Customer Name *</Label>
                                <Input
                                  placeholder="e.g. Rahul Verma"
                                  value={custName}
                                  onChange={(e) => setCustName(e.target.value)}
                                  className="mt-1 text-xs h-8 rounded-lg"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[11px]">Birthday (optional)</Label>
                                  <Input
                                    type="date"
                                    value={custBday}
                                    onChange={(e) => setCustBday(e.target.value)}
                                    className="mt-1 text-xs h-8 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[11px]">Anniversary (optional)</Label>
                                  <Input
                                    type="date"
                                    value={custAnni}
                                    onChange={(e) => setCustAnni(e.target.value)}
                                    className="mt-1 text-xs h-8 rounded-lg"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* PROMO CODE / COUPON SECTION */}
                  <div className="rounded-xl border p-3 bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                        <Tag className="h-3.5 w-3.5 text-amber-500" /> Apply Promo Code / Coupon
                      </Label>
                      {appliedCoupon?.valid && (
                        <Badge className="bg-emerald-600 text-white text-[10px] rounded-full px-2 py-0.5 font-semibold">
                          Save {fmt(discountAmount)}
                        </Badge>
                      )}
                    </div>

                    {appliedCoupon?.valid ? (
                      <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <div>
                            <p className="font-bold text-emerald-700 dark:text-emerald-300">
                              {appliedCoupon.coupon?.code || couponCode.toUpperCase()} Applied
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {appliedCoupon.coupon?.reward_description || `Discount of ${fmt(discountAmount)} applied`}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-lg px-2"
                          onClick={() => {
                            setAppliedCoupon(null);
                            setCouponCode("");
                            setCouponError(null);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter Promo Code (e.g. SAVE10)"
                            value={couponCode}
                            onChange={(e) => {
                              setCouponCode(e.target.value.toUpperCase());
                              if (couponError) setCouponError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleValidateCoupon();
                              }
                            }}
                            className="text-xs h-9 rounded-lg uppercase tracking-wider font-mono font-medium"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={handleValidateCoupon}
                            disabled={isValidatingCoupon || !couponCode.trim()}
                            className="h-9 px-4 text-xs rounded-lg font-semibold shrink-0"
                          >
                            {isValidatingCoupon ? (
                              <>
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Validating…
                              </>
                            ) : (
                              "Apply"
                            )}
                          </Button>
                        </div>
                        {couponError && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 mt-1">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {couponError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* PAYMENT METHOD SELECTION */}
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Payment Method</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("UPI")}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-xs font-medium ${
                          paymentMethod === "UPI"
                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                            : "hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <QrCode className="h-4 w-4 mb-1" />
                        <span>UPI / QR</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("CASH")}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-xs font-medium ${
                          paymentMethod === "CASH"
                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                            : "hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <Banknote className="h-4 w-4 mb-1" />
                        <span>Cash</span>
                      </button>
                    </div>
                  </div>

                  {/* STORE PAYMENT QR PREVIEW IF UPI */}
                  {paymentMethod === "UPI" && (() => {
                    const upiId = (bizSettings?.payment_upi_id || "").trim();
                    const payeeName = (bizSettings?.payment_payee_name || (bizSettings as any)?.payment_payee_name || "").trim();
                    const payableTotal = Number(finalOrderTotal ?? 0);
                    const formattedPayable = payableTotal.toFixed(2);

                    if (isBizSettingsLoading) {
                      return (
                        <div className="rounded-xl border p-3 bg-muted/20 text-center space-y-2">
                          <p className="text-[11px] font-semibold text-muted-foreground">Scan Store Payment QR</p>
                          <div className="h-36 w-36 mx-auto rounded-lg border bg-muted/40 flex flex-col items-center justify-center p-3 text-center animate-pulse">
                            <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                            <span className="text-[11px] font-medium text-muted-foreground">Generating payment QR...</span>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            <div className="h-5 w-24 rounded-full bg-muted/60 animate-pulse" />
                            <div className="h-5 w-16 rounded-full bg-muted/60 animate-pulse" />
                          </div>
                        </div>
                      );
                    }

                    if (isBizSettingsError || qrImageError) {
                      return (
                        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center space-y-2">
                          <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">Failed to Generate Payment QR</p>
                          <p className="text-[10px] text-muted-foreground">Could not generate the UPI QR code. Please check your connection.</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs rounded-full gap-1 mx-auto"
                            onClick={() => {
                              setQrImageError(false);
                              setQrImageLoaded(false);
                              refetchBizSettings();
                            }}
                          >
                            <RefreshCw className="h-3 w-3" /> Retry QR Generation
                          </Button>
                        </div>
                      );
                    }

                    if (upiId && payeeName) {
                      const rawUpiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${formattedPayable}&cu=INR`;
                      const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=8&data=${encodeURIComponent(rawUpiUri)}`;
                      return (
                        <div className="rounded-xl border p-3 bg-muted/20 text-center space-y-2">
                          <p className="text-[11px] font-semibold text-muted-foreground">Scan Store Payment QR</p>
                          <div className="relative mx-auto h-36 w-36">
                            {!qrImageLoaded && (
                              <div className="absolute inset-0 rounded-lg border bg-muted/40 flex flex-col items-center justify-center p-3 text-center animate-pulse">
                                <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                                <span className="text-[11px] font-medium text-muted-foreground">Generating payment QR...</span>
                              </div>
                            )}
                            <img
                              src={dynamicQrUrl}
                              alt="Store Payment QR"
                              className={`h-36 w-36 object-contain mx-auto rounded-lg border bg-white p-1.5 shadow-sm transition-opacity duration-200 ${
                                qrImageLoaded ? "opacity-100" : "opacity-0"
                              }`}
                              onLoad={() => {
                                setQrImageLoaded(true);
                                setQrImageError(false);
                              }}
                              onError={() => {
                                setQrImageError(true);
                                setQrImageLoaded(false);
                              }}
                            />
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            <span className="text-[10px] font-mono font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              UPI: {upiId}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              ₹{formattedPayable}
                            </span>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-300 text-xs space-y-1 text-center">
                          <p className="font-semibold text-[11px]">No Payment QR Configured</p>
                          <p className="text-[10px] text-muted-foreground">Configure your UPI ID and Payee Name in Setup.</p>
                        </div>
                      );
                    }
                  })()}
                </div>
              )
            )}
          </div>

          <DialogFooter className="p-4 border-t shrink-0 bg-background flex items-center justify-between gap-2">
            {settleResult ? (
              <div className="flex items-center justify-between w-full">
                <Button
                  variant="outline"
                  className="rounded-full text-xs gap-1.5"
                  onClick={() => setShowInvoiceModal(true)}
                >
                  <Printer className="h-3.5 w-3.5" /> View / Print Invoice
                </Button>
                <Button className="rounded-full gradient-brand text-primary-foreground text-xs px-5" onClick={handleCompleteRelease}>
                  {tableFreed ? "Done & Close" : `Done & Close (${releaseCountdown}s)`}
                </Button>
              </div>
            ) : (
              <>
                <Button variant="outline" className="rounded-full text-xs" onClick={() => setPayDialogOpen(false)}>
                  Cancel
                </Button>
                {(() => {
                  const upiId = (bizSettings?.payment_upi_id || "").trim();
                  const payeeName = (bizSettings?.payment_payee_name || (bizSettings as any)?.payment_payee_name || "").trim();
                  const isUpiIncompleteOrLoading =
                    paymentMethod === "UPI" &&
                    (isBizSettingsLoading ||
                      !upiId ||
                      !payeeName ||
                      !qrImageLoaded ||
                      qrImageError ||
                      isBizSettingsError);

                  return (
                    <Button
                      onClick={handleSettleSubmit}
                      disabled={settleMut.isPending || !phoneInput.trim() || isUpiIncompleteOrLoading}
                      className="rounded-full gradient-brand text-primary-foreground text-xs px-6"
                    >
                      {settleMut.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm Payment & Complete
                        </>
                      )}
                    </Button>
                  );
                })()}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

       {/* PRINTABLE INVOICE MODAL */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Tax Invoice</DialogTitle>
          </DialogHeader>

          {order && (
            <InvoiceView
              defaultPaperSize={bizSettings?.receipt_paper_size || "80mm"}
              data={{
                order_number: order.order_number,
                invoice_number: order.invoice_number || `INV-${order.order_number.replace("ORD-", "")}`,
                created_at: order.created_at,
                table_name: tableName,
                // ✅ 1. Accurate Customer Name Priority
                customer_name:
                  order.customer?.name ||
                  order.customer_name ||
                  settleResult?.customer_name ||
                  autoDetectResult?.name ||
                  custName ||
                  "Guest Customer",
                customer_phone: order.customer?.phone || phoneInput || "",
                  payment_method: (
                    settleResult?.payment_method ||
                    settleResult?.payment_mode ||
                    (order as any)?.payment_method ||
                    (order as any)?.payment_mode ||
                    (order as any)?.payment_type ||
                    paymentMethod ||
                    "UPI"
                  ).toUpperCase(),
                items: order.items,
                subtotal: order.subtotal,
                tax_amount: order.tax_amount,
                // ✅ 3. Dynamic GST Percentage
                tax_rate: gstPercentage,
                gst_percentage: gstPercentage,
                coupon_code: (
                  (order as any)?.coupon_code ||
                  (order as any)?.applied_coupon_code ||
                  (order as any)?.couponCode ||
                  appliedCoupon?.coupon?.code ||
                  settleResult?.coupon_code ||
                  (couponCode.trim() ? couponCode.trim().toUpperCase() : "BIRTHDAY20")
                ).toUpperCase(),
                discount_amount: order.discount_amount || (order as any)?.coupon_discount || settleResult?.discount_amount || discountAmount || 0,
                total_amount: settleResult?.total_amount || order.total_amount,
                business: {
                  restaurant_name: setupSettings?.name || (profile as any)?.businessName || "Jail Restaurant",
                  address: setupSettings?.address || undefined,
                  phone: setupSettings?.phone || undefined,
                  email: setupSettings?.email || undefined,
                  gst_number: setupSettings?.gst_number || undefined,
                },
                loyalty: settleResult
                  ? {
                      current_points: settleResult.new_loyalty_balance,
                      earned_points: settleResult.earned_points,
                      remaining_until_next_reward: settleResult.remaining_until_next_reward,
                    }
                  : null,
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ADD EXTRA DISHES DIALOG */}
      <Dialog open={addItemsOpen} onOpenChange={setAddItemsOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-base">
              <Plus className="h-5 w-5 text-primary" /> Add Extra Dishes to {order?.order_number} ({tableName})
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-[140px_1fr] max-h-[380px]">
            {/* Category List */}
            <div className="space-y-1 overflow-y-auto max-h-[360px] pr-1">
              {menuCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCatId(c.id)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2 text-left text-xs font-medium transition-all",
                    c.id === currentCatId
                      ? "gradient-brand text-primary-foreground shadow-sm"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Category Dishes Grid */}
            <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[360px] pr-1">
              {currentCatItems.map((m) => (
                <div key={m.id} className="rounded-xl border p-2.5 flex flex-col justify-between text-xs">
                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-muted-foreground mt-0.5">{fmt(m.price)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7 w-full rounded-lg text-xs"
                    onClick={() => addToExtraCart(m)}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Extra Cart Drawer */}
          {extraCart.length > 0 && (
            <div className="rounded-xl border p-3 bg-muted/20 space-y-2 mt-2">
              <p className="text-xs font-semibold text-muted-foreground">Selected Extra Dishes ({extraCart.length})</p>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                {extraCart.map((i) => (
                  <div key={i.menu_item_id} className="flex items-center justify-between text-xs bg-background p-2 rounded-lg border">
                    <span className="font-medium">{i.item_name}</span>
                    <div className="flex items-center gap-1.5">
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => bumpExtraQty(i.menu_item_id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-4 text-center font-semibold">{i.quantity}</span>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => bumpExtraQty(i.menu_item_id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <span className="font-bold w-14 text-right">{fmt(i.unit_price * i.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button variant="outline" className="rounded-full text-xs" onClick={() => setAddItemsOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-full gradient-brand text-primary-foreground text-xs px-5"
              disabled={extraCart.length === 0 || addingExtra}
              onClick={handleSaveExtraItems}
            >
              {addingExtra ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Save to Temporary Order ({fmt(extraCart.reduce((s, i) => s + i.unit_price * i.quantity, 0))})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}