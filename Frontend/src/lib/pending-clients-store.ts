import { useEffect, useState } from "react";

export type PendingStatus = "pending" | "approved" | "rejected";

export type BusinessKind = "Restaurant" | "Salon" | "Spa" | "Cafe";
export type PendingClient = {
  id: string;
  business: string;
  owner: string;
  email: string;
  phone: string;
  type: BusinessKind;
  country?: string;
  city?: string;
  status: PendingStatus;
  createdAt: string;
  rejectionReason?: string;
};

const KEY = "growthos:pending-clients";
const EVT = "growthos:pending-changed";

function read(): PendingClient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function write(list: PendingClient[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
}

function seed(): PendingClient[] {
  const list: PendingClient[] = [
    { id: "p1", business: "Spice Route Kitchen", owner: "Arjun Mehta", email: "arjun@spiceroute.in", phone: "+91 98765 11122", type: "Restaurant", status: "pending", createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: "p2", business: "Luxe Hair Lounge", owner: "Riya Kapoor", email: "riya@luxehair.in", phone: "+91 98111 22334", type: "Salon", status: "pending", createdAt: new Date(Date.now() - 3600000 * 6).toISOString() },
    { id: "p3", business: "Coastal Grill", owner: "Vikram Nair", email: "vikram@coastalgrill.in", phone: "+91 90000 55667", type: "Restaurant", status: "pending", createdAt: new Date().toISOString() },
  ];
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function listPending(): PendingClient[] {
  return read();
}

export function addPending(input: Omit<PendingClient, "id" | "status" | "createdAt">): PendingClient {
  const list = read();
  const item: PendingClient = {
    ...input,
    id: `p${Date.now()}`,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  write([item, ...list]);
  return item;
}

export function setStatus(id: string, status: PendingStatus, reason?: string) {
  const list = read().map((c) => (c.id === id ? { ...c, status, rejectionReason: reason } : c));
  write(list);
}

export function removePending(id: string) {
  write(read().filter((c) => c.id !== id));
}

export function usePendingClients() {
  const [list, setList] = useState<PendingClient[]>(() => read());
  useEffect(() => {
    const on = () => setList(read());
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return list;
}