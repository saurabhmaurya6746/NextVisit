import { useEffect, useState } from "react";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
  image?: string;
}

const KEY = "growthos:menu";

const seed: MenuItem[] = [
  { id: "m1", name: "Margherita Pizza", price: 14, category: "Pizza", available: true },
  { id: "m2", name: "Pepperoni Pizza", price: 16, category: "Pizza", available: true },
  { id: "m3", name: "Truffle Mushroom", price: 18, category: "Pizza", available: true },
  { id: "m4", name: "Butter Chicken", price: 15, category: "Mains", available: true },
  { id: "m5", name: "Grilled Salmon", price: 22, category: "Mains", available: true },
  { id: "m6", name: "Caesar Salad", price: 10, category: "Salads", available: true },
  { id: "m7", name: "Bruschetta", price: 8, category: "Starters", available: true },
  { id: "m8", name: "Garlic Bread", price: 5, category: "Starters", available: true },
  { id: "m9", name: "Tiramisu", price: 7, category: "Desserts", available: true },
  { id: "m10", name: "Chocolate Lava Cake", price: 8, category: "Desserts", available: true },
  { id: "m11", name: "Cappuccino", price: 4, category: "Drinks", available: true },
  { id: "m12", name: "Fresh Lime Soda", price: 3, category: "Drinks", available: true },
];

function read(): MenuItem[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : seed;
  } catch {
    return seed;
  }
}
function write(m: MenuItem[]) {
  localStorage.setItem(KEY, JSON.stringify(m));
  window.dispatchEvent(new Event("growthos:menu-changed"));
}

export function useMenu() {
  const [items, setItems] = useState<MenuItem[]>(() => read());
  useEffect(() => {
    const on = () => setItems(read());
    window.addEventListener("growthos:menu-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:menu-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return items;
}

export function saveMenu(items: MenuItem[]) { write(items); }
export function upsertMenuItem(item: MenuItem) {
  const list = read();
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) list[idx] = item; else list.push(item);
  write(list);
}
export function removeMenuItem(id: string) {
  write(read().filter((x) => x.id !== id));
}
export function menuCategories(items: MenuItem[]): string[] {
  return Array.from(new Set(items.map((i) => i.category)));
}