// Restaurant Domain Type Definitions for NextVisit Platform

export type OrderSource = "POS" | "QR";
export type OrderStatus = "OPEN" | "PREPARING" | "READY" | "SERVED" | "CANCELLED" | "COMPLETED";
export type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED";

export interface MenuItemResponse {
  id: string;
  category_id: string;
  name: string;
  description?: string | null;
  price: number;
  is_veg: boolean;
  is_available: boolean;
}

export interface MenuCategoryResponse {
  id: string;
  name: string;
  display_order: number;
  items: MenuItemResponse[];
}

export interface OrderItemResponse {
  id: string;
  order_id?: string;
  menu_item_id?: string | null;
  service_id?: string | null;
  item_name: string;
  unit_price: number;
  quantity: number;
  tax_rate: number;
  discount: number;
  subtotal: number;
  notes?: string | null;
}

export interface OrderResponse {
  id: string;
  business_id: string;
  table_id?: string | null;
  customer_id?: string | null;
  order_number: string;
  status: OrderStatus;
  order_source: OrderSource;
  subtotal: number;
  tax_amount: number;
  discount: number;
  total_amount: number;
  notes?: string | null;
  created_at: string;
  items: OrderItemResponse[];
}

export interface TableResponse {
  id: string;
  dining_area_id: string;
  table_name: string;
  capacity: number;
  status: TableStatus;
  current_order_id?: string | null;
}

export interface DiningAreaResponse {
  id: string;
  area_name: string;
  tables: TableResponse[];
}
