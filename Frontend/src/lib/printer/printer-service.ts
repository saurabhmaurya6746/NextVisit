/**
 * NextVisit Thermal Printer Service
 *
 * Provides printer discovery, ESC/POS hardware dispatch via Tauri IPC,
 * browser-print fallback, paper width formatting (58mm/80mm),
 * and duplicate reprint tracking.
 *
 * Guarantees:
 * - Printer failure never aborts or loses an order.
 * - Browser runtime gracefully falls back to window.print.
 * - Reprints are clearly tagged with DUPLICATE / REPRINT.
 */

import { invoke } from "@tauri-apps/api/core";
import { isDesktopApp } from "../desktop";
import { printInvoiceDom, type InvoiceData } from "@/components/invoice-view";
import { toast } from "sonner";

export interface PrinterConfig {
  target: "BROWSER" | "SYSTEM" | "NETWORK";
  system_printer_name?: string | null;
  network_host?: string | null;
  network_port?: number;
  paper_width: "58mm" | "80mm";
  auto_cut: boolean;
  open_cash_drawer: boolean;
  auto_print_on_settle: boolean;
}

export interface ReceiptItemDto {
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string | null;
}

export interface ReceiptPrintPayload {
  business_name: string;
  address?: string | null;
  phone?: string | null;
  gst_number?: string | null;
  order_number: string;
  invoice_number?: string | null;
  receipt_reference?: string | null;
  is_offline: boolean;
  created_at: string;
  table_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  staff_name?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  reference_note?: string | null;
  items: ReceiptItemDto[];
  subtotal: number;
  discount_amount: number;
  coupon_code?: string | null;
  enable_gst: boolean;
  gst_percentage: number;
  tax_amount: number;
  total_amount: number;
  earned_loyalty_points?: number | null;
  total_loyalty_points?: number | null;
  is_reprint: boolean;
  paper_width?: string | null;
  auto_cut?: boolean | null;
  open_drawer?: boolean | null;
}

export interface PrintResult {
  success: boolean;
  message: string;
  method_used: "SYSTEM" | "NETWORK" | "BROWSER_FALLBACK";
  bytes_sent: number;
}

const DEFAULT_CONFIG: PrinterConfig = {
  target: "BROWSER",
  system_printer_name: null,
  network_host: null,
  network_port: 9100,
  paper_width: "80mm",
  auto_cut: true,
  open_cash_drawer: false,
  auto_print_on_settle: false,
};

// Track which orders have already been printed in this session for reprint detection
const printedOrdersSet = new Set<string>();

export function isOrderAlreadyPrinted(orderNumberOrRef: string): boolean {
  if (!orderNumberOrRef) return false;
  return printedOrdersSet.has(orderNumberOrRef);
}

export function markOrderAsPrinted(orderNumberOrRef: string): void {
  if (orderNumberOrRef) {
    printedOrdersSet.add(orderNumberOrRef);
  }
}

