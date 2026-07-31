import { AppLink, useAppScope } from "@/lib/app-nav";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, ShoppingBag, Cake, Heart, MessageCircle, Ticket, Trophy, Star, RefreshCw, MessageSquare, BarChart3, Calendar as CalIcon, UserCog, Settings, LogOut, Scissors, Utensils, UserPlus, PartyPopper, Crown, BookOpen, Sparkles, CreditCard, TrendingUp, History } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar";
import { BrandLogo } from "@/components/brand-logo";
import { clearSession, useSession, hasModulePermission } from "@/lib/auth";
import { useBusinessType } from "@/lib/business-type";

const moduleKeyMap: Record<string, string> = {
  // Workspace
  "dashboard": "dashboard",
  "setup": "setup",
  "tables": "tables",
  "orders": "orders",
  "appointments": "orders",
  "services": "menu",
  "menu": "menu",
  "customers": "customers",
  "team": "staff",
  "revenue": "revenue",

  // Automations
  "welcome": "welcome",
  "birthday-campaigns": "birthday",
  "anniversary-campaigns": "anniversary",
  "festival-campaigns": "festivals",
  "vip": "vip",
  "whatsapp-campaigns": "whatsapp_campaigns",
  "customer-recovery": "customer_recovery",

  // Growth
  "coupons": "coupons",
  "loyalty": "loyalty",
  "review-booster": "review_booster",
  "templates": "templates",

  // Insights & Administration
  "reports": "reports",
  "whatsapp-history": "whatsapp_history",
  "calendar": "calendar",
  "subscription": "subscription",
  "settings": "settings",
};

const restaurantPrimary = [
  { title: "Dashboard", path: "dashboard", icon: LayoutDashboard },
  { title: "Restaurant Setup", path: "setup", icon: Settings },
  { title: "Tables", path: "tables", icon: Utensils },
  { title: "Orders", path: "orders", icon: ShoppingBag },
  { title: "Menu", path: "menu", icon: BookOpen },
  { title: "Customers", path: "customers", icon: Users },
  { title: "Staff", path: "team", icon: UserCog },
  { title: "Revenue", path: "revenue", icon: TrendingUp },
];
const salonPrimary = [
  { title: "Dashboard", path: "dashboard", icon: LayoutDashboard },
  { title: "Appointments", path: "appointments", icon: Scissors },
  { title: "Services", path: "services", icon: Sparkles },
  { title: "Customers", path: "customers", icon: Users },
  { title: "Staff", path: "team", icon: UserCog },
  { title: "Revenue", path: "revenue", icon: TrendingUp },
];
const restaurantAutomations = [
  { title: "Welcome", path: "welcome", icon: UserPlus },
  { title: "Birthday Campaigns", path: "birthday-campaigns", icon: Cake },
  { title: "Anniversary Campaigns", path: "anniversary-campaigns", icon: Heart },
  { title: "Festival Campaigns", path: "festival-campaigns", icon: PartyPopper },
  { title: "VIP Customers", path: "vip", icon: Crown },
  { title: "WhatsApp Campaigns", path: "whatsapp-campaigns", icon: MessageCircle },
  { title: "Customer Recovery", path: "customer-recovery", icon: RefreshCw },
];
const salonAutomations = [
  { title: "Welcome", path: "welcome", icon: UserPlus },
  { title: "Birthday Campaigns", path: "birthday-campaigns", icon: Cake },
  { title: "Anniversary Campaigns", path: "anniversary-campaigns", icon: Heart },
  { title: "Festival Campaigns", path: "festival-campaigns", icon: PartyPopper },
  { title: "VIP Customers", path: "vip", icon: Crown },
  { title: "WhatsApp Campaigns", path: "whatsapp-campaigns", icon: MessageCircle },
  { title: "Customer Recovery", path: "customer-recovery", icon: RefreshCw },
];
const restaurantGrowth = [
  { title: "Coupons", path: "coupons", icon: Ticket },
  { title: "Loyalty Program", path: "loyalty", icon: Trophy },
  { title: "Review Booster", path: "review-booster", icon: Star },
  { title: "Templates", path: "templates", icon: MessageSquare },
];
const salonGrowth = [
  { title: "Review Booster", path: "review-booster", icon: Star },
  { title: "Coupons", path: "coupons", icon: Ticket },
  { title: "Templates", path: "templates", icon: MessageSquare },
];
const insights = [
  { title: "Reports", path: "reports", icon: BarChart3 },
  { title: "WhatsApp History", path: "whatsapp-history", icon: History },
  { title: "Calendar", path: "calendar", icon: CalIcon },
  { title: "Subscription", path: "subscription", icon: CreditCard },
  { title: "Settings", path: "settings", icon: Settings },
];

type Item = { title: string; path: string; icon: any };

function Group({ label, items, isActive }: { label: string; items: Item[]; isActive: (path: string) => boolean }) {
  if (items.length === 0) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.path)}>
                <AppLink path={item.path}><item.icon /><span>{item.title}</span></AppLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function BusinessSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const type = useBusinessType();
  const scope = useAppScope();
  const session = useSession();
  const prefix = `/app/${scope.type}/${scope.business}`;

  const isActive = (path: string) => {
    const full = `${prefix}/${path}`;
    return pathname === full || pathname.startsWith(full + "/");
  };

  const filterPermitted = (items: Item[]) => {
    return items.filter((item) => {
      const moduleKey = moduleKeyMap[item.path] || item.path;
      return hasModulePermission(session, moduleKey);
    });
  };

  const primary = filterPermitted(type === "salon" ? salonPrimary : restaurantPrimary);
  const automations = filterPermitted(type === "salon" ? salonAutomations : restaurantAutomations);
  const growth = filterPermitted(type === "salon" ? salonGrowth : restaurantGrowth);
  const insightsGroup = filterPermitted(insights);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-3 py-3">
        <AppLink path="dashboard"><BrandLogo /></AppLink>
      </SidebarHeader>
      <SidebarContent>
        <Group label="Workspace" items={primary} isActive={isActive} />
        <Group label="Automations" items={automations} isActive={isActive} />
        <Group label="Growth" items={growth} isActive={isActive} />
        <Group label="Insights & Admin" items={insightsGroup} isActive={isActive} />
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                clearSession();
              }}
              asChild
            >
              <Link to="/login"><LogOut /><span>Sign out</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}