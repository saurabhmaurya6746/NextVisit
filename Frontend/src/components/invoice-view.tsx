import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { fmt } from "@/lib/currency";
import { jsPDF } from "jspdf";

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

export function InvoiceView({
  data,
  order,
  showPrintButton = true,
}: {
  data?: InvoiceData;
  order?: any;
  showPrintButton?: boolean;
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

  const invNum = invData.invoice_number || `INV-${invData.order_number.replace("ORD-", "")}`;
  const d = new Date(invData.created_at);
  const dateStr = d.toLocaleDateString("en-GB");
  const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handlePrint = () => {
    try {
      const invNo = invNum;
      const dateStrFormatted = `${dateStr} at ${timeStr}`;
      const items = invData.items || [];
      const baseHeight = 125;
      const itemsHeight = Math.max(items.length, 1) * 5;
      const totalHeight = baseHeight + itemsHeight;

      const pdf = new jsPDF({
        unit: "mm",
        format: [80, Math.max(totalHeight, 130)],
      });

      let y = 10;

      pdf.setTextColor(0, 0, 0);
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(0.25);

      // Header
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(invData.business?.restaurant_name || "Jail Restaurant", 40, y, { align: "center" });
      y += 4.5;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      if (invData.business?.address) {
        pdf.text(invData.business.address, 40, y, { align: "center" });
        y += 3.5;
      }
      if (invData.business?.phone) {
        pdf.text(`Ph: ${invData.business.phone}`, 40, y, { align: "center" });
        y += 3.5;
      }
      if (invData.business?.gst_number) {
        pdf.text(`GSTIN: ${invData.business.gst_number}`, 40, y, { align: "center" });
        y += 3.5;
      }

      y += 2;
      pdf.line(8, y, 72, y);
      y += 5;

      // Metadata
      pdf.text("Invoice No:", 8, y);
      pdf.setFont("helvetica", "bold");
      pdf.text(invNo, 72, y, { align: "right" });
      y += 4;

      pdf.setFont("helvetica", "normal");
      pdf.text("Order No:", 8, y);
      pdf.setFont("helvetica", "bold");
      pdf.text(invData.order_number, 72, y, { align: "right" });
      y += 4;

      pdf.setFont("helvetica", "normal");
      pdf.text("Date & Time:", 8, y);
      pdf.setFont("helvetica", "bold");
      pdf.text(dateStrFormatted, 72, y, { align: "right" });
      y += 4;

      if (invData.table_name) {
        pdf.setFont("helvetica", "normal");
        pdf.text("Table:", 8, y);
        pdf.setFont("helvetica", "bold");
        pdf.text(invData.table_name, 72, y, { align: "right" });
        y += 4;
      }

      pdf.setFont("helvetica", "normal");
      pdf.text("Customer:", 8, y);
      pdf.setFont("helvetica", "bold");
      pdf.text(invData.customer_name || "Guest", 72, y, { align: "right" });
      y += 4;

      pdf.setFont("helvetica", "normal");
      pdf.text("Payment Method:", 8, y);
      pdf.setFont("helvetica", "bold");
      pdf.text((invData.payment_method || "CASH").toUpperCase(), 72, y, { align: "right" });
      y += 5;

      pdf.line(8, y, 72, y);
      y += 4;

      // Items Header
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.text("Item", 8, y);
      pdf.text("Qty", 42, y, { align: "right" });
      pdf.text("Price", 57, y, { align: "right" });
      pdf.text("Total", 72, y, { align: "right" });
      y += 4;

      pdf.line(8, y, 72, y);
      y += 5;

      // Items Rows
      pdf.setFont("helvetica", "normal");
      items.forEach((item) => {
        const name = item.item_name.length > 18 ? item.item_name.slice(0, 16) + ".." : item.item_name;
        pdf.text(name, 8, y);
        pdf.text(String(item.quantity), 42, y, { align: "right" });
        pdf.text(`Rs.${item.unit_price}`, 57, y, { align: "right" });
        pdf.text(`Rs.${item.subtotal}`, 72, y, { align: "right" });
        y += 5;
      });

      pdf.line(8, y, 72, y);
      y += 5;

      // Totals
      pdf.text("Subtotal", 8, y);
      pdf.text(`Rs.${invData.subtotal}`, 72, y, { align: "right" });
      y += 4;

      if (invData.discount_amount && invData.discount_amount > 0) {
        const codeLabel = invData.coupon_code ? `Coupon (${invData.coupon_code.toUpperCase()})` : "Coupon (BIRTHDAY20)";
        pdf.text(codeLabel, 8, y);
        pdf.setTextColor(220, 38, 38);
        pdf.text(`-Rs.${invData.discount_amount}`, 72, y, { align: "right" });
        pdf.setTextColor(0, 0, 0);
        y += 4;
      }

      if (invData.tax_amount) {
        pdf.text("GST", 8, y);
        pdf.text(`Rs.${invData.tax_amount}`, 72, y, { align: "right" });
        y += 4;
      }

      pdf.line(8, y, 72, y);
      y += 5;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("Grand Total", 8, y);
      pdf.text(`Rs.${invData.total_amount}`, 72, y, { align: "right" });
      y += 6;

      pdf.line(8, y, 72, y);
      y += 6;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.text("Thank you for visiting!", 40, y, { align: "center" });

      pdf.autoPrint();
      const blobUrl = pdf.output("bloburl");
      window.open(blobUrl, "_blank");
    } catch (err) {
      console.error("Failed to print thermal PDF:", err);
    }
  };

  return (
    <div className="space-y-4">
      {showPrintButton && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="rounded-full gap-1.5 text-xs" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" /> Print Thermal Invoice
          </Button>
        </div>
      )}

      <div
        id="print-invoice"
        className="mx-auto max-w-md rounded-2xl border bg-card p-6 text-card-foreground text-sm shadow-sm"
      >
        {/* Restaurant Header */}
        <div className="text-center space-y-0.5">
          <p className="font-display text-xl font-bold tracking-tight">
            {invData.business?.restaurant_name || "Jail Restaurant"}
          </p>
          {invData.business?.address && <p className="text-xs text-muted-foreground">{invData.business.address}</p>}
          {invData.business?.phone && <p className="text-xs text-muted-foreground">Ph: {invData.business.phone}</p>}
          {invData.business?.gst_number && (
            <p className="text-[11px] font-mono text-muted-foreground">GSTIN: {invData.business.gst_number}</p>
          )}
        </div>

        {/* Invoice Metadata */}
        <div className="my-4 border-y py-2.5 text-xs space-y-1">
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
            <span>
              {dateStr} at {timeStr}
            </span>
          </div>
          {invData.table_name && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Table:</span>
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
              <span>{invData.customer_phone}</span>
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
              <span className="text-muted-foreground">Cashier / Staff:</span>
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
                <td className="py-2 pr-2">
                  <span className="font-medium">{i.item_name}</span>
                  {i.notes && <div className="text-[10px] text-muted-foreground">Note: {i.notes}</div>}
                </td>
                <td className="py-2 text-right tabular-nums">{i.quantity}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt(i.unit_price)}</td>
                <td className="py-2 text-right tabular-nums font-medium">{fmt(i.subtotal)}</td>
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
          
          // Dynamic GST calculation fallback (checks passed gst_percentage, tax_rate, or calculates from subtotal vs tax_amount)
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
            <div className="mt-4 space-y-1.5 border-t pt-3 text-xs">
              {/* Subtotal */}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums font-mono">{fmt(subtotal)}</span>
              </div>

              {/* Coupon Discount */}
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Coupon Discount ({couponCode ? couponCode.toUpperCase() : "BIRTHDAY20"})</span>
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
          <div className="mt-4 rounded-xl bg-muted/50 p-3 text-xs space-y-1 border">
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
              <p className="text-[11px] text-muted-foreground pt-0.5">
                Earn {invData.loyalty.remaining_until_next_reward} more points for your next reward!
              </p>
            ) : null}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-muted-foreground space-y-0.5">
          <p className="font-medium text-foreground">Thank you for visiting!</p>
          <p className="text-[11px]">We look forward to serving you again.</p>
        </div>
      </div>
    </div>
  );
}