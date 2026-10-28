import { apiFetch, getSession } from "./auth";
import { isDesktopApp, isNetworkOrTransientError } from "./desktop";
import { getMasterDataFromDesktopCache } from "./master-data-cache";

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
  receipt_paper_size?: "58mm" | "80mm" | "A4" | string;

  // 5. Tax & Currency
  currency: string;
  timezone: string;
  language: string;
  enable_gst?: boolean;
  tax_percentage: number;
  price_includes_gst?: boolean;
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
  allow_guest_checkout?: boolean;

  // Branding & Payments
  payment_qr_image: string | null;
  payment_upi_id: string | null;
  payment_payee_name: string | null;
  logo: string | null;
  cover_image: string | null;
  default_discount: number;

  created_at: string;
  updated_at: string;
  is_stale?: boolean;
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
  allow_guest_checkout?: boolean;
  tax_percentage: number;
  invoice_prefix: string;
  is_saved: boolean;
  is_stale?: boolean;
}

/**
 * 1. Fetch business settings (GET /api/v1/business-settings)
 */
export async function getBusinessSettingsApi(): Promise<BusinessSettings> {
  try {
    const res = await apiFetch("/api/v1/business-settings");
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const err = new Error(errData.detail || `HTTP ${res.status}`);
      (err as any).status = res.status;
      throw err;
    }
    return await res.json();
  } catch (netErr: unknown) {
    if (isDesktopApp() && isNetworkOrTransientError(netErr)) {
      const session = getSession();
      if (session?.clientId && session?.token) {
        try {
          const cached = await getMasterDataFromDesktopCache(session.clientId);
          if (cached && cached.business_settings) {
            const raw = cached.business_settings as Record<string, any>;
            return {
              id: raw.id || "cached-settings",
              business_id: session.clientId,
              currency: raw.currency || "INR",
              timezone: raw.timezone || "Asia/Kolkata",
              language: raw.language || "en",
              enable_gst: raw.enable_gst !== undefined ? Boolean(raw.enable_gst) : true,
              tax_percentage: typeof raw.tax_percentage === "number" ? raw.tax_percentage : 5,
              invoice_prefix: raw.invoice_prefix || "INV-",
              receipt_paper_size: raw.receipt_paper_size || "80mm",
              payment_upi_id: raw.payment_upi_id || null,
              payment_payee_name: raw.payment_payee_name || null,
              payment_qr_image: raw.payment_qr_image || null,
              logo: raw.logo || null,
              cover_image: raw.cover_image || null,
              default_discount: typeof raw.default_discount === "number" ? raw.default_discount : 0,
              service_charge: typeof raw.service_charge === "number" ? raw.service_charge : 0,
              round_off_bill: Boolean(raw.round_off_bill),
              price_includes_gst: Boolean(raw.price_includes_gst),
              default_country_code: raw.default_country_code || "+91",
              enable_whatsapp_campaigns: Boolean(raw.enable_whatsapp_campaigns),
              enable_welcome_messages: Boolean(raw.enable_welcome_messages),
              review_booster_enabled: Boolean(raw.review_booster_enabled),
              recovery_enabled: Boolean(raw.recovery_enabled),
              show_gst_on_invoice: raw.show_gst_on_invoice !== undefined ? Boolean(raw.show_gst_on_invoice) : true,
              show_qr_on_invoice: raw.show_qr_on_invoice !== undefined ? Boolean(raw.show_qr_on_invoice) : true,
              auto_print_invoice: Boolean(raw.auto_print_invoice),
              notify_orders: Boolean(raw.notify_orders),
              notify_qr_orders: Boolean(raw.notify_qr_orders),
              notify_campaigns: Boolean(raw.notify_campaigns),
              notify_reviews: Boolean(raw.notify_reviews),
              notify_email: Boolean(raw.notify_email),
              review_booster_ai_enabled: Boolean(raw.review_booster_ai_enabled),
              ai_default_tone: raw.ai_default_tone || "friendly",
              ai_max_monthly_requests: typeof raw.ai_max_monthly_requests === "number" ? raw.ai_max_monthly_requests : 100,
              enable_qr_ordering: raw.enable_qr_ordering !== undefined ? Boolean(raw.enable_qr_ordering) : true,
              enable_staff_ordering: raw.enable_staff_ordering !== undefined ? Boolean(raw.enable_staff_ordering) : true,
              enable_parcel: raw.enable_parcel !== undefined ? Boolean(raw.enable_parcel) : true,
              enable_takeaway: raw.enable_takeaway !== undefined ? Boolean(raw.enable_takeaway) : true,
              enable_dine_in: raw.enable_dine_in !== undefined ? Boolean(raw.enable_dine_in) : true,
              pos_auto_complete_order: Boolean(raw.pos_auto_complete_order),
              pos_auto_free_table: Boolean(raw.pos_auto_free_table),
              pos_default_payment_method: raw.pos_default_payment_method || "CASH",
              allow_guest_checkout: raw.allow_guest_checkout !== undefined ? Boolean(raw.allow_guest_checkout) : true,
              created_at: cached.cached_at,
              updated_at: cached.cached_at,
              is_stale: true,
            };
          }
        } catch {
          // Fall through to rethrow original error
        }
      }
    }
    throw netErr;
  }
}

