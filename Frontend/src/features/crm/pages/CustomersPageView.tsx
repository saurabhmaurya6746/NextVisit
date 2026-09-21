import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLink } from "@/lib/app-nav";
import {
  Search,
  Plus,
  Download,
  Upload,
  Filter,
  LayoutGrid,
  List as ListIcon,
  MessageCircle,
  Phone,
  Edit,
  Users,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  ArrowUpDown,
  Trash2,
  Loader2,
  FileText,
  FileSpreadsheet,
  FileCode,
  ChevronDown,
} from "lucide-react";
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

const VIEW_KEY = "growthos:customers-view";
const sanitizePhoneInput = (v: string) => (v || "").replace(/\D/g, "").slice(0, 10);

export function CustomersPageView() {
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
  } = useQuery({
    queryKey: ["customers", "paginated", page, limit, q, status, sortBy],
    queryFn: () =>
      listPaginatedCustomersApi({
        page,
        limit,
        search: q,
        status,
        sort_by: sortBy,
      }),
  });

  const customersList = paginatedResult?.data || [];
  const totalCount = paginatedResult?.total_count || 0;
  const totalPages = paginatedResult?.total_pages || 1;

  // Add/Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerModel | null>(null);

  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formGender, setFormGender] = useState("");
  const [formBirthDate, setFormBirthDate] = useState("");
  const [formAnniversaryDate, setFormAnniversaryDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // CSV Import State
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const savedView = localStorage.getItem(VIEW_KEY);
    if (savedView === "list" || savedView === "card") {
      setView(savedView);
    }
  }, []);

  const toggleView = (v: "card" | "list") => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  const handleOpenAddModal = () => {
    setEditCustomer(null);
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormGender("");
    setFormBirthDate("");
    setFormAnniversaryDate("");
    setFormNotes("");
    setModalOpen(true);
  };

  const handleOpenEditModal = (c: CustomerModel) => {
    setEditCustomer(c);
    setFormName(c.name);
    setFormPhone(c.phone);
    setFormEmail(c.email || "");
    setFormGender(c.gender || "");
    setFormBirthDate(c.birth_date || "");
    setFormAnniversaryDate(c.anniversary_date || "");
    setFormNotes(c.notes || "");
    setModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      toast.error("Name and Phone are required.");
      return;
    }

    setSubmitting(true);
    try {
      if (editCustomer) {
        await updateCustomerApi(editCustomer.id, {
          name: formName,
          phone: formPhone,
          email: formEmail || undefined,
          gender: formGender || undefined,
          birth_date: formBirthDate || undefined,
          anniversary_date: formAnniversaryDate || undefined,
          notes: formNotes || undefined,
        });
        toast.success("Customer profile updated.");
      } else {
        await createCustomerApi({
          name: formName,
          phone: formPhone,
          email: formEmail || undefined,
          gender: formGender || undefined,
          birth_date: formBirthDate || undefined,
          anniversary_date: formAnniversaryDate || undefined,
          notes: formNotes || undefined,
        });
        toast.success("New customer added.");
      }
      qc.invalidateQueries({ queryKey: ["customers"] });
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save customer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!toDelete) return;
    try {
      await deleteCustomerApi(toDelete.id);
      toast.success(`Deleted ${toDelete.name}`);
      qc.invalidateQueries({ queryKey: ["customers"] });
      setToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete customer");
    }
  };

  const handleExport = async (format: "csv" | "excel" | "json") => {
    try {
      toast.loading(`Preparing ${format.toUpperCase()} export...`, { id: "export" });
      const blob = await exportCustomersApi(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers_export_${new Date().toISOString().slice(0, 10)}.${
        format === "excel" ? "xlsx" : format
      }`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`Customers exported to ${format.toUpperCase()}`, { id: "export" });
    } catch (err: any) {
      toast.error("Export failed: " + err.message, { id: "export" });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    toast.loading("Importing customer list...", { id: "import" });
    try {
      const res: CustomerImportResponse = await importCustomersApi(file);
      toast.success(
        `Imported ${res.imported_count} customers (${res.skipped_count} skipped/duplicates)`,
        { id: "import" }
      );
      qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (err: any) {
      toast.error("Import failed: " + err.message, { id: "import" });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Customer Relationship Management (CRM)"
          subtitle="Directory, purchase history, loyalty tiers & targeted communication."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleOpenAddModal}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Customer
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-1.5 h-4 w-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  <FileText className="mr-2 h-4 w-4 text-emerald-600" /> Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")}>
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" /> Export Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")}>
                  <FileCode className="mr-2 h-4 w-4 text-amber-600" /> Export JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Label htmlFor="import-csv" className="cursor-pointer">
              <Button variant="outline" size="sm" asChild disabled={importing}>
                <span>
                  {importing ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-4 w-4" />
                  )}
                  Import List
                </span>
              </Button>
            </Label>
            <input
              id="import-csv"
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </PageHeader>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-1 flex-wrap items-center gap-2 w-full">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, or email..."
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
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(v) => {
                setSortBy(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest Joined</SelectItem>
                <SelectItem value="oldest">Oldest Joined</SelectItem>
                <SelectItem value="visits">Most Visits</SelectItem>
                <SelectItem value="spent">Highest Spent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 border rounded-lg p-1 bg-card">
            <Button
              variant={view === "card" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => toggleView("card")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => toggleView("list")}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Render */}
        {loading ? (
          view === "card" ? <SkeletonCustomerCards count={6} /> : <SkeletonRows count={6} />
        ) : isError ? (
          <div className="text-center py-12 text-destructive">
            Failed to load customers: {queryErr instanceof Error ? queryErr.message : "Unknown error"}
          </div>
        ) : customersList.length === 0 ? (
          <EmptyState
            title="No Customers Found"
            description={q ? `No matches found for "${q}".` : "Your customer directory is empty."}
            actionLabel="Add Customer"
            onAction={handleOpenAddModal}
          />
        ) : view === "card" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {customersList.map((c) => (
              <CustomerCard
                key={c.id}
                customer={c}
                onEdit={() => handleOpenEditModal(c)}
                onDelete={() => setToDelete(c)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone / Email</TableHead>
                  <TableHead className="text-center">Total Visits</TableHead>
                  <TableHead className="text-right">Total Spent</TableHead>
                  <TableHead className="text-right">Loyalty Points</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customersList.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                            {c.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <AppLink
                            to={`/app/$type/$business/customers/$id`}
                            params={{ id: c.id }}
                            className="hover:underline font-semibold text-sm"
                          >
                            {c.name}
                          </AppLink>
                          {c.notes && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.notes}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5">
                        <p className="font-mono">{c.phone}</p>
                        {c.email && <p className="text-muted-foreground">{c.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{c.visit_count || 0}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{fmt(c.total_spent || 0)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {c.loyalty_points || 0} pts
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                          onClick={() => openWhatsApp(c.phone, `Hello ${c.name}, thank you for choosing us!`)}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenEditModal(c)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setToDelete(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
            <span>
              Showing {customersList.length} of {totalCount} clients (Page {page} of {totalPages})
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 font-semibold text-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Create / Edit Customer Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-lg">
                {editCustomer ? "Edit Customer Profile" : "Add New Customer"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveCustomer} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="c-name">Full Name *</Label>
                <Input
                  id="c-name"
                  placeholder="e.g. Rahul Sharma"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="c-phone">Phone Number *</Label>
                  <Input
                    id="c-phone"
                    placeholder="9876543210"
                    value={formPhone}
                    onChange={(e) => setFormPhone(sanitizePhoneInput(e.target.value))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-gender">Gender</Label>
                  <Select value={formGender} onValueChange={setFormGender}>
                    <SelectTrigger id="c-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="c-email">Email Address</Label>
                <Input
                  id="c-email"
                  type="email"
                  placeholder="rahul@example.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="c-dob">Birth Date</Label>
                  <Input
                    id="c-dob"
                    type="date"
                    value={formBirthDate}
                    onChange={(e) => setFormBirthDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-anniv">Anniversary</Label>
                  <Input
                    id="c-anniv"
                    type="date"
                    value={formAnniversaryDate}
                    onChange={(e) => setFormAnniversaryDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="c-notes">Notes / Preferences</Label>
                <Textarea
                  id="c-notes"
                  placeholder="Preferences, allergies, or internal staff notes..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : editCustomer ? "Update Customer" : "Create Customer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={!!toDelete}
          onOpenChange={(open) => !open && setToDelete(null)}
          title="Delete Customer?"
          description={`Are you sure you want to delete ${toDelete?.name}? This will purge their CRM records.`}
          confirmText="Delete"
          variant="destructive"
          onConfirm={handleDeleteCustomer}
        />
      </div>
    </PageTransition>
  );
}
