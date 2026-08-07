import { customers } from "./sample-data";
import { apiFetch } from "./auth";
import { toast } from "sonner";
import { logWhatsApp } from "./whatsapp-history";

export const DEMO_TODAY = new Date("2026-07-17T00:00:00");

export function mmdd(d: Date) {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function formatDateLabel(key: string) {
  if (!key || key === "Unknown") return "Special Date";
  const parts = key.split("-").map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return key;
  const [m, day] = parts;
  const d = new Date(2026, m - 1, day);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "long" });
}

export type Bucket = "today" | "tomorrow" | "week" | "month";
export type Kind = "birthday" | "anniversary";

export function getCelebrants(kind: Kind, bucket: Bucket) {
  const todayKey = mmdd(DEMO_TODAY);
  const tomKey = mmdd(addDays(DEMO_TODAY, 1));
  const weekKeys = Array.from({ length: 7 }, (_, i) => mmdd(addDays(DEMO_TODAY, i)));
  const monthKeys = Array.from({ length: 31 }, (_, i) => mmdd(addDays(DEMO_TODAY, i)));
  return customers.filter((c) => {
    const raw = (c as any)[kind];
    if (!raw) return false;
    const k = raw.slice(5);
    if (bucket === "today") return k === todayKey;
    if (bucket === "tomorrow") return k === tomKey;
    if (bucket === "month") return monthKeys.includes(k);
    return weekKeys.includes(k);
  });
}

export function couponFor(kind: Kind) {
  return kind === "birthday" ? "BDAYSPECIAL" : "ANNISPECIAL";
}

export function messageFor(kind: Kind, name: string) {
  const code = couponFor(kind);
  const first = name.split(" ")[0];
  return kind === "birthday"
    ? `Happy Birthday ${first} 🎉\nWishing you a wonderful year ahead. Enjoy a FREE Dessert on your next visit.\nCoupon Code: ${code}\nSee you soon ❤️`
    : `Cheers to another year, ${first} ❤️\nCelebrate with us — coupon ${code} unlocks 20% off your favourite.\nCan't wait to have you back.`;
}

export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits || digits.length < 10) return null;

  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return digits;
  }
  return null;
}

export function openWhatsApp(phone: string | null | undefined, message: string): boolean {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) {
    toast.error("Invalid or missing phone number for WhatsApp.");
    return false;
  }

  const encodedMsg = encodeURIComponent(message);
  const waUrl = `https://wa.me/${normalized}?text=${encodedMsg}`;
  window.open(waUrl, "_blank");
  return true;
}

export async function sendWhatsAppWithStatusTracking(options: {
  customerId: string;
  customerPhone: string;
  message: string;
  campaignType: string;
  campaignId?: string;
  onSuccess?: () => void;
  onError?: (err: any) => void;
}): Promise<boolean> {
  const { customerId, customerPhone, message, campaignType, campaignId, onSuccess, onError } = options;

  try {
    const payload: any = {
      customer_id: customerId,
      campaign_type: campaignType.toUpperCase(),
      message: message,
    };
    if (campaignId && campaignId.length > 20 && !campaignId.includes("global")) {
      payload.campaign_id = campaignId;
    }

    // 1. Call Backend BEFORE opening wa.me
    const res = await apiFetch("/api/v1/campaign-logs/record-send", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Failed to update campaign status (HTTP ${res.status})`);
    }

    // 2. Save to local WhatsApp history
    logWhatsApp({ customerId, kind: "campaign", message });

    // 3. Open wa.me AFTER successful backend update
    openWhatsApp(customerPhone, message);

    // 4. Trigger callback (React Query refetch)
    if (onSuccess) onSuccess();
    return true;
  } catch (err: any) {
    console.error("WhatsApp status update failed:", err);
    toast.error(`Could not update campaign status: ${err.message || "Backend error"}`);
    if (onError) onError(err);
    return false;
  }
}

export function groupByDate(list: any[], kind: Kind) {
  const map = new Map<string, any[]>();
  for (const c of list) {
    let rawDate: string | null = null;
    if (kind === "birthday") {
      rawDate = c.birth_date || c.event_date || c.birthday || null;
    } else {
      rawDate = c.anniversary_date || c.event_date || c.anniversary || null;
    }

    if (!rawDate) {
      const k = "Unknown";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
      continue;
    }

    const dStr = typeof rawDate === "string" ? rawDate.slice(0, 10) : "";
    const k = dStr.length >= 10 ? dStr.slice(5) : "Unknown";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(c);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}