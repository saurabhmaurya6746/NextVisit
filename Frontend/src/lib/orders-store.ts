import { useEffect, useState } from "react";
import { customers as seedCustomers } from "./sample-data";
import { pushQrNotification } from "./notifications-store";

export type Payment = "cash" | "upi" | "card";
export type OrderStatus = "pending" | "completed";
export type PaymentStatus = "unpaid" | "paid";
export type OrderSource = "staff" | "qr";

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  notes?: string;
}
export interface Order {
  id: string;
  code?: string;
  table: string;
  items: OrderItem[];
  subtotal: number;
  gst: number;
  discount?: number;
  total: number;
  payment?: Payment;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  source: OrderSource;
  sessionId: string;
  customerId?: string;
  customerPhone?: string;
  customerName?: string;
  createdAt: string;
  paidAt?: string;
  visitCounted?: boolean;
}

const OKEY = "growthos:orders";
const CKEY = "growthos:extra-customers";
const CODE_KEY = "growthos:order-counter";
const CUST_CODE_KEY = "growthos:cust-counter";

export interface ExtraCustomer {
  id: string;
  name: string;
  phone: string;
  birthday?: string;
  anniversary?: string;
  gender?: string;
  visits: number;
  spent: number;
  lastVisit: string;
  favorites: string[];
  status: string;
  initials: string;
}

function readOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const list: Order[] = JSON.parse(localStorage.getItem(OKEY) || "[]");
    // Back-compat: migrate legacy statuses / missing fields
    return list.map((o) => ({
      ...o,
      status: (o.status === "completed" ? "completed" : "pending") as OrderStatus,
      paymentStatus: (o.paymentStatus || (o.paidAt ? "paid" : "unpaid")) as PaymentStatus,
      sessionId: o.sessionId || o.id,
    }));
  } catch { return []; }
}
function writeOrders(o: Order[]) {
  localStorage.setItem(OKEY, JSON.stringify(o));
  window.dispatchEvent(new Event("growthos:orders-changed"));
}
function readExtras(): ExtraCustomer[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CKEY) || "[]"); } catch { return []; }
}
function writeExtras(list: ExtraCustomer[]) {
  localStorage.setItem(CKEY, JSON.stringify(list));
  window.dispatchEvent(new Event("growthos:extra-customers-changed"));
}

export function readExtrasList(): ExtraCustomer[] { return readExtras(); }

function nextOrderCode(): string {
  if (typeof window === "undefined") return "ORD-00000";
  const n = (parseInt(localStorage.getItem(CODE_KEY) || "0", 10) || 0) + 1;
  localStorage.setItem(CODE_KEY, String(n));
  return `ORD-${String(n).padStart(5, "0")}`;
}

// Stable CUST-##### mapping. Seeded customers get 1..N by array order.
// Extra (localStorage) customers get N+auto-increment.
import { customers as _seedCustomers } from "./sample-data";
export function custId(id: string): string {
  const i = _seedCustomers.findIndex((c) => c.id === id);
  if (i >= 0) return `CUST-${String(i + 1).padStart(5, "0")}`;
  const extras = readExtras();
  const j = extras.findIndex((c) => c.id === id);
  if (j >= 0) return `CUST-${String(_seedCustomers.length + j + 1).padStart(5, "0")}`;
  return `CUST-${(id || "00000").slice(-5).toUpperCase().padStart(5, "0")}`;
}
void CUST_CODE_KEY;

