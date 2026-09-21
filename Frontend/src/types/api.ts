// Master API Type Definitions for NextVisit Platform

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "BUSINESS_OWNER" | "STAFF";
  business_id?: string | null;
  business_type?: "RESTAURANT" | "SALON" | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export interface BusinessSettingsResponse {
  business_id: string;
  city?: string | null;
  state?: string | null;
  gst_number?: string | null;
  tax_percentage: number;
  opening_time?: string | null;
  closing_time?: string | null;
  website?: string | null;
  whatsapp_number?: string | null;
  default_country_code?: string | null;
  default_message_signature?: string | null;
}

export interface MenuCategoryResponse {
  id: string;
  name: string;
  display_order: number;
  items: MenuItemResponse[];
}

export interface MenuItemResponse {
  id: string;
  category_id: string;
  name: string;
  description?: string | null;
  price: number;
  is_veg: boolean;
  is_available: boolean;
}

export interface OrderItemResponse {
  id: string;
  menu_item_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  notes?: string | null;
}

export interface OrderResponse {
  id: string;
  business_id: string;
  table_id?: string | null;
  customer_id?: string | null;
  order_number: string;
  status: "OPEN" | "PREPARING" | "READY" | "SERVED" | "CANCELLED" | "COMPLETED";
  order_source: "POS" | "QR";
  subtotal: number;
  tax_amount: number;
  discount: number;
  total_amount: number;
  notes?: string | null;
  created_at: string;
  items: OrderItemResponse[];
}

export interface DiningAreaResponse {
  id: string;
  area_name: string;
  tables: TableResponse[];
}

export interface TableResponse {
  id: string;
  dining_area_id: string;
  table_name: string;
  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED";
  current_order_id?: string | null;
}

export interface SalonServiceResponse {
  id: string;
  category_id: string;
  name: string;
  description?: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
}

export interface AppointmentResponse {
  id: string;
  customer_id: string;
  customer_name: string;
  service_id: string;
  service_name: string;
  staff_id: string;
  staff_name: string;
  start_time: string;
  end_time: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  price: number;
}
