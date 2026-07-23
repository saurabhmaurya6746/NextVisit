import { AppLink } from "@/lib/app-nav";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle, Phone, Edit, FileText, ChevronDown, ChevronRight, Gift, Crown, AlertTriangle, UserX } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { SkeletonRows, SkeletonCustomerCards } from "@/components/skeletons";
import { useWhatsAppHistory, logWhatsApp } from "@/lib/whatsapp-history";
import { useOrders, custId, orderCode, useExtraCustomers } from "@/lib/orders-store";
import { useAppointments, apptCode } from "@/lib/appointments-store";
import { useBusinessType } from "@/lib/business-type";
import { fmt } from "@/lib/currency";
import { openWhatsApp } from "@/lib/celebration-utils";
import { customers as seedCustomers, coupons, reviews } from "@/lib/sample-data";
import { toast } from "sonner";
import { useBalance, calcPointsForAmount } from "@/lib/loyalty-store";
import { Sparkles } from "lucide-react";

import { getCustomerByIdApi, type CustomerModel } from "@/lib/customers-api";

export const Route = createFileRoute("/app/$type/$business/customers/$id")({
  loader: ({ params }) => ({ id: params.id }),
  component: CustomerProfile,
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const timeline = [
  { at: "2026-07-14 19:24", text: "Placed order · $84 (3 items)" },
  { at: "2026-07-08 20:11", text: "Redeemed coupon BDAY20" },
  { at: "2026-06-30 18:45", text: "Received birthday WhatsApp wish" },
  { at: "2026-06-14 12:00", text: "Left 5★ Google review" },
  { at: "2026-05-20 19:00", text: "Booked table for 4" },
];

const kindMeta: Record<string, { label: string; tone: string }> = {
  birthday: { label: "Birthday Wish", tone: "border-primary/40 text-primary" },
  anniversary: { label: "Anniversary", tone: "border-accent/40 text-accent-foreground" },
  recovery: { label: "Recovery Offer", tone: "border-warning/40 text-warning-foreground" },
  review: { label: "Review Request", tone: "border-info/40 text-info" },
  campaign: { label: "Campaign", tone: "border-primary/40 text-primary" },
  manual: { label: "Manual", tone: "border-muted-foreground/40 text-muted-foreground" },
};

function CustomerProfile() {
  // =========================================================================
  // 1. ALL HOOKS CALLED UNCONDITIONALLY AT THE TOP LEVEL OF THE COMPONENT
  // =========================================================================
  const { id } = Route.useLoaderData();
  const allOrders = useOrders();
  const allAppts = useAppointments();
  const extras = useExtraCustomers();
  const type = useBusinessType();
  const wa = useWhatsAppHistory(id);

  const [customer, setCustomer] = useState<CustomerModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInvalidUuid, setIsInvalidUuid] = useState(false);

  // Always call custom hooks unconditionally
  const balance = useBalance(id);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const isSeedId = id.startsWith("c") || id.startsWith("cu") || id.startsWith("guest");
  const isValidUuidFormat = UUID_REGEX.test(id);

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    setErrorStatus(null);
    setErrorMessage(null);
    setIsInvalidUuid(false);

    if (!isValidUuidFormat && !isSeedId) {
      console.error(`❌ Error loading customer: Invalid customer ID format (${id})`);
      setIsInvalidUuid(true);
      setLoading(false);
      return;
    }

    console.log(`🟢 Fetching customer: ${id}`);

    try {
      const data = await getCustomerByIdApi(id);
      console.log(`✅ Customer data loaded: ${data.name}`);
      setCustomer(data);
    } catch (err: any) {
      console.error(`❌ Error loading customer: ${err.message || err}`);
      const status = err.status || 500;
      setErrorStatus(status);
      setErrorMessage(err.message || "Failed to load customer profile");

      // Check if seed customer exists as fallback for local demo IDs
      const fallback = resolveCustomer(id, allOrders, allAppts, extras);
      if (fallback && isSeedId) {
        console.log(`ℹ️ Restored demo customer fallback for seed ID ${id}`);
        setCustomer(fallback);
        setErrorStatus(null);
      }
    } finally {
      setLoading(false);
    }
  }, [id, isValidUuidFormat, isSeedId, allOrders, allAppts, extras]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  useEffect(() => {
    const noteKey = `growthos:note:${id}`;
    setNote(localStorage.getItem(noteKey) || "");
  }, [id]);

  // =========================================================================
  // 2. CONDITIONAL RENDERING (SAFE AFTER ALL HOOKS HAVE BEEN EXECUTED)
  // =========================================================================

  // Loading view
  if (loading) {
    return (
      <PageTransition>
        <AppLink path="customers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All customers
        </AppLink>
        <div className="space-y-4">
          <div className="h-12 w-64 rounded-xl bg-muted/60 animate-pulse" />
          <div className="grid gap-4 lg:grid-cols-3">
            <SkeletonCustomerCards count={1} />
            <div className="lg:col-span-2">
              <SkeletonRows rows={6} cols={4} />
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  // Invalid UUID error view
  if (isInvalidUuid) {
    return (
      <PageTransition>
        <AppLink path="customers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All customers
        </AppLink>
        <EmptyState
          title="Invalid customer ID"
          description={`The requested customer ID "${id}" is not a valid format.`}
          icon={<AlertTriangle className="h-8 w-8 text-warning" />}
          action={
            <AppLink path="customers">
              <Button variant="outline" className="rounded-full">Back to customers</Button>
            </AppLink>
          }
        />
      </PageTransition>
    );
  }

  // 404 Not Found view
  if (errorStatus === 404) {
    return (
      <PageTransition>
        <AppLink path="customers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All customers
        </AppLink>
        <EmptyState
          title="Customer not found"
          description="The customer profile you are looking for does not exist or has been removed."
          icon={<UserX className="h-8 w-8 text-muted-foreground" />}
          action={
            <AppLink path="customers">
              <Button variant="outline" className="rounded-full">Back to customers</Button>
            </AppLink>
          }
        />
      </PageTransition>
    );
  }

  // 500 or Server Error view
  if (errorStatus && errorStatus >= 500) {
    return (
      <PageTransition>
        <AppLink path="customers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All customers
        </AppLink>
        <EmptyState
          title="Something went wrong. Please try again."
          description={errorMessage || "Failed to communicate with the server."}
          icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
          action={
            <Button variant="outline" className="rounded-full" onClick={fetchCustomer}>
              Retry
            </Button>
          }
        />
      </PageTransition>
    );
  }

  // Generic error fallback
  if (errorStatus || !customer) {
    return (
      <PageTransition>
        <AppLink path="customers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All customers
        </AppLink>
        <EmptyState
          title="Failed to load customer profile"
          description={errorMessage || "An error occurred while fetching customer details."}
          icon={<AlertTriangle className="h-8 w-8 text-warning" />}
          action={
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-full" onClick={fetchCustomer}>
                Retry
              </Button>
              <AppLink path="customers">
                <Button variant="secondary" className="rounded-full">Back to customers</Button>
              </AppLink>
            </div>
          }
        />
      </PageTransition>
    );
  }

  // =========================================================================
  // 3. MAIN CUSTOMER PROFILE UI
  // =========================================================================
  const c = customer;
  const loyaltyPoints = balance || c.points || 0;
  const myAppts = allAppts.filter((a) => a.customerId === c.id).sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  const myOrders = allOrders.filter((o) => o.customerId === c.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const totalSpent = (myOrders.reduce((s, o) => s + (o.total || 0), 0) + myAppts.reduce((s, a) => s + (a.price || 0), 0)) || c.spent;
  const visitCount = (myOrders.filter((o) => o.visitCounted).length + myAppts.filter((a) => a.visitCounted).length) || c.visits;
  const avgSpend = totalSpent / Math.max(1, visitCount);
  const paidOrders = myOrders.filter((o) => o.paymentStatus === "paid");
  const loyaltyLedger = paidOrders.map((o) => ({
    id: o.id,
    date: o.paidAt || o.createdAt,
    reason: `Order ${orderCode(o)} · ${fmt(o.total)}`,
    earned: calcPointsForAmount(o.total),
    redeemed: 0,
  }));
  const lifetimeEarned = loyaltyLedger.reduce((s, r) => s + r.earned, 0) || loyaltyPoints;
  const lifetimeRedeemed = Math.max(0, lifetimeEarned - loyaltyPoints);
  const isVip = /vip/i.test(String(c.status || ""));
  const daysBetween = (a: string, b: string) => Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
  const visitDates = [...myOrders.map((o) => o.paidAt || o.createdAt), ...myAppts.map((a) => a.paidAt || a.start)].sort();
  const customerSince = (visitDates[0] || c.lastVisit || "—").slice(0, 10);
  const intervals: number[] = [];
  for (let i = 1; i < visitDates.length; i++) intervals.push(daysBetween(visitDates[i - 1], visitDates[i]));
  const avgInterval = intervals.length ? Math.round(intervals.reduce((s, n) => s + n, 0) / intervals.length) : 0;
  const daysSinceLast = visitDates.length ? Math.floor((Date.now() - new Date(visitDates[visitDates.length - 1]).getTime()) / 86400000) : 999;
  const likelyReturning = visitCount >= 2 && daysSinceLast < Math.max(30, avgInterval * 1.5) ? "High" : visitCount >= 1 && daysSinceLast < 60 ? "Medium" : "Low";
  const likelyReturnDate = avgInterval && visitDates.length
    ? new Date(new Date(visitDates[visitDates.length - 1]).getTime() + avgInterval * 86400000).toISOString().slice(0, 10)
    : "—";

  const favMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of myOrders) {
    for (const it of o.items || []) {
      const cur = favMap.get(it.name) || { name: it.name, qty: 0, revenue: 0 };
      cur.qty += it.qty; cur.revenue += it.qty * it.price;
      favMap.set(it.name, cur);
    }
  }

  const safeFavorites = c.favorites || [];
  for (const f of safeFavorites) {
    if (!favMap.has(f)) favMap.set(f, { name: f, qty: 0, revenue: 0 });
  }
  const favDishes = Array.from(favMap.values()).sort((a, b) => b.qty - a.qty);
  const topCategory = favDishes[0]?.name || "—";
  const favDish = favDishes[0]?.name || (safeFavorites[0] ?? "—");
  const recommendedOffer = likelyReturning === "Low" ? "15% comeback discount" : favDish !== "—" ? `Free ${favDish.split(" ")[0]} on next visit` : "Loyalty bonus points";

  function saveNote() {
    const noteKey = `growthos:note:${c.id}`;
    localStorage.setItem(noteKey, note);
    toast.success("Note saved");
  }

  function handleWhatsApp() {
    const msg = `Hi ${c.name.split(" ")[0]} 👋 — quick note from Aroma Bistro.`;
    openWhatsApp(c.phone, msg);
    logWhatsApp({ customerId: c.id, kind: "manual", message: msg });
    toast.success("WhatsApp opened");
  }

  const visits = [
    { date: c.lastVisit, note: "Dinner · 2 guests", amount: 84 },
    { date: "2026-06-22", note: "Lunch · 1 guest", amount: 42 },
    { date: "2026-05-30", note: "Dinner · 4 guests", amount: 168 },
    { date: "2026-05-11", note: "Brunch · 2 guests", amount: 68 },
  ];

  return (
    <PageTransition>
      <AppLink path="customers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All customers
      </AppLink>
      <PageHeader
        title={c.name}
        description={`${custId(c.id)} · ${c.status} · ${c.visits} visits · ${fmt(c.spent)} lifetime`}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => toast(`Calling ${c.phone}`)}><Phone className="mr-1.5 h-4 w-4" /> Call</Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={handleWhatsApp}><MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp</Button>
            <Button size="sm" className="rounded-full gradient-brand text-primary-foreground"><Edit className="mr-1.5 h-4 w-4" /> Edit</Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-1">
          <CardContent className="p-6 text-center">
            <Avatar className="mx-auto h-20 w-20"><AvatarFallback className="gradient-brand text-primary-foreground text-xl">{c.initials}</AvatarFallback></Avatar>
            <h2 className="mt-3 font-display text-xl font-semibold">{c.name}</h2>
            <div className="mt-1 flex items-center justify-center gap-2">
              <Badge variant="outline" className="rounded-full">{c.status}</Badge>
              {isVip && (
                <Badge className="rounded-full gradient-brand text-primary-foreground"><Crown className="mr-1 h-3 w-3" /> VIP</Badge>
              )}
            </div>
            <div className="mt-6 space-y-3 text-left text-sm">
              <Row label="Customer ID" value={custId(c.id)} />
              <Row label="Phone" value={c.phone} />
              <Row label="Email" value={c.email || "—"} />
              <Row label="DOB" value={c.birthday || "—"} />
              <Row label="Anniversary" value={c.anniversary || "—"} />
              <Row label="Gender" value={(c as any).gender || "—"} />
              <Row label="Customer since" value={customerSince} />
              <Row label="VIP status" value={isVip ? "VIP" : "—"} />
              <Row label="Visits" value={visitCount} />
              <Row label="Total spend" value={fmt(totalSpent)} />
              <Row label="Loyalty points" value={loyaltyPoints} />
              <Row label="Lifetime earned" value={lifetimeEarned} />
              <Row label="Last visit" value={c.lastVisit} />
              <Row label="Favorites" value={safeFavorites.join(", ") || "—"} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader><CardTitle className="font-display">Activity</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl p-1">
                <TabsTrigger value="overview" className="rounded-full">Overview</TabsTrigger>
                <TabsTrigger value="visits" className="rounded-full">Visits</TabsTrigger>
                <TabsTrigger value="orders" className="rounded-full">{type === "salon" ? "Appointments" : "Orders"}</TabsTrigger>
                <TabsTrigger value="loyalty" className="rounded-full">Loyalty</TabsTrigger>
                <TabsTrigger value="favorites" className="rounded-full">Favorites</TabsTrigger>
                <TabsTrigger value="coupons" className="rounded-full">Coupons</TabsTrigger>
                <TabsTrigger value="whatsapp" className="rounded-full">WhatsApp</TabsTrigger>
                <TabsTrigger value="campaigns" className="rounded-full">Campaigns</TabsTrigger>
                <TabsTrigger value="reviews" className="rounded-full">Reviews</TabsTrigger>
                <TabsTrigger value="notes" className="rounded-full">Notes</TabsTrigger>
                <TabsTrigger value="ai" className="rounded-full">AI Insights</TabsTrigger>
                <TabsTrigger value="timeline" className="rounded-full">Timeline</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4 grid gap-3 sm:grid-cols-3">
                <StatMini label="Lifetime spend" value={fmt(totalSpent)} />
                <StatMini label="Visits" value={visitCount} />
                <StatMini label="Loyalty points" value={loyaltyPoints} />
                <StatMini label="Lifetime earned" value={lifetimeEarned} />
                <StatMini label="Avg order value" value={fmt(avgSpend)} />
                <StatMini label="WhatsApps opened" value={wa.length} />
              </TabsContent>
              <TabsContent value="ai" className="mt-4 space-y-3">
                <div className="rounded-2xl border p-4 bg-gradient-to-br from-primary/5 to-transparent">
                  <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> AI Customer Insights</p>
                  <p className="mt-1 text-xs text-muted-foreground">Preview — Gemini-powered insights coming soon.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatMini label="Favorite dish" value={favDish} />
                  <StatMini label="Favorite category" value={topCategory} />
                  <StatMini label="Visit frequency" value={avgInterval ? `every ~${avgInterval} days` : "First visit"} />
                  <StatMini label="Average spend" value={fmt(avgSpend)} />
                  <StatMini label="Likely return date" value={likelyReturnDate} />
                  <StatMini label="Recommended offer" value={recommendedOffer} />
                </div>
              </TabsContent>
              <TabsContent value="visits" className="mt-4 space-y-2">
                {visits.map((v, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                    <div><p className="font-medium">{v.date}</p><p className="text-xs text-muted-foreground">{v.note}</p></div>
                    <span className="font-medium">{fmt(v.amount)}</span>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="timeline" className="mt-4 space-y-3">
                {timeline.map((t, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div><p className="text-sm">{t.text}</p><p className="text-xs text-muted-foreground">{t.at}</p></div>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="orders" className="mt-4 space-y-2">
                {type === "salon" ? (
                  myAppts.length === 0 ? (
                    <EmptyState title="No appointments yet" description="Appointments linked to this customer will appear here." icon={<FileText className="h-7 w-7" />} />
                  ) : (myAppts.map((a) => {
                    const svcs = a.services && a.services.length ? a.services : [{ name: a.service, price: a.price, duration: a.duration || 0 }];
                    return (
                      <div key={a.id} className="rounded-xl border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-xs">{apptCode(a)}</p>
                          <span className="font-semibold">{fmt(a.price)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(a.start).toLocaleString()} · {a.staff}</p>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{svcs.map((s) => s.name).join(", ")}</p>
                      </div>
                    );
                  }))
                ) : myOrders.length === 0 ? (
                  <EmptyState title="No orders yet" description="Paid orders linked to this customer will appear here." icon={<FileText className="h-7 w-7" />} />
                ) : myOrders.map((o) => {
                  const open = expandedOrder === o.id;
                  const qty = (o.items || []).reduce((s, i) => s + i.qty, 0);
                  return (
                    <div key={o.id} className="rounded-xl border text-sm">
                      <button
                        type="button"
                        onClick={() => setExpandedOrder(open ? null : o.id)}
                        className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/40"
                      >
                        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-xs">{orderCode(o)}</p>
                            <Badge variant="outline" className="rounded-full text-[10px] capitalize">{o.source === "qr" ? "QR" : "Staff"}</Badge>
                            <Badge variant="outline" className={`rounded-full text-[10px] capitalize ${o.paymentStatus === "paid" ? "border-success/40 text-success" : "border-warning/40 text-warning-foreground"}`}>{o.paymentStatus}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString()} · Table {o.table} · {qty} items</p>
                        </div>
                        <span className="shrink-0 font-semibold">{fmt(o.total)}</span>
                      </button>
                      {open && (
                        <div className="border-t p-3">
                          <table className="w-full text-xs">
                            <thead className="text-muted-foreground">
                              <tr><th className="text-left font-normal">Item</th><th className="text-right font-normal">Qty</th><th className="text-right font-normal">Price</th><th className="text-right font-normal">Total</th></tr>
                            </thead>
                            <tbody>
                              {(o.items || []).map((it) => (
                                <tr key={it.id} className="border-t"><td className="py-1.5">{it.name}</td><td className="py-1.5 text-right">{it.qty}</td><td className="py-1.5 text-right">{fmt(it.price)}</td><td className="py-1.5 text-right">{fmt(it.price * it.qty)}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </TabsContent>
              <TabsContent value="loyalty" className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatMini label="Current balance" value={loyaltyPoints} />
                  <StatMini label="Lifetime earned" value={lifetimeEarned} />
                  <StatMini label="Lifetime redeemed" value={lifetimeRedeemed} />
                </div>
                {loyaltyLedger.length === 0 ? (
                  <EmptyState title="No loyalty activity yet" description="Points earned from paid orders will appear here." icon={<Gift className="h-7 w-7" />} />
                ) : (
                  <div className="space-y-2">
                    {loyaltyLedger.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{r.reason}</p>
                          <p className="text-xs text-muted-foreground">{new Date(r.date).toLocaleString()}</p>
                        </div>
                        <span className="shrink-0 font-semibold text-success">+{r.earned}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="favorites" className="mt-4 space-y-2">
                {favDishes.length === 0 ? (
                  <EmptyState title="No favorites yet" description="Most-ordered items will show here after visits." icon={<FileText className="h-7 w-7" />} />
                ) : favDishes.map((f) => (
                  <div key={f.name} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                    <div><p className="font-medium">{f.name}</p><p className="text-xs text-muted-foreground">{f.qty} ordered</p></div>
                    <span className="font-medium">{fmt(f.revenue)}</span>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="coupons" className="mt-4 space-y-2">
                {coupons.slice(0, 3).map((cp) => (
                  <div key={cp.code} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                    <div><p className="font-mono text-xs">{cp.code}</p><p className="text-xs text-muted-foreground">{cp.discount}</p></div>
                    <Badge variant="outline" className="rounded-full capitalize">{cp.status}</Badge>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="whatsapp" className="mt-4 space-y-2">
                {wa.length === 0 ? (
                  <EmptyState title="No WhatsApp yet" description="Messages you open for this customer show up here." icon={<MessageCircle className="h-7 w-7" />} />
                ) : wa.map((m) => {
                  const meta = kindMeta[m.kind] ?? kindMeta.manual;
                  return (
                    <div key={m.id} className="rounded-xl border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-primary" />
                          <Badge variant="outline" className={`rounded-full text-[10px] ${meta.tone}`}>{meta.label}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{m.message}</p>
                    </div>
                  );
                })}
              </TabsContent>
              <TabsContent value="campaigns" className="mt-4 space-y-2">
                {wa.filter((m) => m.kind !== "manual").length === 0 ? (
                  <EmptyState title="No campaigns received" description="Birthday, anniversary and recovery messages will show up here." icon={<Sparkles className="h-7 w-7" />} />
                ) : wa.filter((m) => m.kind !== "manual").map((m) => {
                  const meta = kindMeta[m.kind] ?? kindMeta.manual;
                  return (
                    <div key={m.id} className="rounded-xl border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={`rounded-full text-[10px] ${meta.tone}`}>{meta.label}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{m.message}</p>
                    </div>
                  );
                })}
              </TabsContent>
              <TabsContent value="reviews" className="mt-4 space-y-3">
                {reviews.slice(0, 2).map((r, i) => (
                  <div key={i} className="rounded-xl border p-3 text-sm">
                    <p>{"⭐".repeat(r.rating)}</p>
                    <p className="mt-1 italic text-muted-foreground">"{r.comment}"</p>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="notes" className="mt-4 space-y-3">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} placeholder="Preferences, allergies, table preference…" />
                <div className="flex justify-end">
                  <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={saveNote}>
                    <FileText className="mr-1.5 h-4 w-4" /> Save note
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (<div className="flex items-center justify-between border-b pb-2 last:border-0"><span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>);
}

function resolveCustomer(id: string, orders: any[], appts: any[], extras: any[]): any {
  const seed = seedCustomers.find((x) => x.id === id);
  if (seed) return { ...seed, favorites: seed.favorites || [] };
  const extra = extras.find((x) => x.id === id);
  if (extra) {
    return {
      ...extra,
      email: extra.email || "",
      points: extra.points || 0,
      favorites: extra.favorites || [],
      gender: extra.gender || "",
      birthday: extra.birthday || "—",
      anniversary: extra.anniversary || "—",
    };
  }
  // Synthesize from orders / appointments — fall back to a bare guest record.
  const fromOrder = orders.find((o) => o.customerId === id);
  const fromAppt = appts.find((a) => a.customerId === id);
  const src = fromOrder || fromAppt;
  const name = src?.customerName || `Guest ${(src?.customerPhone || id).slice(-4)}`.trim();
  const initials = name.split(" ").map((x: string) => x[0]).slice(0, 2).join("").toUpperCase() || "GU";
  const myOrders = orders.filter((o) => o.customerId === id);
  const myAppts = appts.filter((a) => a.customerId === id);
  const spent = myOrders.reduce((s, o) => s + (o.total || 0), 0) + myAppts.reduce((s, a) => s + (a.price || 0), 0);
  const visits = myOrders.filter((o) => o.visitCounted).length + myAppts.filter((a) => a.visitCounted).length;
  const lastVisit = [...myOrders.map((o) => o.paidAt || o.createdAt), ...myAppts.map((a) => a.paidAt || a.start)].sort().pop() || "—";
  return {
    id,
    name,
    initials,
    phone: src?.customerPhone || "—",
    email: "",
    birthday: "—",
    anniversary: "—",
    gender: "",
    visits,
    spent,
    points: 0,
    lastVisit: typeof lastVisit === "string" ? lastVisit.slice(0, 10) : "—",
    favorites: [],
    status: "Guest",
  };
}

function StatMini({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}