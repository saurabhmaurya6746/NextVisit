import { useEffect, useState } from "react";
import { clients as seedClients } from "@/lib/sample-data";

export type ClientStatus = "active" | "trial" | "expired" | "suspended";

export type StoredClient = {
  id: string;
  business: string;
  owner: string;
  type: "Restaurant" | "Salon";
  email: string;
  phone: string;
  plan: string;
  status: ClientStatus;
  expiry: string;
  revenue: number;
  customers: number;
  city: string;
  address?: string;
  trialStart?: string;
  trialEnd?: string;
  lastLogin?: string;
  campaignsSent?: number;
  ordersProcessed?: number;
};

export type ClientView = StoredClient & {
  trialDaysRemaining: number | null;
  isTrialExpired: boolean;
};

export type ActivityEntry = {
  id: string;
  clientId?: string;
  business?: string;
  type: "signup" | "approval" | "campaign" | "order" | "login";
  message: string;
  at: string;
};

const KEY = "growthos:clients";
const AKEY = "growthos:activity";
const EVT = "growthos:clients-changed";
const AEVT = "growthos:activity-changed";

const DAY = 86_400_000;
const TRIAL_DAYS = 14;

function readAdded(): StoredClient[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function writeAdded(list: StoredClient[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
}

function readActivity(): ActivityEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(AKEY) || "[]");
  } catch {
    return [];
  }
}
function writeActivity(list: ActivityEntry[]) {
  localStorage.setItem(AKEY, JSON.stringify(list.slice(0, 100)));
  window.dispatchEvent(new Event(AEVT));
}

function normalizeSeed(): StoredClient[] {
  return seedClients.map((c) => {
    const isTrial = c.status === "trial" || c.plan === "Free Trial" || c.plan === "Free";
    let trialStart: string | undefined;
    let trialEnd: string | undefined;
    if (isTrial && c.expiry) {
      const end = new Date(c.expiry);
      trialEnd = end.toISOString();
      trialStart = new Date(end.getTime() - TRIAL_DAYS * DAY).toISOString();
    }
    return {
      ...c,
      type: (c.type === "Salon" ? "Salon" : "Restaurant") as "Restaurant" | "Salon",
      status: c.status as ClientStatus,
      trialStart,
      trialEnd,
      lastLogin: new Date(Date.now() - Math.floor(Math.random() * 5) * DAY).toISOString(),
      campaignsSent: Math.round(c.customers / 40),
      ordersProcessed: Math.round(c.customers * 3.4),
    };
  });
}

function decorate(c: StoredClient): ClientView {
  const now = Date.now();
  let daysRemaining: number | null = null;
  let expired = false;
  if (c.trialEnd) {
    const diff = new Date(c.trialEnd).getTime() - now;
    daysRemaining = Math.max(0, Math.ceil(diff / DAY));
    expired = diff <= 0;
  }
  return { ...c, trialDaysRemaining: daysRemaining, isTrialExpired: expired };
}

export function listAllClients(): ClientView[] {
  const merged = [...normalizeSeed(), ...readAdded()];
  return merged.map(decorate);
}

export function getClientById(id: string): ClientView | undefined {
  return listAllClients().find((c) => c.id === id);
}

export function addClient(input: {
  business: string;
  owner: string;
  email: string;
  phone: string;
  type: "Restaurant" | "Salon";
  address?: string;
}): StoredClient {
  const now = new Date();
  const end = new Date(now.getTime() + TRIAL_DAYS * DAY);
  const c: StoredClient = {
    id: `c${Date.now().toString(36)}`,
    business: input.business,
    owner: input.owner,
    email: input.email,
    phone: input.phone,
    type: input.type,
    plan: "Free Trial",
    status: "trial",
    expiry: end.toISOString().slice(0, 10),
    revenue: 0,
    customers: 0,
    city: input.address?.split(",").slice(-1)[0]?.trim() || "—",
    address: input.address,
    trialStart: now.toISOString(),
    trialEnd: end.toISOString(),
    lastLogin: now.toISOString(),
    campaignsSent: 0,
    ordersProcessed: 0,
  };
  writeAdded([c, ...readAdded()]);
  logActivity({ clientId: c.id, business: c.business, type: "signup", message: `${c.business} joined (2-month free trial)` });
  return c;
}

export function updateClient(id: string, patch: Partial<StoredClient>) {
  const added = readAdded();
  const i = added.findIndex((c) => c.id === id);
  if (i >= 0) {
    added[i] = { ...added[i], ...patch };
    writeAdded(added);
  }
}

export function removeClient(id: string) {
  writeAdded(readAdded().filter((c) => c.id !== id));
}

export function logActivity(entry: Omit<ActivityEntry, "id" | "at">) {
  const item: ActivityEntry = { ...entry, id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString() };
  writeActivity([item, ...readActivity()]);
}

export function useClients(): ClientView[] {
  const [list, setList] = useState<ClientView[]>(() => listAllClients());
  useEffect(() => {
    const on = () => setList(listAllClients());
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return list;
}

export function useActivity(): ActivityEntry[] {
  const [list, setList] = useState<ActivityEntry[]>(() => readActivity());
  useEffect(() => {
    const on = () => setList(readActivity());
    window.addEventListener(AEVT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(AEVT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return list;
}

// Client-side (business owner) trial context — assume current logged-in client is the first seed for demo.
const CURRENT_KEY = "growthos:current-client";
export function currentClientId(): string {
  if (typeof window === "undefined") return "c1";
  return localStorage.getItem(CURRENT_KEY) || "c1";
}
export function setCurrentClientId(id: string) {
  localStorage.setItem(CURRENT_KEY, id);
}
export function useCurrentClient(): ClientView | undefined {
  const list = useClients();
  const id = currentClientId();
  return list.find((c) => c.id === id) || list[0];
}

export const TRIAL_DAYS_TOTAL = TRIAL_DAYS;