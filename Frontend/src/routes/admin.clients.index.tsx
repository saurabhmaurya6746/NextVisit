import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Plus, Search, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClients, removeClient } from "@/lib/clients-store";
import { AddClientDialog } from "@/components/add-client-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/clients/")({ component: ClientsPage });

const statusStyle: Record<string, string> = {
  active: "bg-success/15 text-success-foreground border-success/30",
  trial: "bg-warning/20 text-warning-foreground border-warning/30",
  expired: "bg-destructive/15 text-destructive border-destructive/30",
  suspended: "bg-muted text-muted-foreground border-border",
};

function ClientsPage() {
  const clients = useClients();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const filtered = clients.filter((c) => {
    const matchQ = [c.business, c.owner, c.email, c.city].join(" ").toLowerCase().includes(q.toLowerCase());
    const matchS =
      status === "all"
        ? true
        : status === "expiring"
          ? c.status === "trial" && (c.trialDaysRemaining ?? 99) <= 7 && !c.isTrialExpired
          : status === "expired"
            ? c.status === "expired" || c.isTrialExpired
            : c.status === status;
    return matchQ && matchS;
  });

  return (
    <>
      <PageHeader
        title="Client management"
        description={`${clients.length} businesses across 8 countries`}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-full"><Download className="mr-1.5 h-4 w-4" /> Export</Button>
            <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={() => setAddOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Add client</Button>
          </>
        }
      />
      <AddClientDialog open={addOpen} onOpenChange={setAddOpen} />
      <Card className="rounded-2xl p-4">
        <div className="mb-4 grid gap-2 sm:flex sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by business, owner, email…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="expiring">Trial expiring (≤7d)</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Trial / Expiry</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="group">
                  <TableCell>
                    <Link to="/admin/clients/$id" params={{ id: c.id }} className="font-medium text-foreground hover:text-primary">{c.business}</Link>
                    <div className="text-xs text-muted-foreground">{c.city}</div>
                  </TableCell>
                  <TableCell>{c.owner}</TableCell>
                  <TableCell><Badge variant="secondary" className="rounded-full">{c.type}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-xs">
                    <div>{c.email}</div>
                    <div className="text-muted-foreground">{c.phone}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="rounded-full">{c.plan}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`rounded-full capitalize ${statusStyle[c.isTrialExpired ? "expired" : c.status]}`}>
                      {c.isTrialExpired ? "expired" : c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {c.trialEnd ? (
                      c.isTrialExpired
                        ? <span className="text-destructive">Trial expired</span>
                        : <>{c.trialDaysRemaining}d left · {new Date(c.trialEnd).toLocaleDateString()}</>
                    ) : c.expiry}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link to="/admin/clients/$id" params={{ id: c.id }}>View</Link></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast("Edit dialog would open")}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.success("Logged in as client (demo)")}>Login as client</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toast.success("Account activated")}>Activate</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.warning("Account suspended")}>Suspend</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => { removeClient(c.id); toast.error(`${c.business} removed`); }}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {filtered.length} of {clients.length}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 rounded-full">Previous</Button>
            <Button variant="outline" size="sm" className="h-7 rounded-full">Next</Button>
          </div>
        </div>
      </Card>
    </>
  );
}