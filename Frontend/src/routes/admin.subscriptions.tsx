import { useNavigate } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import {
  Check, Plus, Loader2, Edit2, Clock, Search, Trash2, RotateCcw, PlusCircle,
  Brain, Shield, Sparkles, AlertTriangle, History, Eye, CheckSquare, XCircle
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listSubscriptionPlansApi, createSubscriptionPlanApi, updateSubscriptionPlanApi, deleteSubscriptionPlanApi,
  listBusinessSubscriptionsApi, assignBusinessSubscriptionApi, listAdminUpgradeRequestsApi, approveUpgradeRequestApi,
  rejectUpgradeRequestApi, getAdminAiUsageApi, resetBusinessMonthlyCreditsApi, adjustBusinessPurchasedCreditsApi,
  getBusinessAiAuditLogsApi, type SubscriptionPlanModel, type BusinessSubscriptionItemModel, type AdminUpgradeRequestItem,
  type BusinessAiUsageModel, type AiCreditAuditLogModel,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/admin/subscriptions")({ component: SubscriptionsPage });
export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SubscriptionPlanModel[]>([]);
  const [businessSubs, setBusinessSubs] = useState<BusinessSubscriptionItemModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<AdminUpgradeRequestItem[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [reqPage, setReqPage] = useState(1);
  const [reqTotalPages, setReqTotalPages] = useState(1);
  const [reqStatusFilter, setReqStatusFilter] = useState("ALL");
  const [reqSearch, setReqSearch] = useState("");
  const [aiUsage, setAiUsage] = useState<BusinessAiUsageModel[]>([]);
  const [aiUsageLoading, setAiUsageLoading] = useState(false);
  const [aiPage, setAiPage] = useState(1);
  const [aiTotalPages, setAiTotalPages] = useState(1);
  const [aiTotal, setAiTotal] = useState(0);
  const [aiSearch, setAiSearch] = useState("");
  const [aiTypeFilter, setAiTypeFilter] = useState("all");
  const [aiPlanFilter, setAiPlanFilter] = useState("all");
  const [aiStatusFilter, setAiStatusFilter] = useState("all");
  const [addCreditsOpen, setAddCreditsOpen] = useState(false);
  const [addCreditsTarget, setAddCreditsTarget] = useState<BusinessAiUsageModel | null>(null);
  const [addCreditsAmount, setAddCreditsAmount] = useState("100");
  const [addCreditsReason, setAddCreditsReason] = useState("Manual Purchase");
  const [addCreditsNotes, setAddCreditsNotes] = useState("");
  const [addCreditsSaving, setAddCreditsSaving] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<BusinessAiUsageModel | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditTarget, setAuditTarget] = useState<BusinessAiUsageModel | null>(null);
  const [auditLogs, setAuditLogs] = useState<AiCreditAuditLogModel[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessSubscriptionItemModel | null>(null);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanModel | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<AdminUpgradeRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createPrice, setCreatePrice] = useState("29");
  const [createTrialDays, setCreateTrialDays] = useState("14");
  const [createMaxStaff, setCreateMaxStaff] = useState("5");
  const [createMaxDevices, setCreateMaxDevices] = useState("5");
  const [createMaxCampaigns, setCreateMaxCampaigns] = useState("20");
  const [createStorageLimit, setCreateStorageLimit] = useState("2");
  const [createMonthlyAiCredits, setCreateMonthlyAiCredits] = useState("100");
  const [createAiEnabled, setCreateAiEnabled] = useState(true);
  const [createPdfExport, setCreatePdfExport] = useState(true);
  const [createPrioritySupport, setCreatePrioritySupport] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editTrialDays, setEditTrialDays] = useState("");
  const [editMaxStaff, setEditMaxStaff] = useState("");
  const [editMaxDevices, setEditMaxDevices] = useState("");
  const [editMaxCampaigns, setEditMaxCampaigns] = useState("");
  const [editStorageLimit, setEditStorageLimit] = useState("");
  const [editMonthlyAiCredits, setEditMonthlyAiCredits] = useState("");
  const [editAiEnabled, setEditAiEnabled] = useState(true);
  const [editPdfExport, setEditPdfExport] = useState(true);
  const [editPrioritySupport, setEditPrioritySupport] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, bRes] = await Promise.all([listSubscriptionPlansApi(), listBusinessSubscriptionsApi()]);
      setPlans(pRes || []); setBusinessSubs(bRes || []);
    } catch (err: any) { toast.error(err.message || "Failed to load plans"); }
    finally { setLoading(false); }
  }, []);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await listAdminUpgradeRequestsApi(reqPage, 10, reqStatusFilter, reqSearch);
      setRequests(res.items || []); setReqTotalPages(res.pages || 1);
    } catch (err: any) { toast.error(err.message || "Failed to load requests"); }
    finally { setRequestsLoading(false); }
  }, [reqPage, reqStatusFilter, reqSearch]);

  const loadAiUsage = useCallback(async () => {
    setAiUsageLoading(true);
    try {
      const res = await getAdminAiUsageApi(aiPage, 20, aiSearch, aiTypeFilter, aiPlanFilter, aiStatusFilter);
      setAiUsage(res.items || []); setAiTotalPages(res.pages || 1); setAiTotal(res.total || 0);
    } catch (err: any) { toast.error(err.message || "Failed to load AI usage"); }
    finally { setAiUsageLoading(false); }
  }, [aiPage, aiSearch, aiTypeFilter, aiPlanFilter, aiStatusFilter]);

  useEffect(() => { loadData(); loadRequests(); }, [loadData, loadRequests]);
  useEffect(() => { loadAiUsage(); }, [loadAiUsage]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault(); setCreateSaving(true);
    try {
      await createSubscriptionPlanApi({
        name: createName, monthly_price: parseFloat(createPrice) || 0,
        trial_days: parseInt(createTrialDays, 10) || 14, max_staff: parseInt(createMaxStaff, 10) || 5,
        max_active_devices: parseInt(createMaxDevices, 10) || 5, max_campaigns_per_month: parseInt(createMaxCampaigns, 10) || 20,
        storage_limit_gb: parseFloat(createStorageLimit) || 1.0, monthly_ai_credits: parseInt(createMonthlyAiCredits, 10) || 0,
        features: { ai_enabled: createAiEnabled, pdf_export: createPdfExport, priority_support: createPrioritySupport },
      });
      toast.success(`Plan '${createName}' created successfully`); setCreateOpen(false);
      setCreateName(""); setCreatePrice("29"); setCreateTrialDays("14"); setCreateMaxStaff("5"); setCreateMaxDevices("5");
      setCreateMaxCampaigns("20"); setCreateStorageLimit("2"); setCreateMonthlyAiCredits("100");
      setCreateAiEnabled(true); setCreatePdfExport(true); setCreatePrioritySupport(false); loadData();
    } catch (err: any) { toast.error(err.message || "Failed to create plan"); }
    finally { setCreateSaving(false); }
  };

  const handleOpenEditModal = (p: SubscriptionPlanModel) => {
    setEditingPlan(p); setEditName(p.name); setEditPrice(p.monthly_price.toString());
    setEditTrialDays(p.trial_days.toString()); setEditMaxStaff((p.max_staff || 5).toString());
    setEditMaxDevices((p.max_active_devices || 5).toString()); setEditMaxCampaigns(p.max_campaigns_per_month.toString());
    setEditStorageLimit((p.storage_limit_gb || 1.0).toString()); setEditMonthlyAiCredits((p.monthly_ai_credits || 0).toString());
    const feats = p.features || {};
    setEditAiEnabled(feats.ai_enabled !== false); setEditPdfExport(feats.pdf_export !== false);
    setEditPrioritySupport(Boolean(feats.priority_support)); setEditOpen(true);
  };

  const handleSaveEditPlan = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingPlan) return; setEditSaving(true);
    try {
      await updateSubscriptionPlanApi(editingPlan.id, {
        name: editName, monthly_price: parseFloat(editPrice) || 0, trial_days: parseInt(editTrialDays, 10) || 0,
        max_staff: parseInt(editMaxStaff, 10) || 5, max_active_devices: parseInt(editMaxDevices, 10) || 5,
        max_campaigns_per_month: parseInt(editMaxCampaigns, 10) || 10, storage_limit_gb: parseFloat(editStorageLimit) || 1.0,
        monthly_ai_credits: parseInt(editMonthlyAiCredits, 10) || 0,
        features: { ai_enabled: editAiEnabled, pdf_export: editPdfExport, priority_support: editPrioritySupport },
      });
      toast.success(`Plan '${editName}' updated`); setEditOpen(false); setEditingPlan(null); await loadData();
    } catch (err: any) { toast.error(err.message || "Failed to update plan"); }
    finally { setEditSaving(false); }
  };

  const handleDeletePlan = async () => {
    if (!editingPlan || !confirm(`Delete plan '${editingPlan.name}'?`)) return;
    setDeleteSaving(true);
    try {
      const res = await deleteSubscriptionPlanApi(editingPlan.id);
      toast.success(res.message || "Plan deleted"); setEditOpen(false); setEditingPlan(null); await loadData();
    } catch (err: any) { toast.error(err.message || "Failed to delete plan"); }
    finally { setDeleteSaving(false); }
  };

  const handleAssignPlan = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedBusiness || !selectedPlanId) return;
    try {
      await assignBusinessSubscriptionApi(selectedBusiness.business_id, { plan_id: selectedPlanId });
      toast.success(`Plan assigned`); setAssignOpen(false); setSelectedBusiness(null); loadData();
    } catch (err: any) { toast.error(err.message || "Failed to assign plan"); }
  };

  const handleApproveRequest = async (reqId: string) => {
    setApprovingId(reqId);
    try { await approveUpgradeRequestApi(reqId); toast.success("Approved!"); loadRequests(); loadData(); }
    catch (err: any) { toast.error(err.message || "Failed to approve"); }
    finally { setApprovingId(null); }
  };

  const handleRejectRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingRequest || !rejectReason.trim()) { toast.error("Provide a reason."); return; }
    try {
      await rejectUpgradeRequestApi(rejectingRequest.id, rejectReason.trim());
      toast.success("Rejected."); setRejectOpen(false); setRejectingRequest(null); setRejectReason(""); loadRequests();
    } catch (err: any) { toast.error(err.message || "Failed to reject"); }
  };

  const handleConfirmResetMonthly = async () => {
    if (!resetTarget) return; setResettingId(resetTarget.business_id);
    try {
      await resetBusinessMonthlyCreditsApi(resetTarget.business_id);
      toast.success(`Monthly AI credits reset for ${resetTarget.business_name}`);
      setResetConfirmOpen(false); setResetTarget(null); loadAiUsage();
    } catch (err: any) { toast.error(err.message || "Failed to reset"); }
    finally { setResettingId(null); }
  };

  const handleAddCreditsSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!addCreditsTarget) return;
    const amount = parseInt(addCreditsAmount, 10);
    if (isNaN(amount) || amount === 0) { toast.error("Valid non-zero amount required"); return; }
    setAddCreditsSaving(true);
    try {
      const res = await adjustBusinessPurchasedCreditsApi(addCreditsTarget.business_id, amount, addCreditsReason, addCreditsNotes.trim() || undefined);
      toast.success(res.message); setAddCreditsOpen(false); setAddCreditsTarget(null);
      setAddCreditsAmount("100"); setAddCreditsReason("Manual Purchase"); setAddCreditsNotes(""); loadAiUsage();
    } catch (err: any) { toast.error(err.message || "Failed"); }
    finally { setAddCreditsSaving(false); }
  };

  const handleViewAuditLogs = async (biz: BusinessAiUsageModel) => {
    setAuditTarget(biz); setAuditOpen(true); setAuditLoading(true);
    try { const logs = await getBusinessAiAuditLogsApi(biz.business_id); setAuditLogs(logs || []); }
    catch (err: any) { toast.error(err.message || "Failed to load audit logs"); }
    finally { setAuditLoading(false); }
  };
  return (
    <>
      <PageHeader
        title="Subscription Management"
        description="Manage subscription tiers, review upgrade requests, assign merchant plans, and monitor AI usage."
        actions={
          <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Create plan
          </Button>
        }
      />
      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList className="rounded-2xl bg-muted/50 p-1">
          <TabsTrigger value="requests" className="rounded-xl text-xs flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Upgrade Requests</TabsTrigger>
          <TabsTrigger value="plans" className="rounded-xl text-xs">Platform Plans</TabsTrigger>
          <TabsTrigger value="roster" className="rounded-xl text-xs">Merchant Roster</TabsTrigger>
          <TabsTrigger value="ai" className="rounded-xl text-xs flex items-center gap-1.5"><Brain className="h-3.5 w-3.5 text-violet-500" /> AI Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="font-display text-base">Pending &amp; Historical Upgrade Requests</CardTitle>
                <CardDescription>Review merchant upgrade requests and approve plan activations.</CardDescription>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search..." className="pl-9 rounded-xl text-xs" value={reqSearch} onChange={(e) => { setReqSearch(e.target.value); setReqPage(1); }} />
                </div>
                <Select value={reqStatusFilter} onValueChange={(val) => { setReqStatusFilter(val); setReqPage(1); }}>
                  <SelectTrigger className="w-36 rounded-xl text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {requestsLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              : requests.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No upgrade requests found.</div>
              : <>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Business &amp; Owner</TableHead><TableHead>Current Plan</TableHead>
                    <TableHead>Requested Plan</TableHead><TableHead>Date</TableHead>
                    <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {requests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell><div className="font-semibold text-sm">{r.business_name}</div><div className="text-xs text-muted-foreground">{r.owner_name} ({r.email})</div></TableCell>
                        <TableCell><Badge variant="outline" className="rounded-full text-xs">{r.current_plan?.name || "Free Tier"}</Badge></TableCell>
                        <TableCell><Badge variant="secondary" className="rounded-full text-xs font-semibold text-primary">{r.requested_plan.name} ({formatCurrency(r.requested_plan.monthly_price, "INR")}/mo)</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(r.requested_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("rounded-full text-[10px] capitalize",
                            r.status === "APPROVED" && "border-emerald-500/40 text-emerald-600 bg-emerald-500/10",
                            r.status === "PENDING" && "border-amber-500/40 text-amber-600 bg-amber-500/10 animate-pulse",
                            r.status === "REJECTED" && "border-rose-500/40 text-rose-600 bg-rose-500/10",
                            r.status === "CANCELLED" && "border-muted text-muted-foreground"
                          )}>{r.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status === "PENDING" ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" disabled={approvingId === r.id} className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApproveRequest(r.id)}>
                                {approvingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Approve"}
                              </Button>
                              <Button size="sm" variant="outline" className="rounded-full text-xs text-destructive" onClick={() => { setRejectingRequest(r); setRejectOpen(true); }}>Reject</Button>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">{r.status === "APPROVED" ? `By ${r.approved_by || "Admin"}` : r.status === "REJECTED" ? `Reason: ${r.reason}` : "Cancelled"}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                  <div>Page {reqPage} of {reqTotalPages}</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="rounded-full text-xs" disabled={reqPage <= 1} onClick={() => setReqPage((p) => p - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" className="rounded-full text-xs" disabled={reqPage >= reqTotalPages} onClick={() => setReqPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              </>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="plans">
          {loading ? <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => {
              const feats = p.features || {};
              return (
                <Card key={p.id} className="relative rounded-2xl transition-all hover:-translate-y-1">
                  <CardHeader>
                    <CardTitle className="font-display">{p.name}</CardTitle>
                    <p className="mt-2"><span className="font-display text-3xl font-semibold">{formatCurrency(p.monthly_price, "INR")}</span><span className="text-sm text-muted-foreground">/mo</span></p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ul className="space-y-1.5 text-sm">
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {p.max_staff} active staff accounts</li>
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {p.max_active_devices} active devices</li>
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {p.storage_limit_gb} GB storage</li>
                      <li className="flex items-center gap-2"><Brain className="h-4 w-4 text-violet-500" />{p.monthly_ai_credits > 0 ? `${p.monthly_ai_credits} AI credits/mo` : <span className="text-muted-foreground text-xs">No AI credits</span>}</li>
                      <li className="flex items-center gap-2 text-muted-foreground text-xs">{feats.ai_enabled !== false ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />} AI Enabled</li>
                      <li className="flex items-center gap-2 text-muted-foreground text-xs">{feats.pdf_export !== false ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />} PDF Export</li>
                      <li className="flex items-center gap-2 text-muted-foreground text-xs"><Check className="h-3.5 w-3.5" /> {p.trial_days} day trial</li>
                    </ul>
                    <Button variant="outline" className="w-full rounded-full" onClick={() => handleOpenEditModal(p)}>
                      <Edit2 className="mr-1.5 h-3.5 w-3.5" /> Manage plan
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>}
        </TabsContent>

        <TabsContent value="roster">
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader><CardTitle className="font-display">Merchant subscription roster</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Business</TableHead><TableHead>Owner &amp; Email</TableHead>
                  <TableHead>Current Plan</TableHead><TableHead>Status</TableHead>
                  <TableHead>Expiry</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {businessSubs.map((b) => (
                    <TableRow key={b.business_id}>
                      <TableCell className="font-medium">{b.business_name}</TableCell>
                      <TableCell className="text-xs"><div>{b.owner_name}</div><div className="text-muted-foreground">{b.email}</div></TableCell>
                      <TableCell><Badge variant="outline" className="rounded-full">{b.current_plan?.name || "Free Tier"}</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="rounded-full capitalize">{b.subscription_status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedBusiness(b); setSelectedPlanId(b.current_plan?.id || (plans[0]?.id ?? "")); setAssignOpen(true); }}>Change plan</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ai">
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Brain className="h-4 w-4 text-violet-500" /> AI Credit Usage — All Businesses
                </CardTitle>
                <CardDescription>Monitor monthly &amp; purchased AI credit consumption across {aiTotal} businesses.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search name, owner..." className="pl-9 rounded-xl text-xs" value={aiSearch} onChange={(e) => { setAiSearch(e.target.value); setAiPage(1); }} />
                </div>
                <Select value={aiTypeFilter} onValueChange={(val) => { setAiTypeFilter(val); setAiPage(1); }}>
                  <SelectTrigger className="w-32 rounded-xl text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="salon">Salon</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={aiPlanFilter} onValueChange={(val) => { setAiPlanFilter(val); setAiPage(1); }}>
                  <SelectTrigger className="w-32 rounded-xl text-xs"><SelectValue placeholder="Plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    {plans.map((p) => (<SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={aiStatusFilter} onValueChange={(val) => { setAiStatusFilter(val); setAiPage(1); }}>
                  <SelectTrigger className="w-32 rounded-xl text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="warning">Warning (80%+)</SelectItem>
                    <SelectItem value="limit reached">Limit Reached</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {aiUsageLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              : aiUsage.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No business AI usage data matching filters.</div>
              : <>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Business &amp; Owner</TableHead><TableHead>Type</TableHead>
                    <TableHead>Current Plan</TableHead><TableHead>Monthly Credits</TableHead>
                    <TableHead>Purchased</TableHead><TableHead>Remaining</TableHead>
                    <TableHead>Last AI Activity</TableHead><TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {aiUsage.map((biz) => {
                      const pct = biz.monthly_plan_credits > 0 ? Math.min(100, Math.round((biz.monthly_used_credits / biz.monthly_plan_credits) * 100)) : 0;
                      return (
                        <TableRow key={biz.business_id}>
                          <TableCell><div className="font-semibold text-sm">{biz.business_name}</div><div className="text-xs text-muted-foreground">{biz.owner_name} ({biz.email})</div></TableCell>
                          <TableCell><Badge variant="outline" className="rounded-full text-[11px]">{biz.business_type}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className="rounded-full text-xs font-semibold">{biz.plan_name}</Badge></TableCell>
                          <TableCell className="min-w-[150px]">
                            {biz.monthly_plan_credits === 0 ? <span className="text-xs text-muted-foreground">No monthly credits</span> : (
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">{biz.monthly_used_credits} / {biz.monthly_plan_credits}</span><span className={cn("font-medium", pct >= 90 ? "text-rose-500" : pct >= 70 ? "text-amber-500" : "text-emerald-500")}>{pct}%</span></div>
                                <Progress value={pct} className={cn("h-1.5", pct >= 90 ? "[&>div]:bg-rose-500" : pct >= 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500")} />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{biz.purchased_remaining_credits > 0 ? <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">{biz.purchased_remaining_credits}</span> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                          <TableCell><span className="text-sm font-bold text-foreground">{biz.total_remaining_credits}</span></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{biz.last_ai_activity}</TableCell>
                          <TableCell>
                            {biz.status === "Limit Reached" ? <Badge variant="outline" className="rounded-full text-[10px] border-rose-500/40 text-rose-600 bg-rose-500/10 font-bold">Limit Reached</Badge>
                            : biz.status === "Warning" ? <Badge variant="outline" className="rounded-full text-[10px] border-amber-500/40 text-amber-600 bg-amber-500/10 font-bold">Warning (80%+)</Badge>
                            : <Badge variant="outline" className="rounded-full text-[10px] border-emerald-500/40 text-emerald-600 bg-emerald-500/10">Normal</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button size="sm" variant="ghost" className="rounded-full text-xs h-7 px-2" onClick={() => navigate(`/admin/clients/${biz.business_id}`)} title="View Business"><Eye className="h-3.5 w-3.5" /></Button>
                              <Button size="sm" variant="outline" className="rounded-full text-xs gap-1 h-7" onClick={() => { setResetTarget(biz); setResetConfirmOpen(true); }} title="Reset monthly usage"><RotateCcw className="h-3 w-3" /> Reset</Button>
                              <Button size="sm" variant="outline" className="rounded-full text-xs gap-1 h-7 text-violet-600 border-violet-500/30 hover:bg-violet-500/10" onClick={() => { setAddCreditsTarget(biz); setAddCreditsAmount("100"); setAddCreditsReason("Manual Purchase"); setAddCreditsNotes(""); setAddCreditsOpen(true); }}><PlusCircle className="h-3 w-3" /> Credits</Button>
                              <Button size="sm" variant="ghost" className="rounded-full text-xs h-7 px-2 text-muted-foreground" onClick={() => handleViewAuditLogs(biz)} title="View Audit Log"><History className="h-3.5 w-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="mt-4 flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                  <div>Page {aiPage} of {aiTotalPages} ({aiTotal} businesses)</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="rounded-full text-xs" disabled={aiPage <= 1} onClick={() => setAiPage((p) => p - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" className="rounded-full text-xs" disabled={aiPage >= aiTotalPages} onClick={() => setAiPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              </>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600"><AlertTriangle className="h-5 w-5" /> Confirm Monthly AI Credit Reset</DialogTitle>
            <DialogDescription>Are you sure you want to reset monthly used AI credits for <strong>{resetTarget?.business_name}</strong>?</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-amber-500/10 p-3 text-xs space-y-1 text-amber-800 dark:text-amber-300">
            <p>&bull; Resets <strong>Monthly Used Credits</strong> back to 0.</p>
            <p>&bull; <strong>Purchased Extra Credits ({resetTarget?.purchased_remaining_credits ?? 0})</strong> remain completely untouched.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>Cancel</Button>
            <Button disabled={resettingId === resetTarget?.business_id} className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleConfirmResetMonthly}>
              {resettingId === resetTarget?.business_id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />} Confirm Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /> AI Credit Audit History — {auditTarget?.business_name}</DialogTitle>
            <DialogDescription>Record of AI credit adjustments performed by Super Admin.</DialogDescription>
          </DialogHeader>
          {auditLoading ? <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          : auditLogs.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">No credit adjustment history found.</div>
          : <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead><TableHead>Balance Change</TableHead><TableHead>Admin</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline" className="rounded-full text-[10px]">{log.action}</Badge></TableCell>
                    <TableCell className="font-semibold text-xs">{log.amount > 0 ? `+${log.amount}` : log.amount}</TableCell>
                    <TableCell className="text-xs">{log.reason}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.previous_balance} &rarr; {log.new_balance}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.admin_name || "Admin"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setAuditOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Upgrade Request — {rejectingRequest?.business_name}</DialogTitle></DialogHeader>
          <form onSubmit={handleRejectRequestSubmit} className="space-y-4">
            <div className="space-y-1.5"><Label>Rejection Reason</Label><Textarea rows={3} placeholder="Reason..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} required /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button><Button type="submit" variant="destructive">Confirm Rejection</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Manage Plan — {editingPlan?.name}</DialogTitle><DialogDescription>Configure limits and features for this plan.</DialogDescription></DialogHeader>
          <form onSubmit={handleSaveEditPlan} className="space-y-4">
            <div><Label>Plan Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} required /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Monthly Price (₹)</Label><Input type="number" step="0.01" min="0" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} required /></div>
              <div><Label>Trial Duration (Days)</Label><Input type="number" min="0" value={editTrialDays} onChange={(e) => setEditTrialDays(e.target.value)} required /></div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usage Limits</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Active Staff Limit</Label><Input type="number" min="1" value={editMaxStaff} onChange={(e) => setEditMaxStaff(e.target.value)} required /></div>
                <div><Label>Active Device Limit</Label><Input type="number" min="1" value={editMaxDevices} onChange={(e) => setEditMaxDevices(e.target.value)} required /></div>
              </div>
              <div>
                <Label>Storage Limit (GB)</Label>
                <Input type="number" step="0.1" min="0.1" value={editStorageLimit} onChange={(e) => setEditStorageLimit(e.target.value)} required />
              </div>
              <div><Label className="flex items-center gap-1.5"><Brain className="h-3.5 w-3.5 text-violet-500" /> Monthly AI Credits</Label><Input type="number" min="0" value={editMonthlyAiCredits} onChange={(e) => setEditMonthlyAiCredits(e.target.value)} required placeholder="0 = AI disabled" /></div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Features</p>
              <div className="flex items-center justify-between py-1"><Label className="text-xs">AI Enabled</Label><Switch checked={editAiEnabled} onCheckedChange={setEditAiEnabled} /></div>
              <div className="flex items-center justify-between py-1"><Label className="text-xs">PDF Export</Label><Switch checked={editPdfExport} onCheckedChange={setEditPdfExport} /></div>
              <div className="flex items-center justify-between py-1"><Label className="text-xs">Priority Support</Label><Switch checked={editPrioritySupport} onCheckedChange={setEditPrioritySupport} /></div>
            </div>
            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <Button type="button" variant="destructive" onClick={handleDeletePlan} disabled={deleteSaving || editSaving}>{deleteSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />} Delete Plan</Button>
              <div className="flex items-center gap-2"><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={editSaving || deleteSaving}>{editSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Save Changes</Button></div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Subscription Plan</DialogTitle><DialogDescription>Configure limits and pricing for the new plan.</DialogDescription></DialogHeader>
          <form onSubmit={handleCreatePlan} className="space-y-4">
            <div><Label>Plan Name</Label><Input placeholder="e.g. ULTIMATE" value={createName} onChange={(e) => setCreateName(e.target.value)} required /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Monthly Price (₹)</Label><Input type="number" step="0.01" min="0" value={createPrice} onChange={(e) => setCreatePrice(e.target.value)} required /></div>
              <div><Label>Trial Duration (Days)</Label><Input type="number" min="0" value={createTrialDays} onChange={(e) => setCreateTrialDays(e.target.value)} /></div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usage Limits</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Active Staff Limit</Label><Input type="number" min="1" value={createMaxStaff} onChange={(e) => setCreateMaxStaff(e.target.value)} /></div>
                <div><Label>Active Device Limit</Label><Input type="number" min="1" value={createMaxDevices} onChange={(e) => setCreateMaxDevices(e.target.value)} /></div>
              </div>
              <div><Label>Storage Limit (GB)</Label><Input type="number" step="0.1" min="0.1" value={createStorageLimit} onChange={(e) => setCreateStorageLimit(e.target.value)} /></div>
              <div><Label className="flex items-center gap-1.5"><Brain className="h-3.5 w-3.5 text-violet-500" /> Monthly AI Credits</Label><Input type="number" min="0" value={createMonthlyAiCredits} onChange={(e) => setCreateMonthlyAiCredits(e.target.value)} placeholder="0 = AI disabled" /></div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Features</p>
              <div className="flex items-center justify-between py-1"><Label className="text-xs">AI Enabled</Label><Switch checked={createAiEnabled} onCheckedChange={setCreateAiEnabled} /></div>
              <div className="flex items-center justify-between py-1"><Label className="text-xs">PDF Export</Label><Switch checked={createPdfExport} onCheckedChange={setCreatePdfExport} /></div>
              <div className="flex items-center justify-between py-1"><Label className="text-xs">Priority Support</Label><Switch checked={createPrioritySupport} onCheckedChange={setCreatePrioritySupport} /></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={createSaving}>{createSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Create Plan</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Plan to {selectedBusiness?.business_name}</DialogTitle></DialogHeader>
          <form onSubmit={handleAssignPlan} className="space-y-4">
            <div><Label>Select Subscription Plan</Label><select className="w-full rounded-md border p-2 text-sm bg-background" value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name} — ₹{p.monthly_price}/mo</option>)}</select></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button><Button type="submit">Assign Plan</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addCreditsOpen} onOpenChange={setAddCreditsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Brain className="h-4 w-4 text-violet-500" /> Adjust Purchased Credits</DialogTitle>
            <DialogDescription>Add or remove purchased AI credits for <strong>{addCreditsTarget?.business_name}</strong>.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCreditsSubmit} className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-3 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">Current purchased credits</span><span className="font-semibold text-violet-600">{addCreditsTarget?.purchased_remaining_credits ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Monthly used / limit</span><span>{addCreditsTarget?.monthly_used_credits ?? 0} / {addCreditsTarget?.monthly_plan_credits ?? 0}</span></div>
            </div>
            <div><Label>Amount (positive to add, negative to remove)</Label><Input type="number" value={addCreditsAmount} onChange={(e) => setAddCreditsAmount(e.target.value)} placeholder="e.g. 100 to add, -50 to remove" required /></div>
            <div>
              <Label>Reason for Adjustment</Label>
              <Select value={addCreditsReason} onValueChange={setAddCreditsReason}>
                <SelectTrigger className="w-full text-sm"><SelectValue placeholder="Select Reason" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manual Purchase">Manual Purchase</SelectItem>
                  <SelectItem value="Compensation">Compensation</SelectItem>
                  <SelectItem value="Promotion">Promotion</SelectItem>
                  <SelectItem value="Testing">Testing</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Admin Notes (Optional)</Label><Textarea rows={2} placeholder="Add optional details..." value={addCreditsNotes} onChange={(e) => setAddCreditsNotes(e.target.value)} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddCreditsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addCreditsSaving} className="bg-violet-600 hover:bg-violet-700 text-white">
                {addCreditsSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-1.5 h-4 w-4" />}Apply Credits
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
