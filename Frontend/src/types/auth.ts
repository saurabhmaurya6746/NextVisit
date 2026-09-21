// Auth Domain Type Definitions for NextVisit Platform

export type UserRole = "SUPER_ADMIN" | "BUSINESS_OWNER" | "STAFF";
export type BusinessType = "RESTAURANT" | "SALON";

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  business_id?: string | null;
  business_type?: BusinessType | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export interface LoginPayload {
  email: string;
  password?: string;
}

export interface RegisterPayload {
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  business_type: BusinessType;
}
