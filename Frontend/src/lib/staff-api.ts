import { apiFetch } from "./auth";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "MANAGER" | "STAFF" | string;
  is_active: boolean;
  created_at: string;
}

export interface StaffCreatePayload {
  name: string;
  email: string;
  password: string;
  role?: string;
}

export interface StaffUpdatePayload {
  name?: string;
  email?: string;
  role?: string;
}

/**
 * 1. GET /api/v1/staff - Fetch all active staff for the business
 */
export async function listStaffApi(): Promise<StaffMember[]> {
  const res = await apiFetch("/api/v1/staff");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 2. POST /api/v1/staff - Create a new staff member
 */
export async function createStaffApi(payload: StaffCreatePayload): Promise<StaffMember> {
  const res = await apiFetch("/api/v1/staff", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to create staff member (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 3. PUT /api/v1/staff/{user_id} - Update staff member
 */
export async function updateStaffApi(
  userId: string,
  payload: StaffUpdatePayload
): Promise<StaffMember> {
  const res = await apiFetch(`/api/v1/staff/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to update staff member (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * 4. PATCH /api/v1/staff/{user_id}/deactivate - Deactivate a staff member
 */
export async function deactivateStaffApi(userId: string): Promise<StaffMember> {
  const res = await apiFetch(`/api/v1/staff/${userId}/deactivate`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.detail || `Failed to deactivate staff member (HTTP ${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return await res.json();
}
