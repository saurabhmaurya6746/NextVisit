import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, CreditCard, Settings, LifeBuoy, LogOut, ClipboardCheck, Activity, Coins } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { BrandLogo } from "@/components/brand-logo";
import { useEffect } from "react";

const items = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, exact: true },
  { title: "Client Management", url: "/admin/clients", icon: Users },
  { title: "Approvals", url: "/admin/approvals", icon: ClipboardCheck },
  { title: "Monitoring", url: "/admin/monitoring", icon: Activity },
  { title: "Subscriptions", url: "/admin/subscriptions", icon: CreditCard },
  { title: "Credit Management", url: "/admin/credits", icon: Coins },
  { title: "System Settings", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { setOpenMobile, isMobile } = useSidebar();

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  const isActive = (url: string, exact?: boolean) => (exact ? pathname === url : pathname.startsWith(url));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-3 py-3">
        <Link to="/admin" onClick={handleNavClick}><BrandLogo /></Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)}>
                    <Link to={item.url} onClick={handleNavClick}>
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
            <SidebarMenuButton asChild><Link to="/" onClick={handleNavClick}><LogOut /><span>Sign out</span></Link></SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}