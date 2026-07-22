import { Bell, Search, Sparkles, Users, ShoppingBag, Ticket, Megaphone, QrCode, Cake, DollarSign } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "@tanstack/react-router";
import { customers, orders, coupons, campaigns } from "@/lib/sample-data";
import { useNotifications, markAllRead, markRead, clearNotifications, type NotificationType } from "@/lib/notifications-store";

export function Topbar({ userName, userRole, initials }: { userName: string; userRole: string; initials: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const notifications = useNotifications();
  const unread = notifications.filter((n) => !n.read).length;

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

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl">
      <SidebarTrigger />
      <div ref={wrapRef} className="relative hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
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
                  <button key={c.id} onClick={() => { navigate({ to: "/app/customers/$id", params: { id: c.id } }); setOpen(false); setQ(""); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <Avatar className="h-6 w-6"><AvatarFallback className="gradient-brand text-primary-foreground text-[10px]">{c.initials}</AvatarFallback></Avatar>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.phone}</span>
                  </button>
                ))}
                {results.orders.length > 0 && <Section label="Orders" icon={<ShoppingBag className="h-3.5 w-3.5" />} />}
                {results.orders.map((o) => (
                  <button key={o.id} onClick={() => { navigate({ to: "/app/orders" }); setOpen(false); setQ(""); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <span className="font-mono text-xs">{o.id}</span>
                    <span className="flex-1 truncate text-muted-foreground">{o.customer}</span>
                    <span className="text-xs font-medium">${o.total}</span>
                  </button>
                ))}
                {results.coupons.length > 0 && <Section label="Coupons" icon={<Ticket className="h-3.5 w-3.5" />} />}
                {results.coupons.map((c) => (
                  <button key={c.code} onClick={() => { navigate({ to: "/app/coupons" }); setOpen(false); setQ(""); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <span className="font-mono text-xs">{c.code}</span>
                    <span className="flex-1 truncate text-muted-foreground">{c.type}</span>
                    <span className="text-xs">{c.discount}</span>
                  </button>
                ))}
                {results.campaigns.length > 0 && <Section label="Campaigns" icon={<Megaphone className="h-3.5 w-3.5" />} />}
                {results.campaigns.map((c) => (
                  <button key={c.id} onClick={() => { navigate({ to: "/app/whatsapp" }); setOpen(false); setQ(""); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
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
        <Button variant="ghost" size="sm" className="hidden gap-1.5 rounded-full text-xs md:inline-flex">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Ask AI
        </Button>
        <div ref={notifRef} className="relative">
          <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notifications" onClick={() => { setNotifOpen((v) => !v); if (!notifOpen) setTimeout(markAllRead, 800); }}>
            <Bell className="h-4 w-4" />
            {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">{unread}</span>}
          </Button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border bg-popover p-2 shadow-elegant animate-in fade-in-0 zoom-in-95">
              <div className="flex items-center justify-between px-2 pb-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notifications</p>
                {notifications.length > 0 && <button className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => clearNotifications()}>Clear all</button>}
              </div>
              {notifications.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">No notifications yet</p>
              ) : (
                <div className="max-h-80 space-y-1 overflow-auto">
                  {notifications.map((n) => {
                    const Icon = ICONS[n.type] || Bell;
                    return (
                      <button key={n.id} onClick={() => {
                        markRead(n.id);
                        setNotifOpen(false);
                        if (n.orderId) navigate({ to: "/app/orders/$id", params: { id: n.orderId } });
                      }}
                        className={`flex w-full items-start gap-2 rounded-lg p-2 text-left hover:bg-muted ${!n.read ? "bg-primary/5" : ""}`}>
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg gradient-brand text-primary-foreground"><Icon className="h-4 w-4" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                            <p className="text-sm font-medium truncate">{n.title}</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{n.body}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(n.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        {n.orderId && <span className="text-[10px] text-primary opacity-70">View →</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <ThemeToggle />
        <Link to="/" className="ml-1 flex items-center gap-2 rounded-full border bg-card px-2 py-1 pr-3 transition-colors hover:bg-muted">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-gradient-brand text-[11px] text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left leading-tight sm:block">
            <p className="text-xs font-semibold">{userName}</p>
            <p className="text-[10px] text-muted-foreground">{userRole}</p>
          </div>
        </Link>
        <Badge variant="secondary" className="hidden rounded-full text-[10px] lg:inline-flex">Demo</Badge>
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
  qr_order: QrCode,
  staff_order: ShoppingBag,
  birthday: Cake,
  campaign: Megaphone,
  payment: DollarSign,
};
