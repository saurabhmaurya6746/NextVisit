import { AppLink } from "@/lib/app-nav";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, Plus, Download, Upload, Filter, LayoutGrid, List as ListIcon, MessageCircle, Phone, Edit, Archive, Users, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, ArrowUpDown, Trash2, Loader2, FileText, FileSpreadsheet, FileCode, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomerCard } from "@/components/customer-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  listPaginatedCustomersApi,
  createCustomerApi,
  updateCustomerApi,
  deleteCustomerApi,
  exportCustomersApi,
  importCustomersApi,
  type CustomerModel,
  type CustomerImportResponse,
} from "@/lib/customers-api";

export const Route = createFileRoute("/app/$type/$business/customers/")({ component: CustomersPage });

const VIEW_KEY = "growthos:customers-view";
const sanitizePhoneInput = (v: string) => (v || "").replace(/\D/g, "").slice(0, 10);

function CustomersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [view, setView] = useState<"card" | "list">("card");
  const [toArchive, setToArchive] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CustomerModel | null>(null);

  // Server-side Paginated Query
  const {
    data: paginatedResult,
    isLoading: loading,
    isError,
    error: queryErr,
    refetch: loadCustomers,
  } = useQuery({
    queryKey: ["customers-paginated", { page, limit, q, sortBy, status }],
    queryFn: () =>
      listPaginatedCustomersApi({
        page,
        limit,
        search: q,
        sort: sortBy,
        filter: status,
      }),
    staleTime: 5000,
  });

  const customers = paginatedResult?.items || [];
  const total = paginatedResult?.total || 0;
  const totalPages = paginatedResult?.total_pages || 1;
  const hasNext = paginatedResult?.has_next || false;
  const hasPrevious = paginatedResult?.has_previous || false;

  const fromItem = total > 0 ? (page - 1) * limit + 1 : 0;
  const toItem = Math.min(page * limit, total);

  const error = isError ? (queryErr as any)?.message || "Failed to load customers" : null;

  // Add Customer modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [birthDateInput, setBirthDateInput] = useState("");
  const [anniversaryInput, setAnniversaryInput] = useState("");

  // Edit Customer modal state
  const [editingCustomer, setEditingCustomer] = useState<CustomerModel | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editAnniversary, setEditAnniversary] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "card" || v === "list") setView(v);
  }, []);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const target = toArchive ? customers.find((c) => c.id === toArchive) : null;

  function handleWhatsApp(c: CustomerModel) {
    const firstName = c.name ? c.name.split(" ")[0] : "Customer";
    const msg = `Hi ${firstName} 👋 — thank you for connecting with us!`;
    const success = openWhatsApp(c.phone, msg);
    if (success) {
      logWhatsApp({ customerId: c.id, kind: "manual", message: msg });
      toast.success(`WhatsApp chat opened for ${c.name}`);
    }
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    const cleanPhone = sanitizePhoneInput(phoneInput);
    const cleanEmail = emailInput.trim();

    if (!cleanName) {
      toast.error("Full Name is required.");
      return;
    }
    if (cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setAddLoading(true);
    try {
      const newCust = await createCustomerApi({
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail || undefined,
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
      qc.invalidateQueries({ queryKey: ["customers-paginated"] });
      await loadCustomers();
    } catch (err: any) {
      console.error("[CUSTOMERS] Create error:", err);
      toast.error(err.message || "Failed to create customer");
    } finally {
      setAddLoading(false);
    }
  };

  const openEditModal = (c: CustomerModel) => {
    setEditingCustomer(c);
    setEditName(c.name || "");
    setEditPhone(c.phone || "");
    setEditEmail(c.email || "");
    setEditGender(c.gender || "");
    setEditBirthDate(c.birth_date || "");
    setEditAnniversary(c.anniversary_date || "");
    setEditAddress(c.address || "");
    setEditNotes(c.notes || "");
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    const cleanName = editName.trim();
    const cleanPhone = sanitizePhoneInput(editPhone);
    const cleanEmail = editEmail.trim();

    if (!cleanName) {
      toast.error("Full Name is required.");
      return;
    }
    if (cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setEditLoading(true);
    try {
      await updateCustomerApi(editingCustomer.id, {
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail || undefined,
        gender: editGender || undefined,
        birth_date: editBirthDate || undefined,
        anniversary_date: editAnniversary || undefined,
        address: editAddress.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      toast.success(`Customer ${cleanName} updated!`);
      setEditingCustomer(null);
      qc.invalidateQueries({ queryKey: ["customers-paginated"] });
      await loadCustomers();
    } catch (err: any) {
      console.error("[CUSTOMERS] Update error:", err);
      toast.error(err.message || "Failed to update customer");
    } finally {
      setEditLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!toArchive) return;
    try {
      await updateCustomerApi(toArchive, { is_active: false });
      toast.success("Customer archived");
      qc.invalidateQueries({ queryKey: ["customers-paginated"] });
      await loadCustomers();
    } catch (err: any) {
      console.error("[CUSTOMERS] Archive error:", err);
      toast.error("Failed to archive customer");
    } finally {
      setToArchive(null);
    }
  };

  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const handleExport = async (fmt: "pdf" | "xlsx" | "csv") => {
    setExportingFormat(fmt);
    try {
      await exportCustomersApi({
        search: q,
        filter: status,
        sort: sortBy,
        format: fmt,
      });
      const fmtLabel = fmt === "xlsx" ? "Excel" : fmt.toUpperCase();
      toast.success(`Customers exported as ${fmtLabel} successfully!`);
    } catch (err: any) {
      console.error("[CUSTOMERS] Export error:", err);
      toast.error(err.message || `Failed to export customers as ${fmt}`);
    } finally {
      setExportingFormat(null);
    }
  };

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<CustomerImportResponse | null>(null);

  const handleDownloadSampleTemplate = () => {
    const csvContent = "Customer Name,Phone,Email,Gender,Birthday,Anniversary,Notes\nRahul Sharma,9876543210,rahul@example.com,Male,1990-05-15,2018-11-20,VIP Salon Client\nPriya Patel,9876543211,priya@example.com,Female,1992-08-10,,Regular Client\n";
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers_import_template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Sample template downloaded!");
  };

  const handleDoImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      toast.error("Please select a CSV or Excel file to import.");
      return;
    }
    setImporting(true);
    setImportSummary(null);
    try {
      const res = await importCustomersApi(importFile);
      setImportSummary(res);
      qc.invalidateQueries({ queryKey: ["customers-paginated"] });
      await loadCustomers();
      if (res.imported_count > 0) {
        toast.success(`Successfully imported ${res.imported_count} customers!`);
      } else {
        toast.warning(res.message || "Import completed with no new customers added.");
      }
    } catch (err: any) {
      console.error("[CUSTOMERS] Import error:", err);
      toast.error(err.message || "Failed to import customers file.");
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!toDelete) return;
    try {
      await deleteCustomerApi(toDelete.id);
      toast.success(`Customer ${toDelete.name} deleted successfully!`);
      qc.invalidateQueries({ queryKey: ["customers-paginated"] });
      await loadCustomers();
    } catch (err: any) {
      console.error("[CUSTOMERS] Delete error:", err);
      toast.error(err.message || "Failed to delete customer");
    } finally {
      setToDelete(null);
    }
  };

  return (
    <PageTransition>
      <PageHeader
        title="Customers"
        description={`Showing ${fromItem}–${toItem} of ${total} customers · Server-side Paginated`}
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
            <Button
              variant="outline"
              size="sm"
              className="rounded-full transition-transform hover:scale-105 active:scale-95"
              onClick={() => {
                setImportFile(null);
                setImportSummary(null);
                setIsImportOpen(true);
              }}
            >
              <Upload className="mr-1.5 h-4 w-4" /> Import
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!exportingFormat || loading}
                  className="rounded-full transition-transform hover:scale-105 active:scale-95"
                >
                  {exportingFormat ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-1.5 h-4 w-4" /> Export <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5 shadow-lg">
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer py-2 text-xs font-medium"
                  onClick={() => handleExport("pdf")}
                >
                  <FileText className="mr-2 h-4 w-4 text-rose-500" />
                  <span>PDF Report (.pdf)</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer py-2 text-xs font-medium"
                  onClick={() => handleExport("xlsx")}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-500" />
                  <span>Excel Sheet (.xlsx)</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer py-2 text-xs font-medium"
                  onClick={() => handleExport("csv")}
                >
                  <FileCode className="mr-2 h-4 w-4 text-blue-500" />
                  <span>CSV File (.csv)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="rounded-full gradient-brand text-primary-foreground transition-transform hover:scale-105 active:scale-95" onClick={() => setIsAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add customer
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-2 sm:flex sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone or email…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(val) => {
            setStatus(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-40"><Filter className="mr-1.5 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="VIP">VIP</SelectItem>
            <SelectItem value="New">New</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sortBy}
          onValueChange={(val) => {
            setSortBy(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-44"><ArrowUpDown className="mr-1.5 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="highest_spend">Highest Spend</SelectItem>
            <SelectItem value="most_visits">Most Visits</SelectItem>
            <SelectItem value="name_asc">Name (A-Z)</SelectItem>
            <SelectItem value="name_desc">Name (Z-A)</SelectItem>
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
          action={<Button variant="outline" className="rounded-full" onClick={() => loadCustomers()}>Retry</Button>}
        />
      ) : customers.length === 0 ? (
        <EmptyState
          title="No customers found"
          description={q ? "No customers match your search query." : "No customers yet. Add your first customer."}
          icon={<Users className="h-7 w-7" />}
          action={<Button variant="outline" className="rounded-full" onClick={() => { setQ(""); setStatus("all"); setPage(1); }}>Clear search</Button>}
        />
      ) : view === "card" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {customers.map((c, i) => (
            <CustomerCard
              key={c.id}
              c={c}
              index={i}
              onEdit={() => openEditModal(c)}
              onDelete={() => setToDelete(c)}
              onWhatsApp={() => handleWhatsApp(c)}
            />
          ))}
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
                {customers.map((c) => (
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
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" title="Edit Customer" onClick={() => openEditModal(c)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive" title="Delete Customer" onClick={() => setToDelete(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      )}

      {/* SERVER-SIDE PAGINATION CONTROLS */}
      {!loading && !error && total > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:flex-row">
          <p className="text-xs text-muted-foreground font-medium">
            Showing <strong className="text-foreground">{fromItem}–{toItem}</strong> of <strong className="text-foreground">{total}</strong> customers
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg px-2 text-xs"
              onClick={() => setPage(1)}
              disabled={page === 1}
              title="First Page"
            >
              <ChevronsLeft className="h-3.5 w-3.5 mr-1" /> First
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg px-2.5 text-xs"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPrevious}
              title="Previous Page"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
            </Button>
            <span className="px-3 text-xs font-semibold text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg px-2.5 text-xs"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={!hasNext}
              title="Next Page"
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg px-2 text-xs"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              title="Last Page"
            >
              Last <ChevronsRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
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
              <Input
                id="cust-phone"
                placeholder="10-digit mobile number"
                value={phoneInput}
                onChange={(e) => setPhoneInput(sanitizePhoneInput(e.target.value))}
                maxLength={10}
                required
              />
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

      {/* Edit Customer Modal */}
      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer Profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateCustomer} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-cust-name">Full Name *</Label>
              <Input id="edit-cust-name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-cust-phone">Phone Number *</Label>
              <Input
                id="edit-cust-phone"
                value={editPhone}
                onChange={(e) => setEditPhone(sanitizePhoneInput(e.target.value))}
                maxLength={10}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-cust-email">Email Address</Label>
              <Input id="edit-cust-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-cust-gender">Gender</Label>
              <Select value={editGender} onValueChange={setEditGender}>
                <SelectTrigger id="edit-cust-gender" className="w-full">
                  <SelectValue placeholder="Select gender..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                  <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-cust-dob">Birth Date</Label>
                <Input id="edit-cust-dob" type="date" value={editBirthDate} onChange={(e) => setEditBirthDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-cust-anniv">Anniversary</Label>
                <Input id="edit-cust-anniv" type="date" value={editAnniversary} onChange={(e) => setEditAnniversary(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-cust-address">Address</Label>
              <Input id="edit-cust-address" placeholder="e.g. 123 Main Street" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-cust-notes">Customer Notes</Label>
              <Textarea id="edit-cust-notes" placeholder="Preferences, allergies, or VIP notes..." value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setEditingCustomer(null)}>Cancel</Button>
              <Button type="submit" disabled={editLoading} className="gradient-brand text-primary-foreground">
                {editLoading ? "Updating..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toArchive}
        onOpenChange={(o) => !o && setToArchive(null)}
        title="Archive Customer?"
        description="They will be hidden from active customer lists. You can restore them anytime."
        confirmLabel="Archive customer"
        destructive
        onConfirm={handleArchive}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name || "Customer"}?`}
        description="Are you sure you want to permanently delete this customer record from the backend database? This action cannot be undone."
        confirmLabel="Delete customer"
        destructive
        onConfirm={handleDeleteCustomer}
      />

      {/* Import Customers Modal */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Customers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-3 text-xs">
              <span className="text-muted-foreground">Need a sample format? Download our pre-formatted CSV template:</span>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs rounded-full" onClick={handleDownloadSampleTemplate}>
                <Download className="mr-1 h-3 w-3" /> Template
              </Button>
            </div>

            <form onSubmit={handleDoImport} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="import-file-input">Select CSV or Excel File (.csv, .xlsx)</Label>
                <Input
                  id="import-file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  disabled={importing}
                />
              </div>

              {importFile && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-primary font-medium flex items-center justify-between">
                  <span>Selected file: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}

              {importSummary && (
                <div className="space-y-3 rounded-xl border bg-card p-3.5 text-xs">
                  <div className="font-semibold text-foreground border-b pb-1.5">Import Results Summary</div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-lg bg-muted p-2">
                      <div className="text-muted-foreground">Total</div>
                      <div className="text-sm font-bold text-foreground">{importSummary.total_rows}</div>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 text-emerald-600 p-2">
                      <div className="font-medium">Imported</div>
                      <div className="text-sm font-bold">{importSummary.imported_count}</div>
                    </div>
                    <div className="rounded-lg bg-amber-500/10 text-amber-600 p-2">
                      <div className="font-medium">Duplicates</div>
                      <div className="text-sm font-bold">{importSummary.duplicate_count}</div>
                    </div>
                    <div className="rounded-lg bg-rose-500/10 text-rose-600 p-2">
                      <div className="font-medium">Failed</div>
                      <div className="text-sm font-bold">{importSummary.failed_count}</div>
                    </div>
                  </div>

                  {importSummary.errors && importSummary.errors.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="font-medium text-destructive">Skipped / Failed Row Details:</div>
                      <div className="max-h-36 overflow-y-auto rounded-lg border bg-background p-2 space-y-1 text-[11px]">
                        {importSummary.errors.map((err, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 border-b last:border-0 pb-1 text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Row {err.row}</Badge>
                            <span>{err.field ? `[${err.field}]: ` : ""}{err.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsImportOpen(false)}>
                  Close
                </Button>
                <Button type="submit" disabled={importing || !importFile} className="gradient-brand text-primary-foreground">
                  {importing ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Importing...
                    </>
                  ) : (
                    "Start Import"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}