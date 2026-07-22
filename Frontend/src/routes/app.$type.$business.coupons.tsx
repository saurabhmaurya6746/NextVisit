import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Ticket, Copy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { coupons } from "@/lib/sample-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/$type/$business/coupons")({ component: CouponsPage });

function CouponsPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader title="Coupons" description="Discounts, freebies and BOGOs that drive repeat visits."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="rounded-full gradient-brand text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> Generate coupon</Button></DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader><DialogTitle className="font-display">Create coupon</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5"><Label>Code</Label><Input defaultValue="SUMMER25" /></div>
                <div className="grid gap-1.5"><Label>Type</Label>
                  <Select defaultValue="pct"><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pct">Percent discount</SelectItem>
                      <SelectItem value="flat">Flat discount</SelectItem>
                      <SelectItem value="free">Free item</SelectItem>
                      <SelectItem value="dessert">Free dessert</SelectItem>
                      <SelectItem value="bogo">Buy one get one</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>Value</Label><Input defaultValue="25" /></div>
                  <div className="grid gap-1.5"><Label>Usage limit</Label><Input defaultValue="300" /></div>
                </div>
                <div className="grid gap-1.5"><Label>Expiry date</Label><Input type="date" defaultValue="2026-12-31" /></div>
              </div>
              <DialogFooter><Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>Cancel</Button><Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => { setOpen(false); toast.success("Coupon created"); }}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><Ticket className="h-4 w-4" /> Active & recent coupons</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>Reward</TableHead><TableHead>Usage</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {coupons.map((c) => (
                <TableRow key={c.code}>
                  <TableCell className="font-mono text-xs">{c.code}</TableCell>
                  <TableCell>{c.type}</TableCell>
                  <TableCell className="font-medium">{c.discount}</TableCell>
                  <TableCell className="w-40"><div className="mb-1 text-xs text-muted-foreground">{c.used} / {c.limit}</div><Progress value={(c.used / c.limit) * 100} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.expiry}</TableCell>
                  <TableCell><Badge variant="outline" className={cn("rounded-full capitalize", c.status === "active" ? "border-success/40 text-success" : "border-muted-foreground/30 text-muted-foreground")}>{c.status}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard?.writeText(c.code); toast("Copied"); }}><Copy className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}