import { useEffect, useState } from "react";

export type BusinessType = "restaurant" | "salon";
const KEY = "growthos:business-type";
const ONB = (t: BusinessType) => `growthos:onboarded:${t}`;

function read(): BusinessType {
  if (typeof window === "undefined") return "restaurant";
  const v = localStorage.getItem(KEY);
  return v === "salon" ? "salon" : "restaurant";
}

export function setBusinessType(t: BusinessType) {
  localStorage.setItem(KEY, t);
  window.dispatchEvent(new Event("growthos:type-changed"));
}

export function useBusinessType(): BusinessType {
  const [t, setT] = useState<BusinessType>(() => read());
  useEffect(() => {
    const on = () => setT(read());
    window.addEventListener("growthos:type-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:type-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return t;
}

export function isOnboarded(t: BusinessType): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(ONB(t)) === "1";
}
export function markOnboarded(t: BusinessType) {
  localStorage.setItem(ONB(t), "1");
  window.dispatchEvent(new Event("growthos:onboarding-changed"));
}
export function resetOnboarding(t: BusinessType) {
  localStorage.removeItem(ONB(t));
  window.dispatchEvent(new Event("growthos:onboarding-changed"));
}

export function useOnboarded(t: BusinessType) {
  const [v, setV] = useState<boolean>(() => isOnboarded(t));
  useEffect(() => {
    setV(isOnboarded(t));
    const on = () => setV(isOnboarded(t));
    window.addEventListener("growthos:onboarding-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:onboarding-changed", on);
      window.removeEventListener("storage", on);
    };
  }, [t]);
  return v;
}