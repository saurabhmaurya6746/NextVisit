import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { SkeletonRows } from "@/components/skeletons";
import { PageTransition } from "@/components/page-transition";
import { Plus, Edit2, UserX, AlertTriangle, Users, Phone, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listStaffApi,
  createStaffApi,
  updateStaffApi,
  deactivateStaffApi,
  type StaffMember,
} from "@/lib/staff-api";

export const Route = createFileRoute("/app/$type/$business/team")({ component: TeamPage });

export function TeamPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Staff Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createRole, setCreateRole] = useState("STAFF");
  const [createDesignation, setCreateDesignation] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit Modal State
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("STAFF");
  const [editDesignation, setEditDesignation] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [updating, setUpdating] = useState(false);

  // Deactivate Modal State
  const [confirmDeactivateMember, setConfirmDeactivateMember] = useState<StaffMember | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listStaffApi();
      setStaffList(data);
    } catch (err: any) {
      console.error("[STAFF] Error loading staff members:", err);
      setError(err.message || "Failed to load team members from server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      toast.error("Full Name is required.");
      return;
    }
    if (!createPhone.trim()) {
      toast.error("Phone Number is required.");
      return;
    }

    setCreating(true);
    try {
      // Under-the-hood values for backend payload compatibility
      const cleanPhoneDigits = createPhone.replace(/\D/g, "") || Date.now().toString();
      const generatedEmail = createEmail.trim()
        ? createEmail.trim()
        : `staff_${cleanPhoneDigits}@example.com`;
      const generatedPassword = `StaffPass@123`;

      // Include designation/specialization in name if present
      const finalName = createDesignation.trim()
        ? `${createName.trim()} (${createDesignation.trim()})`
        : createName.trim();

      await createStaffApi({
        name: finalName,
        email: generatedEmail,
        password: generatedPassword,
        role: createRole,
      });

      toast.success("Team member added successfully!");
      setCreateOpen(false);
      setCreateName("");
      setCreatePhone("");
      setCreateRole("STAFF");
      setCreateDesignation("");
      setCreateEmail("");
      await loadStaff();
    } catch (err: any) {
      console.error("[STAFF] Create error:", err);
      toast.error(err.message || "Failed to add team member.");
    } finally {
      setCreating(false);
    }
  };

  const handleEditOpen = (member: StaffMember) => {
    setEditMember(member);

    // Extract name and designation from "Name (Designation)" string format
    const match = member.name.match(/^(.*?)(?:\s*\((.*?)\))?$/);
    const rawName = match?.[1]?.trim() || member.name;
    const rawDesignation = match?.[2]?.trim() || "";

    setEditName(rawName);
    setEditDesignation(rawDesignation);
    setEditRole(member.role || "STAFF");

    // Clean dummy email for UI preview
    const isDummyEmail = member.email?.endsWith("@example.com") || member.email?.endsWith("@business.local");
    setEditEmail(isDummyEmail ? "" : member.email || "");

    // Extract phone number from email pattern if generated
    const phoneFromEmail = member.email?.match(/staff_(\d+)/)?.[1] || "";
    setEditPhone(phoneFromEmail ? `+${phoneFromEmail}` : "");
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    if (!editName.trim()) {
      toast.error("Full Name is required.");
      return;
    }

    setUpdating(true);
    try {
      const cleanPhoneDigits = editPhone.replace(/\D/g, "") || Date.now().toString();
      const payloadEmail = editEmail.trim()
        ? editEmail.trim()
        : `staff_${cleanPhoneDigits}@example.com`;

      const finalName = editDesignation.trim()
        ? `${editName.trim()} (${editDesignation.trim()})`
        : editName.trim();

      await updateStaffApi(editMember.id, {
        name: finalName,
        email: payloadEmail,
        role: editRole,
      });

      toast.success("Team member updated successfully!");
      setEditMember(null);
      await loadStaff();
    } catch (err: any) {
      console.error("[STAFF] Update error:", err);
      toast.error(err.message || "Failed to update team member.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!confirmDeactivateMember) return;

    setDeactivating(true);
    try {
      await deactivateStaffApi(confirmDeactivateMember.id);
      toast.success(`${confirmDeactivateMember.name} has been deactivated.`);
      setConfirmDeactivateMember(null);
      await loadStaff();
    } catch (err: any) {
      console.error("[STAFF] Deactivate error:", err);
      toast.error(err.message || "Failed to deactivate team member.");
    } finally {
      setDeactivating(false);
    }
  };

  const getInitials = (name: string) =>
    (name || "Staff")
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <PageTransition>
      <PageHeader
        title="Staff Management"
        description="Manage team members, roles, and access permissions."
        actions={
          <Button
            size="sm"
            className="rounded-full gradient-brand text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Staff / Invite
          </Button>
        }
      />

      {loading ? (
        <Card className="rounded-2xl p-6">
          <SkeletonRows rows={5} cols={4} />
        </Card>
      ) : error ? (
        <EmptyState
          title="Error loading team"
          description={error}
          icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
          action={
            <Button variant="outline" className="rounded-full" onClick={loadStaff}>
              Retry
            </Button>
          }
        />
      ) : staffList.length === 0 ? (
        <EmptyState
          title="No team members found"
          description="Add your employees to grant them access to NextVisit."
          icon={<Users className="h-8 w-8 text-muted-foreground" />}
          action={
            <Button
              className="rounded-full gradient-brand text-primary-foreground"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Team Member
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {staffList.map((m) => (
            <Card key={m.id} className="rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-glow">
              <CardContent className="p-4">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="gradient-brand text-primary-foreground font-semibold">
                      {getInitials(m.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-sm">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge variant="secondary" className="rounded-full text-[10px] uppercase font-mono">
                        {m.role}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full text-[10px] capitalize",
                          m.is_active ? "border-success/40 text-success" : "border-destructive/40 text-destructive"
                        )}
                      >
                        {m.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  {m.role !== "OWNER" && (
                    <div className="flex flex-col gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
                        onClick={() => handleEditOpen(m)}
                        title="Edit Staff Member"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-full"
                        onClick={() => setConfirmDeactivateMember(m)}
                        title="Deactivate Staff Member"
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Staff Member Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Add Team Member
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateStaff} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name">Full Name *</Label>
              <Input
                id="staff-name"
                placeholder="e.g. Vikram Singh"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-phone">Phone Number *</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="staff-phone"
                  type="tel"
                  className="pl-9"
                  placeholder="+91 98765 43210"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-role">Role / Access Level *</Label>
              <Select value={createRole} onValueChange={setCreateRole}>
                <SelectTrigger id="staff-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">STAFF (Regular Access)</SelectItem>
                  <SelectItem value="MANAGER">MANAGER (Advanced Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-designation">Designation / Specialization (Optional)</Label>
              <div className="relative">
                <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="staff-designation"
                  className="pl-9"
                  placeholder="e.g. Senior Stylist, Head Chef, Billing Counter"
                  value={createDesignation}
                  onChange={(e) => setCreateDesignation(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-email">Email Address (Optional)</Label>
              <Input
                id="staff-email"
                type="email"
                placeholder="vikram@example.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
              />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating} className="rounded-full gradient-brand text-primary-foreground">
                {creating ? "Adding..." : "Add Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Modal */}
      <Dialog open={!!editMember} onOpenChange={(o) => !o && setEditMember(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" /> Edit Team Member
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateStaff} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                placeholder="e.g. Vikram Singh"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="edit-phone"
                  type="tel"
                  className="pl-9"
                  placeholder="+91 98765 43210"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-role">Role *</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">STAFF (Regular Access)</SelectItem>
                  <SelectItem value="MANAGER">MANAGER (Advanced Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-designation">Designation / Specialization (Optional)</Label>
              <div className="relative">
                <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="edit-designation"
                  className="pl-9"
                  placeholder="e.g. Senior Stylist, Head Chef, Billing Counter"
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email Address (Optional)</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="vikram@example.com"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setEditMember(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updating} className="rounded-full gradient-brand text-primary-foreground">
                {updating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation Modal */}
      <Dialog open={!!confirmDeactivateMember} onOpenChange={(o) => !o && setConfirmDeactivateMember(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Deactivate Team Member
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            Are you sure you want to deactivate <strong className="text-foreground">{confirmDeactivateMember?.name}</strong>?
            They will no longer be able to access NextVisit.
          </div>
          <DialogFooter className="mt-4 flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setConfirmDeactivateMember(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={deactivating}
              onClick={handleDeactivateConfirm}
            >
              {deactivating ? "Deactivating..." : "Deactivate Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}