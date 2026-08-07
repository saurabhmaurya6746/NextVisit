import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { SkeletonRows } from "@/components/skeletons";
import { PageTransition } from "@/components/page-transition";
import {
  Plus,
  Edit2,
  UserX,
  AlertTriangle,
  Users,
  Key,
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";
import { sanitizePhoneInput } from "@/lib/validation";
import { cn } from "@/lib/utils";
import {
  listStaffApi,
  createStaffApi,
  updateStaffApi,
  toggleStaffStatusApi,
  resetStaffPasswordApi,
  deleteStaffApi,
  getNextStaffLoginIdApi,
  type StaffMember,
} from "@/lib/staff-api";
import { getSubscriptionUsageApi } from "@/lib/subscription-api";
import { SubscriptionUpgradeModal } from "@/components/subscription-upgrade-modal";

export const Route = createFileRoute("/app/$type/$business/team")({ component: TeamPage });

interface PermissionModule {
  key: string;
  label: string;
}

interface PermissionGroup {
  name: string;
  modules: PermissionModule[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    name: "Workspace",
    modules: [
      { key: "dashboard", label: "Dashboard" },
      { key: "setup", label: "Restaurant Setup" },
      { key: "tables", label: "Tables" },
      { key: "orders", label: "Orders" },
      { key: "menu", label: "Menu" },
      { key: "customers", label: "Customers" },
      { key: "staff", label: "Staff" },
      { key: "revenue", label: "Revenue" },
    ],
  },
  {
    name: "Automations",
    modules: [
      { key: "welcome", label: "Welcome" },
      { key: "birthday", label: "Birthday Campaigns" },
      { key: "anniversary", label: "Anniversary Campaigns" },
      { key: "festivals", label: "Festival Campaigns" },
      { key: "vip", label: "VIP Customers" },
      { key: "whatsapp_campaigns", label: "WhatsApp Campaigns" },
      { key: "customer_recovery", label: "Customer Recovery" },
    ],
  },
  {
    name: "Growth",
    modules: [
      { key: "coupons", label: "Coupons" },
      { key: "loyalty", label: "Loyalty Program" },
      { key: "review_booster", label: "Review Booster" },
      { key: "templates", label: "Templates" },
    ],
  },
  {
    name: "Insights",
    modules: [
      { key: "reports", label: "Reports" },
      { key: "whatsapp_history", label: "WhatsApp History" },
      { key: "calendar", label: "Calendar" },
    ],
  },
  {
    name: "Administration",
    modules: [
      { key: "subscription", label: "Subscription" },
      { key: "settings", label: "Settings" },
    ],
  },
];

export function TeamPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal States
  const [createOpen, setCreateOpen] = useState(false);
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [resetMember, setResetMember] = useState<StaffMember | null>(null);
  const [deleteMember, setDeleteMember] = useState<StaffMember | null>(null);

  // Form States
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [designation, setDesignation] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    "dashboard",
    "orders",
    "tables",
    "menu",
    "customers",
  ]);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset Password Modal State
  const [resetPass, setResetPass] = useState("");
  const [resetConfirmPass, setResetConfirmPass] = useState("");
  const [resetting, setResetting] = useState(false);
  const [usage, setUsage] = useState<any>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const [data, usageData] = await Promise.all([
        listStaffApi(search, statusFilter, page, 10),
        getSubscriptionUsageApi().catch(() => null),
      ]);
      setStaffList(data.items || []);
      setTotalPages(data.pages || 1);
      if (usageData) setUsage(usageData);
    } catch (err: any) {
      toast.error(err.message || "Failed to load staff members");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // Dynamic Live Preview of Staff Login ID as owner types Name
  useEffect(() => {
    if (!createOpen || editMember) return;
    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        const nextId = await getNextStaffLoginIdApi(name);
        if (!isCancelled) setLoginId(nextId);
      } catch {
        // Keep current preview
      }
    }, 200);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [name, createOpen, editMember]);

  function generateSecurePassword() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$!";
    let pass = "";
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
    setConfirmPassword(pass);
    toast.success("Secure password generated!");
  }

  async function handleOpenCreate() {
    setEditMember(null);
    setName("");
    setPhone("");
    setEmail("");
    setDesignation("");
    setPassword("");
    setConfirmPassword("");
    setStatus("ACTIVE");
    setSelectedPermissions(["dashboard", "orders", "tables", "menu", "customers"]);
    setLoginId("RST-STF-AUTO");
    setCreateOpen(true);

    try {
      const nextId = await getNextStaffLoginIdApi();
      setLoginId(nextId);
    } catch {
      setLoginId("RST-STF-AUTO");
    }
  }

  function handleOpenEdit(m: StaffMember) {
    setEditMember(m);
    setName(m.name);
    setPhone(m.phone || "");
    setEmail(m.email || "");
    setDesignation(m.designation || "");
    setLoginId(m.login_id || "");
    setPassword("");
    setConfirmPassword("");
    setStatus((m.status?.toUpperCase() as "ACTIVE" | "INACTIVE") || "ACTIVE");
    setSelectedPermissions(m.permissions || []);
    setCreateOpen(true);
  }

  function togglePermission(key: string) {
    if (status === "INACTIVE") {
      toast.error("Cannot assign permissions if account is INACTIVE.");
      return;
    }
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function selectAllGroup(modules: PermissionModule[]) {
    if (status === "INACTIVE") {
      toast.error("Cannot assign permissions if account is INACTIVE.");
      return;
    }
    const keys = modules.map((m) => m.key);
    setSelectedPermissions((prev) => Array.from(new Set([...prev, ...keys])));
  }

  function clearGroup(modules: PermissionModule[]) {
    const keys = modules.map((m) => m.key);
    setSelectedPermissions((prev) => prev.filter((k) => !keys.includes(k)));
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    const cleanPhone = sanitizePhoneInput(phone);
    if (!name.trim()) {
      toast.error("Full Name is required.");
      return;
    }
    if (cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (!editMember) {
      if (!password) {
        toast.error("Password is required for new staff accounts.");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }
    } else if (password && password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      if (editMember) {
        await updateStaffApi(editMember.id, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          designation: designation.trim() || undefined,
          password: password || undefined,
          status,
          permissions: status === "INACTIVE" ? [] : selectedPermissions,
        });
        toast.success(`Staff member '${name}' updated successfully!`);
      } else {
        const created = await createStaffApi({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          designation: designation.trim() || undefined,
          password,
          status,
          permissions: status === "INACTIVE" ? [] : selectedPermissions,
        });
        toast.success(`Staff account for '${name}' created! Login ID: ${created.login_id}`);
      }
      setCreateOpen(false);
      loadStaff();
    } catch (err: any) {
      toast.error(err.message || "Failed to save staff member");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(m: StaffMember) {
    const nextStatus = m.status?.toUpperCase() === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await toggleStaffStatusApi(m.id, nextStatus as "ACTIVE" | "INACTIVE");
      toast.success(`Account status for ${m.name} changed to ${nextStatus}`);
      loadStaff();
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle status");
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetMember || !resetPass) return;
    if (resetPass !== resetConfirmPass) {
      toast.error("Passwords do not match.");
      return;
    }

    setResetting(true);
    try {
      await resetStaffPasswordApi(resetMember.id, resetPass);
      toast.success(`Password reset successfully for ${resetMember.name}!`);
      setResetMember(null);
      setResetPass("");
      setResetConfirmPass("");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setResetting(false);
    }
  }

  async function handleDeleteStaff() {
    if (!deleteMember) return;
    try {
      await deleteStaffApi(deleteMember.id);
      toast.success(`Staff member '${deleteMember.name}' deleted.`);
      setDeleteMember(null);
      loadStaff();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete staff member");
    }
  }

  const staffUsage = usage?.staff_usage;
  const isLimitReached = staffUsage?.limit_reached || false;

  return (
    <PageTransition>
      <PageHeader
        title="Staff & Team Permissions"
        description="Manage staff login credentials, status, and module permissions."
        actions={
          <Button
            size="sm"
            disabled={isLimitReached}
            className="rounded-full gradient-brand text-primary-foreground transition-transform hover:scale-105"
            onClick={handleOpenCreate}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Team Member
          </Button>
        }
      />

      {/* Staff Usage Card & Limit Banner */}
      {staffUsage && (
        <Card className="rounded-2xl border shadow-sm mb-4 bg-muted/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Staff Account Usage</p>
                <p className="text-lg font-bold text-foreground font-display mt-0.5">
                  {staffUsage.active_count} / {staffUsage.max_count} Staff Accounts Used
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="rounded-full px-3 py-1 font-semibold text-xs border-primary/30 text-primary">
                  {staffUsage.remaining_slots} Staff Slots Available
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1 font-semibold text-xs">
                  {staffUsage.plan_name} PLAN
                </Badge>
              </div>
            </div>

            {isLimitReached && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    <strong>Limit Reached:</strong> You have reached your staff account limit. Upgrade your subscription to add more staff.
                  </span>
                </div>
                <Button size="sm" variant="outline" className="rounded-full text-xs font-semibold shrink-0" onClick={() => setUpgradeModalOpen(true)}>
                  Upgrade Subscription
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <SubscriptionUpgradeModal open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen} />

      {/* Staff Roster Card */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="font-display text-base">Team Members Roster</CardTitle>
            <CardDescription>Accounts created for staff members with auto-generated Login IDs.</CardDescription>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search staff name, login ID, phone..."
                className="pl-9 rounded-xl text-xs"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-32 rounded-xl text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonRows rows={5} cols={5} />
          ) : staffList.length === 0 ? (
            <EmptyState
              title="No Team Members Found"
              description="Click 'Add Team Member' to create staff accounts with auto-generated Login IDs."
              icon={<Users className="h-8 w-8 text-muted-foreground" />}
              action={
                <Button className="rounded-full gradient-brand text-primary-foreground" onClick={handleOpenCreate}>
                  <Plus className="mr-1.5 h-4 w-4" /> Create Staff Account
                </Button>
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Name & Designation</TableHead>
                    <TableHead>Staff Login ID</TableHead>
                    <TableHead>Contact (Phone & Email)</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffList.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-semibold text-sm text-foreground">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.designation || "Staff Member"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs font-bold text-primary border-primary/30 bg-primary/5">
                          {m.login_id || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{m.phone || "—"}</div>
                        <div className="text-muted-foreground">{m.email || "No email"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {m.permissions && m.permissions.length > 0 ? (
                            m.permissions.slice(0, 3).map((p) => (
                              <Badge key={p} variant="secondary" className="rounded-full text-[10px] capitalize">
                                {p}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No permissions</span>
                          )}
                          {m.permissions && m.permissions.length > 3 && (
                            <Badge variant="outline" className="rounded-full text-[10px]">
                              +{m.permissions.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full text-[10px] capitalize",
                            m.status?.toUpperCase() === "ACTIVE"
                              ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                              : "border-rose-500/40 text-rose-600 bg-rose-500/10"
                          )}
                        >
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.last_login ? new Date(m.last_login).toLocaleString() : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full"
                            title="Edit Staff & Permissions"
                            onClick={() => handleOpenEdit(m)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full text-amber-600"
                            title="Reset Password"
                            onClick={() => {
                              setResetMember(m);
                              setResetPass("");
                              setResetConfirmPass("");
                            }}
                          >
                            <Key className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full"
                            title="Toggle Active / Inactive"
                            onClick={() => handleToggleStatus(m)}
                          >
                            {m.status?.toUpperCase() === "ACTIVE" ? (
                              <XCircle className="h-3.5 w-3.5 text-rose-500" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full text-destructive"
                            title="Delete Staff Account"
                            onClick={() => setDeleteMember(m)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                <div>Page {page} of {totalPages}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-full text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Staff Account Form & Grouped Permissions Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {editMember ? `Edit Staff — ${editMember.name}` : "Create Staff Account & Assign Permissions"}
            </DialogTitle>
            <DialogDescription>
              Auto-generated login ID, status, and module permissions for this staff member.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitForm} className="space-y-6 pt-2">
            {/* Account Details Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Full Name *</Label>
                <Input placeholder="e.g. Vikram Singh" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Phone Number *</Label>
                <Input
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                  maxLength={10}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Email Address (Optional)</Label>
                <Input type="email" placeholder="vikram@restaurant.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Designation</Label>
                <Input placeholder="e.g. Cashier, Head Waiter, Manager" value={designation} onChange={(e) => setDesignation(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {/* Auto-Generated Login ID (Read-Only Live Preview) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Lock className="h-3 w-3 text-muted-foreground" /> Staff Login ID
                  </Label>
                  <Badge variant="secondary" className="rounded-full text-[9px] bg-primary/10 text-primary border-primary/20">
                    Auto-Generated
                  </Badge>
                </div>
                <Input
                  readOnly
                  tabIndex={-1}
                  className="bg-muted/40 font-mono font-bold text-primary cursor-not-allowed select-all"
                  value={loginId}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Password {editMember && "(Leave blank to keep current)"}</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!editMember}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Confirm Password</Label>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={!editMember && Boolean(password)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/20">
              <div>
                <Label className="text-xs font-semibold">Account Status</Label>
                <p className="text-[10px] text-muted-foreground">Inactive staff cannot log in or hold active permissions.</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full text-xs gap-1"
                  onClick={generateSecurePassword}
                >
                  <Key className="h-3.5 w-3.5 text-primary" /> Generate Secure Password
                </Button>
                <Select value={status} onValueChange={(val: "ACTIVE" | "INACTIVE") => setStatus(val)}>
                  <SelectTrigger className="w-32 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* GROUPED PERMISSIONS SECTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" /> Module Access Permissions
                  </h3>
                  <p className="text-xs text-muted-foreground">Check the modules this staff member is allowed to see and manage.</p>
                </div>
                <Badge variant="outline" className="rounded-full text-xs">
                  {selectedPermissions.length} Modules Granted
                </Badge>
              </div>

              {PERMISSION_GROUPS.map((group) => (
                <Card key={group.name} className="rounded-xl border bg-card shadow-none">
                  <CardHeader className="py-2 px-4 flex flex-row items-center justify-between border-b bg-muted/30">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] rounded-full px-2"
                        onClick={() => selectAllGroup(group.modules)}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] rounded-full px-2 text-destructive hover:bg-destructive/10"
                        onClick={() => clearGroup(group.modules)}
                      >
                        Clear All
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {group.modules.map((m) => {
                      const isChecked = selectedPermissions.includes(m.key);
                      return (
                        <label
                          key={m.key}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-all text-xs",
                            isChecked ? "border-primary bg-primary/5 font-semibold text-foreground" : "bg-muted/10 text-muted-foreground"
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            disabled={status === "INACTIVE"}
                            onCheckedChange={() => togglePermission(m.key)}
                          />
                          <span className="truncate">{m.label}</span>
                        </label>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="rounded-full gradient-brand text-primary-foreground font-semibold">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editMember ? "Save Changes" : "Create Staff Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={!!resetMember} onOpenChange={(o) => !o && setResetMember(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" /> Reset Password — {resetMember?.name}
            </DialogTitle>
            <DialogDescription>Set a new password for staff login ID <strong className="font-mono text-primary">{resetMember?.login_id}</strong>.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">New Password *</Label>
              <PasswordInput placeholder="••••••••" value={resetPass} onChange={(e) => setResetPass(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Confirm New Password *</Label>
              <PasswordInput placeholder="••••••••" value={resetConfirmPass} onChange={(e) => setResetConfirmPass(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setResetMember(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={resetting} className="rounded-full gradient-brand text-primary-foreground font-semibold">
                {resetting ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Staff Confirmation Modal */}
      <Dialog open={!!deleteMember} onOpenChange={(o) => !o && setDeleteMember(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete Staff Account
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            Are you sure you want to permanently delete staff account <strong className="text-foreground">{deleteMember?.name}</strong> (Login ID: {deleteMember?.login_id})?
          </div>
          <DialogFooter className="mt-4 flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setDeleteMember(null)}>
              Cancel
            </Button>
            <Button variant="destructive" className="rounded-full" onClick={handleDeleteStaff}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}