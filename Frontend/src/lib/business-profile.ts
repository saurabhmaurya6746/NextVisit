import { useEffect, useState } from "react";
import type { BusinessType } from "./business-type";

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