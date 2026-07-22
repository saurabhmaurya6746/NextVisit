import { useEffect, useState } from "react";

export type NotificationType =
  | "qr_order"
  | "staff_order"
  | "birthday"
  | "campaign"
  | "payment";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  orderId?: string;
  table?: string;
  at: string;
  read: boolean;
}

const KEY = "growthos:qr-notifications"; // kept key for back-compat with existing data
const EVT = "growthos:qr-notifications-changed";

function migrate(raw: any): AppNotification {
  if (raw && raw.type && raw.title) return raw as AppNotification;
  return {
    id: raw?.id ?? `n${Math.random().toString(36).slice(2)}`,
    type: "qr_order",
    title: "New QR Order",
    body: `${raw?.table ?? "Table"} · ${raw?.items ?? 0} items · ₹${raw?.total ?? 0}`,
    orderId: raw?.orderId,
    table: raw?.table,
    at: raw?.at ?? new Date().toISOString(),
    read: !!raw?.read,
  };
}

function read(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.map(migrate) : [];
  } catch { return []; }
}
function write(n: AppNotification[]) {
  localStorage.setItem(KEY, JSON.stringify(n.slice(0, 60)));
  window.dispatchEvent(new Event(EVT));
}

/** Subtle "ding" — 800Hz sine, ~150ms, ~30% volume. */
export function playNotificationSound() {
  try {
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 800;
    g.gain.value = 0.3;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    // gentle fade to avoid click
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    o.stop(ctx.currentTime + 0.16);
    setTimeout(() => ctx.close(), 400);
  } catch {}
}

export function pushNotification(n: Omit<AppNotification, "id" | "at" | "read">, opts?: { sound?: boolean }) {
  const item: AppNotification = {
    ...n,
    id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    read: false,
  };
  write([item, ...read()]);
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(item.title, { body: item.body });
    }
  } catch {}
  if (opts?.sound !== false) playNotificationSound();
  return item;
}

/** Back-compat helper used by the QR self-order flow. */
export function pushQrNotification(n: { orderId: string; table: string; customerName?: string; items: number; total: number }) {
  return pushNotification({
    type: "qr_order",
    title: "New QR Order",
    body: `${n.table} · ${n.items} items · ₹${n.total}${n.customerName ? ` · ${n.customerName}` : ""}`,
    orderId: n.orderId,
    table: n.table,
  });
}

export function markAllRead() { write(read().map((n) => ({ ...n, read: true }))); }
export function markRead(id: string) { write(read().map((n) => n.id === id ? { ...n, read: true } : n)); }
export function clearNotifications() { write([]); }

export function useNotifications() {
  const [list, setList] = useState<AppNotification[]>(() => read());
  useEffect(() => {
    const on = () => setList(read());
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener(EVT, on); window.removeEventListener("storage", on); };
  }, []);
  return list;
}

/** Back-compat alias. */
export const useQrNotifications = useNotifications;