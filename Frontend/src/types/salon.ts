// Salon Domain Type Definitions for NextVisit Platform

export type AppointmentStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export interface SalonServiceResponse {
  id: string;
  category_id: string;
  name: string;
  description?: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
}

export interface SalonCategoryResponse {
  id: string;
  name: string;
  display_order: number;
  services: SalonServiceResponse[];
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
  status: AppointmentStatus;
  price: number;
  notes?: string | null;
}

export interface SalonChairResponse {
  id: string;
  chair_name: string;
  assigned_staff_id?: string | null;
  is_active: boolean;
}
