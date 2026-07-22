import { useEffect, useState } from "react";

export interface LoyaltySettings {
  pointsPer100: number;
  signupBonus: number;
  visitBonus: number;
  birthdayBonus: number;
  referralBonus: number;
  minRedemption: number;
  maxRedemptionPct: number;
  expiryDays: number; // 0 = never
}

export const defaultLoyaltySettings: LoyaltySettings = {
  pointsPer100: 10,
  signupBonus: 50,
  visitBonus: 5,
  birthdayBonus: 100,
  referralBonus: 200,
  minRedemption: 100,
  maxRedemptionPct: 20,
  expiryDays: 0,
};

const SKEY = "growthos:loyalty:settings";
const BKEY = (id: string) => `growthos:loyalty:balance:${id}`;
const AKEY = "growthos:loyalty:awarded-orders";

export function readLoyaltySettings(): LoyaltySettings {
  if (typeof window === "undefined") return defaultLoyaltySettings;
  try {
    const raw = localStorage.getItem(SKEY);
    if (!raw) return defaultLoyaltySettings;
    return { ...defaultLoyaltySettings, ...JSON.parse(raw) };
  } catch {
    return defaultLoyaltySettings;
  }
}

export function saveLoyaltySettings(s: LoyaltySettings) {
  localStorage.setItem(SKEY, JSON.stringify(s));
  window.dispatchEvent(new Event("growthos:loyalty-changed"));
}

export function useLoyaltySettings() {
  const [s, setS] = useState<LoyaltySettings>(() => readLoyaltySettings());
  useEffect(() => {
    const on = () => setS(readLoyaltySettings());
    window.addEventListener("growthos:loyalty-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:loyalty-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return s;
}

export function calcPointsForAmount(amount: number, s: LoyaltySettings = readLoyaltySettings()) {
  return Math.floor((Math.max(0, amount) * s.pointsPer100) / 100);
}

export function readBalance(customerId?: string): number {
  if (!customerId || typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(BKEY(customerId)) || "0", 10) || 0;
}
function writeBalance(customerId: string, v: number) {
  localStorage.setItem(BKEY(customerId), String(Math.max(0, v)));
  window.dispatchEvent(new Event("growthos:loyalty-balance-changed"));
}

export function useBalance(customerId?: string) {
  const [b, setB] = useState<number>(() => readBalance(customerId));
  useEffect(() => {
    setB(readBalance(customerId));
    const on = () => setB(readBalance(customerId));
    window.addEventListener("growthos:loyalty-balance-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:loyalty-balance-changed", on);
      window.removeEventListener("storage", on);
    };
  }, [customerId]);
  return b;
}

function readAwarded(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(AKEY) || "{}"); } catch { return {}; }
}
function writeAwarded(m: Record<string, number>) {
  localStorage.setItem(AKEY, JSON.stringify(m));
}

/**
 * Award points for a completed order (idempotent per orderId).
 * Returns points earned in this call and the new balance.
 */
export function awardPointsForOrder(orderId: string, customerId: string | undefined, amount: number, opts?: { visitBonus?: boolean; signupBonus?: boolean; birthdayBonus?: boolean }): { earned: number; balance: number } {
  if (!customerId) return { earned: 0, balance: 0 };
  const s = readLoyaltySettings();
  const awarded = readAwarded();
  if (awarded[orderId]) {
    return { earned: awarded[orderId], balance: readBalance(customerId) };
  }
  let earned = calcPointsForAmount(amount, s);
  if (opts?.visitBonus) earned += s.visitBonus;
  if (opts?.signupBonus) earned += s.signupBonus;
  if (opts?.birthdayBonus) earned += s.birthdayBonus;
  const bal = readBalance(customerId) + earned;
  writeBalance(customerId, bal);
  awarded[orderId] = earned;
  writeAwarded(awarded);
  return { earned, balance: bal };
}