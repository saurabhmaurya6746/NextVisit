import { AppLink } from "@/lib/app-nav";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle, Phone, Edit, FileText, ChevronDown, ChevronRight, Gift, Crown, AlertTriangle, UserX, Sparkles, Clock, Calendar, Heart, MapPin, Mail, User, ShieldCheck } from "lucide-react";
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
import { useAppointments } from "@/lib/appointments-store";
import { useBusinessType } from "@/lib/business-type";
import { fmt } from "@/lib/currency";
import { openWhatsApp } from "@/lib/celebration-utils";
import { toast } from "sonner";
import { useBalance, calcPointsForAmount } from "@/lib/loyalty-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { getCustomerByIdApi, updateCustomerApi, type CustomerModel } from "@/lib/customers-api";

export const Route = createFileRoute("/app/$type/$business/customers/$id")({
  loader: ({ params }) => ({ id: params.id }),
  component: CustomerProfile,
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function CustomerProfile() {
  const { id } = Route.useLoaderData();
  const allOrders = useOrders();
  const allAppts = useAppointments();
  const type = useBusinessType();
  const wa = useWhatsAppHistory(id);

  const [customer, setCustomer] = useState<CustomerModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInvalidUuid, setIsInvalidUuid] = useState(false);

  const balance = useBalance(id);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // Edit customer dialog state
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

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    setErrorStatus(null);
    setErrorMessage(null);
    setIsInvalidUuid(false);

    if (!isValidUuidFormat) {
      console.error(`❌ Error loading customer: Invalid customer ID format (${id})`);
      setIsInvalidUuid(true);
      setLoading(false);
      return;
    }

    try {
      const data = await getCustomerByIdApi(id);
      setCustomer(data);
      if (data.notes) setNote(data.notes);
    } catch (err: any) {
      console.error(`❌ Error loading customer: ${err.message || err}`);
      const status = err.status || 500;
      setErrorStatus(status);
      setErrorMessage(err.message || "Failed to load customer profile");
    } finally {
      setLoading(false);
    }
  }, [id, isValidUuidFormat]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

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

  if (isInvalidUuid) {
    return (
      <PageTransition>
        <AppLink path="customers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All customers
        </AppLink>
        <EmptyState
          title="Invalid customer ID"
          description={`The requested customer ID "${id}" is not a valid UUID.`}
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

  const c = customer;
  const myAppts = allAppts.filter((a) => a.customerId === c.id);
  const myOrders = allOrders.filter((o) => o.customerId === c.id);
  const totalSpent = c.spent;
  const visitCount = c.visits;
  const loyaltyPoints = c.points || balance || 0;
  const customerSince = c.raw?.created_at ? new Date(c.raw.created_at).toLocaleDateString() : "—";
  const lastVisitFormatted = c.raw?.last_visit_at ? new Date(c.raw.last_visit_at).toLocaleDateString() : "No visits recorded";

  const paidOrders = myOrders.filter((o) => o.paymentStatus === "paid");
  const loyaltyLedger = paidOrders.map((o) => ({
    id: o.id,
    date: o.paidAt || o.createdAt,
    reason: `Order ${orderCode(o)} · ${fmt(o.total)}`,
    earned: calcPointsForAmount(o.total),
    redeemed: 0,
  }));

  const saveNote = async () => {
    try {
      await updateCustomerApi(c.id, { notes: note });
      toast.success("Customer note updated successfully");
      fetchCustomer();
    } catch (err: any) {
      toast.error(err.message || "Failed to update note");
    }
  };

  const handleWhatsApp = () => {
    const msg = `Hi ${c.name.split(" ")[0]} 👋 — quick note from Aroma Bistro.`;
    openWhatsApp(c.phone, msg);
    logWhatsApp({ customerId: c.id, kind: "manual", message: msg });
    toast.success("WhatsApp opened");
  };

  const openEditModal = () => {
    setEditName(c.name || "");
    setEditPhone(c.phone || "");
    setEditEmail(c.email || "");
    setEditGender(c.gender || "");
    setEditBirthDate(c.birth_date || "");
    setEditAnniversary(c.anniversary_date || "");
    setEditAddress(c.address || "");
    setEditNotes(c.notes || "");
    setIsEditOpen(true);
  };

  const handleSaveEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editPhone.trim()) {
      toast.error("Name and Phone are required.");
      return;
    }
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (editEmail.trim() && !EMAIL_REGEX.test(editEmail.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setEditLoading(true);
    try {
      const updated = await updateCustomerApi(c.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim() || undefined,
        gender: editGender.trim() || undefined,
        birth_date: editBirthDate || undefined,
        anniversary_date: editAnniversary || undefined,
        address: editAddress.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      toast.success(`Customer ${updated.name} updated successfully!`);
      setIsEditOpen(false);
      await fetchCustomer();
    } catch (err: any) {
      console.error("[CUSTOMERS] Update error:", err);
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
        description={`ID: ${c.id} · ${c.status} · ${c.visits} visits · ${fmt(c.spent)} spent`}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => window.open(`tel:${c.phone.replace(/[^\d+]/g, "")}`)}><Phone className="mr-1.5 h-4 w-4" /> Call</Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={handleWhatsApp}><MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp</Button>
            <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={openEditModal}><Edit className="mr-1.5 h-4 w-4" /> Edit</Button>
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
            </div>
            <div className="mt-6 space-y-3 text-left text-sm">
              <Row label="Phone" value={c.phone} />
              <Row label="Email" value={c.email || "Not provided"} />
              <Row label="Gender" value={c.gender || "Not specified"} />
              <Row label="Birth Date" value={c.birth_date || "—"} />
              <Row label="Anniversary" value={c.anniversary_date || "—"} />
              <Row label="Address" value={c.address || "Not specified"} />
              <Row label="Customer Since" value={customerSince} />
              <Row label="Last Visit" value={lastVisitFormatted} />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl lg:col-span-2">
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Visits</p>
                <p className="font-display text-2xl font-bold">{visitCount}</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Spent</p>
                <p className="font-display text-2xl font-bold">{fmt(totalSpent)}</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Loyalty Points</p>
                <p className="font-display text-2xl font-bold">{loyaltyPoints}</p>
              </div>
            </div>
            <Tabs defaultValue="overview" className="mt-6">
              <TabsList className="flex flex-wrap h-auto justify-start rounded-full bg-muted/60 p-1">
                <TabsTrigger value="overview" className="rounded-full text-xs">Overview</TabsTrigger>
                <TabsTrigger value="visits" className="rounded-full text-xs">Visits</TabsTrigger>
                <TabsTrigger value="orders" className="rounded-full text-xs">Orders</TabsTrigger>
                <TabsTrigger value="loyalty" className="rounded-full text-xs">Loyalty</TabsTrigger>
                <TabsTrigger value="whatsapp" className="rounded-full text-xs">WhatsApp</TabsTrigger>
                <TabsTrigger value="campaigns" className="rounded-full text-xs">Campaigns</TabsTrigger>
                <TabsTrigger value="reviews" className="rounded-full text-xs">Reviews</TabsTrigger>
                <TabsTrigger value="notes" className="rounded-full text-xs">Notes</TabsTrigger>
                <TabsTrigger value="ai" className="rounded-full text-xs">AI Insights</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <EmptyState
                  title="No customer activity logged"
                  description="Recent order transactions, visits, and interactions will be recorded here automatically."
                  icon={<Clock className="h-6 w-6 text-muted-foreground" />}
                />
              </TabsContent>

              <TabsContent value="visits" className="mt-4">
                {myAppts.length === 0 ? (
                  <EmptyState
                    title="No visits recorded"
                    description="This customer has not recorded any appointment or table visits yet."
                    icon={<Calendar className="h-6 w-6 text-muted-foreground" />}
                  />
                ) : (
                  <div className="space-y-2">
                    {myAppts.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                        <div>
                          <p className="font-medium">{(a as any).serviceName || a.service || "Appointment"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(a.start).toLocaleDateString()}</p>
                        </div>
                        <Badge variant="outline">{fmt(a.price)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="orders" className="mt-4">
                {myOrders.length === 0 ? (
                  <EmptyState
                    title="No orders found"
                    description="This customer has not placed any orders yet."
                    icon={<Clock className="h-6 w-6 text-muted-foreground" />}
                  />
                ) : (
                  <div className="space-y-2">
                    {myOrders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                        <div>
                          <p className="font-medium">Order #{orderCode(o)}</p>
                          <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</p>
                        </div>
                        <Badge variant="outline">{fmt(o.total)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="loyalty" className="mt-4">
                {loyaltyLedger.length === 0 ? (
                  <EmptyState
                    title="No loyalty history"
                    description="Points earned and redeemed through purchases will appear here."
                    icon={<Crown className="h-6 w-6 text-muted-foreground" />}
                  />
                ) : (
                  <div className="space-y-2">
                    {loyaltyLedger.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                        <div>
                          <p className="font-medium">{r.reason}</p>
                          <p className="text-xs text-muted-foreground">{new Date(r.date).toLocaleDateString()}</p>
                        </div>
                        <Badge className="bg-success text-success-foreground">+{r.earned} pts</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="whatsapp" className="mt-4">
                {wa.length === 0 ? (
                  <EmptyState
                    title="No WhatsApp messages"
                    description="WhatsApp message logs sent to this customer will appear here."
                    icon={<MessageCircle className="h-6 w-6 text-muted-foreground" />}
                  />
                ) : (
                  <div className="space-y-2">
                    {wa.map((m) => (
                      <div key={m.id} className="rounded-xl border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="capitalize">{m.kind}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString()}</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{m.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="campaigns" className="mt-4">
                <EmptyState
                  title="No campaign history"
                  description="Marketing and automated campaigns sent to this customer will be listed here."
                  icon={<Sparkles className="h-6 w-6 text-muted-foreground" />}
                />
              </TabsContent>

              <TabsContent value="reviews" className="mt-4">
                <EmptyState
                  title="No reviews yet"
                  description="Feedback and reviews submitted by this customer will appear here."
                  icon={<Sparkles className="h-6 w-6 text-muted-foreground" />}
                />
              </TabsContent>

              <TabsContent value="notes" className="mt-4 space-y-3">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} placeholder="Record customer preferences, allergies, or special notes..." />
                <div className="flex justify-end">
                  <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={saveNote}>
                    <FileText className="mr-1.5 h-4 w-4" /> Save note
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="ai" className="mt-4">
                <EmptyState
                  title="No AI insights available"
                  description="Automated customer behavior predictions will generate after more visits are recorded."
                  icon={<Sparkles className="h-6 w-6 text-muted-foreground" />}
                />
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
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[200px] truncate">{value}</span>
    </div>
  );
}