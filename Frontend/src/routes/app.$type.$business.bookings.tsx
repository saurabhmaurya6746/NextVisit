import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar } from "lucide-react";
import { bookings } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/$type/$business/bookings")({ component: BookingsPage });

function BookingsPage() {
  return (
    <>
      <PageHeader title="Bookings" description={`${bookings.length} upcoming reservations`}
        actions={<Button size="sm" className="rounded-full gradient-brand text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> New booking</Button>} />
      <Card className="rounded-2xl p-4">
        <Table>
          <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Service</TableHead><TableHead>Staff</TableHead><TableHead>When</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {bookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.customer}</TableCell>
                <TableCell>{b.service}</TableCell>
                <TableCell>{b.staff}</TableCell>
                <TableCell className="text-sm text-muted-foreground"><Calendar className="mr-1 inline h-3.5 w-3.5" />{b.date} · {b.time}</TableCell>
                <TableCell><Badge variant="outline" className={cn("rounded-full capitalize", b.status === "confirmed" ? "border-success/40 text-success" : "border-warning/40 text-warning-foreground")}>{b.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}