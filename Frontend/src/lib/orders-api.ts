import { apiFetch } from "./auth";

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

export interface BackendOrder {
  id: string;
  business_id: string;
  table_id: string;
  customer_id: string | null;
  order_number: string;
  order_source: OrderSource;
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes: string | null;
  created_by: string | null;
  items: BackendOrderItem[];
  created_at: string;
  updated_at: string;
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
}

export interface TableMapItem {
  id: string;
  table_name: string;
  capacity: number;
  display_order: number;
  is_active: boolean;
  status: string; // "OCCUPIED" | "EMPTY" | etc.
  current_order_id: string | null;
  pending_amount: number;
  item_count: number;
  order_source: OrderSource | null;
  last_updated: string | null;
}

export interface DiningAreaMapResponse {
  id: string;
  name: string;
  display_order: number;
  color: string | null;
  is_active: boolean;
  tables: TableMapItem[];
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

export async function getTablesMapApi(): Promise<DiningAreaMapResponse[]> {
  const res = await apiFetch("/api/v1/tables/map");
  return handleResponse<DiningAreaMapResponse[]>(res);
}

// ---------------------------------------------------------------------------
// ORDER APIs
// ---------------------------------------------------------------------------

export async function listOrdersApi(params?: {
  status?: OrderStatus;
  table_id?: string;
  customer_id?: string;
}): Promise<BackendOrder[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.table_id) q.set("table_id", params.table_id);
  if (params?.customer_id) q.set("customer_id", params.customer_id);

  const res = await apiFetch(`/api/v1/orders${q.toString() ? `?${q}` : ""}`);
  return handleResponse<BackendOrder[]>(res);
}

export async function getOrderByIdApi(orderId: string): Promise<BackendOrder> {
  const res = await apiFetch(`/api/v1/orders/${orderId}`);
  return handleResponse<BackendOrder>(res);
}

export async function createOrderApi(payload: OrderCreatePayload): Promise<BackendOrder> {
  const res = await apiFetch("/api/v1/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse<BackendOrder>(res);
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
  itemPayload: OrderItemCreatePayload
): Promise<BackendOrder> {
  const res = await apiFetch(`/api/v1/orders/${orderId}/items`, {
    method: "POST",
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
// PHONE LOOKUP API
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
