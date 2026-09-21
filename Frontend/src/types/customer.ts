// Customer CRM Domain Type Definitions for NextVisit Platform

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

export interface LoyaltyConfigResponse {
  business_id: string;
  earn_rate: number;
  point_value: number;
  min_spend: number;
}

export interface CouponResponse {
  id: string;
  code: string;
  discount_type: "PERCENTAGE" | "FIXED";
  discount_value: number;
  min_order_amount: number;
  max_uses: number;
  used_count: number;
  expiry_date?: string | null;
  is_active: boolean;
}
