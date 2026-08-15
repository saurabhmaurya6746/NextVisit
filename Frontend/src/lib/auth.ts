import { useEffect, useState } from "react";
import { slugify } from "./app-nav";

export type Role = "admin" | "business";
export type UserRole = "SUPERADMIN" | "OWNER" | "STAFF" | "MANAGER";

export type Session = {
  role: Role;
  userRole?: UserRole;
  email: string;
  loginId?: string;
  name?: string;
  clientId?: string;
  businessType?: "restaurant" | "salon";
  businessSlug?: string;
  businessName?: string;
  permissions?: string[];
  token?: string;
};

const KEY_SESSION = "growthos:session";
const KEY_TOKEN = "growthos:token";
const EVT = "growthos:session-changed";

function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof window !== "undefined") {
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (isLocalhost) {
      return envUrl || "http://localhost:8000";
    }
    // On remote/production domains (e.g. *.onrender.com), strictly disallow localhost/127.0.0.1 URLs
    // to prevent Android/Chrome Private Network Access (Local Network) permission dialogs
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl;
    }
    return "https://nextvisit-backend.onrender.com";
  }
  return envUrl || "https://nextvisit-backend.onrender.com";
}

export const API_BASE_URL = getApiBaseUrl();

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(KEY_TOKEN);
  return token;
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_TOKEN, token);
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY_SESSION);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(s: Session) {
  localStorage.setItem(KEY_SESSION, JSON.stringify(s));
  if (s.token) {
    setToken(s.token);
  }
  window.dispatchEvent(new Event(EVT));
}

export function clearSession() {
  localStorage.removeItem(KEY_SESSION);
  localStorage.removeItem(KEY_TOKEN);
  localStorage.removeItem("growthos:profile:restaurant");
  localStorage.removeItem("growthos:profile:salon");
  localStorage.removeItem("nextvisit:authenticated_business");
  window.dispatchEvent(new Event(EVT));
}

export function useSession(): Session | null {
  const [s, setS] = useState<Session | null>(() => getSession());
  useEffect(() => {
    const on = () => setS(getSession());
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return s;
}

/**
 * Checks if current user has permission to access a specific module.
 * Owner and SuperAdmin bypass all permission checks (100% full access).
 */
export function hasModulePermission(session: Session | null, moduleKey: string): boolean {
  if (!session) return false;
  // SuperAdmin and Business Owner always bypass permission checking
  if (session.role === "admin" || !session.userRole || session.userRole === "OWNER" || session.userRole === "SUPERADMIN") {
    return true;
  }
  // Staff accounts check permissions array
  const perms = session.permissions || [];
  return perms.includes("*") || perms.includes(moduleKey);
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  const token = getToken();

  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...options, headers });

  if (
    (res.status === 401 || res.status === 403) &&
    !url.includes("/login") &&
    typeof window !== "undefined" &&
    !window.location.pathname.startsWith("/login") &&
    !window.location.pathname.startsWith("/qr")
  ) {
    if (res.status === 401) {
      console.warn(`[AUTH] Unauthenticated (${res.status}) on ${url}. Redirecting to login.`);
      clearSession();
      window.location.href = "/login";
    }
  }

  return res;
}

export async function loginApi(emailOrLoginId: string, password: string): Promise<Session> {
  clearSession();

  const res = await apiFetch("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: emailOrLoginId, password }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Incorrect login ID/email or password.");
  }

  const data = await res.json();
  const token = data.access_token;
  setToken(token);

  const user = await getMeApi(token);

  let bizName = user.name;
  let bizType: "restaurant" | "salon" = "restaurant";
  try {
    const bizRes = await fetch(`${API_BASE_URL}/api/v1/business`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (bizRes.ok) {
      const bizData = await bizRes.json();
      if (bizData?.name) bizName = bizData.name;
      const rawType = (bizData?.type || bizData?.business_type?.name || "").toLowerCase();
      if (rawType.includes("salon")) {
        bizType = "salon";
      } else if (rawType.includes("restaurant")) {
        bizType = "restaurant";
      } else if (bizName.toLowerCase().includes("salon")) {
        bizType = "salon";
      }
    }
  } catch (e) {
    console.warn("[AUTH] Failed to prefetch business info during login:", e);
  }

  const session: Session = {
    role: "business",
    userRole: (user.role as UserRole) || "OWNER",
    email: user.email || user.login_id || emailOrLoginId,
    loginId: user.login_id,
    name: user.name,
    clientId: user.business_id,
    businessName: bizName,
    businessType: bizType,
    businessSlug: slugify(bizName || bizType),
    permissions: user.permissions || [],
    token: token,
  };

  setSession(session);
  return session;
}

export async function getMeApi(explicitToken?: string) {
  const token = explicitToken || getToken();

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch user profile");
  }

  return await res.json();
}

export async function adminLoginApi(email: string, password: string): Promise<Session> {
  const res = await apiFetch("/api/v1/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = typeof errData.detail === "string" ? errData.detail : "Incorrect admin email or password.";
    throw new Error(msg);
  }

  const data = await res.json();
  const token = data.access_token;
  setToken(token);

  const adminUser = await getAdminMeApi(token);

  const session: Session = {
    role: "admin",
    userRole: "SUPERADMIN",
    email: adminUser.email,
    businessName: adminUser.name || "Super Admin",
    permissions: ["*"],
    token: token,
  };

  setSession(session);
  return session;
}

export async function getAdminMeApi(explicitToken?: string) {
  const token = explicitToken || getToken();
  const res = await fetch(`${API_BASE_URL}/api/v1/admin/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch admin profile");
  }

  return await res.json();
}

export async function getBusinessTypesApi() {
  const res = await fetch(`${API_BASE_URL}/api/v1/business-types`);
  if (!res.ok) return [];
  return await res.json();
}

export async function registerApi(payload: any) {
  const res = await apiFetch("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Registration failed. Please check your details.");
  }

  const data = await res.json();
  if (data.access_token) {
    setToken(data.access_token);
  }
  return data;
}