export function useOrders() {
  const [o, setO] = useState<Order[]>(() => readOrders());
  useEffect(() => {
    const on = () => setO(readOrders());
    window.addEventListener("growthos:orders-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:orders-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return o;
}

export function useExtraCustomers() {
  const [x, setX] = useState<ExtraCustomer[]>(() => readExtras());
  useEffect(() => {
    const on = () => setX(readExtras());
    window.addEventListener("growthos:extra-customers-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:extra-customers-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return x;
}

function normPhone(p: string) {
  return (p || "").replace(/\D/g, "");
}

export function findCustomerByPhone(phone: string) {
  const n = normPhone(phone);
  if (!n) return null;
  const seed = seedCustomers.find((c) => normPhone(c.phone).endsWith(n) || n.endsWith(normPhone(c.phone)));
  if (seed) return { id: seed.id, name: seed.name, phone: seed.phone, source: "seed" as const };
  const extra = readExtras().find((c) => normPhone(c.phone) === n);
  if (extra) return { id: extra.id, name: extra.name, phone: extra.phone, source: "extra" as const };
  return null;
}

export function createCustomerFromOrder(input: {
  phone: string;
  name?: string;
  birthday?: string;
  anniversary?: string;
  spent: number;
  visitDate: string;
  favorite?: string;
}): ExtraCustomer {
  const list = readExtras();
  const name = input.name || `Guest ${input.phone.slice(-4)}`;
  const initials = name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  const c: ExtraCustomer = {
    id: `x${Date.now().toString(36)}`,
    name,
    phone: input.phone,
    birthday: input.birthday,
    anniversary: input.anniversary,
    visits: 0,
    spent: 0,
    lastVisit: input.visitDate,
    favorites: input.favorite ? [input.favorite] : [],
    status: "New",
    initials,
  };
  writeExtras([c, ...list]);
  return c;
}

export function bumpExtraCustomer(id: string, add: { spent: number; visitDate: string; favorite?: string }) {
  const list = readExtras();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return;
  const c = list[idx];
  c.visits += 1;
  c.spent += add.spent;
  c.lastVisit = add.visitDate;
  if (add.favorite && !c.favorites.includes(add.favorite)) c.favorites.push(add.favorite);
  list[idx] = c;
  writeExtras(list);
}

export function saveOrder(o: Omit<Order, "id" | "createdAt">) {
  const id = `O-${Date.now().toString(36).toUpperCase()}`;
  const code = nextOrderCode();
  const order: Order = {
    ...o,
    id,
    code,
    sessionId: o.sessionId || id,
    paymentStatus: o.paymentStatus || "unpaid",
    createdAt: new Date().toISOString(),
  };
  writeOrders([order, ...readOrders()]);
  return order;
}

export function updateOrder(id: string, patch: Partial<Order>) {
  const list = readOrders();
  const idx = list.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  const merged = { ...list[idx], ...patch } as Order;
  list[idx] = merged;
  writeOrders(list);
  return merged;
}

export function getOrder(id: string) {
  return readOrders().find((o) => o.id === id) || null;
}

export function getActiveOrderForTable(table: string) {
  return readOrders().find((o) => o.table === table && o.status !== "completed") || null;
}

// Append items to an existing active order. If none, create one.
export function appendItemsToActiveOrder(params: {
  table: string;
  items: OrderItem[];
  source: OrderSource;
  gstPercent: number;
  gstEnabled: boolean;
  customer?: { id?: string; name?: string; phone?: string };
}) {
  const active = getActiveOrderForTable(params.table);
  const merge = (existing: OrderItem[]) => {
    const map = new Map(existing.map((i) => [i.id, { ...i }]));
    for (const it of params.items) {
      const cur = map.get(it.id);
      if (cur) { cur.qty += it.qty; if (it.notes) cur.notes = it.notes; map.set(it.id, cur); }
      else map.set(it.id, { ...it });
    }
    return Array.from(map.values());
  };
  if (active) {
    const items = merge(active.items);
    const t = calcTotals(items, params.gstPercent, params.gstEnabled);
    const patch: Partial<Order> = {
      items, subtotal: t.subtotal, gst: t.gst, total: t.total,
    };
    if (params.customer?.id && !active.customerId) {
      patch.customerId = params.customer.id;
      patch.customerName = params.customer.name;
      patch.customerPhone = params.customer.phone;
    }
    const updated = updateOrder(active.id, patch)!;
    if (params.source === "qr") {
      pushQrNotification({ orderId: updated.id, table: updated.table, customerName: updated.customerName, items: items.reduce((s, i) => s + i.qty, 0), total: updated.total });
    }
    return updated;
  }
  const t = calcTotals(params.items, params.gstPercent, params.gstEnabled);
  const created = saveOrder({
    table: params.table, items: params.items, subtotal: t.subtotal, gst: t.gst, total: t.total,
    status: "pending", paymentStatus: "unpaid", source: params.source,
    sessionId: `S-${Date.now().toString(36).toUpperCase()}`,
    customerId: params.customer?.id, customerName: params.customer?.name, customerPhone: params.customer?.phone,
  } as any);
  if (params.source === "qr") {
    pushQrNotification({ orderId: created.id, table: created.table, customerName: created.customerName, items: created.items.reduce((s, i) => s + i.qty, 0), total: created.total });
  }
  return created;
}

// Mark an order paid + completed, with idempotent visit-count increment
// (only one +1 per session).
export function markOrderPaid(id: string, payment: Payment, customer?: { id?: string; name?: string; phone?: string }) {
  const list = readOrders();
  const idx = list.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  const o = list[idx];
  const alreadyCounted = list.some((x) => x.sessionId === o.sessionId && x.visitCounted);
  const patched: Order = {
    ...o,
    status: "completed",
    paymentStatus: "paid",
    payment,
    paidAt: new Date().toISOString(),
    customerId: customer?.id ?? o.customerId,
    customerName: customer?.name ?? o.customerName,
    customerPhone: customer?.phone ?? o.customerPhone,
    visitCounted: !alreadyCounted,
  };
  list[idx] = patched;
  writeOrders(list);
  return patched;
}

export function statusLabel(s: OrderStatus) {
  return s === "completed" ? "Completed" : "Pending";
}
export function paymentLabel(p: PaymentStatus) {
  return p === "paid" ? "Paid" : "Unpaid";
}

// Display-friendly order code: prefers persisted counter code, else derived.
export function orderCode(x: string | Order) {
  if (typeof x === "object" && x) {
    if (x.code) return x.code;
    return orderCode(x.id);
  }
  const id = String(x || "");
  const tail = id.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(-6).padStart(6, "0");
  return `ORD-${tail}`;
}
export function invoiceNumber(iso: string, id: string) {
  const year = new Date(iso).getFullYear();
  const tail = id.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(-4).padStart(4, "0");
  return `INV-${year}-${tail}`;
}

export function calcTotals(items: OrderItem[], gstPercent: number, gstEnabled: boolean) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const gst = gstEnabled ? Math.round(subtotal * gstPercent) / 100 : 0;
  return { subtotal, gst, total: Math.round((subtotal + gst) * 100) / 100 };
}

export function orderTopSelling(orders: Order[], limit = 5) {
  const map = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of orders) for (const it of o.items) {
    const cur = map.get(it.name) || { name: it.name, qty: 0, revenue: 0 };
    cur.qty += it.qty; cur.revenue += it.qty * it.price;
    map.set(it.name, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, limit);
}

export function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}