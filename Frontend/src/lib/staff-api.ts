import { apiFetch } from "./auth";

export interface StaffMember {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  designation: string | null;
  login_id: string | null;
  role: "OWNER" | "MANAGER" | "STAFF" | string;
  status: "ACTIVE" | "INACTIVE" | string;
  is_active: boolean;
  permissions: string[] | null;
  last_login: string | null;
  created_at: string;
}

export interface StaffCreatePayload {
  name: string;
  phone: string;
  email?: string;
  designation?: string;
  login_id?: string;
  password: string;
  status?: string;
  permissions?: string[];
}

export interface StaffUpdatePayload {
  name?: string;
  phone?: string;
  email?: string;
  designation?: string;
  login_id?: string;
  password?: string;
  status?: string;
  permissions?: string[];
}

export interface PaginatedStaffResponse {
  items: StaffMember[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * 1. GET /api/v1/staff - Fetch paginated staff members
 */
export async function listStaffApi(
  search = "",
  status = "ALL",
  page = 1,
  limit = 10
): Promise<PaginatedStaffResponse> {
  const params = new URLSearchParams();
  params.set("page", page.toString());
  params.set("limit", limit.toString());
  if (search) params.set("search", search);
  if (status) params.set("status", status);

  const res = await apiFetch(`/api/v1/staff?${params.toString()}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to fetch staff members");
  }
  return await res.json();
}

/**
 * 2. GET /api/v1/staff/next-login-id - Fetch next auto-generated Login ID preview
 */
export async function getNextStaffLoginIdApi(name?: string): Promise<string> {
  const query = name ? `?name=${encodeURIComponent(name)}` : "";
  const res = await apiFetch(`/api/v1/staff/next-login-id${query}`);
  if (!res.ok) {
    return "RST-STF-AUTO";
  }
  const data = await res.json();
  return data.next_login_id || "RST-STF-AUTO";
}

/**
 * 3. POST /api/v1/staff - Create a new staff member with auto-generated login_id
 */
export async function createStaffApi(payload: StaffCreatePayload): Promise<StaffMember> {
  const res = await apiFetch("/api/v1/staff", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to create staff member");
  }
  return await res.json();
}

/**
 * 4. GET /api/v1/staff/{user_id} - Fetch single staff member details
 */
export async function getStaffDetailApi(userId: string): Promise<StaffMember> {
  const res = await apiFetch(`/api/v1/staff/${userId}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to fetch staff detail");
  }
  return await res.json();
}

/**
 * 5. PUT /api/v1/staff/{user_id} - Update staff member profile and permissions
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
    throw new Error(errData.detail || "Failed to update staff member");
  }
  return await res.json();
}

/**
 * 6. PATCH /api/v1/staff/{user_id}/status - Toggle staff account status (ACTIVE / INACTIVE)
 */
export async function toggleStaffStatusApi(userId: string, status: "ACTIVE" | "INACTIVE"): Promise<StaffMember> {
  const res = await apiFetch(`/api/v1/staff/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to update staff status");
  }
  return await res.json();
}

/**
 * 7. POST /api/v1/staff/{user_id}/reset-password - Reset staff password
 */
export async function resetStaffPasswordApi(userId: string, password: string): Promise<{ message: string }> {
  const res = await apiFetch(`/api/v1/staff/${userId}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to reset password");
  }
  return await res.json();
}

/**
 * 8. DELETE /api/v1/staff/{user_id} - Delete staff member
 */
export async function deleteStaffApi(userId: string): Promise<{ message: string }> {
  const res = await apiFetch(`/api/v1/staff/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to delete staff member");
  }
  return await res.json();
}
