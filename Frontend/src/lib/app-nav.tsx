import { Link, useParams } from "@tanstack/react-router";
import { forwardRef } from "react";
import { readProfile } from "@/lib/business-profile";
import { useBusinessType, type BusinessType } from "@/lib/business-type";

export function slugify(input: string): string {
  return (input || "business")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "business";
}

/**
 * Read the current business scope from URL params, falling back to the stored
 * business type + profile name. This lets components that live inside the
 * /app/$type/$business/* subtree build correct links.
 */
export function useAppScope(): { type: BusinessType; business: string } {
  const params = useParams({ strict: false }) as { type?: string; business?: string };
  const storedType = useBusinessType();
  const type = (params.type === "restaurant" || params.type === "salon" ? params.type : storedType) as BusinessType;
  const profile = readProfile(type) as { name?: string };
  const business = params.business || slugify(profile?.name || type);
  return { type, business };
}

type AppLinkOwnProps = {
  /** Path relative to /app/$type/$business/ (e.g. "customers" or "customers/$id"). Empty string points at the layout root. */
  path: string;
  params?: Record<string, string>;
  [key: string]: any;
};

/**
 * Wrapper around TanStack `<Link>` that auto-injects the current business
 * scope ($type + $business) into `to` and `params`. Any extra dynamic
 * segments (e.g. `$id`) should be supplied via `params`.
 */
export const AppLink = forwardRef<HTMLAnchorElement, AppLinkOwnProps>(
  function AppLink({ path, params, ...rest }, ref) {
    const scope = useAppScope();
    const to = "/app/$type/$business" + (path ? "/" + path.replace(/^\//, "") : "");
    return <Link ref={ref as any} to={to as any} params={{ ...scope, ...(params || {}) } as any} {...(rest as any)} />;
  }
);

/** Build a `{to, params}` object usable with `useNavigate()`. */
export function useAppNav() {
  const scope = useAppScope();
  return {
    scope,
    to(path: string, extra?: Record<string, string>) {
      const to = "/app/$type/$business" + (path ? "/" + path.replace(/^\//, "") : "");
      return { to: to as any, params: { ...scope, ...(extra || {}) } as any };
    },
  };
}