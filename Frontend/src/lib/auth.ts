import { useEffect, useState } from "react";
import { slugify } from "./app-nav";

export type Role = "admin" | "business";

export type Session = {
  role: Role;
  email: string;
  clientId?: string;
  businessType?: "restaurant" | "salon";
  businessSlug?: string;
  businessName?: string;
  token?: string;
};

const KEY_SESSION = "growthos:session";
const KEY_TOKEN = "growthos:token";
const EVT = "growthos:session-changed";

export const API_BASE_URL = "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(KEY_TOKEN);
  console.log("[AUTH] getToken() retrieved:", token ? `${token.substring(0, 15)}...` : "null");
  return token;
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  console.log("[AUTH] setToken() saving growthos:token to localStorage:", token ? `${token.substring(0, 15)}...` : "null");
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
  console.log("[AUTH] setSession() saving session:", s);
  localStorage.setItem(KEY_SESSION, JSON.stringify(s));
  if (s.token) {
    setToken(s.token);
  }
  window.dispatchEvent(new Event(EVT));
}

export function clearSession() {
  console.log("[AUTH] clearSession() called - removing tokens");
  localStorage.removeItem(KEY_SESSION);
  localStorage.removeItem(KEY_TOKEN);
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

  console.log(`[AUTH] apiFetch ${options.method || "GET"} -> ${url}`);
  console.log(`[AUTH] Authorization Header:`, headers.get("Authorization"));

  const res = await fetch(url, { ...options, headers });

  console.log(`[AUTH] apiFetch response status for ${url}: ${res.status}`);

  if (res.status === 401 || res.status === 403) {
    console.warn(`[AUTH] Unauthenticated (${res.status}) on ${url}. Redirecting to login.`);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      clearSession();
      window.location.href = "/login";
    }
  }

  return res;
}

export async function loginApi(email: string, password: string): Promise<Session> {
  console.log("[AUTH] loginApi() starting with email:", email);

  const res = await apiFetch("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  console.log("[AUTH] POST /api/v1/auth/login response status:", res.status);

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("[AUTH] loginApi() failed with error payload:", errData);
    throw new Error(errData.detail || "Incorrect email or password.");
  }

  const data = await res.json();
  console.log("[AUTH] POST /api/v1/auth/login success, received access_token:", data.access_token ? `${data.access_token.substring(0, 15)}...` : "NONE");

  const token = data.access_token;
  setToken(token);

  console.log("[AUTH] Fetching user profile via getMeApi()...");
  const user = await getMeApi(token);
  console.log("[AUTH] GET /api/v1/auth/me response profile:", user);

  const session: Session = {
    role: "business",
    email: user.email,
    clientId: user.business_id,
    businessName: user.name,
    businessType: "restaurant",
    businessSlug: slugify(user.name || "restaurant"),
    token: token,
  };

  setSession(session);
  return session;
}

export async function getMeApi(explicitToken?: string) {
  const token = explicitToken || getToken();
  console.log("[AUTH] getMeApi() executing with token:", token ? `${token.substring(0, 15)}...` : "null");

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  console.log("[AUTH] GET /api/v1/auth/me response status:", res.status);

  if (!res.ok) {
    throw new Error("Failed to fetch user profile");
  }

  return await res.json();
}

export async function getBusinessTypesApi() {
  console.log("[AUTH] getBusinessTypesApi() fetching...");
  const res = await fetch(`${API_BASE_URL}/api/v1/business-types`);
  console.log("[AUTH] GET /api/v1/business-types status:", res.status);
  if (!res.ok) {
    return [];
  }
  return await res.json();
}

export async function registerApi(payload: any) {
  console.log("[AUTH] registerApi() starting with payload:", payload);

  const res = await apiFetch("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  console.log("[AUTH] POST /api/v1/auth/register response status:", res.status);

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("[AUTH] registerApi() failed:", errData);
    throw new Error(errData.detail || "Registration failed. Please check your details.");
  }

  const data = await res.json();
  console.log("[AUTH] registerApi() succeeded:", data);

  if (data.access_token) {
    setToken(data.access_token);
  }
  return data;
}