export function getPrinterConfig(businessId: string): PrinterConfig {
  if (typeof window === "undefined" || !businessId) return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(`nv_printer_config_${businessId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
      };
    }
  } catch (err) {
    console.warn("[PRINTER] Failed to read printer config from localStorage:", err);
  }
  return DEFAULT_CONFIG;
}

export function savePrinterConfig(businessId: string, config: PrinterConfig): void {
  if (typeof window === "undefined" || !businessId) return;
  try {
    localStorage.setItem(`nv_printer_config_${businessId}`, JSON.stringify(config));
  } catch (err) {
    console.warn("[PRINTER] Failed to save printer config to localStorage:", err);
  }
}

/**
 * Enumerates installed Windows printers via Tauri IPC.
 * Browser returns empty array.
 */
export async function listSystemPrinters(): Promise<string[]> {
  if (!isDesktopApp()) return [];
  try {
    const list = await invoke<string[]>("printer_list_system");
    return list || [];
  } catch (err) {
    console.warn("[PRINTER] Failed to list system printers:", err);
    return [];
  }
}

/**
 * Dispatches a diagnostic test receipt to the configured thermal printer.
 */
export async function printTestReceipt(config: PrinterConfig): Promise<PrintResult> {
  if (!isDesktopApp() || config.target === "BROWSER") {
    // Test browser print
    printInvoiceDom("print-invoice");
    return {
      success: true,
      message: "Browser print dialog opened.",
      method_used: "BROWSER_FALLBACK",
      bytes_sent: 0,
    };
  }

  try {
    const res = await invoke<PrintResult>("printer_print_test", { config });
    return res;
  } catch (err: any) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
      method_used: config.target === "NETWORK" ? "NETWORK" : "SYSTEM",
      bytes_sent: 0,
    };
  }
}

/**
 * Converts InvoiceData into ReceiptPrintPayload for the ESC/POS generator.
 */
export function convertInvoiceToReceiptPayload(
  inv: InvoiceData,
  config: PrinterConfig,
  isReprint: boolean = false
): ReceiptPrintPayload {
  const subtotal = inv.subtotal || 0;
  const discount = inv.discount_amount || 0;
  const netSubtotal = Math.max(0, subtotal - discount);

  const enableGst = inv.enable_gst ?? inv.business?.enable_gst ?? (inv.tax_amount ? inv.tax_amount > 0 : true);
  const gstPct = inv.gst_percentage ?? inv.tax_rate ?? inv.business?.tax_percentage ?? 5;
  const taxAmount = inv.tax_amount || 0;
  const grandTotal = inv.total_amount || (netSubtotal + taxAmount);

  return {
    business_name: inv.business?.restaurant_name || "NextVisit",
    address: inv.business?.address || null,
    phone: inv.business?.phone || null,
    gst_number: inv.business?.gst_number || null,
    order_number: inv.order_number,
    invoice_number: inv.invoice_number || null,
    receipt_reference: inv.receipt_reference || null,
    is_offline: Boolean(inv.is_offline),
    created_at: inv.created_at,
    table_name: inv.table_name || null,
    customer_name: inv.customer_name || null,
    customer_phone: inv.customer_phone || null,
    staff_name: inv.staff_name || null,
    payment_method: inv.payment_method || "CASH",
    payment_status: inv.payment_status || (inv.is_offline ? "RECORDED_OFFLINE" : "PAID"),
    reference_note: (inv as any).reference_note || null,
    items: (inv.items || []).map((i) => ({
      item_name: i.item_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      subtotal: i.subtotal,
      notes: i.notes || null,
    })),
    subtotal,
    discount_amount: discount,
    coupon_code: inv.coupon_code || null,
    enable_gst: Boolean(enableGst),
    gst_percentage: gstPct,
    tax_amount: taxAmount,
    total_amount: grandTotal,
    earned_loyalty_points: inv.loyalty?.earned_points ?? null,
    total_loyalty_points: inv.loyalty?.current_points ?? null,
    is_reprint: isReprint,
    paper_width: config.paper_width,
    auto_cut: config.auto_cut,
    open_drawer: config.open_cash_drawer,
  };
}

/**
 * Core print dispatch method:
 * - If config is BROWSER or running in browser, triggers browser print.
 * - If SYSTEM or NETWORK, dispatches raw ESC/POS bytes via Tauri.
 * - If native print fails, safely triggers browser print fallback so the order is never lost!
 */
export async function dispatchReceiptPrint(
  businessId: string,
  invData: InvoiceData,
  options?: {
    forceReprint?: boolean;
    skipBrowserFallback?: boolean;
  }
): Promise<PrintResult> {
  const config = getPrinterConfig(businessId);
  const orderRef = invData.receipt_reference || invData.order_number;
  const isReprint = options?.forceReprint ?? isOrderAlreadyPrinted(orderRef);

  const payload = convertInvoiceToReceiptPayload(invData, config, isReprint);

  // 1. Browser print mode or not on desktop
  if (!isDesktopApp() || config.target === "BROWSER") {
    printInvoiceDom("print-invoice");
    markOrderAsPrinted(orderRef);
    return {
      success: true,
      message: "Browser print dialog opened.",
      method_used: "BROWSER_FALLBACK",
      bytes_sent: 0,
    };
  }

  // 2. Desktop native thermal print (SYSTEM Spooler or NETWORK TCP)
  try {
    const res = await invoke<PrintResult>("printer_print_receipt", {
      config,
      payload,
    });

    if (res.success) {
      markOrderAsPrinted(orderRef);
      toast.success(res.message);
      return res;
    }

    // Native printer returned non-fatal error
    console.warn("[PRINTER] Thermal print did not complete:", res.message);
    toast.error(`Thermal printer warning: ${res.message}`);

    if (!options?.skipBrowserFallback) {
      toast.info("Falling back to standard browser print dialog...");
      printInvoiceDom("print-invoice");
      markOrderAsPrinted(orderRef);
    }

    return res;
  } catch (err: any) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[PRINTER] Hardware print execution failure:", errMsg);
    toast.error(`Printer dispatch failed: ${errMsg}`);

    // Fallback: Order is NEVER lost!
    if (!options?.skipBrowserFallback) {
      toast.info("Opening browser print fallback...");
      printInvoiceDom("print-invoice");
      markOrderAsPrinted(orderRef);
    }

    return {
      success: false,
      message: errMsg,
      method_used: "BROWSER_FALLBACK",
      bytes_sent: 0,
    };
  }
}
