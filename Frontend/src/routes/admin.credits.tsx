import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  Building2,
  Coins,
  Clock,
  CheckCircle2,
  Edit,
  Eye,
  History,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Ban,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";
import {
  AiCreditAuditLogModel,
  BusinessAiUsageModel,
  adjustBusinessPurchasedCreditsApi,
  getAdminAiUsageApi,
  getBusinessAiAuditLogsApi,
  resetBusinessMonthlyCreditsApi,
} from "@/lib/admin-api";
import {
  AiCreditPackModel,
  AiCreditPurchaseRequestModel,
  CreditManagementAnalyticsModel,
  approveCreditPurchaseRequestApi,
  createCreditPackApi,
  deleteCreditPackApi,
  getCreditManagementAnalyticsApi,
  listAdminCreditPacksApi,
  listCreditPurchaseRequestsApi,
  rejectCreditPurchaseRequestApi,
  updateCreditPackApi,
} from "@/lib/credit-management-api";
import { Select as UISelect, SelectContent as UISelectContent, SelectItem as UISelectItem, SelectTrigger as UISelectTrigger, SelectValue as UISelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/admin/credits")({
  component: CreditManagementPage,
});

function CreditManagementPage() {
  const navigate = useNavigate();

  // Top Analytics State
  const [analytics, setAnalytics] = useState<CreditManagementAnalyticsModel | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Tab 1: Packs State
  const [packs, setPacks] = useState<AiCreditPackModel[]>([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCredits, setCreateCredits] = useState("100");
  const [createPrice, setCreatePrice] = useState("49");
  const [createActive, setCreateActive] = useState(true);
  const [createOrder, setCreateOrder] = useState("0");
  const [createSaving, setCreateSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingPack, setEditingPack] = useState<AiCreditPackModel | null>(null);
  const [editName, setEditName] = useState("");
  const [editCredits, setEditCredits] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editOrder, setEditOrder] = useState("0");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Tab 2: Purchase Requests Approval Workflow State
  const [purchaseRequests, setPurchaseRequests] = useState<AiCreditPurchaseRequestModel[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [reqPage, setReqPage] = useState(1);
  const [reqTotalPages, setReqTotalPages] = useState(1);
  const [reqSearch, setReqSearch] = useState("");
  const [reqStatusFilter, setReqStatusFilter] = useState("PENDING");

  const [selectedReq, setSelectedReq] = useState<AiCreditPurchaseRequestModel | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [approveOpen, setApproveOpen] = useState(false);
  const [approvingReq, setApprovingReq] = useState<AiCreditPurchaseRequestModel | null>(null);
  const [approveSaving, setApproveSaving] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectingReq, setRejectingReq] = useState<AiCreditPurchaseRequestModel | null>(null);
  const [rejectReason, setRejectReason] = useState("Payment Not Received");
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);

  // Tab 3: Business AI Usage State
  const [aiUsage, setAiUsage] = useState<BusinessAiUsageModel[]>([]);
  const [aiUsageLoading, setAiUsageLoading] = useState(false);
  const [aiPage, setAiPage] = useState(1);
  const [aiTotalPages, setAiTotalPages] = useState(1);
  const [aiSearch, setAiSearch] = useState("");
  const [aiTypeFilter, setAiTypeFilter] = useState("all");
  const [aiPlanFilter, setAiPlanFilter] = useState("all");
  const [aiStatusFilter, setAiStatusFilter] = useState("all");

  // Actions Modals
  const [addCreditsOpen, setAddCreditsOpen] = useState(false);
  const [addCreditsTarget, setAddCreditsTarget] = useState<BusinessAiUsageModel | null>(null);
  const [addCreditsAmount, setAddCreditsAmount] = useState("100");
  const [addCreditsReason, setAddCreditsReason] = useState("Manual Purchase");
  const [addCreditsNotes, setAddCreditsNotes] = useState("");
  const [addCreditsSaving, setAddCreditsSaving] = useState(false);

  const [auditLogsOpen, setAuditLogsOpen] = useState(false);
  const [auditLogsTarget, setAuditLogsTarget] = useState<BusinessAiUsageModel | null>(null);
  const [auditLogs, setAuditLogs] = useState<AiCreditAuditLogModel[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);

  const [resetTarget, setResetTarget] = useState<BusinessAiUsageModel | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);

  // Load Analytics
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await getCreditManagementAnalyticsApi();
      setAnalytics(data);
    } catch (err: any) {
      toast.error(err.message || "Unable to load analytics.");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // Load Packs
  const loadPacks = useCallback(async () => {
    setPacksLoading(true);
    try {
      const data = await listAdminCreditPacksApi(true);
      setPacks(data || []);
    } catch (err: any) {
      toast.error(err.message || "Unable to load AI credit packs.");
    } finally {
      setPacksLoading(false);
    }
  }, []);

  // Load Purchase Requests
  const loadPurchaseRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await listCreditPurchaseRequestsApi(reqPage, 20, reqSearch, reqStatusFilter);
      setPurchaseRequests(res?.items || []);
      setReqTotalPages(res?.pages || 1);
    } catch (err: any) {
      toast.error(err.message || "Unable to load credit purchase requests.");
    } finally {
      setRequestsLoading(false);
    }
  }, [reqPage, reqSearch, reqStatusFilter]);

  // Load Business AI Usage
  const loadAiUsage = useCallback(async () => {
    setAiUsageLoading(true);
    try {
      const res = await getAdminAiUsageApi(
        aiPage,
        20,
        aiSearch,
        aiTypeFilter,
        aiPlanFilter,
        aiStatusFilter
      );
      setAiUsage(res?.items || []);
      setAiTotalPages(res?.pages || 1);
    } catch (err: any) {
      toast.error(err.message || "Unable to load AI usage monitoring.");
    } finally {
      setAiUsageLoading(false);
    }
  }, [aiPage, aiSearch, aiTypeFilter, aiPlanFilter, aiStatusFilter]);

  useEffect(() => {
    loadAnalytics();
    loadPacks();
  }, [loadAnalytics, loadPacks]);

  useEffect(() => {
    loadPurchaseRequests();
  }, [loadPurchaseRequests]);

  useEffect(() => {
    loadAiUsage();
  }, [loadAiUsage]);

  // Pack Handlers
  const handleCreatePack = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSaving(true);
    try {
      await createCreditPackApi({
        name: createName,
        ai_credits: parseInt(createCredits, 10) || 100,
        price: parseFloat(createPrice) || 0.0,
        is_active: createActive,
        sort_order: parseInt(createOrder, 10) || 0,
      });
      toast.success(`Credit pack '${createName}' created successfully`);
      setCreateOpen(false);
      setCreateName("");
      setCreateCredits("100");
      setCreatePrice("49");
      setCreateActive(true);
      setCreateOrder("0");
      loadPacks();
    } catch (err: any) {
      toast.error(err.message || "Failed to create credit pack");
    } finally {
      setCreateSaving(false);
    }
  };

  const handleOpenEditPack = (p: AiCreditPackModel) => {
    setEditingPack(p);
    setEditName(p.name);
    setEditCredits(p.ai_credits.toString());
    setEditPrice(p.price.toString());
    setEditActive(p.is_active);
    setEditOrder((p.sort_order || 0).toString());
    setEditOpen(true);
  };

  const handleSaveEditPack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPack) return;
    setEditSaving(true);
    try {
      await updateCreditPackApi(editingPack.id, {
        name: editName,
        ai_credits: parseInt(editCredits, 10) || 100,
        price: parseFloat(editPrice) || 0.0,
        is_active: editActive,
        sort_order: parseInt(editOrder, 10) || 0,
      });
      toast.success(`Pack '${editName}' updated successfully`);
      setEditOpen(false);
      loadPacks();
    } catch (err: any) {
      toast.error(err.message || "Failed to update credit pack");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeletePack = async () => {
    if (!editingPack) return;
    if (!confirm(`Are you sure you want to delete '${editingPack.name}'?`)) return;
    setDeleteSaving(true);
    try {
      await deleteCreditPackApi(editingPack.id);
      toast.success(`Pack '${editingPack.name}' deleted successfully`);
      setEditOpen(false);
      loadPacks();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete credit pack");
    } finally {
      setDeleteSaving(false);
    }
  };

  // Purchase Request Approval Handlers
  const handleApproveRequest = async () => {
    if (!approvingReq) return;
    setApproveSaving(true);
    try {
      const res = await approveCreditPurchaseRequestApi(approvingReq.id);
      toast.success(res.message);
      setApproveOpen(false);
      setApprovingReq(null);
      loadPurchaseRequests();
      loadAnalytics();
      loadAiUsage();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve purchase request.");
    } finally {
      setApproveSaving(false);
    }
  };

  const handleRejectRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingReq) return;
    setRejectSaving(true);
    try {
      const res = await rejectCreditPurchaseRequestApi(rejectingReq.id, rejectReason, rejectNotes);
      toast.success(res.message);
      setRejectOpen(false);
      setRejectingReq(null);
      setRejectNotes("");
      loadPurchaseRequests();
      loadAnalytics();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject purchase request.");
    } finally {
      setRejectSaving(false);
    }
  };

  // Adjust Credits Handler
  const handleAddCreditsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCreditsTarget) return;
    setAddCreditsSaving(true);
    try {
      const amt = parseInt(addCreditsAmount, 10);
      if (isNaN(amt) || amt === 0) {
        toast.error("Please enter a valid non-zero credit amount.");
        return;
      }
      const res = await adjustBusinessPurchasedCreditsApi(
        addCreditsTarget.business_id,
        amt,
        addCreditsReason,
        addCreditsNotes
      );
      toast.success(res.message);
      setAddCreditsOpen(false);
      setAddCreditsAmount("100");
      setAddCreditsNotes("");
      loadAiUsage();
      loadAnalytics();
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust credits");
    } finally {
      setAddCreditsSaving(false);
    }
  };

  // Reset Monthly Credits Handler
  const handleResetSubmit = async () => {
    if (!resetTarget) return;
    setResetSaving(true);
    try {
      const res = await resetBusinessMonthlyCreditsApi(resetTarget.business_id);
      toast.success(res.message);
      setResetOpen(false);
      loadAiUsage();
      loadAnalytics();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset monthly credits");
    } finally {
      setResetSaving(false);
    }
  };

  // Open Audit Logs
  const handleOpenAuditLogs = async (b: BusinessAiUsageModel) => {
    setAuditLogsTarget(b);
    setAuditLogsOpen(true);
    setAuditLogsLoading(true);
    try {
      const logs = await getBusinessAiAuditLogsApi(b.business_id);
      setAuditLogs(logs || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load audit logs");
      setAuditLogs([]);
    } finally {
      setAuditLogsLoading(false);
    }
  };

  const pendingRequestsCount = purchaseRequests.filter((r) => r.approval_status === "PENDING").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit Management"
        description="Independent platform AI credit packs, merchant purchase request approval workflow, and AI credit monitoring."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="rounded-full gradient-brand text-primary-foreground font-semibold">
            <Plus className="mr-1.5 h-4 w-4" /> Create Credit Pack
          </Button>
        }
      />

      {/* TOP ANALYTICS DASHBOARD CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total Businesses"
          value={analytics?.total_businesses ?? 0}
          icon={Building2}
          accent="primary"
        />
        <StatCard
          label="Monthly AI Credits Used"
          value={(analytics?.total_ai_credits_used_this_month ?? 0).toLocaleString()}
          icon={Brain}
          accent="info"
        />
        <StatCard
          label="Businesses Near Limit"
          value={analytics?.businesses_near_limit ?? 0}
          icon={AlertTriangle}
          accent="warning"
        />
        <StatCard
          label="Out Of Credits"
          value={analytics?.businesses_out_of_credits ?? 0}
          icon={XCircle}
          accent="destructive"
        />
        <StatCard
          label="Total Purchased Credits Sold"
          value={(analytics?.total_purchased_credits_sold ?? 0).toLocaleString()}
          icon={Coins}
          accent="accent"
        />
      </div>

      {/* MAIN MODULE TABS */}
      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList className="rounded-2xl bg-muted/50 p-1">
          <TabsTrigger value="requests" className="rounded-xl text-xs flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-500" /> Purchase Requests
            {pendingRequestsCount > 0 && (
              <Badge className="rounded-full px-1.5 text-[10px] bg-amber-500 text-white font-bold">
                {pendingRequestsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="packs" className="rounded-xl text-xs flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5" /> AI Credit Packs
            <Badge variant="secondary" className="rounded-full px-1.5 text-[10px]">{packs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="usage" className="rounded-xl text-xs flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-violet-500" /> Business AI Usage
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PURCHASE REQUESTS APPROVAL WORKFLOW */}
        <TabsContent value="requests" className="space-y-4">
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="relative flex-1 w-full sm:w-80">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Business or Merchant Name..."
                    value={reqSearch}
                    onChange={(e) => {
                      setReqSearch(e.target.value);
                      setReqPage(1);
                    }}
                    className="pl-9 text-xs rounded-xl"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={reqStatusFilter}
                    onChange={(e) => {
                      setReqStatusFilter(e.target.value);
                      setReqPage(1);
                    }}
                    className="rounded-xl border bg-background px-3 py-2 text-xs w-full sm:w-44"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending Approval</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={loadPurchaseRequests}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">Merchant AI Credit Purchase Requests</CardTitle>
              <CardDescription>Review and approve merchant top-up requests. Credits are allocated only after explicit Super Admin approval.</CardDescription>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : purchaseRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  No credit purchase requests found matching filters.
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business Name</TableHead>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Credit Pack</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Requested Date</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Approval</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseRequests.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">
                            <p className="text-sm font-bold text-foreground">{r.business_name}</p>
                            <span className="text-[11px] text-muted-foreground">Plan: {r.current_plan_name}</span>
                          </TableCell>
                          <TableCell className="text-xs">
                            <p className="font-semibold text-foreground">{r.merchant_name}</p>
                            <p className="text-[11px] text-muted-foreground">{r.merchant_email}</p>
                          </TableCell>
                          <TableCell className="font-semibold text-xs text-foreground">
                            {r.pack_name}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-violet-600 dark:text-violet-400">
                            +{r.ai_credits.toLocaleString()} Credits
                          </TableCell>
                          <TableCell className="text-xs font-bold text-foreground">
                            {r.amount === 0 ? "Free" : formatCurrency(r.amount, "INR")}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(r.requested_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                r.payment_status === "PAID"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                  : r.payment_status === "FAILED"
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                                  : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                              }
                            >
                              {r.payment_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                r.approval_status === "APPROVED"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                  : r.approval_status === "REJECTED"
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                                  : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                              }
                            >
                              {r.approval_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs rounded-full"
                                onClick={() => {
                                  setSelectedReq(r);
                                  setDetailOpen(true);
                                }}
                                title="View Details"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" /> View
                              </Button>
                              {r.approval_status === "PENDING" && (
                                <>
                                  <Button
                                    size="sm"
                                    className="h-8 text-xs rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                    onClick={() => {
                                      setApprovingReq(r);
                                      setApproveOpen(true);
                                    }}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8 text-xs rounded-full"
                                    onClick={() => {
                                      setRejectingReq(r);
                                      setRejectReason("Payment Not Received");
                                      setRejectNotes("");
                                      setRejectOpen(true);
                                    }}
                                  >
                                    <Ban className="h-3.5 w-3.5 mr-1" /> Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="mt-4 flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                    <div>Page {reqPage} of {reqTotalPages}</div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs"
                        disabled={reqPage <= 1}
                        onClick={() => setReqPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs"
                        disabled={reqPage >= reqTotalPages}
                        onClick={() => setReqPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: AI CREDIT PACKS */}
        <TabsContent value="packs" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">
              Configure available AI Credit Packs for merchants. Changes synchronize instantly with merchant credit top-up modals.
            </p>
            <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={loadPacks}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh Packs
            </Button>
          </div>

          {packsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packs.map((p) => (
                <Card key={p.id} className="relative rounded-2xl border shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-display text-lg font-bold">{p.name}</CardTitle>
                      <Badge variant={p.is_active ? "secondary" : "outline"} className={p.is_active ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "text-muted-foreground"}>
                        {p.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs pt-1">
                      Sort Order: <span className="font-semibold text-foreground">{p.sort_order}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="rounded-xl bg-muted/30 p-3.5 flex items-center justify-between border">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Credits</p>
                        <p className="text-2xl font-bold font-display text-violet-600 dark:text-violet-400">
                          {p.ai_credits.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">AI Credits</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Price</p>
                        <p className="text-xl font-bold font-display text-foreground">
                          {p.price === 0 ? "Free" : formatCurrency(p.price, "INR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => handleOpenEditPack(p)}>
                        <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit Pack
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 3: BUSINESS AI USAGE */}
        <TabsContent value="usage" className="space-y-4">
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Business or Merchant Name..."
                    value={aiSearch}
                    onChange={(e) => {
                      setAiSearch(e.target.value);
                      setAiPage(1);
                    }}
                    className="pl-9 text-xs rounded-xl"
                  />
                </div>

                <select
                  value={aiTypeFilter}
                  onChange={(e) => {
                    setAiTypeFilter(e.target.value);
                    setAiPage(1);
                  }}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-xs"
                >
                  <option value="all">All Business Types</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="salon">Salon</option>
                </select>

                <select
                  value={aiPlanFilter}
                  onChange={(e) => {
                    setAiPlanFilter(e.target.value);
                    setAiPage(1);
                  }}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-xs"
                >
                  <option value="all">All Subscription Plans</option>
                  <option value="FREE">Free</option>
                  <option value="STARTER">Starter</option>
                  <option value="PROFESSIONAL">Professional</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>

                <select
                  value={aiStatusFilter}
                  onChange={(e) => {
                    setAiStatusFilter(e.target.value);
                    setAiPage(1);
                  }}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-xs"
                >
                  <option value="all">All AI Statuses</option>
                  <option value="normal">Normal</option>
                  <option value="warning">Warning (≥80%)</option>
                  <option value="limit reached">Limit Reached</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">Business AI Credit Usage Monitoring</CardTitle>
              <CardDescription>Real-time AI credit consumption, purchased balances, and reset periods for all merchants.</CardDescription>
            </CardHeader>
            <CardContent>
              {aiUsageLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Monthly Credits</TableHead>
                        <TableHead>Purchased Rem.</TableHead>
                        <TableHead>Total Remaining</TableHead>
                        <TableHead>Next Reset</TableHead>
                        <TableHead>Last Activity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiUsage.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-xs">
                            No businesses found matching filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        aiUsage.map((b) => (
                          <TableRow key={b.business_id}>
                            <TableCell className="font-medium">
                              <div>
                                <p className="text-sm font-bold text-foreground">{b.business_name}</p>
                                <p className="text-[11px] text-muted-foreground">{b.owner_name} ({b.email})</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize text-xs">
                                {b.business_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {b.plan_name}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className="font-semibold text-foreground">{b.monthly_used_credits}</span> / {b.monthly_plan_credits}
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              +{b.purchased_remaining_credits}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-foreground">
                              {b.total_remaining_credits}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {b.reset_date}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {b.last_ai_activity}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  b.status === "Limit Reached"
                                    ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                                    : b.status === "Warning"
                                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                }
                              >
                                {b.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-xs rounded-full"
                                  onClick={() => navigate({ to: `/admin/clients/$id`, params: { id: b.business_id } })}
                                  title="View Business"
                                >
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs rounded-full"
                                  onClick={() => {
                                    setAddCreditsTarget(b);
                                    setAddCreditsOpen(true);
                                  }}
                                  title="Add or Remove Credits"
                                >
                                  <Coins className="h-3.5 w-3.5 text-emerald-500 mr-1" /> Credits
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs rounded-full"
                                  onClick={() => {
                                    setResetTarget(b);
                                    setResetOpen(true);
                                  }}
                                  title="Reset Monthly Usage"
                                >
                                  <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-xs rounded-full"
                                  onClick={() => handleOpenAuditLogs(b)}
                                  title="Audit History"
                                >
                                  <History className="h-3.5 w-3.5 text-violet-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  <div className="mt-4 flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                    <div>Page {aiPage} of {aiTotalPages}</div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs"
                        disabled={aiPage <= 1}
                        onClick={() => setAiPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs"
                        disabled={aiPage >= aiTotalPages}
                        onClick={() => setAiPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DETAIL VIEW MODAL FOR PURCHASE REQUEST */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" /> Credit Purchase Request Details
            </DialogTitle>
          </DialogHeader>
          {selectedReq && (
            <div className="space-y-4 text-xs">
              <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Business:</span>
                  <span className="font-bold text-foreground">{selectedReq.business_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Merchant Owner:</span>
                  <span className="font-semibold">{selectedReq.merchant_name} ({selectedReq.merchant_email})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Plan:</span>
                  <Badge variant="secondary">{selectedReq.current_plan_name}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Remaining AI Credits:</span>
                  <span className="font-bold text-violet-600">{selectedReq.current_ai_credits?.toLocaleString()} Credits</span>
                </div>
              </div>

              <div className="rounded-xl border p-3 space-y-2 bg-background">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requested Pack:</span>
                  <span className="font-bold text-foreground">{selectedReq.pack_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI Credits to Add:</span>
                  <span className="font-bold text-emerald-600">+{selectedReq.ai_credits?.toLocaleString()} Credits</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pack Price:</span>
                  <span className="font-bold">{selectedReq.amount === 0 ? "Free" : formatCurrency(selectedReq.amount, "INR")}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Requested Date:</span>
                  <span>{new Date(selectedReq.requested_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="rounded-xl border p-3 space-y-2 bg-muted/10">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Payment Status:</span>
                  <Badge variant="outline">{selectedReq.payment_status}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Approval Status:</span>
                  <Badge variant="outline">{selectedReq.approval_status}</Badge>
                </div>
                {selectedReq.approval_status === "APPROVED" && (
                  <div className="pt-2 border-t space-y-1 text-emerald-600">
                    <p>Approved by: <strong>{selectedReq.approved_by_admin_name || "Super Admin"}</strong></p>
                    <p>Approved date: <strong>{selectedReq.approved_at ? new Date(selectedReq.approved_at).toLocaleString() : "N/A"}</strong></p>
                  </div>
                )}
                {selectedReq.approval_status === "REJECTED" && (
                  <div className="pt-2 border-t space-y-1 text-rose-600">
                    <p>Rejection Reason: <strong>{selectedReq.rejection_reason}</strong></p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-full text-xs" onClick={() => setDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* APPROVE CONFIRMATION DIALOG */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Approve Credit Purchase Request
            </DialogTitle>
            <DialogDescription>
              Confirm approval for <strong>{approvingReq?.business_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          {approvingReq && (
            <div className="rounded-xl border bg-emerald-500/10 border-emerald-500/30 p-3 text-xs space-y-1.5">
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                Approving this request will immediately add +{approvingReq.ai_credits.toLocaleString()} Purchased AI Credits to the business balance.
              </p>
              <p className="text-muted-foreground">
                Pack: {approvingReq.pack_name} (₹{approvingReq.amount})
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button onClick={handleApproveRequest} disabled={approveSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              {approveSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Approve &amp; Allocate Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECT DIALOG */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-rose-500" /> Reject Credit Purchase Request
            </DialogTitle>
            <DialogDescription>
              Select a reason for rejecting the request from <strong>{rejectingReq?.business_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRejectRequest} className="space-y-4">
            <div>
              <Label>Rejection Reason</Label>
              <UISelect value={rejectReason} onValueChange={setRejectReason}>
                <UISelectTrigger className="w-full text-xs">
                  <UISelectValue placeholder="Select Reason" />
                </UISelectTrigger>
                <UISelectContent>
                  <UISelectItem value="Payment Not Received">Payment Not Received</UISelectItem>
                  <UISelectItem value="Duplicate Request">Duplicate Request</UISelectItem>
                  <UISelectItem value="Invalid Request">Invalid Request</UISelectItem>
                  <UISelectItem value="Other">Other</UISelectItem>
                </UISelectContent>
              </UISelect>
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Provide additional details regarding the rejection..."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={rejectSaving}>
                {rejectSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Reject Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE CREDIT PACK DIALOG */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create AI Credit Pack</DialogTitle>
            <DialogDescription>Configure details and pricing for the new credit pack.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePack} className="space-y-4">
            <div>
              <Label>Pack Name</Label>
              <Input
                placeholder="e.g. Starter Pack"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-3 grid-cols-2">
              <div>
                <Label>AI Credits</Label>
                <Input
                  type="number"
                  min="1"
                  value={createCredits}
                  onChange={(e) => setCreateCredits(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Price (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createPrice}
                  onChange={(e) => setCreatePrice(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 grid-cols-2 items-center">
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  min="0"
                  value={createOrder}
                  onChange={(e) => setCreateOrder(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between pt-4">
                <Label className="text-xs font-semibold">Active Status</Label>
                <Switch checked={createActive} onCheckedChange={setCreateActive} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createSaving}>
                {createSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Create Pack
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT CREDIT PACK DIALOG */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Credit Pack — {editingPack?.name}</DialogTitle>
            <DialogDescription>Update pricing and credit count for this pack.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEditPack} className="space-y-4">
            <div>
              <Label>Pack Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-3 grid-cols-2">
              <div>
                <Label>AI Credits</Label>
                <Input
                  type="number"
                  min="1"
                  value={editCredits}
                  onChange={(e) => setEditCredits(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Price (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 grid-cols-2 items-center">
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  min="0"
                  value={editOrder}
                  onChange={(e) => setEditOrder(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between pt-4">
                <Label className="text-xs font-semibold">Active Status</Label>
                <Switch checked={editActive} onCheckedChange={setEditActive} />
              </div>
            </div>
            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeletePack}
                disabled={deleteSaving || editSaving}
              >
                {deleteSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />} Delete
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={editSaving || deleteSaving}>
                  {editSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Save Changes
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ADJUST PURCHASED CREDITS DIALOG */}
      <Dialog open={addCreditsOpen} onOpenChange={setAddCreditsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-emerald-500" /> Adjust Purchased Credits
            </DialogTitle>
            <DialogDescription>
              Add or remove purchased AI credits for <strong>{addCreditsTarget?.business_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCreditsSubmit} className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-3 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Purchased credits remaining</span>
                <span className="font-semibold text-emerald-600">+{addCreditsTarget?.purchased_remaining_credits ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly used / limit</span>
                <span>{addCreditsTarget?.monthly_used_credits ?? 0} / {addCreditsTarget?.monthly_plan_credits ?? 0}</span>
              </div>
            </div>
            <div>
              <Label>Amount (positive to add, negative to remove)</Label>
              <Input
                type="number"
                value={addCreditsAmount}
                onChange={(e) => setAddCreditsAmount(e.target.value)}
                placeholder="e.g. 500 to add, -100 to remove"
                required
              />
            </div>
            <div>
              <Label>Reason for Adjustment</Label>
              <UISelect value={addCreditsReason} onValueChange={setAddCreditsReason}>
                <UISelectTrigger className="w-full text-sm">
                  <UISelectValue placeholder="Select Reason" />
                </UISelectTrigger>
                <UISelectContent>
                  <UISelectItem value="Manual Purchase">Manual Purchase</UISelectItem>
                  <UISelectItem value="Promotion">Promotion</UISelectItem>
                  <UISelectItem value="Compensation">Compensation</UISelectItem>
                  <UISelectItem value="Testing">Testing</UISelectItem>
                  <UISelectItem value="Other">Other</UISelectItem>
                </UISelectContent>
              </UISelect>
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Input
                value={addCreditsNotes}
                onChange={(e) => setAddCreditsNotes(e.target.value)}
                placeholder="e.g. Added via credit pack purchase invoice #1024"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddCreditsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addCreditsSaving}>
                {addCreditsSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Apply Adjustment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RESET MONTHLY CONFIRMATION DIALOG */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Monthly Used Credits</DialogTitle>
            <DialogDescription>
              Are you sure you want to reset monthly used AI credits back to 0 for <strong>{resetTarget?.business_name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={handleResetSubmit} disabled={resetSaving}>
              {resetSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Reset to 0
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AUDIT LOGS DIALOG */}
      <Dialog open={auditLogsOpen} onOpenChange={setAuditLogsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-violet-500" /> AI Credit Audit History — {auditLogsTarget?.business_name}
            </DialogTitle>
          </DialogHeader>
          {auditLogsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No credit adjustment audit logs found for this business.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date &amp; Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-xs font-bold ${log.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {log.amount > 0 ? `+${log.amount}` : log.amount}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {log.reason} {log.notes ? `(${log.notes})` : ""}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.admin_name || "Super Admin"}
                    </TableCell>
                    <TableCell className="text-xs font-semibold">
                      {log.previous_balance} → {log.new_balance}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
