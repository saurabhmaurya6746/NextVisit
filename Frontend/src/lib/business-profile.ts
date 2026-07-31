import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BusinessType } from "./business-type";
import { getBusinessProfileApi, type BusinessProfile as ApiBusinessProfile } from "./business-settings-api";
import { getSession, getToken } from "./auth";

export interface RestaurantProfile {
  name: string;
  logo: string;
  address: string;
  tables: number;
  tableNames: string[];
  parcel: boolean;
  takeaway: boolean;
  currency: string;
  upiQr: string;
  upiId: string;
  googleReviewLink: string;
  gstEnabled: boolean;
  gstNumber: string;
  gstPercent: number;
  hours: string;
  paidHoldMs: number;
}

export interface SalonProfile {
  name: string;
  logo: string;
  services: { name: string; price: number; duration: number }[];
  hours: string;
  currency: string;
  googleReviewLink: string;
}

const defaults: { restaurant: RestaurantProfile; salon: SalonProfile } = {
  restaurant: {
    name: "Aroma Bistro",
    logo: "",
    address: "12 MG Road, Bengaluru 560001",
    tables: 8,
    tableNames: Array.from({ length: 8 }, (_, i) => `Table ${i + 1}`),
    parcel: true,
    takeaway: true,
    currency: "INR",
    upiQr: "",
    upiId: "aromabistro@upi",
    googleReviewLink: "https://g.page/r/aroma-bistro/review",
    gstEnabled: true,
    gstNumber: "",
    gstPercent: 5,
    hours: "12:00 PM – 11:00 PM",
    paidHoldMs: 30_000,
  },
  salon: {
    name: "Bloom & Blush Salon",
    logo: "",
    services: [
      { name: "Haircut", price: 30, duration: 45 },
      { name: "Hair Color", price: 90, duration: 90 },
      { name: "Manicure", price: 25, duration: 30 },
      { name: "Signature Facial", price: 60, duration: 60 },
    ],
    hours: "10:00 AM – 8:00 PM",
    currency: "INR",
    googleReviewLink: "https://g.page/r/bloom-blush/review",
  },
};

const KEY = (t: BusinessType) => `growthos:profile:${t}`;

export function readProfile<T extends BusinessType>(t: T): T extends "restaurant" ? RestaurantProfile : SalonProfile {
  if (typeof window === "undefined") return defaults[t] as any;
  try {
    const raw = localStorage.getItem(KEY(t));
    if (!raw) return defaults[t] as any;
    return { ...(defaults[t] as any), ...JSON.parse(raw) };
  } catch {
    return defaults[t] as any;
  }
}

export function saveProfile(t: BusinessType, p: any) {
  localStorage.setItem(KEY(t), JSON.stringify(p));
  window.dispatchEvent(new Event("growthos:profile-changed"));
}

export function useProfile<T extends BusinessType>(t: T) {
  const [p, setP] = useState<any>(() => readProfile(t));
  useEffect(() => {
    setP(readProfile(t));
    const on = () => setP(readProfile(t));
    window.addEventListener("growthos:profile-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:profile-changed", on);
      window.removeEventListener("storage", on);
    };
  }, [t]);
  return p as T extends "restaurant" ? RestaurantProfile : SalonProfile;
}

// ---------------------------------------------------------------------------
// HELPER: Generate Initials with strict fallback rules
// ---------------------------------------------------------------------------
export function getInitials(name?: string | null): string {
  if (!name || typeof name !== "string") return "NV";
  const clean = name.trim();
  if (!clean || clean.toLowerCase() === "unknown" || clean.toLowerCase() === "null" || clean.toLowerCase() === "undefined") {
    return "NV";
  }
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NV";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// DYNAMIC AUTHENTICATED BUSINESS HOOK
// ---------------------------------------------------------------------------
export function useAuthenticatedBusiness() {
  const session = getSession();
  const token = getToken();

  const { data, isLoading, refetch } = useQuery<ApiBusinessProfile | null>({
    queryKey: ["authenticated-business", session?.clientId],
    queryFn: async () => {
      if (!token || session?.role !== "business") return null;
      try {
        return await getBusinessProfileApi();
      } catch (err) {
        console.warn("[BUSINESS PROFILE] Failed to load business profile:", err);
        return null;
      }
    },
    enabled: !!token && session?.role === "business",
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Calculate fallbacks strictly according to rules:
  // Never show Unknown, Null, Undefined, or empty strings.
  const rawName = data?.name || session?.businessName;
  const name =
    rawName &&
    rawName !== "null" &&
    rawName !== "undefined" &&
    rawName !== "Unknown"
      ? rawName
      : "NextVisit";

  const rawCountry = data?.country;
  const country =
    rawCountry &&
    rawCountry !== "null" &&
    rawCountry !== "undefined"
      ? rawCountry
      : "India";

  const logoUrl = data?.logo_url || undefined;
  const initials = getInitials(name);

  return {
    business: data,
    isLoading,
    name,
    country,
    logoUrl,
    initials,
    refetch,
  };
}