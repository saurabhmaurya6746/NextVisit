import { AppLink, useAppScope } from "@/lib/app-nav";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, ShoppingBag, Cake, Heart, MessageCircle, Ticket, Trophy, Star, RefreshCw, MessageSquare, BarChart3, Calendar as CalIcon, UserCog, Settings, LogOut, Scissors, Utensils, UserPlus, PartyPopper, Crown, BookOpen, Sparkles, CreditCard, TrendingUp, History } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar";
import { BrandLogo } from "@/components/brand-logo";
import { useBusinessType } from "@/lib/business-type";

const restaurantPrimary = [
  { title: "Dashboard", path: "dashboard", icon: LayoutDashboard },
  { title: "Tables", path: "tables", icon: Utensils },
  { title: "Orders", path: "orders", icon: ShoppingBag },
  { title: "Menu", path: "menu", icon: BookOpen },
  { title: "Customers", path: "customers", icon: Users },
  { title: "Revenue", path: "revenue", icon: TrendingUp },
];
const salonPrimary = [
  { title: "Dashboard", path: "dashboard", icon: LayoutDashboard },
  { title: "Appointments", path: "appointments", icon: Scissors },
  { title: "Services", path: "services", icon: Sparkles },
  { title: "Customers", path: "customers", icon: Users },
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
  { title: "Team Members", path: "team", icon: UserCog },
  { title: "Subscription", path: "subscription", icon: CreditCard },
  { title: "Settings", path: "settings", icon: Settings },
];
const salonInsights = [
  { title: "WhatsApp History", path: "whatsapp-history", icon: History },
  { title: "Calendar", path: "calendar", icon: CalIcon },
  { title: "Subscription", path: "subscription", icon: CreditCard },
  { title: "Settings", path: "settings", icon: Settings },
];

type Item = { title: string; path: string; icon: any };
function Group({ label, items, isActive }: { label: string; items: Item[]; isActive: (path: string) => boolean }) {
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
  const prefix = `/app/${scope.type}/${scope.business}`;
  const isActive = (path: string) => {
    const full = `${prefix}/${path}`;
    return pathname === full || pathname.startsWith(full + "/");
  };
  const primary = type === "salon" ? salonPrimary : restaurantPrimary;
  const automations = type === "salon" ? salonAutomations : restaurantAutomations;
  const growth = type === "salon" ? salonGrowth : restaurantGrowth;
  const insightsGroup = type === "salon" ? salonInsights : insights;
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-3 py-3">
        <AppLink path="dashboard"><BrandLogo /></AppLink>
      </SidebarHeader>
      <SidebarContent>
        <Group label="Workspace" items={primary} isActive={isActive} />
        <Group label="Automations" items={automations} isActive={isActive} />
        <Group label="Growth" items={growth} isActive={isActive} />
        <Group label="Insights" items={insightsGroup} isActive={isActive} />
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild><Link to="/"><LogOut /><span>Sign out</span></Link></SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}