import { useEffect, useState } from "react";
import { customers } from "./sample-data";

const KEY = "growthos:archived-customers";

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function write(s: Set<string>) {
  localStorage.setItem(KEY, JSON.stringify(Array.from(s)));
  window.dispatchEvent(new Event("growthos:archive-changed"));
}

export function archiveCustomer(id: string) {
  const s = read();
  s.add(id);
  write(s);
}

export function restoreCustomer(id: string) {
  const s = read();
  s.delete(id);
  write(s);
}

export function useArchivedIds() {
  const [ids, setIds] = useState<Set<string>>(() => read());
  useEffect(() => {
    const on = () => setIds(read());
    window.addEventListener("growthos:archive-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:archive-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return ids;
}

export function useActiveCustomers() {
  const archived = useArchivedIds();
  return customers.filter((c) => !archived.has(c.id));
}