import { createFileRoute } from "@tanstack/react-router";
import { Check, Plus, Loader2, Edit2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  listSubscriptionPlansApi,
  createSubscriptionPlanApi,
  updateSubscriptionPlanApi,
  listBusinessSubscriptionsApi,
  assignBusinessSubscriptionApi,
  type SubscriptionPlanModel,
  type BusinessSubscriptionItemModel,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/admin/subscriptions")({ component: SubscriptionsPage });

function SubscriptionsPage() {
  const [plans, setPlans] = useState<SubscriptionPlanModel[]>([]);
  const [businessSubs, setBusinessSubs] = useState<BusinessSubscriptionItemModel[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [selectedBusiness, setSelectedBusiness] = useState<BusinessSubscriptionItemModel | null>(null);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanModel | null>(null);

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

  // Form states for assigning plan
  const [selectedPlanId, setSelectedPlanId] = useState("");

  const loadData = async () => {
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
  };

  useEffect(() => {
    loadData();
  }, []);

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

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Monthly price must be a valid positive number.");
      return;
    }
    if (isNaN(parsedCustomers) || parsedCustomers < 1) {
      toast.error("Customer limit must be at least 1.");
      return;
    }

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

  return (
    <>
      <PageHeader
        title="Subscription plans"
        description="Platform subscription tiers, pricing limits, and merchant plan assignments."
        actions={
          <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Create plan
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
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
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Up to {p.max_customers.toLocaleString()} customers</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Up to {p.max_staff} Active Devices</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> {p.max_campaigns_per_month} campaigns/mo</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> {p.trial_days} days trial</li>
                  </ul>
                  <Button variant="outline" className="w-full rounded-full" onClick={() => handleOpenEditModal(p)}>
                    <Edit2 className="mr-1.5 h-3.5 w-3.5" /> Manage plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-6 rounded-2xl">
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
        </>
      )}

      {/* Edit Plan Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Plan Parameters — {editingPlan?.name}</DialogTitle>
            <DialogDescription>
              Modify pricing, limits, and trial terms for this subscription tier.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEditPlan} className="space-y-3">
            <div>
              <Label>Plan Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Monthly Price (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Trial Duration (Days)</Label>
                <Input
                  type="number"
                  value={editTrialDays}
                  onChange={(e) => setEditTrialDays(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Customer Limit</Label>
                <Input
                  type="number"
                  value={editMaxCustomers}
                  onChange={(e) => setEditMaxCustomers(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Active Devices Limit</Label>
                <Input
                  type="number"
                  value={editMaxDevices}
                  onChange={(e) => setEditMaxDevices(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Campaign Limit (Per Month)</Label>
                <Input
                  type="number"
                  value={editMaxCampaigns}
                  onChange={(e) => setEditMaxCampaigns(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Storage Allocation (GB)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={editStorageLimit}
                  onChange={(e) => setEditStorageLimit(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editSaving} className="gradient-brand text-primary-foreground">
                {editSaving ? "Saving Changes..." : "Save Changes"}
              </Button>
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
            <div>
              <Label>Trial Days</Label>
              <Input type="number" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} required />
            </div>
            <div>
              <Label>Max Customers</Label>
              <Input type="number" value={maxCustomers} onChange={(e) => setMaxCustomers(e.target.value)} required />
            </div>
            <div>
              <Label>Max Active Devices</Label>
              <Input type="number" value={maxStaff} onChange={(e) => setMaxStaff(e.target.value)} required />
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
                className="w-full rounded-md border p-2 text-sm"
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