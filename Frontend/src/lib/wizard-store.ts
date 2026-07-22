import { useEffect, useState } from "react";
import type { BusinessType } from "./business-type";

export type BusinessCategory = "restaurant" | "cafe" | "salon" | "spa";
export function categoryToType(c: BusinessCategory): BusinessType {
  return c === "cafe" || c === "restaurant" ? "restaurant" : "salon";
}

export interface CampaignSettings {
  birthday: boolean;
  anniversary: boolean;
  welcome: boolean;
  recovery: boolean;
  festival: boolean;
  review: boolean;
  vip: boolean;
}
export const defaultCampaignSettings: CampaignSettings = {
  birthday: true, anniversary: true, welcome: true, recovery: true,
  festival: true, review: true, vip: true,
};

const CKEY = "growthos:campaign-settings";
export function readCampaignSettings(): CampaignSettings {
  if (typeof window === "undefined") return defaultCampaignSettings;
  try {
    const raw = localStorage.getItem(CKEY);
    return raw ? { ...defaultCampaignSettings, ...JSON.parse(raw) } : defaultCampaignSettings;
  } catch { return defaultCampaignSettings; }
}
export function saveCampaignSettings(s: CampaignSettings) {
  localStorage.setItem(CKEY, JSON.stringify(s));
  window.dispatchEvent(new Event("growthos:campaigns-changed"));
}
export function useCampaignSettings() {
  const [s, setS] = useState(() => readCampaignSettings());
  useEffect(() => {
    const on = () => setS(readCampaignSettings());
    window.addEventListener("growthos:campaigns-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:campaigns-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return s;
}

// ---------- Wizard draft (auto-save between steps) ----------
export interface WizardDraft {
  step: number;
  category: BusinessCategory;
  info: {
    businessName: string;
    ownerName: string;
    phone: string;
    email: string;
    country: string;
    city: string;
    gstNumber: string;
    logo: string;
  };
  updatedAt: number;
}
export const defaultDraft: WizardDraft = {
  step: 0,
  category: "restaurant",
  info: { businessName: "", ownerName: "", phone: "", email: "", country: "India", city: "", gstNumber: "", logo: "" },
  updatedAt: 0,
};
const DKEY = "growthos:wizard:draft";
const PKEY = "growthos:wizard:paused";

export function readDraft(): WizardDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DKEY);
    return raw ? { ...defaultDraft, ...JSON.parse(raw) } : null;
  } catch { return null; }
}
export function saveDraft(d: WizardDraft) {
  localStorage.setItem(DKEY, JSON.stringify({ ...d, updatedAt: Date.now() }));
  window.dispatchEvent(new Event("growthos:wizard-changed"));
}
export function clearDraft() {
  localStorage.removeItem(DKEY);
  localStorage.removeItem(PKEY);
  window.dispatchEvent(new Event("growthos:wizard-changed"));
}
export function isPaused(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PKEY) === "1";
}
export function setPaused(v: boolean) {
  if (v) localStorage.setItem(PKEY, "1"); else localStorage.removeItem(PKEY);
  window.dispatchEvent(new Event("growthos:wizard-changed"));
}
export function useWizardState() {
  const [state, setState] = useState(() => ({ draft: readDraft(), paused: isPaused() }));
  useEffect(() => {
    const on = () => setState({ draft: readDraft(), paused: isPaused() });
    window.addEventListener("growthos:wizard-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:wizard-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return state;
}

export const WIZARD_OPEN_EVENT = "growthos:wizard-open";
export function openWizard() {
  setPaused(false);
  window.dispatchEvent(new Event(WIZARD_OPEN_EVENT));
}