import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { fmt } from "@/lib/currency";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";

export interface InvoiceData {
  order_number: string;
  invoice_number?: string;
  created_at: string;
  table_name?: string;
  customer_name?: string;
  customer_phone?: string;
  staff_name?: string;
  payment_method?: string;
  items: Array<{
    id?: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    notes?: string | null;
  }>;
  subtotal: number;
  coupon_code?: string | null;
  tax_amount?: number;
  tax_rate?: number;
  discount_amount?: number;
  enable_gst?: boolean;
  gst_percentage?: number;
  price_includes_gst?: boolean;
  total_amount: number;
  business?: {
    restaurant_name?: string;
    address?: string;
    phone?: string;
    email?: string;
    gst_number?: string;
    enable_gst?: boolean;
    price_includes_gst?: boolean;
    tax_percentage?: number;
  };
  loyalty?: {
    current_points?: number;
    earned_points?: number;
    remaining_until_next_reward?: number;
  } | null;
}

export function printInvoiceDom(elementId: string = "print-invoice") {
  const el = document.getElementById(elementId);
  if (!el) {
    window.print();
    return;
  }

  // Remove any stale print root
  const oldRoot = document.getElementById("nextvisit-print-root");
  if (oldRoot) oldRoot.remove();

  const printRoot = document.createElement("div");
  printRoot.id = "nextvisit-print-root";
  printRoot.innerHTML = el.outerHTML;
  document.body.appendChild(printRoot);

  window.print();

  setTimeout(() => {
    if (printRoot && document.body.contains(printRoot)) {
      printRoot.remove();
    }
  }, 1000);
}

