import { AppLink } from "@/lib/app-nav";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft, MessageCircle, Phone, Edit, FileText, ChevronDown, ChevronRight,
  Gift, Crown, AlertTriangle, UserX, Sparkles, Clock, Calendar, Heart, MapPin,
  Mail, User, ShieldCheck, CheckCircle2, QrCode, ShoppingBag, Star, Zap, Utensils
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { SkeletonRows, SkeletonCustomerCards } from "@/components/skeletons";
import { fmt } from "@/lib/currency";
import { openWhatsApp } from "@/lib/celebration-utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getCustomerCrmDetailsApi, updateCustomerApi, formatCustomer, listCustomersApi,
  type CustomerCrmData, type CustomerModel
} from "@/lib/customers-api";

export const Route = createFileRoute("/app/$type/$business/customers/$id")({
  loader: ({ params }) => ({ id: params.id }),
  component: CustomerProfile,
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function CustomerProfile() {
  const { id } = Route.useLoaderData();

  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [noteText, setNoteText] = useState("");

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editAnniversary, setEditAnniversary] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const isValidUuidFormat = UUID_REGEX.test(id);

  // Live CRM profile fetching with TanStack React Query for automatic real-time updates
  const {
    data: crmData = null,
    isLoading: loading,
    isError,
    error: queryErr,
    refetch: fetchCustomerCrm,
  } = useQuery<CustomerCrmData | null>({
    queryKey: ["customer-crm", id],
    queryFn: async () => {
      let targetUuid = id;
      if (!isValidUuidFormat) {
        const allCust = await listCustomersApi();
        const cleanId = id.trim().toLowerCase().replace(/\D/g, "");
        const match = allCust.find(
          (c: CustomerModel) => c.id === id || (cleanId && (c.phone || "").replace(/\D/g, "").includes(cleanId)) || c.name.toLowerCase().includes(id.toLowerCase())
        );
        if (match) {
          targetUuid = match.id;
        } else if (allCust.length > 0) {
          targetUuid = allCust[0].id;
        } else {
          const err = new Error(`Customer not found in database for ID '${id}'`);
          (err as any).status = 404;
          throw err;
        }
      }
      const data = await getCustomerCrmDetailsApi(targetUuid);
      if (data.profile?.notes) setNoteText(data.profile.notes);
      return data;
    },
    staleTime: 5000,
  });

  const errorMessage = isError ? (queryErr as any)?.message || "Failed to load customer profile" : null;
  const errorStatus = isError ? (queryErr as any)?.status || 500 : null;

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

  if (errorStatus || !crmData) {
    return (
      <PageTransition>
        <AppLink path="customers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All customers
        </AppLink>
        <EmptyState
          title="Customer Profile Error"
          description={errorMessage || "The requested customer profile could not be loaded."}
          icon={<AlertTriangle className="h-8 w-8 text-warning" />}
          action={
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => fetchCustomerCrm()}>Retry</Button>
              <AppLink path="customers">
                <Button variant="secondary" className="rounded-full">Back to customers</Button>
              </AppLink>
            </div>
          }
        />
      </PageTransition>
    );
  }

  const c = formatCustomer(crmData.profile);
  const p = crmData.profile;

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleSaveNote = async () => {
    try {
      await updateCustomerApi(p.id, { notes: noteText });
      toast.success("Customer note saved successfully");
      fetchCustomerCrm();
    } catch (err: any) {
      toast.error(err.message || "Failed to save note");
    }
  };

  const handleWhatsApp = () => {
    const msg = `Hi ${p.name.split(" ")[0]} 👋 — thank you for dining with us!`;
    openWhatsApp(p.phone, msg);
    toast.success("WhatsApp opened");
  };

  const openEditModal = () => {
    setEditName(p.name || "");
    setEditPhone(p.phone || "");
    setEditEmail(p.email || "");
    setEditGender(p.gender || "");
    setEditBirthDate(p.birth_date || "");
    setEditAnniversary(p.anniversary_date || "");
    setEditAddress(p.address || "");
    setEditNotes(p.notes || "");
    setIsEditOpen(true);
  };

  const handleSaveEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editPhone.trim()) {
      toast.error("Name and Phone are required.");
      return;
    }
    setEditLoading(true);
    try {
      await updateCustomerApi(p.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim() || undefined,
        gender: editGender.trim() || undefined,
        birth_date: editBirthDate || undefined,
        anniversary_date: editAnniversary || undefined,
        address: editAddress.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      toast.success("Customer details updated successfully");
      setIsEditOpen(false);
      await fetchCustomerCrm();
    } catch (err: any) {
      toast.error(err.message || "Failed to update customer");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <PageTransition>
      <AppLink path="customers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All customers
      </AppLink>

      <PageHeader
        title={c.name}
        description={`Customer CRM · Phone: ${p.phone} · Total Visits: ${crmData.total_visits} · Lifetime Spent: ${fmt(crmData.total_spent)}`}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => window.open(`tel:${p.phone.replace(/[^\d+]/g, "")}`)}><Phone className="mr-1.5 h-4 w-4" /> Call</Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={handleWhatsApp}><MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp</Button>
            <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={openEditModal}><Edit className="mr-1.5 h-4 w-4" /> Edit</Button>
          </>
        }
      />

      {/* Main Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left Sidebar Profile Card */}
        <Card className="rounded-2xl lg:col-span-1 border shadow-sm h-fit">
          <CardContent className="p-6 text-center space-y-4">
            <Avatar className="mx-auto h-20 w-20 ring-2 ring-primary/20"><AvatarFallback className="gradient-brand text-primary-foreground text-xl font-bold">{c.initials}</AvatarFallback></Avatar>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">{p.name}</h2>
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-xs font-semibold border-primary/30 text-primary">
                  {crmData.total_visits >= 5 || crmData.total_spent >= 2000 ? "VIP Customer" : crmData.total_visits > 1 ? "Repeat Customer" : "New Customer"}
                </Badge>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 text-left text-xs border-t">
              <Row label="Phone" value={p.phone} />
              <Row label="Email" value={p.email || "Not provided"} />
              <Row label="Gender" value={p.gender || "Not specified"} />
              <Row label="Birth Date" value={p.birth_date || "—"} />
              <Row label="Anniversary" value={p.anniversary_date || "—"} />
              <Row label="Address" value={p.address || "Not specified"} />
              <Row label="Customer Since" value={new Date(crmData.customer_since).toLocaleDateString()} />
              <Row label="Last Visit" value={crmData.last_visit_at ? new Date(crmData.last_visit_at).toLocaleDateString() : "—"} />
            </div>

            {/* Customer Summary Preferences */}
            <div className="rounded-xl bg-muted/40 p-3 text-left space-y-2 text-xs border">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Customer Summary
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-muted-foreground">Preferred Area:</span>
                  <p className="font-medium text-foreground">{crmData.preferred_dining_area}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Favorite Table:</span>
                  <p className="font-medium text-foreground">{crmData.favorite_table}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">QR Orders:</span>
                  <p className="font-medium text-foreground">{crmData.total_qr_orders}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Staff Orders:</span>
                  <p className="font-medium text-foreground">{crmData.total_staff_orders}</p>
                </div>
              </div>
              {crmData.favorite_items.length > 0 && (
                <div className="border-t pt-2 mt-1">
                  <span className="text-muted-foreground text-[10px]">Favorite Items:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {crmData.favorite_items.map((it, idx) => (
                      <Badge key={idx} variant="secondary" className="text-[10px] rounded-full px-2 py-0.5">
                        {it.name} ({it.count}x)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Main CRM Content Panel */}
        <Card className="rounded-2xl lg:col-span-2 border shadow-sm">
          <CardContent className="p-6">
            {/* Top Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-6">
              <div className="rounded-xl bg-muted/60 p-3 border">
                <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Total Visits</p>
                <p className="font-display text-2xl font-bold text-foreground">{crmData.total_visits}</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3 border">
                <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Total Orders</p>
                <p className="font-display text-2xl font-bold text-foreground">{crmData.total_orders}</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3 border">
                <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Total Spent</p>
                <p className="font-display text-2xl font-bold text-foreground font-mono">{fmt(crmData.total_spent)}</p>
              </div>
              <div className="rounded-xl bg-primary/10 p-3 border border-primary/20">
                <p className="text-[10px] uppercase font-semibold tracking-wider text-primary">Loyalty Points</p>
                <p className="font-display text-2xl font-bold text-primary font-mono">{crmData.loyalty_points} pts</p>
              </div>
            </div>

            {/* CRM Tabs Navigation */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="flex flex-wrap h-auto justify-start rounded-xl bg-muted/60 p-1 mb-4 gap-1">
                <TabsTrigger value="overview" className="rounded-lg text-xs font-medium">Overview</TabsTrigger>
                <TabsTrigger value="visits" className="rounded-lg text-xs font-medium">Visits ({crmData.visits.length})</TabsTrigger>
                <TabsTrigger value="orders" className="rounded-lg text-xs font-medium">Orders ({crmData.orders.length})</TabsTrigger>
                <TabsTrigger value="loyalty" className="rounded-lg text-xs font-medium">Loyalty</TabsTrigger>
                <TabsTrigger value="whatsapp" className="rounded-lg text-xs font-medium">WhatsApp ({crmData.whatsapp_logs.length})</TabsTrigger>
                <TabsTrigger value="campaigns" className="rounded-lg text-xs font-medium">Campaigns ({crmData.campaigns.length})</TabsTrigger>
                <TabsTrigger value="reviews" className="rounded-lg text-xs font-medium">Reviews ({crmData.reviews.length})</TabsTrigger>
                <TabsTrigger value="notes" className="rounded-lg text-xs font-medium">Notes</TabsTrigger>
                <TabsTrigger value="ai" className="rounded-lg text-xs font-medium">AI Insights</TabsTrigger>
              </TabsList>

              {/* 1. OVERVIEW TAB */}
              <TabsContent value="overview" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Activity Timeline
                  </h3>
                  <span className="text-xs text-muted-foreground">{crmData.timeline.length} activities logged</span>
                </div>

                {crmData.timeline.length === 0 ? (
                  <EmptyState
                    title="No customer activity logged"
                    description="Recent visits, orders, payments, and loyalty transactions will appear here automatically."
                    icon={<Clock className="h-6 w-6 text-muted-foreground" />}
                  />
                ) : (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {crmData.timeline.map((ev) => (
                      <div key={ev.id} className="relative flex items-start gap-3 rounded-xl border p-3.5 bg-card shadow-xs text-xs">
                        <div className="absolute -left-[27px] top-4 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-foreground text-sm">{ev.title}</p>
                            {ev.badge && (
                              <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0.5 font-mono">
                                {ev.badge}
                              </Badge>
                            )}
                          </div>
                          {ev.description && <p className="text-muted-foreground">{ev.description}</p>}
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {new Date(ev.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* 2. VISITS TAB */}
              <TabsContent value="visits" className="space-y-3">
                {crmData.visits.length === 0 ? (
                  <EmptyState
                    title="No visits recorded"
                    description="Visits and table seatings for this customer will be listed here."
                    icon={<Calendar className="h-6 w-6 text-muted-foreground" />}
                  />
                ) : (
                  <div className="space-y-2.5">
                    {crmData.visits.map((v) => (
                      <div key={v.id} className="rounded-xl border p-3.5 bg-card flex items-center justify-between text-xs hover:border-primary/40 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">Visit #{v.visit_number}</span>
                            <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0.2">{v.source}</Badge>
                            <Badge className={`rounded-full text-[10px] px-2 py-0.2 ${v.status === "COMPLETED" ? "bg-emerald-600 text-white" : "bg-primary text-white"}`}>{v.status}</Badge>
                          </div>
                          <p className="text-muted-foreground">
                            {v.dining_area_name} · Table {v.table_name} · {new Date(v.date).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="font-bold text-sm text-foreground font-mono">{fmt(v.total_amount)}</p>
                          <p className="text-[10px] text-emerald-600 font-medium font-mono">+{v.loyalty_earned} pts earned</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* 3. ORDERS TAB */}
              <TabsContent value="orders" className="space-y-3">
                {crmData.orders.length === 0 ? (
                  <EmptyState
                    title="No orders found"
                    description="Order history and line item details will be listed here."
                    icon={<ShoppingBag className="h-6 w-6 text-muted-foreground" />}
                  />
                ) : (
                  <div className="space-y-3">
                    {crmData.orders.map((o) => {
                      const isExpanded = !!expandedOrders[o.id];
                      return (
                        <div key={o.id} className="rounded-xl border bg-card overflow-hidden transition-colors">
                          <div
                            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => toggleOrderExpand(o.id)}
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-foreground font-mono">Order #{o.order_number}</span>
                                  <Badge variant="outline" className="text-[10px] rounded-full px-2 py-0.2">{o.source}</Badge>
                                  <Badge className={`text-[10px] rounded-full px-2 py-0.2 ${o.status === "SERVED" ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}`}>{o.status}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Table {o.table_name} · {new Date(o.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-sm text-foreground font-mono">{fmt(o.total_amount)}</p>
                              <p className="text-[10px] text-muted-foreground">{o.items.length} item(s)</p>
                            </div>
                          </div>

                          {/* Expandable Order Details */}
                          {isExpanded && (
                            <div className="border-t bg-muted/20 p-3.5 space-y-3 text-xs">
                              <p className="font-semibold text-foreground">Order Items:</p>
                              <div className="space-y-1.5">
                                {o.items.map((it) => (
                                  <div key={it.id} className="flex justify-between items-center bg-card p-2 rounded-lg border">
                                    <div>
                                      <p className="font-medium text-foreground">{it.name} x {it.quantity}</p>
                                      {it.notes && <p className="text-[10px] text-muted-foreground">Note: {it.notes}</p>}
                                    </div>
                                    <p className="font-bold text-foreground font-mono">{fmt(it.subtotal)}</p>
                                  </div>
                                ))}
                              </div>

                              <div className="border-t pt-2 space-y-1 text-[11px] text-right font-mono">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Subtotal:</span>
                                  <span>{fmt(o.subtotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Tax:</span>
                                  <span>{fmt(o.tax_amount)}</span>
                                </div>
                                {o.discount_amount > 0 && (
                                  <div className="flex justify-between text-emerald-600 font-medium">
                                    <span>Discount:</span>
                                    <span>-{fmt(o.discount_amount)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between font-bold text-xs text-foreground pt-1 border-t">
                                  <span>Total Amount:</span>
                                  <span>{fmt(o.total_amount)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* 4. LOYALTY TAB */}
              <TabsContent value="loyalty" className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl border bg-card p-3">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">Current Points</p>
                    <p className="font-display text-xl font-bold text-primary font-mono">{crmData.loyalty_current_points}</p>
                  </div>
                  <div className="rounded-xl border bg-card p-3">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">Total Earned</p>
                    <p className="font-display text-xl font-bold text-emerald-600 font-mono">+{crmData.loyalty_lifetime_points}</p>
                  </div>
                  <div className="rounded-xl border bg-card p-3">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">Total Redeemed</p>
                    <p className="font-display text-xl font-bold text-rose-600 font-mono">-{crmData.loyalty_redeemed_points}</p>
                  </div>
                </div>

                <h4 className="font-display text-xs font-semibold text-foreground pt-2">Loyalty Transaction History</h4>

                {crmData.loyalty_history.length === 0 ? (
                  <EmptyState
                    title="No loyalty transactions yet"
                    description="Points earned and redeemed through order purchases will be logged here."
                    icon={<Crown className="h-6 w-6 text-muted-foreground" />}
                  />
                ) : (
                  <div className="space-y-2 text-xs">
                    {crmData.loyalty_history.map((l) => (
                      <div key={l.id} className="rounded-xl border p-3 bg-card flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{l.reason}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{new Date(l.date).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-emerald-600 text-white rounded-full text-[10px] font-mono">+{l.points} pts</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* 5. WHATSAPP TAB */}
              <TabsContent value="whatsapp" className="space-y-3">
                {crmData.whatsapp_logs.length === 0 ? (
                  <EmptyState
                    title="No WhatsApp logs"
                    description="Automated and manual WhatsApp campaign logs will appear here."
                    icon={<MessageCircle className="h-6 w-6 text-muted-foreground" />}
                  />
                ) : (
                  <div className="space-y-2 text-xs">
                    {crmData.whatsapp_logs.map((wa) => (
                      <div key={wa.id} className="rounded-xl border p-3 bg-card space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px] font-semibold">{wa.type}</Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">{new Date(wa.sent_at).toLocaleString()}</span>
                        </div>
                        <p className="text-muted-foreground">{wa.message}</p>
                        <Badge className="bg-emerald-600 text-white text-[9px] rounded-full px-2 py-0.2">{wa.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* 6. CAMPAIGN TAB */}
              <TabsContent value="campaigns" className="space-y-3">
                {crmData.campaigns.length === 0 ? (
                  <EmptyState
                    title="No campaign history"
                    description="Marketing and automated campaigns sent to this customer will be listed here."
                    icon={<Sparkles className="h-6 w-6 text-muted-foreground" />}
                  />
                ) : (
                  <div className="space-y-2 text-xs">
                    {crmData.campaigns.map((cmp) => (
                      <div key={cmp.id} className="rounded-xl border p-3 bg-card flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-foreground">{cmp.name}</p>
                          <p className="text-[10px] text-muted-foreground">Type: {cmp.type}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{cmp.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* 7. REVIEWS TAB */}
              <TabsContent value="reviews" className="space-y-3">
                {crmData.reviews.length === 0 ? (
                  <EmptyState
                    title="No reviews yet"
                    description="Feedback and Google reviews submitted by this customer will appear here."
                    icon={<Star className="h-6 w-6 text-muted-foreground" />}
                  />
                ) : (
                  <div className="space-y-2 text-xs">
                    {crmData.reviews.map((r) => (
                      <div key={r.id} className="rounded-xl border p-3 bg-card space-y-1">
                        <div className="flex items-center gap-1 text-amber-500">
                          {Array.from({ length: r.rating }).map((_, i) => (
                            <Star key={i} className="h-3.5 w-3.5 fill-current" />
                          ))}
                        </div>
                        <p className="text-foreground">{r.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* 8. NOTES TAB */}
              <TabsContent value="notes" className="space-y-3">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={6}
                  placeholder="Record customer dietary preferences, allergies, VIP notes..."
                  className="rounded-xl text-xs"
                />
                <div className="flex justify-end">
                  <Button size="sm" className="rounded-full gradient-brand text-primary-foreground text-xs gap-1.5" onClick={handleSaveNote}>
                    <FileText className="h-3.5 w-3.5" /> Save Note
                  </Button>
                </div>
              </TabsContent>

              {/* 9. AI INSIGHTS TAB */}
              <TabsContent value="ai" className="space-y-3">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <Sparkles className="h-4 w-4" /> AI Customer Insights
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">
                    {crmData.ai_insights}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer Profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEditCustomer} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="id-edit-cust-name">Full Name *</Label>
              <Input id="id-edit-cust-name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="id-edit-cust-phone">Phone Number *</Label>
              <Input id="id-edit-cust-phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="id-edit-cust-email">Email Address</Label>
              <Input id="id-edit-cust-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="id-edit-cust-gender">Gender</Label>
              <Select value={editGender} onValueChange={setEditGender}>
                <SelectTrigger id="id-edit-cust-gender" className="w-full">
                  <SelectValue placeholder="Select gender..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                  <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="id-edit-cust-dob">Birth Date</Label>
                <Input id="id-edit-cust-dob" type="date" value={editBirthDate} onChange={(e) => setEditBirthDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="id-edit-cust-anniv">Anniversary</Label>
                <Input id="id-edit-cust-anniv" type="date" value={editAnniversary} onChange={(e) => setEditAnniversary(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="id-edit-cust-address">Address</Label>
              <Input id="id-edit-cust-address" placeholder="e.g. 123 Main Street" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="id-edit-cust-notes">Customer Notes</Label>
              <Textarea id="id-edit-cust-notes" placeholder="Preferences, allergies, or VIP notes..." value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={editLoading} className="gradient-brand text-primary-foreground">
                {editLoading ? "Updating..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[180px] truncate text-foreground">{value}</span>
    </div>
  );
}