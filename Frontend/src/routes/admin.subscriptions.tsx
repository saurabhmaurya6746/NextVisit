import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { plans, invoices, clients } from "@/lib/sample-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/subscriptions")({ component: SubscriptionsPage });

function SubscriptionsPage() {
  return (
    <>
      <PageHeader title="Subscription plans" description="Compare tiers, manage renewals and download invoices." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <Card key={p.name} className={cn("relative rounded-2xl transition-all hover:-translate-y-1", p.popular && "border-primary shadow-glow")}>
            {p.popular && <Badge className="absolute -top-2 left-4 rounded-full gradient-brand text-primary-foreground">Most popular</Badge>}
            <CardHeader>
              <CardTitle className="font-display">{p.name}</CardTitle>
              <p className="mt-2"><span className="font-display text-3xl font-semibold">${p.price}</span><span className="text-sm text-muted-foreground">/mo</span></p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1.5 text-sm">
                {p.features.map((f) => (<li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-success" /> {f}</li>))}
              </ul>
              <Button className={cn("w-full rounded-full", p.popular && "gradient-brand text-primary-foreground shadow-glow")} variant={p.popular ? "default" : "outline"} onClick={() => toast.success(`${p.cta} · ${p.name}`)}>
                {p.cta}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display">Invoices & payment history</CardTitle>
          <Button variant="outline" size="sm" className="rounded-full"><Download className="mr-1.5 h-4 w-4" /> Export all</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Client</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {invoices.map((i) => {
                const client = clients.find((c) => c.business === i.client);
                return (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.id}</TableCell>
                  <TableCell>
                    {client ? (
                      <Link to="/admin/clients/$id" params={{ id: client.id }} className="font-medium hover:text-primary hover:underline">{i.client}</Link>
                    ) : i.client}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{i.date}</TableCell>
                  <TableCell className="font-medium">${i.amount}</TableCell>
                  <TableCell><Badge variant="outline" className={cn("rounded-full capitalize", i.status === "paid" ? "border-success/40 text-success" : "border-destructive/40 text-destructive")}>{i.status}</Badge></TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => toast("Invoice downloaded")}>Download</Button></TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}