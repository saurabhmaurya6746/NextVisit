import { Link } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import { Plus, Search, MoreHorizontal, Loader2, Check, X, Eye, LogIn, PauseCircle, PlayCircle, Trash2, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  listAdminClientsApi,
  updateAdminClientStatusApi,
  deleteAdminClientApi,
  impersonateAdminClientApi,
  approveBusinessApi,
  rejectBusinessApi,
  type ClientListItemModel,
} from "@/lib/admin-api";
import { setToken, setSession } from "@/lib/auth";
import { slugify } from "@/lib/app-nav";
import { setBusinessType, resolveBusinessType } from "@/lib/business-type";

export const Route = createFileRoute("/admin/clients/")({ component: ClientsPage });

const statusStyle: Record<string, string> = {
  ACTIVE: "bg-success/15 text-success border-success/30",
  PENDING: "bg-warning/20 text-warning border-warning/30",
  REJECTED: "bg-destructive/15 text-destructive border-destructive/30",
  SUSPENDED: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientListItemModel[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [viewingClient, setViewingClient] = useState<ClientListItemModel | null>(null);

  const [deletingClient, setDeletingClient] = useState<ClientListItemModel | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await listAdminClientsApi(
        page,
        10,
        q || undefined,
        statusFilter === "all" ? undefined : statusFilter
      );
      setClients(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to load clients list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, [page, q, statusFilter]);

  // Action handlers
  const handleUpdateStatus = async (
    id: string,
    newStatus: "ACTIVE" | "SUSPENDED" | "PENDING" | "REJECTED",
    name: string
  ) => {
    setActionLoading(true);
    try {
      await updateAdminClientStatusApi(id, newStatus);
      toast.success(`${name} status updated to ${newStatus}`);
      if (viewingClient && viewingClient.id === id) {
        setViewingClient({ ...viewingClient, status: newStatus });
      }
      loadClients();
    } catch (err: any) {
      toast.error(err.message || "Failed to update client status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (id: string, name: string) => {
    setActionLoading(true);
    try {
      await approveBusinessApi(id);
      toast.success(`${name} approved successfully — merchant can now log in!`);
      if (viewingClient && viewingClient.id === id) {
        setViewingClient({ ...viewingClient, status: "ACTIVE" });
      }
      loadClients();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve client");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string, name: string) => {
    setActionLoading(true);
    try {
      await rejectBusinessApi(id, "Registration rejected by administrator.");
      toast.warning(`${name} registration rejected`);
      if (viewingClient && viewingClient.id === id) {
        setViewingClient({ ...viewingClient, status: "REJECTED" });
      }
      loadClients();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject client");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingClient || deleteConfirmText !== "DELETE") return;
    setActionLoading(true);
    try {
      await deleteAdminClientApi(deletingClient.id);
      toast.success(`${deletingClient.name} permanently deleted`);
      setDeletingClient(null);
      setDeleteConfirmText("");
      if (viewingClient && viewingClient.id === deletingClient.id) {
        setViewingClient(null);
      }
      loadClients();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete client");
    } finally {
      setActionLoading(false);
    }
  };

  const impersonate = async (client: ClientListItemModel) => {
    try {
      const res = await impersonateAdminClientApi(client.id);
      setToken(res.access_token);
      const businessType = resolveBusinessType(
        { business_type: client.business_type, name: client.name },
        null,
        null
      );
      const slug = slugify(client.name || businessType);
      setBusinessType(businessType);
      setSession({
        role: "business",
        email: client.email || `impersonate@${slug}.com`,
        clientId: res.business_id,
        businessName: res.business_name || client.name,
        businessType: businessType,
        businessSlug: slug,
        token: res.access_token,
      });
      toast.success(`Logging in as ${client.name} (Impersonation mode)`);
      window.location.href = `/app/${businessType}/${slug}/dashboard`;
    } catch (err: any) {
      toast.error(err.message || "Failed to impersonate client");
    }
  };

  return (
    <>
      <PageHeader
        title="Client management"
        description={`${total} registered business accounts on platform`}
      />
      <Card className="rounded-2xl p-4">
        <div className="mb-4 grid gap-2 sm:flex sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by business, owner, email…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
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
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Signed Up</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No business accounts found matching criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((c) => (
                    <TableRow key={c.id} className="group">
                      <TableCell>
                        <Link to={`/admin/clients/${c.id}`} className="font-medium text-foreground hover:text-primary">
                          {c.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{c.country}</div>
                      </TableCell>
                      <TableCell>{c.owner_name}</TableCell>
                      <TableCell><Badge variant="secondary" className="rounded-full">{c.business_type?.name || "General"}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        <div>{c.email}</div>
                        <div className="text-muted-foreground">{c.phone}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="rounded-full capitalize">{c.subscription_status}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`rounded-full capitalize ${statusStyle[c.status] || ""}`}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingClient(c)}>
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>

                            {/* Status Specific Actions */}
                            {c.status === "ACTIVE" && (
                              <>
                                <DropdownMenuItem onClick={() => impersonate(c)}>
                                  <LogIn className="mr-2 h-4 w-4" /> Login as Client
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateStatus(c.id, "SUSPENDED", c.name)}>
                                  <PauseCircle className="mr-2 h-4 w-4" /> Suspend Account
                                </DropdownMenuItem>
                              </>
                            )}

                            {c.status === "PENDING" && (
                              <>
                                <DropdownMenuItem onClick={() => handleApprove(c.id, c.name)}>
                                  <Check className="mr-2 h-4 w-4 text-success" /> Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleReject(c.id, c.name)}>
                                  <X className="mr-2 h-4 w-4 text-destructive" /> Reject
                                </DropdownMenuItem>
                              </>
                            )}

                            {c.status === "REJECTED" && (
                              <>
                                <DropdownMenuItem onClick={() => handleUpdateStatus(c.id, "PENDING", c.name)}>
                                  <ArrowRight className="mr-2 h-4 w-4" /> Move to Pending
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleApprove(c.id, c.name)}>
                                  <Check className="mr-2 h-4 w-4 text-success" /> Approve
                                </DropdownMenuItem>
                              </>
                            )}

                            {c.status === "SUSPENDED" && (
                              <>
                                <DropdownMenuItem onClick={() => handleUpdateStatus(c.id, "ACTIVE", c.name)}>
                                  <PlayCircle className="mr-2 h-4 w-4 text-success" /> Activate Account
                                </DropdownMenuItem>
                              </>
                            )}

                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => { setDeletingClient(c); setDeleteConfirmText(""); }}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {clients.length} of {total} clients</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-7 rounded-full">Previous</Button>
            <Button variant="outline" size="sm" disabled={clients.length < 10} onClick={() => setPage((p) => p + 1)} className="h-7 rounded-full">Next</Button>
          </div>
        </div>
      </Card>

      {/* View Details Modal */}
      <Dialog open={!!viewingClient} onOpenChange={(open) => !open && setViewingClient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{viewingClient?.name}</DialogTitle>
            <DialogDescription>Full business profile and merchant registration parameters.</DialogDescription>
          </DialogHeader>
          {viewingClient && (
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3">
                <div><span className="text-xs text-muted-foreground">Owner</span><p className="font-medium">{viewingClient.owner_name}</p></div>
                <div><span className="text-xs text-muted-foreground">Business Type</span><p className="font-medium">{viewingClient.business_type?.name || "General"}</p></div>
                <div><span className="text-xs text-muted-foreground">Email</span><p className="font-medium truncate">{viewingClient.email}</p></div>
                <div><span className="text-xs text-muted-foreground">Phone</span><p className="font-medium">{viewingClient.phone}</p></div>
                <div><span className="text-xs text-muted-foreground">Country</span><p className="font-medium">{viewingClient.country}</p></div>
                <div><span className="text-xs text-muted-foreground">Status</span><p><Badge variant="outline" className="capitalize">{viewingClient.status}</Badge></p></div>
                <div><span className="text-xs text-muted-foreground">Subscription</span><p className="font-medium capitalize">{viewingClient.subscription_status}</p></div>
                <div><span className="text-xs text-muted-foreground">Registered</span><p className="font-medium">{new Date(viewingClient.created_at).toLocaleDateString()}</p></div>
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-wrap gap-2 justify-end sm:justify-end">
            {viewingClient && (
              <>
                {viewingClient.status === "ACTIVE" && (
                  <Button variant="outline" disabled={actionLoading} onClick={() => handleUpdateStatus(viewingClient.id, "SUSPENDED", viewingClient.name)}>
                    <PauseCircle className="mr-1.5 h-4 w-4" /> Suspend Account
                  </Button>
                )}
                {viewingClient.status === "PENDING" && (
                  <>
                    <Button disabled={actionLoading} className="bg-success text-success-foreground hover:bg-success/90" onClick={() => handleApprove(viewingClient.id, viewingClient.name)}>
                      <Check className="mr-1.5 h-4 w-4" /> Approve
                    </Button>
                    <Button variant="destructive" disabled={actionLoading} onClick={() => handleReject(viewingClient.id, viewingClient.name)}>
                      <X className="mr-1.5 h-4 w-4" /> Reject
                    </Button>
                  </>
                )}
                {viewingClient.status === "REJECTED" && (
                  <>
                    <Button variant="outline" disabled={actionLoading} onClick={() => handleUpdateStatus(viewingClient.id, "PENDING", viewingClient.name)}>
                      <ArrowRight className="mr-1.5 h-4 w-4" /> Move to Pending
                    </Button>
                    <Button disabled={actionLoading} className="bg-success text-success-foreground hover:bg-success/90" onClick={() => handleApprove(viewingClient.id, viewingClient.name)}>
                      <Check className="mr-1.5 h-4 w-4" /> Approve
                    </Button>
                  </>
                )}
                {viewingClient.status === "SUSPENDED" && (
                  <Button disabled={actionLoading} className="bg-success text-success-foreground hover:bg-success/90" onClick={() => handleUpdateStatus(viewingClient.id, "ACTIVE", viewingClient.name)}>
                    <PlayCircle className="mr-1.5 h-4 w-4" /> Activate Account
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deletingClient} onOpenChange={(open) => { if (!open) { setDeletingClient(null); setDeleteConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Permanently Delete Business?</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{deletingClient?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm:</Label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeletingClient(null); setDeleteConfirmText(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== "DELETE" || actionLoading}
              onClick={handleDeleteConfirm}
            >
              {actionLoading ? "Deleting..." : "Permanently Delete Business"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}