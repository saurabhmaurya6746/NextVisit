import { AppLink } from "@/lib/app-nav";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Download, Upload, Filter, LayoutGrid, List as ListIcon, MessageCircle, Phone, Edit, Archive, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerCard } from "@/components/customer-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageTransition } from "@/components/page-transition";
import { SkeletonCustomerCards, SkeletonRows } from "@/components/skeletons";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmt } from "@/lib/currency";
import { logWhatsApp } from "@/lib/whatsapp-history";
import { openWhatsApp } from "@/lib/celebration-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listCustomersApi,
  createCustomerApi,
  updateCustomerApi,
  type CustomerModel,
} from "@/lib/customers-api";

export const Route = createFileRoute("/app/$type/$business/customers/")({ component: CustomersPage });

const VIEW_KEY = "growthos:customers-view";

function CustomersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"card" | "list">("card");
  const [toArchive, setToArchive] = useState<string | null>(null);

  // Live backend data states
  const [customers, setCustomers] = useState<CustomerModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Customer modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [birthDateInput, setBirthDateInput] = useState("");
  const [anniversaryInput, setAnniversaryInput] = useState("");

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCustomersApi();
      setCustomers(data);
    } catch (err: any) {
      console.error("[CUSTOMERS] Failed to fetch customers:", err);
      setError(err.message || "Failed to load customers from backend.");
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "card" || v === "list") setView(v);
  }, []);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const activeCustomers = customers.filter((c) => c.isActive);

  const filtered = activeCustomers.filter((c) => {
    const matchesStatus = status === "all" || c.status === status;
    const matchesQuery = c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q);
    return matchesStatus && matchesQuery;
  });

  const target = toArchive ? customers.find((c) => c.id === toArchive) : null;

  function handleWhatsApp(c: CustomerModel) {
    const msg = `Hi ${c.name.split(" ")[0]} 👋 — quick note from Aroma Bistro.`;
    openWhatsApp(c.phone, msg);
    logWhatsApp({ customerId: c.id, kind: "manual", message: msg });
    toast.success(`WhatsApp opened for ${c.name}`);
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || !phoneInput.trim()) {
      toast.error("Name and Phone are required.");
      return;
    }
    setAddLoading(true);
    try {
      const newCust = await createCustomerApi({
        name: nameInput.trim(),
        phone: phoneInput.trim(),
        email: emailInput.trim() || undefined,
        birth_date: birthDateInput || undefined,
        anniversary_date: anniversaryInput || undefined,
      });
      toast.success(`Customer ${newCust.name} created successfully!`);
      setIsAddOpen(false);
      setNameInput("");
      setPhoneInput("");
      setEmailInput("");
      setBirthDateInput("");
      setAnniversaryInput("");
      await loadCustomers();
    } catch (err: any) {
      console.error("[CUSTOMERS] Create error:", err);
      toast.error(err.message || "Failed to create customer");
    } finally {
      setAddLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!toArchive) return;
    try {
      await updateCustomerApi(toArchive, { is_active: false });
      toast.success("Customer archived");
      setCustomers((prev) => prev.filter((c) => c.id !== toArchive));
    } catch (err: any) {
      console.error("[CUSTOMERS] Archive error:", err);
      toast.error("Failed to archive customer");
    } finally {
      setToArchive(null);
    }
  };

  return (
    <PageTransition>
      <PageHeader
        title="Customers"
        description={`${activeCustomers.length} active customer${activeCustomers.length === 1 ? "" : "s"} · Live backend connected`}
        actions={
          <>
            <div className="inline-flex rounded-full border p-0.5">
              <button
                type="button"
                onClick={() => setView("card")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
                  view === "card" ? "gradient-brand text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Card
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
                  view === "list" ? "gradient-brand text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ListIcon className="h-3.5 w-3.5" /> List
              </button>
            </div>
            <Button variant="outline" size="sm" className="rounded-full transition-transform hover:scale-105 active:scale-95" onClick={() => toast("CSV imported")}><Upload className="mr-1.5 h-4 w-4" /> Import</Button>
            <Button variant="outline" size="sm" className="rounded-full transition-transform hover:scale-105 active:scale-95" onClick={() => toast("Exported")}><Download className="mr-1.5 h-4 w-4" /> Export</Button>
            <Button size="sm" className="rounded-full gradient-brand text-primary-foreground transition-transform hover:scale-105 active:scale-95" onClick={() => setIsAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add customer
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-2 sm:flex sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-40"><Filter className="mr-1.5 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            <SelectItem value="VIP">VIP</SelectItem>
            <SelectItem value="Regular">Regular</SelectItem>
            <SelectItem value="New">New</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        view === "card" ? <SkeletonCustomerCards count={6} /> : <SkeletonRows rows={6} cols={7} />
      ) : error ? (
        <EmptyState
          title="Error loading customers"
          description={error}
          icon={<Users className="h-7 w-7 text-destructive" />}
          action={<Button variant="outline" className="rounded-full" onClick={loadCustomers}>Retry</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No customers match your filters"
          description="Try clearing filters or adding a new customer."
          icon={<Users className="h-7 w-7" />}
          action={<Button variant="outline" className="rounded-full" onClick={() => { setQ(""); setStatus("all"); }}>Clear filters</Button>}
        />
      ) : view === "card" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c, i) => <CustomerCard key={c.id} c={c} index={i} />)}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="rounded-2xl border bg-card shadow-elegant overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Birthday</TableHead>
                  <TableHead className="hidden md:table-cell">Anniversary</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Visit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="group">
                    <TableCell>
                      <AppLink path="customers/$id" params={{ id: c.id }} className="flex items-center gap-2 font-medium hover:text-primary">
                        <Avatar className="h-8 w-8"><AvatarFallback className="gradient-brand text-primary-foreground text-xs">{c.initials}</AvatarFallback></Avatar>
                        {c.name}
                      </AppLink>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{c.birthday}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{c.anniversary}</TableCell>
                    <TableCell className="text-right font-medium">{c.visits}</TableCell>
                    <TableCell className="text-right font-medium">{c.points}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(c.spent)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{c.lastVisit}</TableCell>
                    <TableCell><Badge variant="outline" className="rounded-full text-[10px]">{c.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" title="WhatsApp" onClick={() => handleWhatsApp(c)}><MessageCircle className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" title="Call" onClick={() => window.open(`tel:${c.phone.replace(/[^\d+]/g, "")}`)}><Phone className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" title="Edit" onClick={() => toast("Edit customer functionality coming soon")}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive" title="Archive" onClick={() => setToArchive(c.id)}><Archive className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      )}

      {/* Add Customer Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCustomer} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cust-name">Full Name *</Label>
              <Input id="cust-name" placeholder="e.g. Ananya Roy" value={nameInput} onChange={(e) => setNameInput(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-phone">Phone Number *</Label>
              <Input id="cust-phone" placeholder="e.g. +91 98765 43210" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-email">Email Address</Label>
              <Input id="cust-email" type="email" placeholder="e.g. ananya@example.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cust-dob">Birth Date</Label>
                <Input id="cust-dob" type="date" value={birthDateInput} onChange={(e) => setBirthDateInput(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust-anniv">Anniversary</Label>
                <Input id="cust-anniv" type="date" value={anniversaryInput} onChange={(e) => setAnniversaryInput(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addLoading} className="gradient-brand text-primary-foreground">
                {addLoading ? "Saving..." : "Create Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toArchive}
        onOpenChange={(o) => !o && setToArchive(null)}
        title={`Archive ${target?.name ?? "customer"}?`}
        description="They will be hidden from active customer lists. You can restore them anytime."
        confirmLabel="Archive customer"
        destructive
        onConfirm={handleArchive}
      />
    </PageTransition>
  );
}