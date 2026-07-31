import { customers } from "./sample-data";

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

export function openWhatsApp(phone: string, message: string) {
  const clean = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  window.open(`https://wa.me/${clean}?text=${encodeURIComponent(message)}`, "_blank");
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