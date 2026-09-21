import { Navigate } from "react-router-dom";
import { readProfile } from "@/lib/business-profile";
import { slugify } from "@/lib/app-nav";
import { getSession } from "@/lib/auth";

function readType(): "restaurant" | "salon" {
  if (typeof window === "undefined") return "restaurant";
  const v = localStorage.getItem("growthos:business-type");
  return v === "salon" ? "salon" : "restaurant";
}

export function AppIndexPage() {
  const session = getSession();
  if (!session || session.role !== "business") {
    return <Navigate to="/login" replace />;
  }

  const type = session.businessType || readType();
  const profile = readProfile(type) as { name?: string };
  const business = session.businessSlug || slugify(profile?.name || type);

  return <Navigate to={`/app/${type}/${business}/dashboard`} replace />;
}

export default AppIndexPage;