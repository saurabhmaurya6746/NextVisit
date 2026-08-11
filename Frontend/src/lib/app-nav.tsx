import { Link, useParams } from "react-router-dom";
import { forwardRef } from "react";
import { readProfile } from "@/lib/business-profile";
import { getSession } from "@/lib/auth";
import { resolveBusinessType, type BusinessType } from "@/lib/business-type";

export function slugify(input: string): string {
  return (input || "business")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "business";
}

/**
 * Read the current business scope from URL params, falling back to the stored
 * business type + profile name.
 */
export function useAppScope(): { type: BusinessType; business: string } {
  const params = useParams<{ type?: string; business?: string }>();
  const session = getSession();
  const type = resolveBusinessType(null, session, params.type);
  const profile = readProfile(type) as { name?: string };
  const business = params.business || slugify(profile?.name || type);
  return { type, business };
}

type AppLinkOwnProps = {
  path?: string;
  to?: string;
  params?: Record<string, string>;
  [key: string]: any;
};

export function resolveAppPath(path: string, scope: { type: string; business: string }, extraParams?: Record<string, string>): string {
  let relativePath = path ? "/" + path.replace(/^\//, "") : "";
  let fullPath = `/app/${scope.type}/${scope.business}${relativePath}`;
  if (extraParams) {
    Object.entries(extraParams).forEach(([key, val]) => {
      fullPath = fullPath.replace(`:$${key}`, val).replace(`:${key}`, val).replace(`$${key}`, val);
    });
  }
  return fullPath;
}

/**
 * Wrapper around React Router `<Link>` that auto-injects the current business
 * scope ($type + $business) into the target URL.
 */
export const AppLink = forwardRef<HTMLAnchorElement, AppLinkOwnProps>(
  function AppLink({ path, params, to: directTo, ...rest }, ref) {
    const scope = useAppScope();
    const targetUrl = directTo || resolveAppPath(path || "", scope, params);
    return <Link ref={ref} to={targetUrl} {...rest} />;
  }
);

/** Build a path string usable with `useNavigate()`. */
export function useAppNav() {
  const scope = useAppScope();
  return {
    scope,
    to(path: string, extra?: Record<string, string>) {
      return resolveAppPath(path, scope, extra);
    },
  };
}