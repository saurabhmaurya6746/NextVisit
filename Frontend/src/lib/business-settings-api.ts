import { apiFetch } from "./auth";

export interface BusinessProfile {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  email: string | null;
  country: string | null;
  currency: string | null;
  address: string | null;
  logo_url: string | null;
}

export interface BusinessSettings {
  id: string;
  business_id: string;
  city?: string | null;
  state?: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
  currency: string;
  timezone: string;
  language: string;
  tax_percentage: number;
  service_charge: number;
  payment_qr_image: string | null;
  payment_upi_id: string | null;
  default_discount: number;
  review_link: string | null;
  booking_link: string | null;
  logo: string | null;
  cover_image: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessSettingsUpdatePayload {
  currency?: string;
  timezone?: string;
  language?: string;
  tax_percentage?: number;
  service_charge?: number;
  payment_qr_image?: string;
  payment_upi_id?: string;
  default_discount?: number;
  review_link?: string;
  booking_link?: string;
  logo?: string;
  cover_image?: string;
}

export interface BusinessProfileUpdatePayload {
  name?: string;
  phone?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  address?: string;
  logo_url?: string;
}

/**
 * 1. Fetch business settings (GET /api/v1/business-settings)
 */
export async function getBusinessSettingsApi(): Promise<BusinessSettings> {
  const res = await apiFetch("/api/v1/business-settings");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 2. Update business settings (PUT /api/v1/business-settings)
 */
export async function updateBusinessSettingsApi(
  payload: BusinessSettingsUpdatePayload
): Promise<BusinessSettings> {
  const res = await apiFetch("/api/v1/business-settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to update business settings (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 3. Fetch core business profile (GET /api/v1/business)
 */
export async function getBusinessProfileApi(): Promise<BusinessProfile> {
  const res = await apiFetch("/api/v1/business");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 4. Update core business profile (PUT /api/v1/business)
 */
export async function updateBusinessProfileApi(
  payload: BusinessProfileUpdatePayload
): Promise<BusinessProfile> {
  const res = await apiFetch("/api/v1/business", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to update business profile (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

export interface RestaurantSetupSettings {
  name: string;
  phone: string;
  email: string;
  address: string;
  city?: string | null;
  state?: string | null;
  country: string;
  gst_number?: string | null;
  currency: string;
  timezone: string;
  opening_time?: string | null;
  closing_time?: string | null;
  enable_qr_ordering: boolean;
  enable_staff_ordering: boolean;
  enable_parcel: boolean;
  enable_takeaway: boolean;
  tax_percentage: number;
  invoice_prefix: string;
  is_saved: boolean;
}

/**
 * 6. Fetch Restaurant Setup Business Settings (GET /api/v1/setup/business-settings)
 */
export async function getRestaurantSetupSettingsApi(): Promise<RestaurantSetupSettings> {
  const res = await apiFetch("/api/v1/setup/business-settings");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 7. Save Restaurant Setup Business Settings (POST /api/v1/setup/business-settings)
 */
export async function saveRestaurantSetupSettingsApi(
  payload: Partial<RestaurantSetupSettings>
): Promise<RestaurantSetupSettings> {
  const res = await apiFetch("/api/v1/setup/business-settings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to save restaurant setup settings (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 8. Upload Payment QR Code Image (POST /api/v1/uploads/payment-qr)
 */
export async function uploadPaymentQRApi(file: File): Promise<{ payment_qr_image: string; message: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiFetch("/api/v1/uploads/payment-qr", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to upload Payment QR code (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 9. Delete Payment QR Code Image (DELETE /api/v1/uploads/payment-qr)
 */
export async function deletePaymentQRApi(): Promise<{ message: string }> {
  const res = await apiFetch("/api/v1/uploads/payment-qr", {
    method: "DELETE",
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to delete Payment QR code (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

