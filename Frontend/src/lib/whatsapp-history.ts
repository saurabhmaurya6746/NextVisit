import { useEffect, useState } from "react";

export type WhatsAppKind = "birthday" | "anniversary" | "recovery" | "review" | "campaign" | "manual";

export interface WhatsAppLog {
  id: string;
  customerId: string;
  kind: WhatsAppKind;
  message: string;
  date: string; // ISO
  status: "opened";
}

const KEY = "growthos:wa-history";

const seed: WhatsAppLog[] = [
  { id: "seed-1", customerId: "u1", kind: "birthday", message: "Happy Birthday Sarah 🎉", date: "2026-07-08T09:00:00", status: "opened" },
  { id: "seed-2", customerId: "u1", kind: "review", message: "Thanks for visiting — could you leave us a review?", date: "2026-06-20T18:20:00", status: "opened" },
  { id: "seed-3", customerId: "u1", kind: "campaign", message: "New menu launch this Friday", date: "2026-05-12T10:00:00", status: "opened" },
];

function read(): WhatsAppLog[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed;
    return JSON.parse(raw);
  } catch {
    return seed;
  }
}

function write(list: WhatsAppLog[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("growthos:wa-changed"));
}

export function logWhatsApp(entry: Omit<WhatsAppLog, "id" | "date" | "status"> & { date?: string }) {
  const list = read();
  const next: WhatsAppLog = {
    id: crypto.randomUUID(),
    date: entry.date || new Date().toISOString(),
    status: "opened",
    customerId: entry.customerId,
    kind: entry.kind,
    message: entry.message,
  };
  write([next, ...list]);
}

export function useWhatsAppHistory(customerId?: string) {
  const [list, setList] = useState<WhatsAppLog[]>(() => read());
  useEffect(() => {
    const on = () => setList(read());
    window.addEventListener("growthos:wa-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:wa-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return customerId ? list.filter((l) => l.customerId === customerId) : list;
}