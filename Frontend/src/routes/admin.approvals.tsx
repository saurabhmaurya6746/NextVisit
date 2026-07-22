import { createFileRoute } from "@tanstack/react-router";
import { Check, X, Eye, Search } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePendingClients, setStatus, type PendingClient } from "@/lib/pending-clients-store";
import { toast } from "sonner";
import { addClient, logActivity } from "@/lib/clients-store";

export const Route = createFileRoute("/admin/approvals")({ component: ApprovalsPage });

function ApprovalsPage() {
  const all = usePendingClients();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<PendingClient | null>(null);
  const [rejecting, setRejecting] = useState<PendingClient | null>(null);
  const [reason, setReason] = useState("");

  const filtered = all
    .filter((c) => c.status === tab)
    .filter((c) => [c.business, c.owner, c.email].join(" ").toLowerCase().includes(q.toLowerCase()));

  const approve = (c: PendingClient) => {
    setStatus(c.id, "approved");
    const mappedType: "Restaurant" | "Salon" = c.type === "Salon" || c.type === "Spa" ? "Salon" : "Restaurant";
    const created = addClient({ business: c.business, owner: c.owner, email: c.email, phone: c.phone, type: mappedType });
    logActivity({ clientId: created.id, business: created.business, type: "approval", message: `${created.business} approved — 2-month free trial started` });
    toast.success(`${c.business} approved · trial started (60 days)`);
  };
  const reject = () => {
    if (!rejecting) return;
    setStatus(rejecting.id, "rejected", reason || "Not specified");
    toast.warning(`${rejecting.business} rejected`);
    setRejecting(null);
    setReason("");
  };

  return (
    <>
      <PageHeader title="Client approvals" description="Review new signups before granting platform access." />
      <Card className="rounded-2xl p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="pending">Pending ({all.filter((c) => c.status === "pending").length})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({all.filter((c) => c.status === "approved").length})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({all.filter((c) => c.status === "rejected").length})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </div>
        <div className="overflow-x-auto">
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
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No {tab} clients.</TableCell></TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.business}</TableCell>
                  <TableCell>{c.owner}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{c.email}</TableCell>
                  <TableCell><Badge variant="secondary" className="rounded-full">{c.type}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setViewing(c)}><Eye className="h-4 w-4" /></Button>
                      {c.status === "pending" && (
                        <>
                          <Button size="sm" className="rounded-full bg-success text-success-foreground hover:bg-success/90" onClick={() => approve(c)}><Check className="mr-1 h-3.5 w-3.5" /> Approve</Button>
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setRejecting(c)}><X className="mr-1 h-3.5 w-3.5" /> Reject</Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{viewing?.business}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Owner:</span> {viewing.owner}</div>
              <div><span className="text-muted-foreground">Email:</span> {viewing.email}</div>
              <div><span className="text-muted-foreground">Phone:</span> {viewing.phone}</div>
              <div><span className="text-muted-foreground">Type:</span> {viewing.type}</div>
              <div><span className="text-muted-foreground">Country:</span> {viewing.country || "—"}</div>
              <div><span className="text-muted-foreground">City:</span> {viewing.city || "—"}</div>
              <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="rounded-full capitalize">{viewing.status}</Badge></div>
              <div><span className="text-muted-foreground">Signed up:</span> {new Date(viewing.createdAt).toLocaleString()}</div>
              {viewing.rejectionReason && <div><span className="text-muted-foreground">Reason:</span> {viewing.rejectionReason}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) { setRejecting(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject {rejecting?.business}?</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason (optional, sent to the client)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejecting(null); setReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={reject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}