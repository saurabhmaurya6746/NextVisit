import { useEffect, useState } from "react";
import { pushNotification } from "./notifications-store";

export type AppointmentStatus = "pending" | "checkedin" | "completed" | "cancelled";
export type ApptPayment = "cash" | "upi" | "card";
export type PaymentStatus = "unpaid" | "paid";

export interface AppointmentService {
  name: string;
  price: number;
  duration: number;
}

export interface Appointment {
  id: string;
  code?: string;
  /** Primary service name (back-compat) — derived from services[0] when present. */
  service: string;
  /** Multi-service list (new). */
  services?: AppointmentService[];
  staff: string;
  start: string;
  status: AppointmentStatus;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  price: number;
  duration?: number;
  payment?: ApptPayment;
  paymentStatus?: PaymentStatus;
  paidAt?: string;
  visitCounted?: boolean;
}

const KEY = "growthos:appointments";
const CODE_KEY = "growthos:appt-counter";

function read(): Appointment[] {
  if (typeof window === "undefined") return [];
  try {
    const list: Appointment[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    return list.map((a) => ({
      ...a,
      status: (a.status as AppointmentStatus) || "pending",
      paymentStatus: (a.paymentStatus || (a.paidAt ? "paid" : "unpaid")) as PaymentStatus,
      services: a.services && a.services.length ? a.services : (a.service ? [{ name: a.service, price: a.price || 0, duration: a.duration || 30 }] : []),
    }));
  } catch { return []; }
}
function write(a: Appointment[]) {
  localStorage.setItem(KEY, JSON.stringify(a));
  window.dispatchEvent(new Event("growthos:appointments-changed"));
}

function nextApptCode(): string {
  if (typeof window === "undefined") return "APP-00000";
  const n = (parseInt(localStorage.getItem(CODE_KEY) || "0", 10) || 0) + 1;
  localStorage.setItem(CODE_KEY, String(n));
  return `APP-${String(n).padStart(5, "0")}`;
}

export function apptCode(a: Appointment) {
  if (a.code) return a.code;
  const tail = a.id.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(-5).padStart(5, "0");
  return `APP-${tail}`;
}

export function useAppointments() {
  const [a, setA] = useState<Appointment[]>(() => read());
  useEffect(() => {
    const on = () => setA(read());
    window.addEventListener("growthos:appointments-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:appointments-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return a;
}

export function getAppointment(id: string) {
  return read().find((a) => a.id === id) || null;
}

export function saveAppointment(input: Omit<Appointment, "id" | "code">) {
  const services = input.services && input.services.length ? input.services : [{ name: input.service, price: input.price || 0, duration: input.duration || 30 }];
  const price = services.reduce((s, x) => s + (x.price || 0), 0);
  const duration = services.reduce((s, x) => s + (x.duration || 0), 0);
  const appt: Appointment = {
    ...input,
    services,
    service: services[0]?.name || input.service,
    price,
    duration,
    id: `A-${Date.now().toString(36).toUpperCase()}`,
    code: nextApptCode(),
    status: input.status || "pending",
    paymentStatus: input.paymentStatus || "unpaid",
  };
  write([appt, ...read()]);
  pushNotification({
    type: "staff_order",
    title: "New Appointment",
    body: `${appt.code} · ${appt.customerName || appt.customerPhone || "Walk-in"} · ${services.map((s) => s.name).join(", ")}`,
    orderId: appt.id,
  }, { sound: true });
  return appt;
}

export function updateAppointment(id: string, patch: Partial<Appointment>) {
  const list = read();
  const idx = list.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const merged = { ...list[idx], ...patch } as Appointment;
  list[idx] = merged;
  write(list);
  return merged;
}

export function markAppointmentPaid(id: string, payment: ApptPayment, customer?: { id?: string; name?: string; phone?: string }) {
  const list = read();
  const idx = list.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const a = list[idx];
  const patched: Appointment = {
    ...a,
    status: "completed",
    paymentStatus: "paid",
    payment,
    paidAt: new Date().toISOString(),
    customerId: customer?.id ?? a.customerId,
    customerName: customer?.name ?? a.customerName,
    customerPhone: customer?.phone ?? a.customerPhone,
    visitCounted: a.visitCounted ? true : true,
  };
  list[idx] = patched;
  write(list);
  return patched;
}

export function topServices(list: Appointment[], limit = 5) {
  const map = new Map<string, { name: string; count: number; revenue: number }>();
  for (const a of list) {
    const svcs = a.services && a.services.length ? a.services : [{ name: a.service, price: a.price, duration: a.duration || 0 }];
    for (const s of svcs) {
      const cur = map.get(s.name) || { name: s.name, count: 0, revenue: 0 };
      cur.count += 1; cur.revenue += s.price || 0;
      map.set(s.name, cur);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, limit);
}