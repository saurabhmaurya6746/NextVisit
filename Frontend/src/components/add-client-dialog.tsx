import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addClient } from "@/lib/clients-store";
import { toast } from "sonner";

export function AddClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [f, setF] = useState({ business: "", owner: "", email: "", phone: "", type: "Restaurant" as "Restaurant" | "Salon", address: "" });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = addClient(f);
    toast.success(`${c.business} added — 2-month free trial started`);
    onOpenChange(false);
    setF({ business: "", owner: "", email: "", phone: "", type: "Restaurant", address: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add new client</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Business name *</Label><Input required value={f.business} onChange={(e) => set("business")(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Owner name *</Label><Input required value={f.owner} onChange={(e) => set("owner")(e.target.value)} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Email *</Label><Input type="email" required value={f.email} onChange={(e) => set("email")(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Phone *</Label><Input required value={f.phone} onChange={(e) => set("phone")(e.target.value)} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Business type *</Label>
              <Select value={f.type} onValueChange={(v) => set("type")(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Restaurant">Restaurant</SelectItem>
                  <SelectItem value="Salon">Salon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Plan</Label><Input disabled value="Free Trial (2 months)" /></div>
          </div>
          <div className="space-y-1.5"><Label>Address (optional)</Label><Textarea rows={2} value={f.address} onChange={(e) => set("address")(e.target.value)} /></div>
          <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            Trial starts today · ends in 60 days · full access to all features.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="rounded-full gradient-brand text-primary-foreground">Create client</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}