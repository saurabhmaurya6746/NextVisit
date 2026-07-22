import { useEffect, useState } from "react";

export interface Festival {
  id: string;
  name: string;
  date: string; // MM-DD or full date
  emoji: string;
  template: string;
  coupon: string;
}

const KEY = "growthos:festivals";

const seed: Festival[] = [
  { id: "f1", name: "Diwali", date: "11-01", emoji: "🪔", coupon: "DIWALI25", template: "Happy Diwali {name} 🪔\nMay your celebrations be as sweet as our desserts!\nEnjoy 25% off with code DIWALI25.\n— Aroma Bistro" },
  { id: "f2", name: "Christmas", date: "12-25", emoji: "🎄", coupon: "XMAS20", template: "Merry Christmas {name} 🎄\nCelebrate with us — 20% off your festive feast (code XMAS20).\n— Aroma Bistro" },
  { id: "f3", name: "New Year", date: "01-01", emoji: "🎆", coupon: "NY30", template: "Happy New Year {name} 🎆\nStart the year with 30% off (code NY30).\n— Aroma Bistro" },
  { id: "f4", name: "Valentine's Day", date: "02-14", emoji: "❤️", coupon: "LOVE15", template: "Happy Valentine's {name} ❤️\nBring your special someone — complimentary dessert on us with code LOVE15.\n— Aroma Bistro" },
  { id: "f5", name: "Eid Mubarak", date: "04-10", emoji: "🌙", coupon: "EID20", template: "Eid Mubarak {name} 🌙\nCelebrate with us — 20% off with code EID20.\n— Aroma Bistro" },
];

function read(): Festival[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed;
    return JSON.parse(raw);
  } catch { return seed; }
}

function write(list: Festival[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("growthos:festivals-changed"));
}

export function saveFestival(f: Festival) {
  const list = read();
  const i = list.findIndex((x) => x.id === f.id);
  if (i >= 0) list[i] = f; else list.push(f);
  write(list);
}

export function addFestival(f: Omit<Festival, "id">) {
  const list = read();
  const created: Festival = { ...f, id: `f${Date.now().toString(36)}` };
  write([created, ...list]);
  return created;
}

export function deleteFestival(id: string) {
  write(read().filter((f) => f.id !== id));
}

export function useFestivals() {
  const [list, setList] = useState<Festival[]>(() => read());
  useEffect(() => {
    const on = () => setList(read());
    window.addEventListener("growthos:festivals-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:festivals-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return list;
}