/**
 * 2. Update business settings (PUT /api/v1/business-settings)
 */
export async function updateBusinessSettingsApi(
  payload: BusinessSettingsUpdatePayload
): Promise<BusinessSettings> {
  const sanitizedPayload: BusinessSettingsUpdatePayload = {
    ...payload,
    allow_guest_checkout:
      typeof payload.allow_guest_checkout === "boolean"
        ? payload.allow_guest_checkout
        : payload.allow_guest_checkout !== undefined
        ? Boolean(payload.allow_guest_checkout)
        : undefined,
  };
  const res = await apiFetch("/api/v1/business-settings", {
    method: "PUT",
    body: JSON.stringify(sanitizedPayload),
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
  try {
    const res = await apiFetch("/api/v1/setup/business-settings");
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const err = new Error(errData.detail || `HTTP ${res.status}`);
      (err as any).status = res.status;
      throw err;
    }
    return await res.json();
  } catch (netErr: unknown) {
    if (isDesktopApp() && isNetworkOrTransientError(netErr)) {
      const session = getSession();
      if (session?.clientId && session?.token) {
        try {
          const cached = await getMasterDataFromDesktopCache(session.clientId);
          if (cached && cached.business_settings) {
            const raw = cached.business_settings as Record<string, any>;
            return {
              name: raw.name || session.businessName || "Restaurant",
              phone: raw.phone || "",
              email: raw.email || "",
              address: raw.address || "",
              city: raw.city || null,
              state: raw.state || null,
              country: raw.country || "IN",
              gst_number: raw.gst_number || null,
              currency: raw.currency || "INR",
              timezone: raw.timezone || "Asia/Kolkata",
              opening_time: raw.opening_time || null,
              closing_time: raw.closing_time || null,
              enable_qr_ordering: raw.enable_qr_ordering !== undefined ? Boolean(raw.enable_qr_ordering) : true,
              enable_staff_ordering: raw.enable_staff_ordering !== undefined ? Boolean(raw.enable_staff_ordering) : true,
              enable_parcel: raw.enable_parcel !== undefined ? Boolean(raw.enable_parcel) : true,
              enable_takeaway: raw.enable_takeaway !== undefined ? Boolean(raw.enable_takeaway) : true,
              allow_guest_checkout: raw.allow_guest_checkout !== undefined ? Boolean(raw.allow_guest_checkout) : true,
              tax_percentage: typeof raw.tax_percentage === "number" ? raw.tax_percentage : 5,
              invoice_prefix: raw.invoice_prefix || "INV-",
              is_saved: true,
              is_stale: true,
            };
          }
        } catch {
          // Fall through to rethrow original error
        }
      }
    }
    throw netErr;
  }
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

export function parseApiErrorMessage(errData: any, fallback: string = "Unable to process request. Please try again."): string {
  if (!errData) return fallback;
  if (typeof errData === "string" && errData.trim()) return errData.trim();

  if (typeof errData.detail === "string" && errData.detail.trim()) {
    return errData.detail.trim();
  }

  if (Array.isArray(errData.detail) && errData.detail.length > 0) {
    const first = errData.detail[0];
    if (typeof first === "string" && first.trim()) return first.trim();
    if (first && typeof first.msg === "string" && first.msg.trim()) {
      return first.msg.trim();
    }
  }

  if (typeof errData.message === "string" && errData.message.trim()) {
    return errData.message.trim();
  }

  if (typeof errData.error === "string" && errData.error.trim()) {
    return errData.error.trim();
  }

  return fallback;
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
    const message = parseApiErrorMessage(errData, "Unable to update password. Please try again.");
    throw new Error(message);
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

export async function exportCatalogPdfApi(): Promise<void> {
  const res = await apiFetch("/api/v1/business-settings/export/catalog-pdf");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to export catalog PDF (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Catalog_Export_${new Date().toISOString().slice(0, 10)}.pdf`;
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
