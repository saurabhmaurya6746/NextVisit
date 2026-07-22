import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, CreditCard, Settings, LifeBuoy, LogOut, ClipboardCheck, Activity } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar";
import { BrandLogo } from "@/components/brand-logo";

const items = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, exact: true },
  { title: "Client Management", url: "/admin/clients", icon: Users },
  { title: "Approvals", url: "/admin/approvals", icon: ClipboardCheck },
  { title: "Monitoring", url: "/admin/monitoring", icon: Activity },
  { title: "Subscriptions", url: "/admin/subscriptions", icon: CreditCard },
  { title: "System Settings", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string, exact?: boolean) => (exact ? pathname === url : pathname.startsWith(url));
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-3 py-3">
        <Link to="/admin"><BrandLogo /></Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild><a href="#"><LifeBuoy /><span>Help & docs</span></a></SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild><Link to="/"><LogOut /><span>Sign out</span></Link></SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}