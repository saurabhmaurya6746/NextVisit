import { createFileRoute, Outlet, redirect, useParams, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { BusinessSidebar } from "@/components/business-sidebar";
import { Topbar } from "@/components/topbar";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { ForbiddenView } from "@/components/forbidden-view";
import { useBusinessType, useOnboarded, setBusinessType, resolveBusinessType, type BusinessType } from "@/lib/business-type";
import { AppLoader } from "@/components/app-loader";
import { useAuthenticatedBusiness } from "@/lib/business-profile";
import { TrialBanner } from "@/components/trial-banner";
import { getSession, useSession, hasModulePermission } from "@/lib/auth";
import { useWizardState, WIZARD_OPEN_EVENT } from "@/lib/wizard-store";

let appLoaderShown = false;

const pathToModuleMap: Record<string, string> = {
  "": "dashboard",
  "dashboard": "dashboard",
  "setup": "setup",
  "tables": "tables",
  "orders": "orders",
  "appointments": "orders",
  "menu": "menu",
  "services": "menu",
  "customers": "customers",
  "team": "staff",
  "revenue": "revenue",
  "welcome": "welcome",
  "birthday-campaigns": "birthday",
  "anniversary-campaigns": "anniversary",
  "festival-campaigns": "festivals",
  "vip": "vip",
  "whatsapp-campaigns": "whatsapp_campaigns",
  "customer-recovery": "customer_recovery",
  "coupons": "coupons",
  "loyalty": "loyalty",
  "review-booster": "review_booster",
  "templates": "templates",
  "reports": "reports",
  "whatsapp-history": "whatsapp_history",
  "calendar": "calendar",
  "subscription": "subscription",
  "settings": "settings",
};

export const Route = createFileRoute("/app/$type/$business")({
  head: () => ({ meta: [{ title: "Dashboard — NextVisit" }] }),
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const s = getSession();
    if (!s || s.role !== "business") {
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const params = useParams({ strict: false }) as { type?: string; business?: string };
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const session = useSession();

  const authBiz = useAuthenticatedBusiness();
  const type = resolveBusinessType(authBiz.business, session, params.type);
  const storedType = useBusinessType();

  useEffect(() => {
    if (storedType !== type) setBusinessType(type);
  }, [storedType, type]);

  const onboarded = useOnboarded(type);
  const [wizard, setWizard] = useState(false);
  const [loading, setLoading] = useState(!appLoaderShown);
  const wizardState = useWizardState();

  useEffect(() => {
    if (!onboarded && !wizardState.paused) setWizard(true);
  }, [onboarded, wizardState.paused]);

  useEffect(() => {
    const on = () => setWizard(true);
    window.addEventListener(WIZARD_OPEN_EVENT, on);
    return () => window.removeEventListener(WIZARD_OPEN_EVENT, on);
  }, []);

  const businessName = authBiz.name;
  const country = authBiz.country;
  const logoUrl = authBiz.logoUrl;
  const initials = authBiz.initials;
  const displayType = type === "salon" ? "Salon" : "Restaurant";

  // Check Route Permission for Staff Members
  const prefix = `/app/${params.type || type}/${params.business || ""}`;
  let relativePath = pathname.replace(prefix, "").replace(/^\//, "");
  const firstSegment = relativePath.split("/")[0] || "";
  const targetModuleKey = pathToModuleMap[firstSegment] || firstSegment;

  const isPermitted = hasModulePermission(session, targetModuleKey);

  return (
    <>
      {loading && (
        <AppLoader
          onDone={() => {
            appLoaderShown = true;
            setLoading(false);
          }}
        />
      )}
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <BusinessSidebar />
          <SidebarInset className="min-w-0">
            <Topbar
              userName={businessName}
              businessType={displayType}
              country={country}
              logoUrl={logoUrl}
              initials={initials}
            />
            <TrialBanner />
            <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
              {isPermitted ? <Outlet /> : <ForbiddenView moduleName={firstSegment || "this module"} />}
            </main>
          </SidebarInset>
        </div>
        <OnboardingWizard open={wizard} onOpenChange={setWizard} initialType={type} />
      </SidebarProvider>
    </>
  );
}