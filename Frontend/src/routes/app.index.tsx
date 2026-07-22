import { createFileRoute, redirect } from "@tanstack/react-router";
import { readProfile } from "@/lib/business-profile";
import { slugify } from "@/lib/app-nav";
import { getSession } from "@/lib/auth";

function readType(): "restaurant" | "salon" {
  if (typeof window === "undefined") return "restaurant";
  const v = localStorage.getItem("growthos:business-type");
  return v === "salon" ? "salon" : "restaurant";
}

export const Route = createFileRoute("/app/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const s = getSession();
    if (!s || s.role !== "business") throw redirect({ to: "/login" });
    const type = s.businessType || readType();
    const profile = readProfile(type) as { name?: string };
    const business = s.businessSlug || slugify(profile?.name || type);
    throw redirect({
      to: "/app/$type/$business/dashboard" as any,
      params: { type, business } as any,
      replace: true,
    });
  },
  component: () => null,
});