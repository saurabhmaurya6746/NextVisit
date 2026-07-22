import { AppLink } from "@/lib/app-nav";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MessageCircle, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { useWhatsAppHistory, type WhatsAppKind } from "@/lib/whatsapp-history";
import { useOrders, useExtraCustomers } from "@/lib/orders-store";
import { useAppointments } from "@/lib/appointments-store";
import { customers } from "@/lib/sample-data";

export const Route = createFileRoute("/app/$type/$business/whatsapp-history")({ component: WhatsAppHistoryPage });

const kindMeta: Record<WhatsAppKind, { label: string; tone: string }> = {
  birthday: { label: "Birthday", tone: "border-primary/40 text-primary" },
  anniversary: { label: "Anniversary", tone: "border-accent/40 text-accent-foreground" },
  recovery: { label: "Recovery", tone: "border-warning/40 text-warning-foreground" },
  review: { label: "Review", tone: "border-info/40 text-info" },
  campaign: { label: "Campaign", tone: "border-primary/40 text-primary" },
  manual: { label: "Manual", tone: "border-muted-foreground/40 text-muted-foreground" },
};

function WhatsAppHistoryPage() {
  const all = useWhatsAppHistory();
  const orders = useOrders();
  const appts = useAppointments();
  const extras = useExtraCustomers();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | WhatsAppKind>("all");
  const [range, setRange] = useState<"all" | "today" | "week" | "month">("all");

  const lookup = useMemo(() => {
    const map = new Map<string, { name: string; phone: string }>();
    for (const c of customers) map.set(c.id, { name: c.name, phone: c.phone });
    for (const c of extras) map.set(c.id, { name: c.name, phone: c.phone });
    for (const o of orders) if (o.customerId) map.set(o.customerId, { name: o.customerName || "Guest", phone: o.customerPhone || "—" });
    for (const a of appts) if (a.customerId) map.set(a.customerId, { name: a.customerName || "Guest", phone: a.customerPhone || "—" });
    return map;
  }, [orders, appts, extras]);

  const rows = useMemo(() => {
    const now = Date.now();
    const day = 86_400_000;
    return all.filter((m) => {
      if (kind !== "all" && m.kind !== kind) return false;
      const t = new Date(m.date).getTime();
      if (range === "today" && now - t > day) return false;
      if (range === "week" && now - t > 7 * day) return false;
      if (range === "month" && now - t > 30 * day) return false;
      if (q) {
        const c = lookup.get(m.customerId);
        const hay = `${c?.name || ""} ${c?.phone || ""} ${m.message}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [all, q, kind, range, lookup]);

  return (
    <PageTransition>
      <PageHeader title="WhatsApp History" description="Every message you've sent from NextVisit, in one place." />
      <Card className="rounded-2xl">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer, phone or message" className="pl-9 rounded-full" />
            </div>
            <Select value={kind} onValueChange={(v) => setKind(v as any)}>
              <SelectTrigger className="w-[160px] rounded-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="birthday">Birthday</SelectItem>
                <SelectItem value="anniversary">Anniversary</SelectItem>
                <SelectItem value="recovery">Recovery</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="campaign">Campaign</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={range} onValueChange={(v) => setRange(v as any)}>
              <SelectTrigger className="w-[140px] rounded-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rows.length === 0 ? (
            <EmptyState title="No WhatsApp messages yet" description="Messages you send from campaigns, recovery, or profiles will appear here." icon={<MessageCircle className="h-7 w-7" />} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((m) => {
                    const c = lookup.get(m.customerId);
                    const meta = kindMeta[m.kind] ?? kindMeta.manual;
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <AppLink path="customers/$id" params={{ id: m.customerId }} className="font-medium hover:underline">
                            {c?.name || "Guest"}
                          </AppLink>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c?.phone || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className={`rounded-full text-[10px] ${meta.tone}`}>{meta.label}</Badge></TableCell>
                        <TableCell className="max-w-[360px] truncate text-sm text-muted-foreground">{m.message}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(m.date).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline" className="rounded-full text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400">Sent</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}