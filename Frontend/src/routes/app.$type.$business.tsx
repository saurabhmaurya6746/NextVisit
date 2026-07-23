import { createFileRoute, Outlet, redirect, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { BusinessSidebar } from "@/components/business-sidebar";
import { Topbar } from "@/components/topbar";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { useBusinessType, useOnboarded, setBusinessType, type BusinessType } from "@/lib/business-type";
import { AppLoader } from "@/components/app-loader";
import { useProfile } from "@/lib/business-profile";
import { TrialBanner } from "@/components/trial-banner";
import { getSession } from "@/lib/auth";
import { useWizardState, WIZARD_OPEN_EVENT, setPaused } from "@/lib/wizard-store";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";

let appLoaderShown = false;

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
  const urlType = params.type || "restaurant";
  const normalizedType: BusinessType = urlType === "salon" ? "salon" : "restaurant";
  const storedType = useBusinessType();
  useEffect(() => {
    if (storedType !== normalizedType) setBusinessType(normalizedType);
  }, [storedType, normalizedType]);
  const type = normalizedType;
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
  const profile = useProfile(type) as any;
  const emoji = type === "restaurant" ? "🍕" : "💇";
  const businessName = profile?.name || (type === "salon" ? "Salon" : "Restaurant");
  const initials = businessName.split(/\s+/).map((s: string) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "GO";
  return (
    <>
      {loading && (
        <AppLoader
          logo={profile?.logo}
          emoji={emoji}
          name={businessName}
          onDone={() => { appLoaderShown = true; setLoading(false); }}
        />
      )}
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <BusinessSidebar />
        <SidebarInset className="min-w-0">
          <Topbar userName={businessName} userRole={`${type === "salon" ? "Salon" : "Restaurant"} · Owner`} initials={initials} />
          <TrialBanner />
          {!onboarded && wizardState.paused && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-primary/5 px-4 py-2 text-sm sm:px-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Finish setting up your business — pick up where you left off.</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={() => { setPaused(false); setWizard(true); }}>
                  Resume setup
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPaused(true)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
      <OnboardingWizard open={wizard} onOpenChange={setWizard} initialType={type} />
    </SidebarProvider>
    </>
  );
}