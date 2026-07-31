import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Ticket, Copy, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { getSession } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCouponsApi,
  createCouponApi,
  deleteCouponApi,
  CouponItem,
} from "@/lib/coupons-api";

export const Route = createFileRoute("/app/$type/$business/coupons")({ component: CouponsPage });

type StatusFilter = "all" | "active" | "upcoming" | "expired" | "inactive";

function CouponsPage() {
  const session = getSession();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CouponItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Form State
  const [formCode, setFormCode] = useState("SUMMER25");
  const [formName, setFormName] = useState("Summer Special Discount");
  const [formType, setFormType] = useState("PERCENTAGE");
  const [formValue, setFormValue] = useState("25");
  const [formMinOrder, setFormMinOrder] = useState("100");
  const [formMaxUsage, setFormMaxUsage] = useState("300");
  const [formExpiry, setFormExpiry] = useState("2026-12-31");
  const [formDesc, setFormDesc] = useState("25% OFF on summer orders above $100");

  // Debounce search
  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__couponSearchTimer);
    (window as any).__couponSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  // React Query: Fetch 100% Database-Driven Coupons
  const {
    data: couponData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "coupons",
      session?.clientId,
      statusFilter,
      debouncedSearch,
      page,
      pageSize,
    ],
    queryFn: () =>
      getCouponsApi({
        status: statusFilter,
        search: debouncedSearch,
        page,
        pageSize,
        sortBy: "recent",
      }),
    refetchInterval: 30000,
  });

  const couponsList = couponData?.items ?? [];
  const totalPages = couponData?.total_pages ?? 1;
  const totalItems = couponData?.total ?? 0;

  // Handle Create Coupon
  async function handleCreateCoupon() {
    if (!formCode.trim()) {
      toast.error("Please enter a valid coupon code");
      return;
    }
    if (!formName.trim()) {
      toast.error("Please enter a coupon name");
      return;
    }

    setIsSubmitting(true);
    try {
      await createCouponApi({
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        coupon_type: formType,
        reward_value: parseFloat(formValue) || 0,
        min_order_amount: parseFloat(formMinOrder) || 0,
        max_usage: formMaxUsage ? parseInt(formMaxUsage, 10) : undefined,
        valid_until: formExpiry ? `${formExpiry}T23:59:59Z` : undefined,
        status: "ACTIVE",
      });

      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success(`Coupon '${formCode.toUpperCase()}' created successfully!`);
      setOpen(false);
      // Reset form defaults
      setFormCode("");
      setFormName("");
      setFormDesc("");
    } catch (e: any) {
      toast.error(e.message || "Failed to create coupon");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle Delete / Deactivate Coupon
  async function handleDeleteCoupon() {
    if (!toDelete) return;
    try {
      const res = await deleteCouponApi(toDelete.id);
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success(res.message);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete coupon");
    } finally {
      setToDelete(null);
    }
  }

  const startRecordNum = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecordNum = Math.min(page * pageSize, totalItems);

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discounts, freebies and BOGOs that drive repeat visits."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full gradient-brand text-primary-foreground">
                <Plus className="mr-1.5 h-4 w-4" /> Generate coupon
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Create coupon</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Coupon Code</Label>
                    <Input
                      placeholder="SUMMER25"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Coupon Name</Label>
                    <Input
                      placeholder="Summer Special Discount"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select value={formType} onValueChange={setFormType}>
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENTAGE">Percent discount</SelectItem>
                        <SelectItem value="FLAT">Flat discount</SelectItem>
                        <SelectItem value="FREE_ITEM">Free item</SelectItem>
                        <SelectItem value="BOGO">Buy one get one (BOGO)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Reward Value</Label>
                    <Input
                      type="number"
                      placeholder="25"
                      value={formValue}
                      onChange={(e) => setFormValue(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Min Order Amount ($)</Label>
                    <Input
                      type="number"
                      placeholder="100"
                      value={formMinOrder}
                      onChange={(e) => setFormMinOrder(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Maximum Usage Limit</Label>
                    <Input
                      type="number"
                      placeholder="300"
                      value={formMaxUsage}
                      onChange={(e) => setFormMaxUsage(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs">Expiry Date</Label>
                  <Input
                    type="date"
                    value={formExpiry}
                    onChange={(e) => setFormExpiry(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs">Description (Optional)</Label>
                  <Textarea
                    placeholder="Short details about the offer"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="text-xs h-16"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-full text-xs" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="rounded-full gradient-brand text-primary-foreground text-xs"
                  onClick={handleCreateCoupon}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating…" : "Create Coupon"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="p-4 flex flex-wrap items-center justify-between gap-3 border-b">
          <CardTitle className="font-display flex items-center gap-2 text-sm">
            <Ticket className="h-4 w-4 text-primary" /> Active & Recent Coupons
          </CardTitle>

          {/* STATUS TABS & SEARCH */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-44">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search code/name…"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-8 rounded-full pl-8 text-xs"
              />
            </div>

            {(["all", "active", "upcoming", "expired", "inactive"] as StatusFilter[]).map((st) => (
              <button
                key={st}
                onClick={() => { setStatusFilter(st); setPage(1); }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-all",
                  statusFilter === st ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {st}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-20 text-center text-sm text-muted-foreground">Loading database coupons…</div>
          ) : isError ? (
            <div className="py-12 text-center text-sm text-destructive">Failed to load coupons.</div>
          ) : couponsList.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No coupons found matching your filter.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-[11px] uppercase tracking-wider">
                  <TableHead className="px-4 py-3">Code</TableHead>
                  <TableHead className="px-4 py-3">Name / Type</TableHead>
                  <TableHead className="px-4 py-3">Reward</TableHead>
                  <TableHead className="px-4 py-3 w-48">Usage</TableHead>
                  <TableHead className="px-4 py-3">Expiry</TableHead>
                  <TableHead className="px-4 py-3">Status</TableHead>
                  <TableHead className="px-4 py-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {couponsList.map((c) => {
                  const usagePct = c.max_usage ? Math.min(100, Math.round((c.redeemed_count / c.max_usage) * 100)) : 0;
                  const expiryFormatted = c.valid_until
                    ? new Date(c.valid_until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : "No Expiry";

                  const stLower = (c.computed_status || c.status).toLowerCase();

                  return (
                    <TableRow key={c.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="font-mono font-bold text-xs px-4 py-3">{c.code}</TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="font-semibold text-xs text-foreground">{c.name}</div>
                        <span className="text-[10px] uppercase font-mono text-muted-foreground">{c.coupon_type}</span>
                      </TableCell>
                      <TableCell className="font-medium text-xs px-4 py-3">{c.reward_description || `${c.reward_value}`}</TableCell>
                      <TableCell className="px-4 py-3">
                        {c.max_usage ? (
                          <>
                            <div className="mb-1 text-[11px] font-mono text-muted-foreground flex justify-between">
                              <span>{c.redeemed_count} / {c.max_usage}</span>
                              <span>{usagePct}%</span>
                            </div>
                            <Progress value={usagePct} className="h-1.5" />
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">{c.redeemed_count} redeemed (Unlimited)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono px-4 py-3">{expiryFormatted}</TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full capitalize text-[10px] font-semibold px-2 py-0.5",
                            stLower === "active" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
                            stLower === "upcoming" && "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10",
                            stLower === "expired" && "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10",
                            stLower === "inactive" && "border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10"
                          )}
                        >
                          {c.computed_status || c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            title="Copy Coupon Code"
                            onClick={() => {
                              navigator.clipboard?.writeText(c.code);
                              toast.success(`Coupon code '${c.code}' copied!`);
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10"
                            title="Delete Coupon"
                            onClick={() => setToDelete(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* SERVER-SIDE PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>
                  Showing <strong>{startRecordNum}</strong>–<strong>{endRecordNum}</strong> of <strong>{totalItems}</strong> coupons
                </span>
                <div className="ml-2 flex items-center gap-1">
                  <span className="text-[11px]">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="h-7 rounded-lg border bg-background px-2 text-xs font-semibold focus:outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full px-3 text-xs"
                  disabled={!couponData?.has_previous}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
                </Button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  let pageNum = page;
                  if (totalPages <= 5) pageNum = idx + 1;
                  else if (page <= 3) pageNum = idx + 1;
                  else if (page >= totalPages - 2) pageNum = totalPages - 4 + idx;
                  else pageNum = page - 2 + idx;

                  return (
                    <Button
                      key={pageNum}
                      size="sm"
                      variant={page === pageNum ? "default" : "outline"}
                      className={cn(
                        "h-8 w-8 rounded-full p-0 text-xs font-semibold",
                        page === pageNum && "bg-primary text-primary-foreground"
                      )}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full px-3 text-xs"
                  disabled={!couponData?.has_next}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete coupon '${toDelete?.code}'?`}
        description={
          toDelete && toDelete.redeemed_count > 0
            ? "This coupon has past redemption history, so it will be marked as INACTIVE to preserve audit records."
            : "This coupon will be soft deleted and removed from active lists."
        }
        confirmLabel="Delete Coupon"
        destructive
        onConfirm={handleDeleteCoupon}
      />
    </>
  );
}