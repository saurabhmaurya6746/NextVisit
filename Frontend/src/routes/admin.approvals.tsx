import { createFileRoute } from "@/lib/route-compat";
import { Check, X, Eye, Search, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  listAdminClientsApi,
  approveBusinessApi,
  rejectBusinessApi,
  type BusinessApprovalModel,
} from "@/lib/admin-api";

export const Route = createFileRoute("/admin/approvals")({ component: ApprovalsPage });

export const ADMIN_DATA_CHANGED_EVENT = "nextvisit:admin-data-changed";

export function notifyAdminDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ADMIN_DATA_CHANGED_EVENT));
  }
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<BusinessApprovalModel[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"PENDING" | "ACTIVE" | "REJECTED">("PENDING");
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<BusinessApprovalModel | null>(null);
  const [rejecting, setRejecting] = useState<BusinessApprovalModel | null>(null);
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      // Fetch backend dataset specifically for the active tab and search query
      const [currentRes, pRes, aRes, rRes] = await Promise.all([
        listAdminClientsApi(1, 100, q || undefined, tab),
        listAdminClientsApi(1, 1, undefined, "PENDING"),
        listAdminClientsApi(1, 1, undefined, "ACTIVE"),
        listAdminClientsApi(1, 1, undefined, "REJECTED"),
      ]);

      const mapped: BusinessApprovalModel[] = (currentRes.items || []).map((c) => ({
        id: c.id,
        name: c.name,
        owner_name: c.owner_name,
        email: c.email,
        phone: c.phone,
        country: c.country,
        currency: "INR",
        timezone: "Asia/Kolkata",
        address: "Registered Address",
        logo_url: null,
        status: c.status,
        rejection_reason: null,
        created_at: c.created_at,
        approved_at: c.approved_at,
        business_type: c.business_type,
      }));

      setItems(mapped);
      setPendingCount(pRes.total || 0);
      setActiveCount(aRes.total || 0);
      setRejectedCount(rRes.total || 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to load approval requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
    window.addEventListener(ADMIN_DATA_CHANGED_EVENT, loadApprovals);
    return () => {
      window.removeEventListener(ADMIN_DATA_CHANGED_EVENT, loadApprovals);
    };
  }, [tab, q]);

  const approve = async (c: BusinessApprovalModel) => {
    setActionLoading(true);
    try {
      await approveBusinessApi(c.id);
      toast.success(`${c.name} approved successfully — merchant can now log in!`);
      // Refetch current backend datasets and update status counts across tabs
      await loadApprovals();
      notifyAdminDataChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve business");
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setActionLoading(true);
    try {
      await rejectBusinessApi(rejecting.id, reason);
      toast.warning(`${rejecting.name} registration rejected`);
      setRejecting(null);
      setReason("");
      // Refetch current backend datasets and update status counts across tabs
      await loadApprovals();
      notifyAdminDataChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject business");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <PageHeader title="Client approvals" description="Review new signups before granting platform access." />
      <Card className="rounded-2xl p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="PENDING">
                Pending ({pendingCount})
              </TabsTrigger>
              <TabsTrigger value="ACTIVE">
                Approved ({activeCount})
              </TabsTrigger>
              <TabsTrigger value="REJECTED">
                Rejected ({rejectedCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search signups…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden lg:table-cell">Signed up</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No {tab === "PENDING" ? "pending" : tab === "ACTIVE" ? "approved" : "rejected"} clients found.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.owner_name}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{c.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full">
                          {c.business_type?.name || "General"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setViewing(c)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {c.status === "PENDING" && (
                            <>
                              <Button
                                size="sm"
                                disabled={actionLoading}
                                className="rounded-full bg-success text-success-foreground hover:bg-success/90"
                                onClick={() => approve(c)}
                              >
                                <Check className="mr-1 h-3.5 w-3.5" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                disabled={actionLoading}
                                variant="outline"
                                className="rounded-full"
                                onClick={() => setRejecting(c)}
                              >
                                <X className="mr-1 h-3.5 w-3.5" /> Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Owner:</span> {viewing.owner_name}</div>
              <div><span className="text-muted-foreground">Email:</span> {viewing.email}</div>
              <div><span className="text-muted-foreground">Phone:</span> {viewing.phone}</div>
              <div><span className="text-muted-foreground">Type:</span> {viewing.business_type?.name || "General"}</div>
              <div><span className="text-muted-foreground">Country:</span> {viewing.country || "—"}</div>
              <div><span className="text-muted-foreground">Address:</span> {viewing.address || "—"}</div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                <Badge variant="outline" className="rounded-full capitalize">{viewing.status}</Badge>
              </div>
              <div><span className="text-muted-foreground">Signed up:</span> {new Date(viewing.created_at).toLocaleString()}</div>
              {viewing.rejection_reason && (
                <div><span className="text-muted-foreground">Rejection Reason:</span> {viewing.rejection_reason}</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) { setRejecting(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejecting?.name}?</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Reason for rejection (sent to merchant)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejecting(null); setReason(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={actionLoading} onClick={reject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}