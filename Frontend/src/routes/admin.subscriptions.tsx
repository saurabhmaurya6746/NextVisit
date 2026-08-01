import { createFileRoute } from '@tanstack/react-router'
import { Check, Plus, Loader2, Edit2, Clock, CheckCircle2, XCircle, Search, Filter, Trash2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listSubscriptionPlansApi,
  createSubscriptionPlanApi,
  updateSubscriptionPlanApi,
  deleteSubscriptionPlanApi,
  listBusinessSubscriptionsApi,
  assignBusinessSubscriptionApi,
  listAdminUpgradeRequestsApi,
  approveUpgradeRequestApi,
  rejectUpgradeRequestApi,
  type SubscriptionPlanModel,
  type BusinessSubscriptionItemModel,
  type AdminUpgradeRequestItem,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/admin/subscriptions")({ component: SubscriptionsPage });

function SubscriptionsPage() {
  const [plans, setPlans] = useState<SubscriptionPlanModel[]>([]);
  const [businessSubs, setBusinessSubs] = useState<BusinessSubscriptionItemModel[]>([]);
  const [loading, setLoading] = useState(true);

  // Upgrade Requests State
  const [requests, setRequests] = useState<AdminUpgradeRequestItem[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [reqPage, setReqPage] = useState(1);
  const [reqTotalPages, setReqTotalPages] = useState(1);
  const [reqStatusFilter, setReqStatusFilter] = useState("ALL");
  const [reqSearch, setReqSearch] = useState("");

  // Dialog States
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const [selectedBusiness, setSelectedBusiness] = useState<BusinessSubscriptionItemModel | null>(null);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanModel | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<AdminUpgradeRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Form states for new plan
  const [name, setName] = useState("");
  const [price, setPrice] = useState("29");
  const [trialDays, setTrialDays] = useState("14");
  const [maxCustomers, setMaxCustomers] = useState("500");
  const [maxStaff, setMaxStaff] = useState("5");

  // Form states for editing plan
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editTrialDays, setEditTrialDays] = useState("");
  const [editMaxCustomers, setEditMaxCustomers] = useState("");
  const [editMaxDevices, setEditMaxDevices] = useState("");
  const [editMaxCampaigns, setEditMaxCampaigns] = useState("");
  const [editStorageLimit, setEditStorageLimit] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Form states for assigning plan
  const [selectedPlanId, setSelectedPlanId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, bRes] = await Promise.all([
        listSubscriptionPlansApi(),
        listBusinessSubscriptionsApi(),
      ]);
      setPlans(pRes || []);
      setBusinessSubs(bRes || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load subscription plans");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await listAdminUpgradeRequestsApi(reqPage, 10, reqStatusFilter, reqSearch);
      setRequests(res.items || []);
      setReqTotalPages(res.pages || 1);
    } catch (err: any) {
      toast.error(err.message || "Failed to load subscription requests");
    } finally {
      setRequestsLoading(false);
    }
  }, [reqPage, reqStatusFilter, reqSearch]);

  useEffect(() => {
    loadData();
    loadRequests();
  }, [loadData, loadRequests]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSubscriptionPlanApi({
        name,
        monthly_price: parseFloat(price) || 0,
        trial_days: parseInt(trialDays, 10) || 14,
        max_customers: parseInt(maxCustomers, 10) || 100,
        max_staff: parseInt(maxStaff, 10) || 5,
        max_campaigns_per_month: 20,
        storage_limit_gb: 2.0,
      });
      toast.success(`Subscription plan '${name}' created successfully`);
      setCreateOpen(false);
      setName("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create plan");
    }
  };

  const handleOpenEditModal = (p: SubscriptionPlanModel) => {
    setEditingPlan(p);
    setEditName(p.name);
    setEditPrice(p.monthly_price.toString());
    setEditTrialDays(p.trial_days.toString());
    setEditMaxCustomers(p.max_customers.toString());
    setEditMaxDevices((p.max_staff || 5).toString());
    setEditMaxCampaigns(p.max_campaigns_per_month.toString());
    setEditStorageLimit((p.storage_limit_gb || 2.0).toString());
    setEditOpen(true);
  };

  const handleSaveEditPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    const parsedPrice = parseFloat(editPrice);
    const parsedTrial = parseInt(editTrialDays, 10);
    const parsedCustomers = parseInt(editMaxCustomers, 10);
    const parsedDevices = parseInt(editMaxDevices, 10);
    const parsedCampaigns = parseInt(editMaxCampaigns, 10);
    const parsedStorage = parseFloat(editStorageLimit);

    setEditSaving(true);
    try {
      await updateSubscriptionPlanApi(editingPlan.id, {
        name: editName,
        monthly_price: parsedPrice,
        trial_days: isNaN(parsedTrial) ? 14 : parsedTrial,
        max_customers: parsedCustomers,
        max_staff: isNaN(parsedDevices) ? 5 : parsedDevices,
        max_campaigns_per_month: isNaN(parsedCampaigns) ? 20 : parsedCampaigns,
        storage_limit_gb: isNaN(parsedStorage) ? 2.0 : parsedStorage,
      });

      toast.success(`Subscription plan '${editName}' updated successfully`);
      setEditOpen(false);
      setEditingPlan(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update plan");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!editingPlan) return;
    if (!confirm(`Are you sure you want to delete the '${editingPlan.name}' plan?`)) return;

    setDeleteSaving(true);
    try {
      const res = await deleteSubscriptionPlanApi(editingPlan.id);
      toast.success(res.message || `Plan '${editingPlan.name}' deleted successfully`);
      setEditOpen(false);
      setEditingPlan(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete plan");
    } finally {
      setDeleteSaving(false);
    }
  };

  const handleAssignPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBusiness || !selectedPlanId) return;
    try {
      await assignBusinessSubscriptionApi(selectedBusiness.business_id, {
        plan_id: selectedPlanId,
      });
      toast.success(`Assigned new plan to ${selectedBusiness.business_name}`);
      setAssignOpen(false);
      setSelectedBusiness(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign plan");
    }
  };

  const handleApproveRequest = async (reqId: string) => {
    setApprovingId(reqId);
    try {
      await approveUpgradeRequestApi(reqId);
      toast.success("Upgrade request APPROVED! Business plan & limits updated.");
      loadRequests();
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve request");
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingRequest || !rejectReason.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }
    try {
      await rejectUpgradeRequestApi(rejectingRequest.id, rejectReason.trim());
      toast.success("Upgrade request REJECTED.");
      setRejectOpen(false);
      setRejectingRequest(null);
      setRejectReason("");
      loadRequests();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject request");
    }
  };

  return (
    <>
      <PageHeader
        title="Subscription Management"
        description="Manage subscription tiers, review upgrade requests, and assign merchant plans."
        actions={
          <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Create plan
          </Button>
        }
      />

      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList className="rounded-2xl bg-muted/50 p-1">
          <TabsTrigger value="requests" className="rounded-xl text-xs flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Subscription Upgrade Requests
          </TabsTrigger>
          <TabsTrigger value="plans" className="rounded-xl text-xs">Platform Plans</TabsTrigger>
          <TabsTrigger value="roster" className="rounded-xl text-xs">Merchant Roster</TabsTrigger>
        </TabsList>

        {/* 1. UPGRADE REQUESTS TAB */}
        <TabsContent value="requests">
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="font-display text-base">Pending & Historical Upgrade Requests</CardTitle>
                <CardDescription>Review merchant upgrade requests and approve plan activations.</CardDescription>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search business, owner, plan..."
                    className="pl-9 rounded-xl text-xs"
                    value={reqSearch}
                    onChange={(e) => {
                      setReqSearch(e.target.value);
                      setReqPage(1);
                    }}
                  />
                </div>
                <Select
                  value={reqStatusFilter}
                  onValueChange={(val) => {
                    setReqStatusFilter(val);
                    setReqPage(1);
                  }}
                >
                  <SelectTrigger className="w-36 rounded-xl text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
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
              {requestsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : requests.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No subscription upgrade requests found matching criteria.</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business & Owner</TableHead>
                        <TableHead>Current Plan</TableHead>
                        <TableHead>Requested Plan</TableHead>
                        <TableHead>Requested Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-semibold text-sm text-foreground">{r.business_name}</div>
                            <div className="text-xs text-muted-foreground">{r.owner_name} ({r.email})</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="rounded-full text-xs">
                              {r.current_plan?.name || "Free Tier"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="rounded-full text-xs font-semibold text-primary">
                              {r.requested_plan.name} ({formatCurrency(r.requested_plan.monthly_price, "INR")}/mo)
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(r.requested_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full text-[10px] capitalize",
                                r.status === "APPROVED" && "border-emerald-500/40 text-emerald-600 bg-emerald-500/10",
                                r.status === "PENDING" && "border-amber-500/40 text-amber-600 bg-amber-500/10 font-bold animate-pulse",
                                r.status === "REJECTED" && "border-rose-500/40 text-rose-600 bg-rose-500/10",
                                r.status === "CANCELLED" && "border-muted text-muted-foreground"
                              )}
                            >
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {r.status === "PENDING" ? (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  disabled={approvingId === r.id}
                                  className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => handleApproveRequest(r.id)}
                                >
                                  {approvingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Approve"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setRejectingRequest(r);
                                    setRejectOpen(true);
                                  }}
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {r.status === "APPROVED" ? `Approved by ${r.approved_by || "Admin"}` : r.status === "REJECTED" ? `Reason: ${r.reason}` : "Cancelled"}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination Footer */}
                  <div className="mt-4 flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                    <div>Page {reqPage} of {reqTotalPages}</div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="rounded-full text-xs" disabled={reqPage <= 1} onClick={() => setReqPage((p) => p - 1)}>
                        Previous
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-full text-xs" disabled={reqPage >= reqTotalPages} onClick={() => setReqPage((p) => p + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. PLANS TAB */}
        <TabsContent value="plans">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <Card key={p.id} className="relative rounded-2xl transition-all hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="font-display">{p.name}</CardTitle>
                  <p className="mt-2">
                    <span className="font-display text-3xl font-semibold">{formatCurrency(p.monthly_price, "INR")}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Up to {p.max_customers.toLocaleString()} customers</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Up to {p.max_staff} Active Devices</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {p.max_campaigns_per_month} campaigns/mo</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {p.trial_days} days trial</li>
                  </ul>
                  <Button variant="outline" className="w-full rounded-full" onClick={() => handleOpenEditModal(p)}>
                    <Edit2 className="mr-1.5 h-3.5 w-3.5" /> Manage plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 3. ROSTER TAB */}
        <TabsContent value="roster">
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display">Merchant subscription roster</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Owner & Email</TableHead>
                    <TableHead>Current Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiry / Trial End</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {businessSubs.map((b) => (
                    <TableRow key={b.business_id}>
                      <TableCell className="font-medium">{b.business_name}</TableCell>
                      <TableCell className="text-xs">
                        <div>{b.owner_name}</div>
                        <div className="text-muted-foreground">{b.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full">
                          {b.current_plan?.name || "Free Tier"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full capitalize">
                          {b.subscription_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBusiness(b);
                            setSelectedPlanId(b.current_plan?.id || (plans[0]?.id ?? ""));
                            setAssignOpen(true);
                          }}
                        >
                          Change plan
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Reason Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Upgrade Request — {rejectingRequest?.business_name}</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this upgrade request.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRejectRequestSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Rejection Reason</Label>
              <Textarea
                rows={3}
                placeholder="e.g. Invalid payment verification, please contact billing support."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button type="submit" variant="destructive">Confirm Rejection</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Plan Parameters — {editingPlan?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEditPlan} className="space-y-3">
            <div>
              <Label>Plan Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Monthly Price (₹)</Label>
                <Input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} required />
              </div>
              <div>
                <Label>Trial Duration (Days)</Label>
                <Input type="number" value={editTrialDays} onChange={(e) => setEditTrialDays(e.target.value)} required />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Customer Limit</Label>
                <Input type="number" value={editMaxCustomers} onChange={(e) => setEditMaxCustomers(e.target.value)} required />
              </div>
              <div>
                <Label>Active Devices Limit</Label>
                <Input type="number" value={editMaxDevices} onChange={(e) => setEditMaxDevices(e.target.value)} required />
              </div>
            </div>
            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeletePlan}
                disabled={deleteSaving || editSaving}
              >
                {deleteSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
                Delete Plan
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={editSaving || deleteSaving}>Save Changes</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Plan Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Subscription Plan</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePlan} className="space-y-3">
            <div>
              <Label>Plan Name</Label>
              <Input placeholder="e.g. ULTIMATE" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Monthly Price (₹)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit">Create Plan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Plan Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Plan to {selectedBusiness?.business_name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignPlan} className="space-y-4">
            <div>
              <Label>Select Subscription Plan</Label>
              <select
                className="w-full rounded-md border p-2 text-sm bg-background"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ₹{p.monthly_price}/mo
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button type="submit">Assign Plan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}