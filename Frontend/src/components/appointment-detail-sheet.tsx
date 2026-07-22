import { AppLink } from "@/lib/app-nav";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle, LogIn, CreditCard, Printer, User } from "lucide-react";
import { fmt } from "@/lib/currency";
import { apptCode, markAppointmentPaid, updateAppointment, type Appointment, type ApptPayment } from "@/lib/appointments-store";
import { findCustomerByPhone, createCustomerFromOrder, bumpExtraCustomer } from "@/lib/orders-store";
import { toast } from "sonner";

const statusColor: Record<string, string> = {
  pending: "bg-warning/15 text-warning-foreground border-warning/30",
  checkedin: "bg-info/15 text-info border-info/30",
  completed: "bg-success/15 text-success-foreground border-success/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};
const statusLabel: Record<string, string> = { pending: "Pending", checkedin: "Checked In", completed: "Completed", cancelled: "Cancelled" };

export function AppointmentDetailSheet({ appt, open, onOpenChange }: { appt: Appointment | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [payOpen, setPayOpen] = useState(false);
  const [payment, setPayment] = useState<ApptPayment>("cash");
  const [notes, setNotes] = useState(appt?.notes || "");
  if (!appt) return null;
  const a = appt;
  const services = a.services && a.services.length ? a.services : [{ name: a.service, price: a.price, duration: a.duration || 0 }];
  const totalPrice = services.reduce((s, x) => s + x.price, 0);
  const totalDuration = services.reduce((s, x) => s + x.duration, 0);
  const paid = a.paymentStatus === "paid";

  function saveNotes() { updateAppointment(a.id, { notes }); toast.success("Notes saved"); }
  function setStatus(s: Appointment["status"]) { updateAppointment(a.id, { status: s }); toast.success(`Marked ${statusLabel[s]}`); }
  function collectPayment() {
    let customer: { id?: string; name?: string; phone?: string } | undefined;
    if (a.customerPhone) {
      const found = findCustomerByPhone(a.customerPhone);
      if (found) {
        customer = { id: found.id, name: found.name, phone: found.phone };
        if (found.source === "extra") bumpExtraCustomer(found.id, { spent: totalPrice, visitDate: a.start.slice(0, 10), favorite: services[0]?.name });
      } else {
        const c = createCustomerFromOrder({ phone: a.customerPhone, name: a.customerName, spent: totalPrice, visitDate: a.start.slice(0, 10), favorite: services[0]?.name });
        customer = { id: c.id, name: c.name, phone: c.phone };
      }
    }
    markAppointmentPaid(a.id, payment, customer);
    toast.success(`Payment collected · ${fmt(totalPrice)}`);
    setPayOpen(false);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            {apptCode(a)}
            <Badge variant="outline" className={`rounded-full text-[10px] ${statusColor[a.status]}`}>{statusLabel[a.status]}</Badge>
            {paid && <Badge variant="outline" className="rounded-full bg-success/15 text-success-foreground border-success/30 text-[10px]">Paid</Badge>}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Customer</p>
            <div className="mt-1 flex items-center justify-between">
              <div>
                {a.customerId ? (
                  <AppLink path="customers/$id" params={{ id: a.customerId }} className="font-medium hover:text-primary inline-flex items-center gap-1"><User className="h-4 w-4" /> {a.customerName}</AppLink>
                ) : (
                  <p className="font-medium">{a.customerName || "Walk-in"}</p>
                )}
                <p className="text-xs text-muted-foreground">{a.customerPhone || "—"}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>{new Date(a.start).toLocaleDateString()}</p>
                <p>{new Date(a.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Services</p>
            <div className="mt-2 space-y-1.5 text-sm">
              {services.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                  <div><span className="font-medium">{s.name}</span> <span className="text-xs text-muted-foreground">· {s.duration}m</span></div>
                  <span className="font-medium">{fmt(s.price)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">Total · {totalDuration} min</span>
              <span className="font-display text-lg font-semibold">{fmt(totalPrice)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Staff: {a.staff}</p>
          </div>

          <div className="rounded-2xl border p-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" disabled={paid} />
            {!paid && <div className="mt-2 flex justify-end"><Button size="sm" variant="outline" className="rounded-full" onClick={saveNotes}>Save notes</Button></div>}
          </div>

          {!paid && (
            <div className="flex flex-wrap items-center gap-2">
              {a.status === "pending" && <Button size="sm" variant="outline" className="rounded-full" onClick={() => setStatus("checkedin")}><LogIn className="mr-1.5 h-4 w-4" /> Check in</Button>}
              {a.status !== "completed" && <Button size="sm" variant="outline" className="rounded-full" onClick={() => setStatus("completed")}><CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark completed</Button>}
              <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={() => setPayOpen(true)}><CreditCard className="mr-1.5 h-4 w-4" /> Collect payment</Button>
              <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={() => setStatus("cancelled")}><XCircle className="mr-1.5 h-4 w-4" /> Cancel</Button>
            </div>
          )}
          {paid && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" /> Print receipt</Button>
            </div>
          )}
        </div>

        {payOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
            <div className="w-[92%] max-w-sm rounded-2xl border bg-card p-5 shadow-xl">
              <p className="font-display text-lg font-semibold">Collect payment</p>
              <p className="text-sm text-muted-foreground">Total {fmt(totalPrice)}</p>
              {!a.customerPhone && (
                <div className="mt-3 space-y-2">
                  <div><Label className="text-xs">Customer phone</Label><Input placeholder="+91…" onChange={(e) => updateAppointment(a.id, { customerPhone: e.target.value })} /></div>
                </div>
              )}
              <div className="mt-3">
                <Label className="text-xs">Payment method</Label>
                <Select value={payment} onValueChange={(v) => setPayment(v as ApptPayment)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setPayOpen(false)}>Cancel</Button>
                <Button className="rounded-full gradient-brand text-primary-foreground" onClick={collectPayment}>Mark paid</Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}