import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Topbar } from "@/components/topbar";
import { AppLoader } from "@/components/app-loader";
import { useState } from "react";
import { getSession } from "@/lib/auth";

let adminLoaderShown = false;

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Console — NextVisit" }] }),
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const s = getSession();
    if (!s || s.role !== "admin") {
      throw redirect({ to: "/login" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const [loading, setLoading] = useState(!adminLoaderShown);
  return (
    <>
      {loading && (
        <AppLoader
          emoji="⚡"
          name="NextVisit Admin"
          onDone={() => { adminLoaderShown = true; setLoading(false); }}
        />
      )}
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <SidebarInset className="min-w-0">
          <Topbar userName="Iris Novak" userRole="Platform Owner" initials="IN" />
          <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
    </>
  );
}