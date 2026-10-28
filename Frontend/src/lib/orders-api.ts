import { apiFetch } from "./auth";
import type { BackendMenuItem } from "./menu-api";
import { syncWorker } from "./sync/sync-worker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrderSource = "POS" | "QR";
export type OrderStatus = "OPEN" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";

export interface BackendOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  service_id: string | null;
  item_name: string;
  unit_price: number;
  quantity: number;
  tax_rate: number;
  discount: number;
  subtotal: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerResponse {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  anniversary_date?: string | null;
  address?: string | null;
  notes?: string | null;
  visit_count: number;
  total_spent: number;
  loyalty_points?: number;
  first_visit_at?: string | null;
  last_visit_at?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RevenueCardMetric {
  amount: number;
  change_pct: number;
  orders_count: number;
}

export interface RevenueAnalyticsData {
  top_cards: {
    today: RevenueCardMetric;
    week: RevenueCardMetric;
    month: RevenueCardMetric;
    year: RevenueCardMetric;
  };
  by_source: Array<{ source: string; amount: number; count: number; percentage: number }>;
  by_payment: Array<{ method: string; amount: number; count: number; percentage: number }>;
  top_items: Array<{ name: string; quantity_sold: number; revenue: number; avg_price: number }>;
  least_items: Array<{ name: string; quantity_sold: number; revenue: number; avg_price: number }>;
  by_category: Array<{ category: string; revenue: number; items_sold: number; percentage: number }>;
  hourly: Array<{ hour: string; revenue: number; orders: number }>;
  daily: Array<{ date: string; day: string; revenue: number; orders: number }>;
  monthly: Array<{ month: string; revenue: number; growth_pct: number }>;
  customer_analytics: {
    new_customer_revenue: number;
    returning_customer_revenue: number;
    avg_spend_per_customer: number;
    highest_spending_customer: { name: string; spent: number } | null;
    repeat_customer_pct: number;
  };
  order_analytics: {
    total_paid_orders: number;
    average_order_value: number;
    largest_order: number;
    smallest_order: number;
    avg_items_per_order: number;
  };
  dining_analytics: {
    revenue_by_table: Array<{ table_name: string; area_name: string; revenue: number; orders: number }>;
    revenue_by_area: Array<{ area_name: string; revenue: number; orders: number }>;
    most_occupied_table: string;
    highest_revenue_table: string;
  };
  tax_discount_analytics: {
    total_tax_collected: number;
    gross_revenue: number;
    net_revenue: number;
    total_discount_given: number;
    manual_discount: number;
    loyalty_redemption_discount: number;
  };
}

export interface BackendOrder {
  id: string;
  business_id: string;
  table_id: string;
  customer_id: string | null;
  customer?: CustomerResponse | null;
  order_number: string;
  order_source: OrderSource;
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes: string | null;
  visit_token?: string | null;
  created_by: string | null;
  items: BackendOrderItem[];
  created_at: string;
  updated_at: string;
  sync_status?: string;
}

export interface CustomerInlineCreate {
  name: string;
  phone: string;
  email?: string | null;
  birth_date?: string | null;
  anniversary_date?: string | null;
  notes?: string | null;
}

export interface OrderItemCreatePayload {
  menu_item_id?: string | null;
  service_id?: string | null;
  item_name: string;
  unit_price: number;
  quantity: number;
  tax_rate?: number;
  discount?: number;
  notes?: string | null;
}

export interface OrderCreatePayload {
  table_id: string;
  customer_id?: string | null;
  customer_details?: CustomerInlineCreate | null;
  order_source?: OrderSource;
  status?: OrderStatus;
  notes?: string | null;
  tax_amount?: number;
  discount_amount?: number;
  items: OrderItemCreatePayload[];
  offline_mode?: boolean;
  client_order_id?: string;
}

export interface TableMapItem {
  id: string;
  table_name: string;
  capacity: number;
  display_order: number;
  is_active: boolean;
  status: string; // "OCCUPIED" | "EMPTY" | "OFFLINE" | etc.
  current_order_id: string | null;
  pending_amount: number;
  item_count: number;
  order_source: OrderSource | null;
  last_updated: string | null;
  is_stale?: boolean;
}

export interface DiningAreaMapResponse {
  id: string;
  name: string;
  display_order: number;
  color: string | null;
  is_active: boolean;
  tables: TableMapItem[];
  is_stale?: boolean;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(
      typeof errData.detail === "string"
        ? errData.detail
        : Array.isArray(errData.detail)
        ? errData.detail.map((e: any) => `${e.loc?.join(".") || "field"}: ${e.msg}`).join("; ")
        : `HTTP ${res.status}`
    );
    (err as any).status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// TABLE MAP API
// ---------------------------------------------------------------------------

import { getSession } from "./auth";
import { isDesktopApp, isNetworkOrTransientError } from "./desktop";
import { getMasterDataFromDesktopCache } from "./master-data-cache";
import { getStoredDeviceBinding } from "./devices-api";
import { invoke } from "@tauri-apps/api/core";

export async function getTablesMapApi(): Promise<DiningAreaMapResponse[]> {
  try {
    const res = await apiFetch("/api/v1/tables/map");
    return await handleResponse<DiningAreaMapResponse[]>(res);
  } catch (netErr) {
    if (isDesktopApp() && isNetworkOrTransientError(netErr)) {
      const session = getSession();
      const bizId = session?.clientId;
      if (bizId && session?.token) {
        try {
          const cached = await getMasterDataFromDesktopCache(bizId);
          if (cached && cached.dining_areas && cached.dining_areas.length > 0) {
            console.info("[DESKTOP CACHE] Serving cached dining area table layout (offline fallback, status=OFFLINE, is_stale=true)");
            return cached.dining_areas.map((area) => ({
              id: area.id,
              name: area.name,
              display_order: area.display_order,
              color: area.color || null,
              is_active: area.is_active,
              is_stale: true,
              tables: (area.tables || []).map((t) => ({
                id: t.id,
                table_name: t.table_name,
                capacity: t.capacity,
                display_order: t.display_order,
                is_active: t.is_active,
                status: "OFFLINE", // Explicit offline status: table layout cached, live occupancy unknown
                current_order_id: null,
                pending_amount: 0,
                item_count: 0,
                order_source: null,
                last_updated: t.updated_at || null,
                is_stale: true,
              })),
            }));
          }
        } catch (cacheErr) {
          console.warn("[DESKTOP CACHE] Error reading cached dining area map:", cacheErr);
        }
      }
    }
    throw netErr;
  }
}

// ---------------------------------------------------------------------------
// PUBLIC QR BOOTSTRAP API
// ---------------------------------------------------------------------------

export interface QrBootstrapResponse {
  business: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    country: string | null;
    currency: string | null;
    timezone: string | null;
    logo_url: string | null;
    cover_image: string | null;
    opening_time: string | null;
    closing_time: string | null;
    tax_percentage: number;
    review_link: string | null;
    booking_link: string | null;
    is_active: boolean;
    allow_guest_checkout?: boolean;
  };
  table: {
    id: string;
    table_name: string;
    dining_area_id: string;
    dining_area_name: string;
    capacity: number;
    status: "OCCUPIED" | "EMPTY";
    current_order_id: string | null;
  };
  session: {
    is_active: boolean;
    session_expired: boolean;
    visit_token: string | null;
    token_matches: boolean;
    table_occupied_blocked?: boolean;
    customer: {
      id: string;
      name: string;
      phone: string;
    } | null;
  };
  dining_areas: DiningAreaMapResponse[];
  categories: {
    id: string;
    business_id: string;
    name: string;
    display_order: number;
    is_active: boolean;
    items: BackendMenuItem[];
  }[];
}

export async function getPublicQrBootstrapApi(
  table: string,
  business?: string,
  visitToken?: string | null
): Promise<QrBootstrapResponse> {
  const q = new URLSearchParams();
  q.set("table", table);
  if (business) q.set("business", business);
  if (visitToken) q.set("visit_token", visitToken);

  const res = await apiFetch(`/api/v1/qr/bootstrap?${q.toString()}`);
  return handleResponse<QrBootstrapResponse>(res);
}

// ---------------------------------------------------------------------------
// ORDER APIs
// ---------------------------------------------------------------------------

export interface PaginatedOrdersResponse {
  items: BackendOrder[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export async function listOrdersApi(params?: {
  page?: number;
  page_size?: number;
  status?: OrderStatus | string;
  table_id?: string;
  customer_id?: string;
  order_source?: string;
  search?: string;
  date_filter?: string;
  start_date?: string;
  end_date?: string;
}): Promise<PaginatedOrdersResponse> {
  const session = getSession();
  const desktop = isDesktopApp();
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  if (desktop && offline && session?.clientId) {
    try {
      const localOrders = await invoke<BackendOrder[]>("order_list_local", {
        businessId: session.clientId,
      });
      return {
        items: localOrders,
        total: localOrders.length,
        page: 1,
        page_size: localOrders.length || 20,
        pages: 1,
      };
    } catch (e) {
      console.warn("[DESKTOP OFFLINE] Failed to list local orders:", e);
    }
  }

  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  if (params?.status && params.status !== "all") q.set("status", params.status);
  if (params?.table_id) q.set("table_id", params.table_id);
  if (params?.customer_id) q.set("customer_id", params.customer_id);
  if (params?.order_source) q.set("order_source", params.order_source);
  if (params?.search) q.set("search", params.search);
  if (params?.date_filter && params.date_filter !== "all") q.set("date_filter", params.date_filter);
  if (params?.start_date) q.set("start_date", params.start_date);
  if (params?.end_date) q.set("end_date", params.end_date);

  try {
    const res = await apiFetch(`/api/v1/orders${q.toString() ? `?${q}` : ""}`);
    return await handleResponse<PaginatedOrdersResponse>(res);
  } catch (netErr) {
    if (desktop && isNetworkOrTransientError(netErr) && session?.clientId) {
      try {
        console.info("[DESKTOP OFFLINE] Network unavailable, falling back to local SQLite orders list");
        const localOrders = await invoke<BackendOrder[]>("order_list_local", {
          businessId: session.clientId,
        });
        return {
          items: localOrders,
          total: localOrders.length,
          page: 1,
          page_size: localOrders.length || 20,
          pages: 1,
        };
      } catch (locErr) {
        console.warn("[DESKTOP OFFLINE] Error querying local SQLite orders:", locErr);
      }
    }
    throw netErr;
  }
}

export async function getOrderByIdApi(orderId: string, visitToken?: string | null): Promise<BackendOrder> {
  const session = getSession();
  const desktop = isDesktopApp();
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  if (desktop && offline && session?.clientId) {
    try {
      const local = await invoke<BackendOrder>("order_get_local", {
        businessId: session.clientId,
        orderId,
      });
      return local;
    } catch (locErr) {
      console.warn("[DESKTOP OFFLINE] Could not find order in local SQLite:", locErr);
    }
  }

  try {
    const headers: Record<string, string> = {};
    if (visitToken) {
      headers["X-Visit-Token"] = visitToken;
    }
    const res = await apiFetch(`/api/v1/orders/${orderId}`, { headers });
    return await handleResponse<BackendOrder>(res);
  } catch (netErr) {
    if (desktop && isNetworkOrTransientError(netErr) && session?.clientId) {
      try {
        console.info("[DESKTOP OFFLINE] Network error reading order, falling back to local SQLite order query");
        const local = await invoke<BackendOrder>("order_get_local", {
          businessId: session.clientId,
          orderId,
        });
        return local;
      } catch (locErr) {
        // Fall through to throw netErr if local also does not have it
      }
    }
    throw netErr;
  }
}

export async function createOrderApi(payload: OrderCreatePayload): Promise<BackendOrder> {
  const session = getSession();
  const desktop = isDesktopApp();
  const offline = (typeof navigator !== "undefined" && !navigator.onLine) || Boolean(payload.offline_mode);
  const clientOrderId = payload.client_order_id || crypto.randomUUID();

  async function createLocally(): Promise<BackendOrder> {
    if (!session?.clientId) throw new Error("Sign in to the correct business before creating an offline order.");
    if (payload.customer_details) throw new Error("New customer registration needs an internet connection. Select Guest or use a cached customer.");
    const binding = getStoredDeviceBinding(session.clientId);
    if (!binding.deviceId || !binding.devicePrefix || binding.isMismatch) {
      throw new Error("This device is not registered to the active business. Connect online and register this POS device first.");
    }
    const created = await invoke<BackendOrder>("order_create_local", {
      input: {
        businessId: session.clientId,
        deviceId: binding.deviceId,
        devicePrefix: binding.devicePrefix,
        tableId: payload.table_id,
        customerId: payload.customer_id || null,
        notes: payload.notes || null,
        clientOrderId: clientOrderId,
        items: payload.items.map((item) => ({
          menuItemId: item.menu_item_id || null,
          itemName: item.item_name,
          unitPrice: item.unit_price,
          quantity: item.quantity,
          taxRate: item.tax_rate || 0,
          discount: item.discount || 0,
          notes: item.notes || null,
        })),
      },
    });
    if (typeof navigator !== "undefined" && navigator.onLine) {
      syncWorker.triggerFlush();
    }
    return created;
  }

  if (desktop && offline) {
    return await createLocally();
  }

  const { offline_mode: _, ...onlinePayload } = payload;
  try {
    const res = await apiFetch("/api/v1/orders", {
      method: "POST",
      body: JSON.stringify({ ...onlinePayload, client_order_id: clientOrderId }),
    });
    return await handleResponse<BackendOrder>(res);
  } catch (netErr: any) {
    if (desktop && isNetworkOrTransientError(netErr)) {
      console.warn("[ORDERS] Transport failure on order creation; falling back to local SQLite outbox with stable client_order_id:", clientOrderId, netErr);
      return await createLocally();
    }
    throw netErr;
  }
}

export async function updateOrderApi(
  orderId: string,
  payload: Partial<OrderCreatePayload>
): Promise<BackendOrder> {
  const res = await apiFetch(`/api/v1/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return handleResponse<BackendOrder>(res);
}

export async function deleteOrderApi(orderId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/orders/${orderId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `HTTP ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// ORDER ITEMS APIs
// ---------------------------------------------------------------------------

export async function addOrderItemApi(
  orderId: string,
  itemPayload: OrderItemCreatePayload,
  visitToken?: string | null
): Promise<BackendOrder> {
  const headers: Record<string, string> = {};
  if (visitToken) {
    headers["X-Visit-Token"] = visitToken;
  }
  const res = await apiFetch(`/api/v1/orders/${orderId}/items`, {
    method: "POST",
    headers,
    body: JSON.stringify(itemPayload),
  });
  return handleResponse<BackendOrder>(res);
}

export async function updateOrderItemApi(
  orderId: string,
  itemId: string,
  itemPayload: Partial<OrderItemCreatePayload>
): Promise<BackendOrder> {
  const res = await apiFetch(`/api/v1/orders/${orderId}/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(itemPayload),
  });
  return handleResponse<BackendOrder>(res);
}

export async function deleteOrderItemApi(
  orderId: string,
  itemId: string
): Promise<BackendOrder> {
  const res = await apiFetch(`/api/v1/orders/${orderId}/items/${itemId}`, {
    method: "DELETE",
  });
  return handleResponse<BackendOrder>(res);
}

// ---------------------------------------------------------------------------
// PHONE LOOKUP & SETTLEMENT APIs
// ---------------------------------------------------------------------------

export async function getCustomerByPhoneApi(phone: string) {
  const res = await apiFetch(`/api/v1/customers/phone/${encodeURIComponent(phone.trim())}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface CustomerAutoDetectResult {
  exists: boolean;
  customer_id: string | null;
  name: string | null;
  phone: string | null;
  loyalty: {
    current_points: number;
    points_earned: number;
    remaining_until_next_reward: number;
    reward_target: number;
  } | null;
}

export async function autoDetectCustomerApi(
  phone: string,
  orderAmount: number = 0
): Promise<CustomerAutoDetectResult> {
  const res = await apiFetch(
    `/api/v1/orders/customers/auto-detect?phone=${encodeURIComponent(phone.trim())}&order_amount=${orderAmount}`,
    { method: "POST" }
  );
  return handleResponse<CustomerAutoDetectResult>(res);
}

export interface OrderSettlePayload {
  phone: string;
  customer_name?: string;
  birth_date?: string;
  anniversary_date?: string;
  gender?: string;
  payment_method: "CASH" | "UPI" | "CARD" | "SPLIT";
  discount_amount?: number;
  reference_note?: string;
  offline_mode?: boolean;
}

export interface OrderSettleResult {
  order_id: string;
  order_number: string;
  receipt_reference?: string;
  business_id: string;
  table_id: string;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  payment_method: string;
  payment_status?: string;
  total_amount: number;
  earned_points: number;
  new_loyalty_balance: number;
  remaining_until_next_reward: number;
  visit_id: string;
  whatsapp_receipt_sent: boolean;
  whatsapp_receipt_text: string;
  is_offline?: boolean;
  recorded_at?: string;
}

export async function settleOrderApi(
  orderId: string,
  payload: OrderSettlePayload
): Promise<OrderSettleResult> {
  const session = getSession();
  const desktop = isDesktopApp();
  const offline = (typeof navigator !== "undefined" && !navigator.onLine) || Boolean(payload.offline_mode);

  if (desktop && offline) {
    if (!session?.clientId) {
      throw new Error("Sign in to the correct business before settling an offline order.");
    }
    const binding = getStoredDeviceBinding(session.clientId);
    if (!binding.deviceId || !binding.devicePrefix || binding.isMismatch) {
      throw new Error("This desktop is not registered to the active business. Connect online and register this POS device first.");
    }
    const settled = await invoke<OrderSettleResult>("order_settle_local", {
      input: {
        businessId: session.clientId,
        deviceId: binding.deviceId,
        devicePrefix: binding.devicePrefix,
        orderId,
        phone: payload.phone,
        customerName: payload.customer_name || null,
        paymentMethod: payload.payment_method,
        discountAmount: payload.discount_amount || null,
        referenceNote: payload.reference_note || null,
      },
    });
    if (typeof navigator !== "undefined" && navigator.onLine) {
      syncWorker.triggerFlush();
    }
    return settled;
  }

  try {
    const { offline_mode: _, reference_note: _ref, ...onlinePayload } = payload as any;
    const res = await apiFetch(`/api/v1/orders/${orderId}/settle`, {
      method: "POST",
      body: JSON.stringify(onlinePayload),
    });
    return await handleResponse<OrderSettleResult>(res);
  } catch (netErr) {
    if (desktop && isNetworkOrTransientError(netErr) && session?.clientId) {
      const binding = getStoredDeviceBinding(session.clientId);
      if (binding.deviceId && binding.devicePrefix && !binding.isMismatch) {
        console.info("[DESKTOP OFFLINE] Network unavailable, falling back to local SQLite order settlement");
        const fallbackSettled = await invoke<OrderSettleResult>("order_settle_local", {
          input: {
            businessId: session.clientId,
            deviceId: binding.deviceId,
            devicePrefix: binding.devicePrefix,
            orderId,
            phone: payload.phone,
            customerName: payload.customer_name || null,
            paymentMethod: payload.payment_method,
            discountAmount: payload.discount_amount || null,
            referenceNote: payload.reference_note || null,
          },
        });
        if (typeof navigator !== "undefined" && navigator.onLine) {
          syncWorker.triggerFlush();
        }
        return fallbackSettled;
      }
    }
    throw netErr;
  }
}

export async function getRevenueAnalyticsApi(params?: {
  period?: string;
  start_date?: string;
  end_date?: string;
  dining_area_id?: string;
  payment_method?: string;
  order_source?: string;
}): Promise<RevenueAnalyticsData> {
  const query = new URLSearchParams();
  if (params?.period) query.set("period", params.period);
  if (params?.start_date) query.set("start_date", params.start_date);
  if (params?.end_date) query.set("end_date", params.end_date);
  if (params?.dining_area_id) query.set("dining_area_id", params.dining_area_id);
  if (params?.payment_method) query.set("payment_method", params.payment_method);
  if (params?.order_source) query.set("order_source", params.order_source);

  const qs = query.toString() ? `?${query.toString()}` : "";
  const res = await apiFetch(`/api/v1/orders/revenue/analytics${qs}`);
  return handleResponse<RevenueAnalyticsData>(res);
}
