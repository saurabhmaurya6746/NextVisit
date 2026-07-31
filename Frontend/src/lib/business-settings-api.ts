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

  // 1. General
  city?: string | null;
  state?: string | null;
  gst_number?: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
  website?: string | null;

  // 2. WhatsApp
  whatsapp_number?: string | null;
  default_country_code: string;
  default_message_signature?: string | null;
  enable_whatsapp_campaigns: boolean;
  enable_welcome_messages: boolean;
  review_booster_enabled: boolean;
  recovery_enabled: boolean;

  // 3. Google
  review_link?: string | null;
  maps_link?: string | null;
  booking_link?: string | null;

  // 4. Invoice
  invoice_prefix: string;
  invoice_footer?: string | null;
  show_gst_on_invoice: boolean;
  show_qr_on_invoice: boolean;
  auto_print_invoice: boolean;

  // 5. Tax & Currency
  currency: string;
  timezone: string;
  language: string;
  tax_percentage: number;
  service_charge: number;
  round_off_bill: boolean;

  // 6. Notifications
  notify_orders: boolean;
  notify_qr_orders: boolean;
  notify_campaigns: boolean;
  notify_reviews: boolean;
  notify_email: boolean;

  // 7. AI
  review_booster_ai_enabled: boolean;
  ai_default_tone: string;
  ai_max_monthly_requests: number;

  // 8. POS
  enable_qr_ordering: boolean;
  enable_staff_ordering: boolean;
  enable_parcel: boolean;
  enable_takeaway: boolean;
  enable_dine_in: boolean;
  pos_auto_complete_order: boolean;
  pos_auto_free_table: boolean;
  pos_default_payment_method: string;

  // Branding & Payments
  payment_qr_image: string | null;
  payment_upi_id: string | null;
  logo: string | null;
  cover_image: string | null;
  default_discount: number;

  created_at: string;
  updated_at: string;
}

export type BusinessSettingsUpdatePayload = Partial<BusinessSettings>;

export interface BusinessProfileUpdatePayload {
  name?: string;
  phone?: string;
  email?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  address?: string;
  logo_url?: string;
}

export interface UserSessionItem {
  id: string;
  ip_address?: string | null;
  user_agent?: string | null;
  is_active: boolean;
  last_active_at: string;
  created_at: string;
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

/**
 * 5. Fetch Restaurant Setup Business Settings (GET /api/v1/setup/business-settings)
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
 * 6. Save Restaurant Setup Business Settings (POST /api/v1/setup/business-settings)
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
 * 7. Change Password (POST /api/v1/business-settings/security/change-password)
 */
export async function changePasswordApi(payload: { old_password: string; new_password: string }): Promise<{ message: string }> {
  const res = await apiFetch("/api/v1/business-settings/security/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to change password (HTTP ${res.status})`);
  }
  return await res.json();
}

/**
 * 8. Toggle 2FA (POST /api/v1/business-settings/security/toggle-2fa)
 */
export async function toggle2faApi(enable: boolean): Promise<{ two_factor_enabled: boolean; message: string }> {
  const res = await apiFetch("/api/v1/business-settings/security/toggle-2fa", {
    method: "POST",
    body: JSON.stringify({ enable }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to toggle 2FA (HTTP ${res.status})`);
  }
  return await res.json();
}

/**
 * 9. Fetch active sessions (GET /api/v1/business-settings/security/sessions)
 */
export async function getActiveSessionsApi(): Promise<UserSessionItem[]> {
  const res = await apiFetch("/api/v1/business-settings/security/sessions");
  if (!res.ok) return [];
  return await res.json();
}

/**
 * 10. Logout other devices (POST /api/v1/business-settings/security/sessions/logout-others)
 */
export async function logoutOtherDevicesApi(): Promise<{ message: string }> {
  const res = await apiFetch("/api/v1/business-settings/security/sessions/logout-others", {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to revoke sessions (HTTP ${res.status})`);
  }
  return await res.json();
}

/**
 * 11. Download Data Export (Database / Customers / Orders / Menu)
 */
export async function downloadDataExportApi(type: "database" | "customers" | "orders" | "menu"): Promise<void> {
  const res = await apiFetch(`/api/v1/business-settings/export/${type}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to export ${type} data (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ext = type === "database" ? "json" : "csv";
  a.download = `${type.toUpperCase()}_Export_${new Date().toISOString().slice(0, 10)}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * 12. Upload Payment QR Code Image (POST /api/v1/uploads/payment-qr)
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
 * 13. Delete Payment QR Code Image (DELETE /api/v1/uploads/payment-qr)
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
