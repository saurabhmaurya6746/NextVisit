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
  const [m, day] = key.split("-").map(Number);
  const d = new Date(DEMO_TODAY.getFullYear(), m - 1, day);
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
    const k = (c as any)[kind].slice(5);
    if (bucket === "today") return k === todayKey;
    if (bucket === "tomorrow") return k === tomKey;
    if (bucket === "month") return monthKeys.includes(k);
    return weekKeys.includes(k);
  });
}

export function couponFor(kind: Kind) {
  return kind === "birthday" ? "BDAY20" : "ANNI25";
}

export function messageFor(kind: Kind, name: string) {
  const code = couponFor(kind);
  const first = name.split(" ")[0];
  return kind === "birthday"
    ? `Happy Birthday ${first} 🎉\nWishing you a wonderful year ahead. Enjoy a FREE Dessert on your next visit.\nCoupon Code: ${code}\nSee you soon ❤️\n— Aroma Bistro`
    : `Cheers to another year, ${first} ❤️\nCelebrate with us — coupon ${code} unlocks 25% off your favourite.\nCan't wait to have you back.\n— Aroma Bistro`;
}

export function openWhatsApp(phone: string, message: string) {
  const clean = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  window.open(`https://wa.me/${clean}?text=${encodeURIComponent(message)}`, "_blank");
}

export function groupByDate<T extends { birthday: string; anniversary: string }>(list: T[], kind: Kind) {
  const map = new Map<string, T[]>();
  for (const c of list) {
    const k = (c as any)[kind].slice(5);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(c);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}