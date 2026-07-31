import { useEffect, useState } from "react";
import { apiFetch } from "./auth";

export type WhatsAppKind = "birthday" | "anniversary" | "recovery" | "review" | "campaign" | "manual";

export interface WhatsAppLog {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  kind: WhatsAppKind;
  message: string;
  date: string; // ISO
  status: "sent" | "opened" | "pending" | "failed";
}

const KEY = "growthos:wa-history";

const seed: WhatsAppLog[] = [
  { id: "seed-1", customerId: "u1", customerName: "Sarah Johnson", customerPhone: "+1 415 555 0142", kind: "birthday", message: "Happy Birthday Sarah 🎉", date: "2026-07-08T09:00:00", status: "sent" },
  { id: "seed-2", customerId: "u1", customerName: "Sarah Johnson", customerPhone: "+1 415 555 0142", kind: "review", message: "Thanks for visiting — could you leave us a review?", date: "2026-06-20T18:20:00", status: "sent" },
  { id: "seed-3", customerId: "u1", customerName: "Sarah Johnson", customerPhone: "+1 415 555 0142", kind: "campaign", message: "New menu launch this Friday", date: "2026-05-12T10:00:00", status: "sent" },
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
    status: "sent",
    customerId: entry.customerId,
    customerName: entry.customerName,
    customerPhone: entry.customerPhone,
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

/**
 * Fetches real SENT backend campaign execution logs from /api/v1/campaign-logs/sent
 */
export async function fetchBackendCampaignLogsApi(): Promise<WhatsAppLog[]> {
  try {
    const res = await apiFetch("/api/v1/campaign-logs/sent");
    if (!res.ok) return [];
    const data = await res.json();

    const mapKind = (typeStr: string): WhatsAppKind => {
      const t = (typeStr || "").toLowerCase();
      if (t.includes("birthday")) return "birthday";
      if (t.includes("anniversary")) return "anniversary";
      if (t.includes("recovery")) return "recovery";
      if (t.includes("review")) return "review";
      if (t.includes("campaign")) return "campaign";
      return "campaign";
    };

    return (data || []).map((item: any) => ({
      id: item.id,
      customerId: item.customer_id,
      customerName: item.customer_name || "Guest",
      customerPhone: item.customer_phone || "—",
      kind: mapKind(item.campaign_type || item.campaign_name),
      message: item.message || item.campaign_name || "WhatsApp Notification",
      date: item.sent_at || item.created_at || new Date().toISOString(),
      status: "sent",
    }));
  } catch (e) {
    return [];
  }
}