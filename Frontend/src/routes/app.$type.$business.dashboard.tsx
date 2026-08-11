import { useParams } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import { useQuery } from "@tanstack/react-query";
import { useBusinessType, resolveBusinessType } from "@/lib/business-type";
import { useAuthenticatedBusiness } from "@/lib/business-profile";
import { apiFetch, getSession } from "@/lib/auth";
import { RestaurantDashboard } from "@/components/business/restaurant/restaurant-dashboard";
import { SalonDashboard } from "@/components/business/salon/salon-dashboard";

export const Route = createFileRoute("/app/$type/$business/dashboard")({
  component: BusinessDashboardRoute,
});

export default function BusinessDashboardRoute() {
  const routeParams = useParams({ strict: false }) as { type?: string };
  const session = getSession();
  const authBiz = useAuthenticatedBusiness();

  // Authoritative business type detection evaluating Profile DB, Session & Route
  const type = resolveBusinessType(authBiz.business, session, routeParams?.type);

  const {
    data: dashData,
    isLoading: fetchLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["dashboard-analytics", session?.clientId],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/dashboard");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to load dashboard (HTTP ${res.status})`);
      }
      return await res.json();
    },
    refetchInterval: 15000,
  });

  const displayName = authBiz.name || session?.businessName || "Owner";
  const displayBizName = authBiz.name || session?.businessName || (type === "salon" ? "Salon" : "Restaurant");

  // Scalable Business Type Switcher for Dashboard
  switch (type) {
    case "salon":
      return (
        <SalonDashboard
          dashData={dashData}
          fetchLoading={fetchLoading}
          isError={isError}
          error={error}
          refetch={refetch}
          displayName={displayName}
          displayBizName={displayBizName}
        />
      );

    case "restaurant":
    default:
      return (
        <RestaurantDashboard
          dashData={dashData}
          fetchLoading={fetchLoading}
          isError={isError}
          error={error}
          refetch={refetch}
          displayName={displayName}
          displayBizName={displayBizName}
        />
      );
  }
}