import { useEffect, useState } from "react";

export type Role = "admin" | "business";
export type Session = {
  role: Role;
  email: string;
  clientId?: string;
  businessType?: "restaurant" | "salon";
  businessSlug?: string;
  businessName?: string;
};

const KEY = "growthos:session";
const EVT = "growthos:session-changed";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(s: Session) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(EVT));
}

export function clearSession() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVT));
}

export function useSession(): Session | null {
  const [s, setS] = useState<Session | null>(() => getSession());
  useEffect(() => {
    const on = () => setS(getSession());
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return s;
}