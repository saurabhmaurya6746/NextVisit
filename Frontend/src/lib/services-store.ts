import { useEffect, useState } from "react";

export const SERVICE_CATEGORIES = ["Hair", "Skin", "Nails", "Makeup", "Spa", "Bridal", "Grooming"] as const;
export type ServiceCategory = typeof SERVICE_CATEGORIES[number];

export interface SalonService {
  id: string;
  name: string;
  category: string;
  description?: string;
  duration: number; // minutes
  price: number;
  staff?: string;
  available: boolean;
}

const KEY = "growthos:salon-services";

const seed: SalonService[] = [
  { id: "s1", name: "Haircut", category: "Hair", duration: 30, price: 500, available: true },
  { id: "s2", name: "Hair Coloring", category: "Hair", duration: 60, price: 1500, available: true },
  { id: "s3", name: "Signature Facial", category: "Skin", duration: 60, price: 1200, available: true },
  { id: "s4", name: "Manicure", category: "Nails", duration: 30, price: 600, available: true },
  { id: "s5", name: "Pedicure", category: "Nails", duration: 45, price: 800, available: true },
  { id: "s6", name: "Bridal Makeup", category: "Bridal", duration: 120, price: 8000, available: true },
  { id: "s7", name: "Body Massage", category: "Spa", duration: 60, price: 1800, available: true },
  { id: "s8", name: "Beard Trim", category: "Grooming", duration: 20, price: 250, available: true },
];

function read(): SalonService[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : seed;
  } catch { return seed; }
}
function write(list: SalonService[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("growthos:salon-services-changed"));
}

export function useSalonServices() {
  const [items, setItems] = useState<SalonService[]>(() => read());
  useEffect(() => {
    const on = () => setItems(read());
    window.addEventListener("growthos:salon-services-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:salon-services-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return items;
}

export function upsertSalonService(s: SalonService) {
  const list = read();
  const idx = list.findIndex((x) => x.id === s.id);
  if (idx >= 0) list[idx] = s; else list.push(s);
  write(list);
}
export function removeSalonService(id: string) {
  write(read().filter((x) => x.id !== id));
}