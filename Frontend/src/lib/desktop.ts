/**
 * NextVisit Desktop Runtime Detection Helper
 *
 * Isolated helper to safely detect whether the React app is executing inside
 * a Tauri v2 desktop webview or inside a standard web browser.
 */

import { isTauri } from "@tauri-apps/api/core";

export interface DesktopRuntimeInfo {
  isDesktop: boolean;
  platform: "desktop" | "mobile" | "web";
  deviceType: "DESKTOP_WINDOWS" | "ANDROID_TABLET" | "ANDROID_MOBILE" | "WEB";
}

/**
 * Returns true if running inside a Tauri application (Desktop or Mobile).
 */
export function isDesktopApp(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

/**
 * Returns true if running on a mobile / touch device (phone or tablet).
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/**
 * Returns the suggested device type for registration based on runtime heuristics.
 */
export function getDevicePlatform(): "DESKTOP_WINDOWS" | "ANDROID_TABLET" | "ANDROID_MOBILE" | "WEB" {
  if (!isDesktopApp()) return "WEB";
  if (typeof navigator === "undefined") return "DESKTOP_WINDOWS";
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) {
    if (/Mobile/i.test(ua)) {
      return "ANDROID_MOBILE";
    }
    return "ANDROID_TABLET";
  }
  return "DESKTOP_WINDOWS";
}

/**
 * Returns the default device prefix recommendation for each device type.
 */
export function getDefaultDevicePrefix(deviceType: string): string {
  switch (deviceType) {
    case "ANDROID_MOBILE":
      return "MOB01";
    case "ANDROID_TABLET":
      return "TAB01";
    case "DESKTOP_WINDOWS":
    default:
      return "POS01";
  }
}

/**
 * Returns runtime platform information without throwing in SSR or standard web environments.
 */
export function getDesktopRuntimeInfo(): DesktopRuntimeInfo {
  const tauri = isDesktopApp();
  const mobile = isMobileDevice();
  const deviceType = getDevicePlatform();
  return {
    isDesktop: tauri && !mobile,
    platform: !tauri ? "web" : mobile ? "mobile" : "desktop",
    deviceType,
  };
}

/**
 * Determines whether an error represents a genuine network/offline failure or an explicitly
 * approved transient server unavailability condition (HTTP 502, 503, 504).
 *
 * Strictly returns FALSE for:
 * - HTTP 401 Unauthorized (invalid/expired credentials)
 * - HTTP 403 Forbidden (access denied or device unregistered)
 * - HTTP 400 Bad Request
 * - HTTP 404 Not Found
 * - HTTP 422 Unprocessable Entity
 * - Any client validation or programming errors
 */
export function isNetworkOrTransientError(err: unknown): boolean {
  if (!err) return false;

  // 1. Browser/client explicitly offline
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }

  // 2. HTTP response status check if attached by apiFetch/handleResponse
  const status = (err as any)?.status;
  if (typeof status === "number") {
    // Explicitly reject auth, client, and validation errors
    if (status === 401 || status === 403 || status === 400 || status === 404 || status === 422) {
      return false;
    }
    // Only transient gateway / unavailable errors are eligible for fallback
    if (status === 502 || status === 503 || status === 504) {
      return true;
    }
    // Any other HTTP status (e.g. 500, other 4xx) must not silently fall back
    return false;
  }

  // 3. Native fetch TypeError (DNS resolution failure, ECONNREFUSED, CORS preflight network failure)
  if (err instanceof TypeError) {
    return true;
  }

  // 4. Common network error message signatures
  const message = String((err as any)?.message || "").toLowerCase();
  if (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("econnrefused") ||
    message.includes("timed out") ||
    message.includes("aborted")
  ) {
    return true;
  }

  return false;
}

