import {
  Bell,
  Search,
  Sparkles,
  Users,
  ShoppingBag,
  Ticket,
  Megaphone,
  QrCode,
  Cake,
  DollarSign,
  UserPlus,
  Clock,
  Check,
  X,
  ShieldAlert,
  AlertTriangle,
  Star,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { customers, orders, coupons, campaigns } from "@/lib/sample-data";
import {
  useNotifications,
  markAllRead,
  markRead,
  clearNotifications,
  type NotificationType,
  type AppNotification,
} from "@/lib/notifications-store";
import { getSession } from "@/lib/auth";
import { getShortBusinessName } from "@/lib/utils";
import { useAppNav } from "@/lib/app-nav";

const ADMIN_NOTIF_TYPES: NotificationType[] = [
  "registration",
  "approval",
  "approval_approved",
  "approval_rejected",
  "subscription",
  "system_error",
  "campaign_failure",
];

const MERCHANT_NOTIF_TYPES: NotificationType[] = [
  "qr_order",
  "staff_order",
  "visit",
  "payment",
  "review",
  "staff_activity",
  "birthday",
  "campaign",
];

function getNotificationDestination(
  n: AppNotification,
  isAdmin: boolean,
  appNav: { to: (path: string, extra?: Record<string, string>) => string; scope: { type: string } }
): string | null {
  if (isAdmin) {
    switch (n.type) {
      case "registration":
        return "/admin/clients";
      case "approval":
      case "approval_approved":
      case "approval_rejected":
        return "/admin/approvals";
      case "subscription":
        return "/admin/subscriptions";
      case "system_error":
      case "campaign_failure":
        return "/admin/monitoring";
      default:
        return null;
    }
  }

  switch (n.type) {
    case "qr_order":
    case "staff_order":
      return n.orderId ? appNav.to("orders/$id", { id: n.orderId }) : appNav.to("orders");
    case "visit":
      return appNav.scope.type === "salon" ? appNav.to("workstations") : appNav.to("tables");
    case "payment":
      return appNav.to("revenue");
    case "review":
      return appNav.to("review-booster");
    case "birthday":
      return appNav.to("birthday-campaigns");
    case "campaign":
      return appNav.to("whatsapp-campaigns");
    case "staff_activity":
      return appNav.to("team");
    default:
      return null;
  }
}

export interface TopbarProps {
  userName?: string;
  userRole?: string;
  initials?: string;
  logoUrl?: string;
  country?: string;
  businessType?: string;
}

export function Topbar({
  userName,
  userRole,
  initials,
  logoUrl,
  country,
  businessType,
}: TopbarProps) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const appNav = useAppNav();
  const notifications = useNotifications();

  const session = getSession();
  const isAdmin = session?.role === "admin";

  const displayNotifications = useMemo(() => {
    const isToday = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const today = new Date();
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    };

    const roleFiltered = isAdmin
      ? notifications.filter((n) => ADMIN_NOTIF_TYPES.includes(n.type))
      : notifications.filter((n) => !ADMIN_NOTIF_TYPES.includes(n.type));

    // Show only today's notifications
    return roleFiltered.filter((n) => isToday(n.at));
  }, [notifications, isAdmin]);

  const unread = displayNotifications.filter((n) => !n.read).length;

  useEffect(() => {
    function on(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return { customers: [], orders: [], coupons: [], campaigns: [] };
    return {
      customers: customers.filter((c) => c.name.toLowerCase().includes(s) || c.phone.includes(s)).slice(0, 4),
      orders: orders.filter((o) => o.id.toLowerCase().includes(s) || o.customer.toLowerCase().includes(s)).slice(0, 3),
      coupons: coupons.filter((c) => c.code.toLowerCase().includes(s) || c.type.toLowerCase().includes(s)).slice(0, 3),
      campaigns: campaigns.filter((c) => c.name.toLowerCase().includes(s)).slice(0, 3),
    };
  }, [q]);

  const total = results.customers.length + results.orders.length + results.coupons.length + results.campaigns.length;

  // Profile data resolution
  const isSuperAdmin = isAdmin || userRole === "Super Administrator" || userName === "NextVisit";

  const displayName = isSuperAdmin
    ? "NextVisit"
    : userName &&
      userName !== "null" &&
      userName !== "undefined" &&
      userName !== "Unknown"
    ? userName
    : session?.businessName && session.businessName !== "null"
    ? session.businessName
    : "NextVisit";

  const displaySubtitle = isSuperAdmin
    ? "Super Administrator"
    : `${businessType || "Restaurant"} • ${country || "India"}`;

  const computedInitials = isSuperAdmin
    ? "NV"
    : initials && initials !== "null" && initials !== "undefined" && initials !== "NV"
    ? initials
    : displayName
        .split(/\s+/)
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "NV";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl">
      <SidebarTrigger />
      <div ref={wrapRef} className="relative hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search customers, orders, coupons, campaigns…"
          className="h-9 rounded-full border-transparent bg-muted/60 pl-9"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">⌘K</kbd>
        {open && q && (
          <div className="absolute left-0 right-0 top-full mt-2 max-h-96 overflow-auto rounded-2xl border bg-popover p-2 shadow-elegant animate-in fade-in-0 zoom-in-95">
            {total === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">No results for "{q}"</p>
            ) : (
              <div className="space-y-1">
                {results.customers.length > 0 && <Section label="Customers" icon={<Users className="h-3.5 w-3.5" />} />}
                {results.customers.map((c) => (
                  <button key={c.id} onClick={() => { navigate(appNav.to("customers/$id", { id: c.id })); setOpen(false); setQ(""); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <Avatar className="h-6 w-6"><AvatarFallback className="gradient-brand text-primary-foreground text-[10px]">{c.initials}</AvatarFallback></Avatar>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.phone}</span>
                  </button>
                ))}
                {results.orders.length > 0 && <Section label="Orders" icon={<ShoppingBag className="h-3.5 w-3.5" />} />}
                {results.orders.map((o) => (
                  <button key={o.id} onClick={() => { navigate(appNav.to("orders")); setOpen(false); setQ(""); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <span className="font-mono text-xs">{o.id}</span>
                    <span className="flex-1 truncate text-muted-foreground">{o.customer}</span>
                    <span className="text-xs font-medium">${o.total}</span>
                  </button>
                ))}
                {results.coupons.length > 0 && <Section label="Coupons" icon={<Ticket className="h-3.5 w-3.5" />} />}
                {results.coupons.map((c) => (
                  <button key={c.code} onClick={() => { navigate(appNav.to("coupons")); setOpen(false); setQ(""); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <span className="font-mono text-xs">{c.code}</span>
                    <span className="flex-1 truncate text-muted-foreground">{c.type}</span>
                    <span className="text-xs">{c.discount}</span>
                  </button>
                ))}
                {results.campaigns.length > 0 && <Section label="Campaigns" icon={<Megaphone className="h-3.5 w-3.5" />} />}
                {results.campaigns.map((c) => (
                  <button key={c.id} onClick={() => { navigate(appNav.to("whatsapp-campaigns")); setOpen(false); setQ(""); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.channel}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <div ref={notifRef} className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full cursor-pointer"
            aria-label="Notifications"
            onClick={() => {
              setNotifOpen((v) => !v);
              if (!notifOpen) setTimeout(markAllRead, 800);
            }}
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                {unread}
              </span>
            )}
          </Button>
          {notifOpen && (
            <div className="fixed left-3 right-3 top-[68px] sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 rounded-2xl border bg-popover shadow-elegant animate-in fade-in-0 zoom-in-95 z-50 overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b bg-muted/30">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">NOTIFICATIONS</p>
                {displayNotifications.length > 0 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer font-medium transition-colors"
                    onClick={() => clearNotifications()}
                  >
                    Clear all
                  </button>
                )}
              </div>
              {displayNotifications.length === 0 ? (
                <div className="py-8 px-4 text-center">
                  <p className="text-sm font-medium text-muted-foreground">No notifications today</p>
                </div>
              ) : (
                <div className="max-h-[calc(100vh-160px)] sm:max-h-80 space-y-1.5 overflow-y-auto overflow-x-hidden p-2">
                  {displayNotifications.map((n) => {
                    const Icon = ICONS[n.type] || Bell;
                    const dest = getNotificationDestination(n, isAdmin, appNav);
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          markRead(n.id);
                          setNotifOpen(false);
                          if (dest) {
                            navigate(dest);
                          }
                        }}
                        className={`group flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted/80 cursor-pointer border ${
                          !n.read ? "bg-primary/5 border-primary/20 font-medium" : "bg-card border-border/40"
                        }`}
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg gradient-brand text-primary-foreground shadow-2xs mt-0.5">
                          <Icon className="h-4 w-4 shrink-0" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5">
                            {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                            <p className="text-sm font-semibold truncate text-foreground leading-tight">{n.title}</p>
                          </div>
                          <p className="text-xs text-muted-foreground break-words leading-relaxed whitespace-normal">
                            {n.body}
                          </p>
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <span className="text-[10px] text-muted-foreground/80">
                              {new Date(n.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {dest ? (
                              <span className="text-xs font-semibold text-primary group-hover:underline flex items-center gap-0.5 shrink-0">
                                View →
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <ThemeToggle />
        <div className="ml-1 flex items-center gap-1.5 sm:gap-2 rounded-full border bg-card px-2 py-1 pr-2.5 sm:pr-3 max-w-[130px] xs:max-w-[170px] sm:max-w-none shrink-0 shadow-xs">
          <Avatar className="h-6 w-6 sm:h-7 sm:w-7 shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={displayName} className="h-full w-full object-cover rounded-full" />
            ) : (
              <AvatarFallback className="bg-gradient-brand text-[10px] sm:text-[11px] text-primary-foreground font-semibold">{computedInitials}</AvatarFallback>
            )}
          </Avatar>
          <div className="text-left leading-tight min-w-0 flex-1">
            {/* Shortened business name on mobile */}
            <p className="text-[11px] font-semibold sm:hidden truncate text-foreground">{getShortBusinessName(displayName)}</p>
            {/* Full business name & subtitle on desktop */}
            <p className="hidden sm:block text-xs font-semibold truncate text-foreground">{displayName}</p>
            <p className="hidden sm:block text-[10px] text-muted-foreground truncate">{displaySubtitle}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

function Section({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 px-2 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {icon} {label}
    </div>
  );
}

const ICONS: Record<NotificationType, typeof Bell> = {
  registration: UserPlus,
  approval: Clock,
  approval_approved: Check,
  approval_rejected: X,
  subscription: ShieldAlert,
  system_error: AlertTriangle,
  campaign_failure: Megaphone,
  qr_order: QrCode,
  staff_order: ShoppingBag,
  visit: Users,
  payment: DollarSign,
  review: Star,
  staff_activity: UserCheck,
  birthday: Cake,
  campaign: Megaphone,
};
