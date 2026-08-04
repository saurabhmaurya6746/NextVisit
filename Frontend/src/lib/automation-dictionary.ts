import { useParams } from "@tanstack/react-router";

export interface AutomationDictionary {
  businessLabel: string;
  itemLabel: string;
  itemsLabel: string;
  categoryLabel: string;
  resourceLabel: string;
  staffLabel: string;
  bookingLabel: string;
  bookingsLabel: string;
  recoveryPrompt: string;
  favoriteItemLabel: string;
  orderSourceLabel: string;
}

export const DICTIONARIES: Record<string, AutomationDictionary> = {
  restaurant: {
    businessLabel: "Restaurant",
    itemLabel: "Dish",
    itemsLabel: "Dishes",
    categoryLabel: "Menu Category",
    resourceLabel: "Table",
    staffLabel: "Steward",
    bookingLabel: "Order",
    bookingsLabel: "Orders",
    recoveryPrompt: "Days since last meal",
    favoriteItemLabel: "Favorite Dish",
    orderSourceLabel: "Dine-in / QR / Takeaway",
  },
  salon: {
    businessLabel: "Salon",
    itemLabel: "Service",
    itemsLabel: "Services",
    categoryLabel: "Service Category",
    resourceLabel: "Workstation",
    staffLabel: "Stylist",
    bookingLabel: "Appointment",
    bookingsLabel: "Appointments",
    recoveryPrompt: "Days since last hair/beauty visit",
    favoriteItemLabel: "Top Service",
    orderSourceLabel: "Walk-in / Online Booking",
  },
  spa: {
    businessLabel: "Spa",
    itemLabel: "Treatment",
    itemsLabel: "Treatments",
    categoryLabel: "Treatment Category",
    resourceLabel: "Treatment Room",
    staffLabel: "Therapist",
    bookingLabel: "Session",
    bookingsLabel: "Sessions",
    recoveryPrompt: "Days since last therapy",
    favoriteItemLabel: "Preferred Treatment",
    orderSourceLabel: "Spa Booking",
  },
};

export function getAutomationDictionary(type?: string): AutomationDictionary {
  const normalized = (type || "").toLowerCase();
  if (normalized.includes("restaurant") || normalized.includes("cafe")) {
    return DICTIONARIES.restaurant;
  }
  if (normalized.includes("spa")) {
    return DICTIONARIES.spa;
  }
  return DICTIONARIES.salon;
}

export function useAutomationDictionary(): AutomationDictionary {
  const routerParams = useParams({ strict: false }) as Record<string, string>;
  return getAutomationDictionary(routerParams?.type);
}
