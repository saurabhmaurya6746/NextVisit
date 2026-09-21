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
  businessKey?: string;
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
  customerGender?: string;
  customerDob?: string;
  customerAnniversary?: string;
  serviceAreaId?: string;
  serviceAreaName?: string;
  chairId?: string;
  chairName?: string;
  notes?: string;
  price: number;
  duration?: number;
  payment?: ApptPayment;
  paymentStatus?: PaymentStatus;
  paidAt?: string;
  visitCounted?: boolean;
  isWalkIn?: boolean;
  advancePaid?: number;
  couponCode?: string;
  couponDiscount?: number;
  discountDescription?: string;
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
      couponCode: a.couponCode || (a as any).coupon_code || (a as any).applied_coupon_code,
      couponDiscount: a.couponDiscount ?? (a as any).coupon_discount ?? (a as any).discount ?? 0,
      discountDescription: a.discountDescription || (a as any).discount_description,
    }));
  } catch { return []; }
}
function write(a: Appointment[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {}
}

export function useAppointments() {
  const [list, setList] = useState<Appointment[]>(read);

  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === KEY) setList(read());
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return list;
}

export function getAppointment(id: string): Appointment | undefined {
  return read().find((a) => a.id === id);
}

export function getNextApptCode(): string {
  if (typeof window === "undefined") return "APP-00001";
  try {
    const raw = localStorage.getItem(CODE_KEY);
    let next = raw ? parseInt(raw, 10) : 1;
    if (isNaN(next) || next < 1) next = 1;
    localStorage.setItem(CODE_KEY, String(next + 1));
    return `APP-${String(next).padStart(5, "0")}`;
  } catch {
    return "APP-00001";
  }
}

export function apptCode(a?: Partial<Appointment> | null): string {
  if (!a) return "APP-00000";
  if (a.code) return a.code;
  if (a.id) {
    if (a.id.startsWith("apt-")) {
      const digits = a.id.replace(/\D/g, "");
      return `APP-${digits ? digits.slice(-5) : "00001"}`;
    }
    const clean = a.id.replace(/-/g, "").toUpperCase();
    return `APP-${clean.slice(0, 5)}`;
  }
  return "APP-00000";
}

export function saveAppointment(a: Appointment) {
  const list = read();
  const idx = list.findIndex((x) => x.id === a.id);
  if (idx >= 0) list[idx] = a;
  else list.unshift(a);
  write(list);
  pushNotification({
    type: "appointment_created",
    title: "New Salon Appointment",
    message: `Appointment #${apptCode(a)} for ${a.customerName || "Walk-in"} created.`,
  }, { sound: true });
  return a;
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

export function markAppointmentPaid(
  id: string,
  payment: ApptPayment,
  customer?: { id?: string; name?: string; phone?: string },
  couponDetails?: { code?: string; discount?: number; description?: string }
) {
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
    couponCode: couponDetails?.code ?? a.couponCode,
    couponDiscount: couponDetails?.discount ?? a.couponDiscount,
    discountDescription: couponDetails?.description ?? a.discountDescription,
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