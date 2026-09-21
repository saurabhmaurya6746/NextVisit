import { apiFetch } from "./auth";

export interface CustomerMinimal {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  visit_count: number;
  total_spent: number;
  last_visit_at?: string | null;
}

export interface StaffMinimal {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
}

export interface CalendarEventModel {
  id: string;
  business_id: string;
  title: string;
  description?: string | null;
  event_type: "BIRTHDAY" | "BOOKING" | "CAMPAIGN" | "ANNIVERSARY" | "STAFF" | "NOTE" | "REMINDER" | "TASK" | "APPOINTMENT" | "EVENT";
  start_at: string;
  end_at?: string | null;
  customer_id?: string | null;
  staff_id?: string | null;
  reminder_minutes?: number | null;
  is_completed: boolean;
  recurrence_rule?: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | null;
  is_system: boolean;
  source: string;
  customer?: CustomerMinimal | null;
  staff?: StaffMinimal | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCalendarEventParams {
  title: string;
  description?: string;
  event_type?: string;
  start_at: string;
  end_at?: string;
  customer_id?: string;
  staff_id?: string;
  reminder_minutes?: number;
  is_completed?: boolean;
  recurrence_rule?: string;
}

export interface UpdateCalendarEventParams {
  title?: string;
  description?: string;
  event_type?: string;
  start_at?: string;
  end_at?: string;
  customer_id?: string;
  staff_id?: string;
  reminder_minutes?: number;
  is_completed?: boolean;
  recurrence_rule?: string;
}

export async function listCalendarEventsApi(params?: {
  start_date?: string;
  end_date?: string;
  event_type?: string;
  customer_id?: string;
  staff_id?: string;
}): Promise<CalendarEventModel[]> {
  const query = new URLSearchParams();
  if (params?.start_date) query.set("start_date", params.start_date);
  if (params?.end_date) query.set("end_date", params.end_date);
  if (params?.event_type) query.set("event_type", params.event_type);
  if (params?.customer_id) query.set("customer_id", params.customer_id);
  if (params?.staff_id) query.set("staff_id", params.staff_id);

  const res = await apiFetch(`/api/v1/calendar/events?${query.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to load calendar events");
  }
  return await res.json();
}

export async function createCalendarEventApi(data: CreateCalendarEventParams): Promise<CalendarEventModel> {
  const res = await apiFetch("/api/v1/calendar/events", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create calendar event");
  }
  return await res.json();
}

export async function updateCalendarEventApi(id: string, data: UpdateCalendarEventParams): Promise<CalendarEventModel> {
  const res = await apiFetch(`/api/v1/calendar/events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update calendar event");
  }
  return await res.json();
}

export async function deleteCalendarEventApi(id: string): Promise<{ detail: string }> {
  const res = await apiFetch(`/api/v1/calendar/events/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete calendar event");
  }
  return await res.json();
}
