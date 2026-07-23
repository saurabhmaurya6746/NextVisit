import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { SkeletonRows } from "@/components/skeletons";
import { Plus, Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageTransition } from "@/components/page-transition";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listVisitsApi,
  createVisitApi,
  completeVisitApi,
  type VisitModel,
} from "@/lib/visits-api";
import { listCustomersApi, type CustomerModel } from "@/lib/customers-api";

export const Route = createFileRoute("/app/$type/$business/bookings")({ component: BookingsPage });

function BookingsPage() {
  const [visits, setVisits] = useState<VisitModel[]>([]);
  const [customers, setCustomers] = useState<CustomerModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Visit modal state
  const [isOpen, setIsOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [notesInput, setNotesInput] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vData, cData] = await Promise.all([
        listVisitsApi(),
        listCustomersApi().catch(() => []),
      ]);
      setVisits(vData);
      setCustomers(cData);
    } catch (err: any) {
      console.error("[VISITS] Error loading visits:", err);
      setError(err.message || "Failed to load visits from backend.");
      toast.error("Failed to load visits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      toast.error("Please select a customer.");
      return;
    }
    setCreateLoading(true);
    try {
      await createVisitApi({
        customer_id: selectedCustomer,
        notes: notesInput.trim() || undefined,
        services: [], // backend default / optional items
      });
      toast.success("New visit created!");
      setIsOpen(false);
      setSelectedCustomer("");
      setNotesInput("");
      await loadData();
    } catch (err: any) {
      console.error("[VISITS] Create visit error:", err);
      toast.error(err.message || "Failed to create visit");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCompleteVisit = async (id: string) => {
    try {
      await completeVisitApi(id);
      toast.success("Visit marked as completed!");
      await loadData();
    } catch (err: any) {
      console.error("[VISITS] Complete visit error:", err);
      toast.error(err.message || "Failed to complete visit");
    }
  };

  const getCustomerName = (cid: string) => {
    const found = customers.find((c) => c.id === cid);
    return found ? found.name : `Customer (${cid.slice(0, 8)})`;
  };

  return (
    <PageTransition>
      <PageHeader
        title="Visits & Bookings"
        description={`${visits.length} visit${visits.length === 1 ? "" : "s"} recorded · Live backend connected`}
        actions={
          <Button
            size="sm"
            className="rounded-full gradient-brand text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            onClick={() => setIsOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" /> New visit
          </Button>
        }
      />

      {loading ? (
        <Card className="rounded-2xl p-4">
          <SkeletonRows rows={5} cols={5} />
        </Card>
      ) : error ? (
        <EmptyState
          title="Error loading visits"
          description={error}
          icon={<AlertTriangle className="h-7 w-7 text-destructive" />}
          action={
            <Button variant="outline" className="rounded-full" onClick={loadData}>
              Retry
            </Button>
          }
        />
      ) : visits.length === 0 ? (
        <EmptyState
          title="No visits found"
          description="Create your first visit to start tracking customer arrivals."
          icon={<Calendar className="h-7 w-7" />}
          action={
            <Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => setIsOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> New visit
            </Button>
          }
        />
      ) : (
        <Card className="rounded-2xl p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Started At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visits.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{getCustomerName(v.customerId)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full capitalize",
                        v.status === "COMPLETED"
                          ? "border-success/40 text-success"
                          : "border-warning/40 text-warning-foreground"
                      )}
                    >
                      {v.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{fmt(v.totalAmount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <Calendar className="mr-1 inline h-3.5 w-3.5" />
                    {new Date(v.startedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {v.status === "OPEN" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs border-success/40 text-success hover:bg-success/10"
                        onClick={() => handleCompleteVisit(v.id)}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Complete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* New Visit Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Customer Visit</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateVisit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="visit-cust">Select Customer *</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer} required>
                <SelectTrigger id="visit-cust">
                  <SelectValue placeholder="Choose a customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visit-notes">Notes</Label>
              <Input
                id="visit-notes"
                placeholder="e.g. Prefer corner table / Special requests"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
              />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createLoading} className="gradient-brand text-primary-foreground">
                {createLoading ? "Creating..." : "Start Visit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}