export function InvoiceView({
  data,
  order,
  showPrintButton = true,
  defaultPaperSize = "80mm",
}: {
  data?: InvoiceData;
  order?: any;
  showPrintButton?: boolean;
  defaultPaperSize?: "58mm" | "80mm" | "A4" | string;
}) {
  // Convert legacy order prop to InvoiceData if data is not directly provided
  const invData: InvoiceData = data || {
    order_number: order?.order_number || (order?.id ? `ORD-${order.id.slice(-4)}` : "ORD-1001"),
    invoice_number: order?.invoice_number || `INV-${(order?.order_number || order?.id || "1001").replace("ORD-", "")}`,
    created_at: order?.created_at || order?.createdAt || new Date().toISOString(),
    table_name: order?.table_name || order?.table || "Table 1",
    customer_name: order?.customer?.name || order?.customer_name || order?.customerName || "Guest Customer",
    customer_phone: order?.customer?.phone || order?.customer_phone || order?.customerPhone,
    payment_method: order?.payment_method || order?.payment_mode || order?.payment || "CASH",
    items: (order?.items || []).map((i: any) => ({
      id: i.id,
      item_name: i.item_name || i.name || "Dish",
      quantity: i.quantity || i.qty || 1,
      unit_price: i.unit_price || i.price || 0,
      subtotal: i.subtotal || (i.price * (i.quantity || i.qty || 1)) || 0,
      notes: i.notes,
    })),
    subtotal: order?.subtotal || 0,
    tax_amount: order?.tax_amount || order?.gst || 0,
    discount_amount: order?.discount_amount || 0,
    total_amount: order?.total_amount || order?.total || 0,
    business: order?.business || {
      restaurant_name: order?.restaurantName || "Jail Restaurant",
    },
    loyalty: order?.loyalty || null,
  };

  const [paperSize, setPaperSize] = useState<"58mm" | "80mm" | "A4">(
    defaultPaperSize === "58mm" ? "58mm" : defaultPaperSize === "A4" ? "A4" : "80mm"
  );
  const [downloading, setDownloading] = useState(false);

  const invNum = invData.invoice_number || `INV-${invData.order_number.replace("ORD-", "")}`;
  const d = new Date(invData.created_at);
  const dateStr = d.toLocaleDateString("en-GB");
  const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Native Browser Print Flow using Isolated Print Root
  const handlePrint = () => {
    printInvoiceDom("print-invoice");
  };

  // Dedicated PDF Download Flow with Dynamic Content Height
  const handleDownloadPdf = () => {
    setDownloading(true);
    try {
      const invNo = invNum;
      const dateStrFormatted = `${dateStr} at ${timeStr}`;
      const items = invData.items || [];

      const is58 = paperSize === "58mm";
      const isA4 = paperSize === "A4";

      const pdfWidth = is58 ? 58 : isA4 ? 210 : 80;
      const baseHeight = is58 ? 100 : isA4 ? 297 : 110;
      const itemsHeight = Math.max(items.length, 1) * (is58 ? 7 : 5.5);
      const totalHeight = isA4 ? 297 : baseHeight + itemsHeight;

      const pdf = new jsPDF({
        unit: "mm",
        format: [pdfWidth, totalHeight],
      });

      let y = is58 ? 6 : isA4 ? 15 : 10;
      const leftMargin = is58 ? 4 : isA4 ? 15 : 8;
      const rightMargin = is58 ? 54 : isA4 ? 195 : 72;
      const centerX = pdfWidth / 2;

      pdf.setTextColor(0, 0, 0);
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(0.2);

      // Header
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(is58 ? 9.5 : isA4 ? 14 : 11);
      pdf.text(invData.business?.restaurant_name || "NextVisit", centerX, y, { align: "center" });
      y += is58 ? 3.8 : 4.5;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(is58 ? 6.5 : 7.5);
      if (invData.business?.address) {
        pdf.text(invData.business.address, centerX, y, { align: "center" });
        y += 3.2;
      }
      if (invData.business?.phone) {
        pdf.text(`Ph: ${invData.business.phone}`, centerX, y, { align: "center" });
        y += 3.2;
      }
      if (invData.business?.gst_number) {
        pdf.text(`GSTIN: ${invData.business.gst_number}`, centerX, y, { align: "center" });
        y += 3.2;
      }

      y += 1.5;
      pdf.line(leftMargin, y, rightMargin, y);
      y += 4;

      // Metadata
      pdf.text("Invoice No:", leftMargin, y);
      pdf.setFont("helvetica", "bold");
      pdf.text(invNo, rightMargin, y, { align: "right" });
      y += 3.5;

      pdf.setFont("helvetica", "normal");
      pdf.text("Order No:", leftMargin, y);
      pdf.setFont("helvetica", "bold");
      pdf.text(invData.order_number, rightMargin, y, { align: "right" });
      y += 3.5;

      pdf.setFont("helvetica", "normal");
      pdf.text("Date & Time:", leftMargin, y);
      pdf.setFont("helvetica", "bold");
      pdf.text(dateStrFormatted, rightMargin, y, { align: "right" });
      y += 3.5;

      if (invData.table_name) {
        pdf.setFont("helvetica", "normal");
        pdf.text("Table:", leftMargin, y);
        pdf.setFont("helvetica", "bold");
        pdf.text(invData.table_name, rightMargin, y, { align: "right" });
        y += 3.5;
      }

      pdf.setFont("helvetica", "normal");
      pdf.text("Customer:", leftMargin, y);
      pdf.setFont("helvetica", "bold");
      pdf.text(invData.customer_name || "Guest", rightMargin, y, { align: "right" });
      y += 3.5;

      pdf.setFont("helvetica", "normal");
      pdf.text("Payment Method:", leftMargin, y);
      pdf.setFont("helvetica", "bold");
      pdf.text((invData.payment_method || "CASH").toUpperCase(), rightMargin, y, { align: "right" });
      y += 4.5;

      pdf.line(leftMargin, y, rightMargin, y);
      y += 3.5;

      // Items Header
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(is58 ? 6.5 : 7.5);
      pdf.text("Item", leftMargin, y);
      const qtyX = is58 ? 32 : isA4 ? 120 : 42;
      const priceX = is58 ? 42 : isA4 ? 155 : 57;
      pdf.text("Qty", qtyX, y, { align: "right" });
      pdf.text("Price", priceX, y, { align: "right" });
      pdf.text("Total", rightMargin, y, { align: "right" });
      y += 3.5;

      pdf.line(leftMargin, y, rightMargin, y);
      y += 4;

      // Items Rows
      pdf.setFont("helvetica", "normal");
      items.forEach((item) => {
        const maxLen = is58 ? 12 : 18;
        const name = item.item_name.length > maxLen ? item.item_name.slice(0, maxLen - 2) + ".." : item.item_name;
        pdf.text(name, leftMargin, y);
        pdf.text(String(item.quantity), qtyX, y, { align: "right" });
        pdf.text(`Rs.${item.unit_price}`, priceX, y, { align: "right" });
        pdf.text(`Rs.${item.subtotal}`, rightMargin, y, { align: "right" });
        y += 4.5;
      });

      pdf.line(leftMargin, y, rightMargin, y);
      y += 4;

      // Totals
      pdf.text("Subtotal", leftMargin, y);
      pdf.text(`Rs.${invData.subtotal}`, rightMargin, y, { align: "right" });
      y += 3.5;

      if (invData.discount_amount && invData.discount_amount > 0) {
        const codeLabel = invData.coupon_code ? `Coupon (${invData.coupon_code.toUpperCase()})` : "Discount";
        pdf.text(codeLabel, leftMargin, y);
        pdf.setTextColor(220, 38, 38);
        pdf.text(`-Rs.${invData.discount_amount}`, rightMargin, y, { align: "right" });
        pdf.setTextColor(0, 0, 0);
        y += 3.5;
      }

      if (invData.tax_amount) {
        pdf.text("GST", leftMargin, y);
        pdf.text(`Rs.${invData.tax_amount}`, rightMargin, y, { align: "right" });
        y += 3.5;
      }

      pdf.line(leftMargin, y, rightMargin, y);
      y += 4.5;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(is58 ? 8 : 9);
      pdf.text("Grand Total", leftMargin, y);
      pdf.text(`Rs.${invData.total_amount}`, rightMargin, y, { align: "right" });
      y += 5.5;

      pdf.line(leftMargin, y, rightMargin, y);
      y += 5;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(is58 ? 6.5 : 7.5);
      pdf.text("Thank you for visiting!", centerX, y, { align: "center" });

      pdf.save(`Invoice_${invNo}.pdf`);
    } catch (err) {
      console.error("Failed to download PDF invoice:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Paper Size Selector & Print Controls */}
      {showPrintButton && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl text-xs">
            <button
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer",
                paperSize === "58mm" ? "bg-background shadow-xs text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setPaperSize("58mm")}
            >
              58mm
            </button>
            <button
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer",
                paperSize === "80mm" ? "bg-background shadow-xs text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setPaperSize("80mm")}
            >
              80mm
            </button>
            <button
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer",
                paperSize === "A4" ? "bg-background shadow-xs text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setPaperSize("A4")}
            >
              A4
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="rounded-full gap-1.5 text-xs h-8" onClick={handleDownloadPdf} disabled={downloading}>
              <Download className={cn("h-3.5 w-3.5", downloading && "animate-spin")} /> {downloading ? "Saving…" : "Download PDF"}
            </Button>
            <Button size="sm" className="rounded-full gap-1.5 text-xs h-8 gradient-brand text-primary-foreground font-semibold" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" /> Print Invoice
            </Button>
          </div>
        </div>
      )}

      {/* Main Printable Invoice Wrapper */}
      <div
        id="print-invoice"
        className={cn(
          "print-active-invoice mx-auto rounded-2xl border bg-card text-card-foreground shadow-sm transition-all",
          paperSize === "58mm"
            ? "paper-58mm max-w-[340px] p-4 text-xs"
            : paperSize === "A4"
            ? "paper-a4 max-w-2xl p-8 text-sm"
            : "paper-80mm max-w-md p-6 text-sm"
        )}
      >
        {/* Business Header */}
        <div className="text-center space-y-0.5">
          <p className={cn("font-display font-bold tracking-tight text-foreground", paperSize === "58mm" ? "text-base" : "text-xl")}>
            {invData.business?.restaurant_name || "NextVisit"}
          </p>
          {invData.business?.address && <p className="text-[11px] text-muted-foreground leading-tight">{invData.business.address}</p>}
          {invData.business?.phone && <p className="text-[11px] text-muted-foreground">Ph: {invData.business.phone}</p>}
          {invData.business?.gst_number && (
            <p className="text-[11px] font-mono text-muted-foreground">GSTIN: {invData.business.gst_number}</p>
          )}
        </div>

        {/* Invoice Metadata */}
        <div className="my-3 border-y py-2 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invoice No:</span>
            <span className="font-mono font-semibold">{invNum}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order No:</span>
            <span className="font-mono font-medium">{invData.order_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date & Time:</span>
            <span className="tabular-nums">
              {dateStr} at {timeStr}
            </span>
          </div>
          {invData.table_name && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Table / Area:</span>
              <span className="font-medium">{invData.table_name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Customer:</span>
            <span className="font-medium">{invData.customer_name || "Guest Customer"}</span>
          </div>
          {invData.customer_phone && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone:</span>
              <span className="tabular-nums">{invData.customer_phone}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment Method:</span>
            <span className="font-semibold uppercase text-primary">
              {(invData.payment_method || "CASH").toUpperCase()}
            </span>
          </div>
          {invData.staff_name && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Staff:</span>
              <span>{invData.staff_name}</span>
            </div>
          )}
        </div>

        {/* Items Table */}
        <table className="w-full text-xs">
          <thead className="text-muted-foreground border-b pb-1">
            <tr className="text-left">
              <th className="pb-1.5 font-medium">Item</th>
              <th className="pb-1.5 text-right font-medium">Qty</th>
              <th className="pb-1.5 text-right font-medium">Price</th>
              <th className="pb-1.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {invData.items.map((i, idx) => (
              <tr key={i.id || idx}>
                <td className="py-1.5 pr-1">
                  <span className="font-medium leading-tight block">{i.item_name}</span>
                  {i.notes && <div className="text-[10px] text-muted-foreground">Note: {i.notes}</div>}
                </td>
                <td className="py-1.5 text-right tabular-nums align-top">{i.quantity}</td>
                <td className="py-1.5 text-right tabular-nums text-muted-foreground align-top">{fmt(i.unit_price)}</td>
                <td className="py-1.5 text-right tabular-nums font-medium align-top">{fmt(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals Section */}
        {(() => {
          const subtotal = invData.subtotal || 0;
          const discount = invData.discount_amount || 0;
          const couponCode = invData.coupon_code;
          const netSubtotal = Math.max(0, subtotal - discount);

          const enableGst = invData.enable_gst ?? invData.business?.enable_gst ?? (invData.tax_amount ? invData.tax_amount > 0 : true);

          const calculatedGst = subtotal > 0 && invData.tax_amount ? Math.round((invData.tax_amount / subtotal) * 100) : 5;
          const gstPct = invData.gst_percentage ?? invData.tax_rate ?? invData.business?.tax_percentage ?? (calculatedGst > 0 ? calculatedGst : 5);

          const isInclusive = invData.price_includes_gst ?? invData.business?.price_includes_gst ?? false;

          let taxableAmt = netSubtotal;
          let taxAmt = invData.tax_amount || 0;
          let grandTotal = invData.total_amount || netSubtotal;

          if (enableGst && taxAmt === 0 && gstPct > 0) {
            if (isInclusive) {
              grandTotal = netSubtotal;
              taxableAmt = Math.round((grandTotal / (1 + gstPct / 100)) * 100) / 100;
              taxAmt = Math.round((grandTotal - taxableAmt) * 100) / 100;
            } else {
              taxableAmt = netSubtotal;
              taxAmt = Math.round((taxableAmt * (gstPct / 100)) * 100) / 100;
              grandTotal = Math.round((taxableAmt + taxAmt) * 100) / 100;
            }
          }

          return (
            <div className="mt-3 space-y-1 border-t pt-2.5 text-xs">
              {/* Subtotal */}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums font-mono">{fmt(subtotal)}</span>
              </div>

              {/* Coupon Discount */}
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount {couponCode ? `(${couponCode.toUpperCase()})` : ""}</span>
                  <span className="tabular-nums font-mono">-{fmt(discount)}</span>
                </div>
              )}

              {/* Taxable Amount & GST Breakdown */}
              {enableGst && (taxAmt > 0 || gstPct > 0) && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxable Amount</span>
                    <span className="tabular-nums font-mono">{fmt(taxableAmt)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST ({gstPct}%) {isInclusive ? "(Inclusive)" : ""}</span>
                    <span className="tabular-nums font-mono">{fmt(taxAmt)}</span>
                  </div>
                </>
              )}

              {/* Grand Total */}
              <div className="flex justify-between border-t pt-2 font-display text-base font-bold">
                <span>Grand Total</span>
                <span className="tabular-nums text-primary font-mono">{fmt(grandTotal)}</span>
              </div>
            </div>
          );
        })()}

        {/* Loyalty Section */}
        {invData.loyalty && (
          <div className="mt-3 rounded-xl bg-muted/50 p-2.5 text-xs space-y-1 border">
            <p className="font-semibold text-primary">🎁 NextVisit Loyalty Rewards</p>
            {invData.loyalty.earned_points ? (
              <div className="flex justify-between">
                <span>Points Earned Today:</span>
                <span className="font-bold text-emerald-600">+{invData.loyalty.earned_points} pts</span>
              </div>
            ) : null}
            {invData.loyalty.current_points !== undefined && (
              <div className="flex justify-between">
                <span>Current Total Points:</span>
                <span className="font-semibold">{invData.loyalty.current_points} pts</span>
              </div>
            )}
            {invData.loyalty.remaining_until_next_reward ? (
              <p className="text-[10px] text-muted-foreground pt-0.5">
                Earn {invData.loyalty.remaining_until_next_reward} more points for your next reward!
              </p>
            ) : null}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 text-center text-xs text-muted-foreground space-y-0.5">
          <p className="font-medium text-foreground">Thank you for visiting!</p>
          <p className="text-[10.5px]">We look forward to serving you again.</p>
        </div>
      </div>
    </div>
  );
}