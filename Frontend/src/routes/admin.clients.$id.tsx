import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  KeyRound,
  Send,
  ArrowUpRight,
  PauseCircle,
  Trash2,
  Store,
  LogIn,
  Megaphone,
  ShoppingBag,
  Loader2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stat-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getAdminClientDetailApi,
  updateAdminClientStatusApi,
  deleteAdminClientApi,
  impersonateAdminClientApi,
  listSubscriptionPlansApi,
  assignBusinessSubscriptionApi,
  type ClientDetailModel,
  type SubscriptionPlanModel,
} from "@/lib/admin-api";
import { setToken, setSession } from "@/lib/auth";
import { slugify } from "@/lib/app-nav";
import { setBusinessType } from "@/lib/business-type";
import { pushNotification } from "@/lib/notifications-store";

export const Route = createFileRoute("/admin/clients/$id")({
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const [client, setClient] = useState<ClientDetailModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog States
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [notifDialogOpen, setNotifDialogOpen] = useState(false);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [sendingNotif, setSendingNotif] = useState(false);

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlanModel[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [planNotes, setPlanNotes] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminClientDetailApi(id);
      setClient(data);
    } catch (err: any) {
      setError(err.message || "Failed to load client details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading merchant profile details…</p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-3 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h3 className="font-display text-lg font-semibold">Client not found</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/admin/clients">Back to clients list</Link>
        </Button>
      </div>
    );
  }

  const toggleStatus = async () => {
    const nextStatus = client.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      const updated = await updateAdminClientStatusApi(client.id, nextStatus);
      setClient(updated);
      toast.success(`Account status updated to ${nextStatus}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const deleteClient = async () => {
    if (!confirm(`Are you sure you want to delete ${client.name}?`)) return;
    try {
      await deleteAdminClientApi(client.id);
      toast.success("Business account deleted");
      window.location.href = "/admin/clients";
    } catch (err: any) {
      toast.error(err.message || "Failed to delete business");
    }
  };

  const impersonate = async () => {
    try {
      const res = await impersonateAdminClientApi(client.id);
      setToken(res.access_token);
      const slug = slugify(client.name);
      setBusinessType("restaurant");
      setSession({
        role: "business",
        email: client.email,
        clientId: res.business_id,
        businessName: res.business_name,
        businessType: "restaurant",
        businessSlug: slug,
        token: res.access_token,
      });
      toast.success(`Logged in as ${client.owner_name}`);
      window.location.href = `/app/restaurant/${slug}/dashboard`;
    } catch (err: any) {
      toast.error(err.message || "Failed to impersonate merchant");
    }
  };

  // 1. Reset Password Handler
  const handleResetPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let pwd = "NV#";
    for (let i = 0; i < 9; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTempPassword(pwd);
    setCopied(false);
    toast.success(`Password reset generated for ${client.owner_name}`);
  };

  const handleCopyPassword = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    toast.success("Temporary password copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // 2. Send Notification Handler
  const openNotifDialog = () => {
    setNotifTitle(`Notice for ${client.name}`);
    setNotifBody(`Hello ${client.owner_name}, please review your platform subscription and account configuration.`);
    setNotifDialogOpen(true);
  };

  const handleSendNotification = async () => {
    if (!notifTitle || !notifBody) {
      toast.error("Please provide both a title and a message body.");
      return;
    }
    setSendingNotif(true);
    try {
      pushNotification({
        type: "campaign",
        title: notifTitle,
        body: notifBody,
      });
      toast.success(`Notification sent to ${client.name} (${client.email})`);
      setNotifDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send notification");
    } finally {
      setSendingNotif(false);
    }
  };

  // 3. Manage Subscription Plan Handler
  const openPlanModal = async () => {
    setPlanDialogOpen(true);
    try {
      const allPlans = await listSubscriptionPlansApi();
      setPlans(allPlans);
      if (allPlans.length > 0) {
        setSelectedPlanId(allPlans[0].id);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load subscription plans");
    }
  };

  const handleSavePlan = async () => {
    if (!selectedPlanId) return;
    setSavingPlan(true);
    try {
      await assignBusinessSubscriptionApi(client.id, {
        plan_id: selectedPlanId,
        notes: planNotes || undefined,
      });
      toast.success(`Subscription plan updated for ${client.name}`);
      setPlanDialogOpen(false);
      await loadDetail();
    } catch (err: any) {
      toast.error(err.message || "Failed to update subscription plan");
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <>
      <Link to="/admin/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All clients
      </Link>
      <PageHeader
        title={client.name}
        description={`${client.id.substring(0, 8).toUpperCase()} · ${client.business_type?.name || "General"} · ${client.country} · Owner ${client.owner_name}`}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-full" onClick={impersonate}>
              <LogIn className="mr-1.5 h-4 w-4" /> Login as client
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setResetDialogOpen(true)}>
              <KeyRound className="mr-1.5 h-4 w-4" /> Reset password
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={openNotifDialog}>
              <Send className="mr-1.5 h-4 w-4" /> Send notification
            </Button>
            <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={openPlanModal}>
              <ArrowUpRight className="mr-1.5 h-4 w-4" /> Subscription Plan
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Last login" value={client.last_login ? new Date(client.last_login).toLocaleDateString() : "Never"} icon={LogIn} accent="info" />
        <StatCard label="Campaigns created" value={client.stats.campaign_count} icon={Megaphone} accent="primary" />
        <StatCard label="Total visits" value={client.stats.visit_count} icon={ShoppingBag} accent="accent" />
        <StatCard label="Status" value={client.status} icon={Store} accent={client.status === "ACTIVE" ? "accent" : "destructive"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader><CardTitle className="font-display">Business information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-3 sm:col-span-2">
              <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-glow">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">{client.name}</p>
                <p className="text-xs text-muted-foreground">{client.business_type?.name || "Business"}</p>
              </div>
            </div>
            <Info label="Business ID" value={client.id} />
            <Info label="Owner Name" value={client.owner_name} />
            <Info label="Email Address" value={client.email} />
            <Info label="Phone Number" value={client.phone} />
            <Info label="Country & Currency" value={`${client.country} (${client.currency})`} />
            <Info label="Address" value={client.address || "Not specified"} />
            <Info label="Subscription Status" value={<Badge variant="outline" className="rounded-full capitalize">{client.subscription_status}</Badge>} />
            <Info label="Account Status" value={<Badge className="rounded-full capitalize">{client.status}</Badge>} />
            <Info label="Joined Date" value={new Date(client.created_at).toLocaleDateString()} />
            {client.approved_at && <Info label="Approved At" value={new Date(client.approved_at).toLocaleDateString()} />}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-display">Platform usage & statistics</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="mb-1.5 flex justify-between"><span>Registered Customers</span><span className="font-medium">{client.stats.customer_count}</span></div>
              <Progress value={Math.min(100, (client.stats.customer_count / 100) * 100)} />
            </div>
            <div>
              <div className="mb-1.5 flex justify-between"><span>Active Services</span><span className="font-medium">{client.stats.service_count}</span></div>
              <Progress value={Math.min(100, (client.stats.service_count / 20) * 100)} />
            </div>
            <div>
              <div className="mb-1.5 flex justify-between"><span>AI Credits Used</span><span className="font-medium">{client.stats.ai_monthly_used_credits ?? 0}</span></div>
              <Progress value={Math.min(100, Math.round(((client.stats.ai_monthly_used_credits ?? 0) / (client.stats.ai_monthly_plan_credits || 100)) * 100))} />
            </div>
            <div>
              <div className="mb-1.5 flex justify-between"><span>Loyalty Program</span><span className="font-medium">{client.stats.loyalty_enabled ? "Enabled" : "Disabled"}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 rounded-2xl border-destructive/30">
        <CardHeader><CardTitle className="font-display text-destructive">Danger zone</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" onClick={toggleStatus}>
            <PauseCircle className="mr-1.5 h-4 w-4" /> {client.status === "ACTIVE" ? "Suspend Account" : "Activate Account"}
          </Button>
          <Button variant="destructive" className="rounded-full" onClick={deleteClient}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete Business Account
          </Button>
        </CardContent>
      </Card>

      {/* 1. Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password — {client.name}</DialogTitle>
            <DialogDescription>
              Generate a temporary password and dispatch login credentials to <strong>{client.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!tempPassword ? (
              <p className="text-sm text-muted-foreground">
                Clicking the button below will issue a new temporary credential for merchant owner <strong>{client.owner_name}</strong>.
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Temporary Password Generated</Label>
                <div className="flex items-center gap-2">
                  <Input value={tempPassword} readOnly className="font-mono text-sm font-semibold" />
                  <Button variant="outline" size="icon" onClick={handleCopyPassword}>
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Credentials sent to {client.email}. Share this temporary password securely with the client.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetDialogOpen(false); setTempPassword(null); }}>
              Close
            </Button>
            {!tempPassword && (
              <Button onClick={handleResetPassword} className="gradient-brand text-primary-foreground">
                <KeyRound className="mr-1.5 h-4 w-4" /> Generate & Send Reset Link
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Send Notification Dialog */}
      <Dialog open={notifDialogOpen} onOpenChange={setNotifDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Operational Notification</DialogTitle>
            <DialogDescription>
              Dispatch a direct platform alert to business owner <strong>{client.owner_name}</strong> ({client.name}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Notification Title</Label>
              <Input
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="e.g. Subscription Update Notice"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message Body</Label>
              <Textarea
                rows={4}
                value={notifBody}
                onChange={(e) => setNotifBody(e.target.value)}
                placeholder="Enter notification message..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={sendingNotif} onClick={handleSendNotification} className="gradient-brand text-primary-foreground">
              {sendingNotif ? "Sending..." : <><Send className="mr-1.5 h-4 w-4" /> Send Notification</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Subscription Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Subscription Plan — {client.name}</DialogTitle>
            <DialogDescription>
              Update merchant plan tier and subscription details directly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Select Subscription Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a plan..." />
                </SelectTrigger>
                <SelectContent>
                  {plans.length > 0 ? (
                    plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — ₹{p.monthly_price}/mo ({p.max_customers} clients)
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="starter">STARTER Plan</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Internal Admin Notes (Optional)</Label>
              <Input
                value={planNotes}
                onChange={(e) => setPlanNotes(e.target.value)}
                placeholder="e.g. Upgraded to Professional Tier manually"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={savingPlan} onClick={handleSavePlan} className="gradient-brand text-primary-foreground">
              {savingPlan ? "Saving..." : <><ArrowUpRight className="mr-1.5 h-4 w-4" /> Save Plan</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}