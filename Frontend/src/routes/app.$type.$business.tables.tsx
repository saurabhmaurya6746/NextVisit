import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QrCode, Copy, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useProfile } from "@/lib/business-profile";
import { useOrders, type OrderStatus } from "@/lib/orders-store";
import { NewOrderDialog } from "@/components/new-order-dialog";
import { OrderDetailSheet } from "@/components/order-detail-sheet";
import { SkeletonTablesGrid, useShortMountFlag } from "@/components/skeletons";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$type/$business/tables")({ component: TablesPage });

const COLORS: Record<OrderStatus | "empty" | "unpaid", string> = {
  empty: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  pending: "bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300",
  unpaid: "bg-rose-500/15 border-rose-500/50 text-rose-700 dark:text-rose-300",
  completed: "bg-neutral-900/90 border-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-100",
};

function TablesPage() {
  const profile = useProfile("restaurant");
  const orders = useOrders();
  const [preset, setPreset] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const PAID_HOLD_MS = profile.paidHoldMs ?? 30_000;
  const loading = useShortMountFlag();

  const activeByTable = new Map<string, ReturnType<typeof orders.find>>();
  for (const o of orders) {
    if (o.status === "completed") continue;
    if (!activeByTable.has(o.table)) activeByTable.set(o.table, o);
  }
  const lastByTable = new Map<string, ReturnType<typeof orders.find>>();
  for (const o of orders) if (!lastByTable.has(o.table)) lastByTable.set(o.table, o);

  const tables = [
    ...profile.tableNames,
    ...(profile.parcel ? ["Parcel"] : []),
    ...(profile.takeaway ? ["Take Away"] : []),
  ];
  const bizSlug = (profile.name || "business").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "business";

  return (
    <PageTransition>
      <PageHeader
        title="Tables"
        description="Live table map · click a table to open its active order"
        actions={<Legend />}
      />
      {loading ? <SkeletonTablesGrid count={8} /> : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {tables.map((t) => {
          const active = activeByTable.get(t);
          const last = lastByTable.get(t);
          const paidAtMs = last?.paidAt ? new Date(last.paidAt).getTime() : 0;
          const stillHolding = paidAtMs > 0 && now - paidAtMs < PAID_HOLD_MS;
          const showLastPaid = !active && last && last.status === "completed" && stillHolding;
          const stateKey: OrderStatus | "empty" | "unpaid" =
            showLastPaid ? "completed" : active ? (active.paymentStatus === "unpaid" && active.items.length > 0 ? "unpaid" : "pending") : "empty";
          const inner = (
            <div className={cn("rounded-2xl border-2 p-4 transition-all hover:-translate-y-0.5 hover:shadow-glow", COLORS[stateKey])}>
              <div className="flex items-center justify-between">
                <p className="font-display text-lg font-semibold">{t}</p>
                <Badge variant="outline" className="rounded-full bg-background/70 text-[10px]">
                  {stateKey === "empty" ? "Empty" : stateKey === "unpaid" ? "Unpaid" : stateKey === "completed" ? "Paid" : "Active"}
                </Badge>
              </div>
              <div className="mt-3 text-xs opacity-90">
                {active ? (
                  <>
                    <p>{active.items.reduce((s, i) => s + i.qty, 0)} items · {fmt(active.total)}</p>
                    <p className="opacity-70">#{active.id.slice(-6)}</p>
                    {active.source === "qr" && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-background/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                        <QrCode className="h-2.5 w-2.5" /> QR Self Order
                      </p>
                    )}
                  </>
                ) : showLastPaid ? (
                  <>
                    <p>Last: {fmt(last!.total)}</p>
                    <p className="opacity-70">Paid</p>
                  </>
                ) : (
                  <p className="opacity-70">Tap to start order</p>
                )}
              </div>
            </div>
          );
          return active ? (
            <button key={t} type="button" className="text-left" onClick={() => setOpenId(active.id)}>{inner}</button>
          ) : showLastPaid ? (
            <button key={t} type="button" className="text-left" onClick={() => setOpenId(last!.id)}>{inner}</button>
          ) : (
            <button key={t} type="button" className="text-left" onClick={() => setPreset(t)}>{inner}</button>
          );
        })}
      </div>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <QrCode className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">QR Self-Order Links</h2>
          <span className="text-xs text-muted-foreground">Print a QR of each URL and place it on the table.</span>
        </div>
        <Card className="rounded-2xl p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {tables.map((t) => {
              const slug = t.toLowerCase().replace(/\s+/g, "-");
              const path = `/qr/${bizSlug}/${encodeURIComponent(slug)}`;
              const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
              return (
                <div key={t} className="flex items-center justify-between gap-2 rounded-xl border p-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{url}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}>
                      <Copy className="mr-1 h-3.5 w-3.5" /> Copy Link
                    </Button>
                    <a href={path} target="_blank" rel="noreferrer"><Button size="icon" variant="ghost"><ExternalLink className="h-4 w-4" /></Button></a>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <NewOrderDialog open={!!preset} onOpenChange={(o) => !o && setPreset(null)} presetTable={preset || undefined} />
      <OrderDetailSheet orderId={openId} open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </PageTransition>
  );
}

function Legend() {
  const items: { k: OrderStatus | "empty" | "unpaid"; label: string }[] = [
    { k: "empty", label: "Empty" }, { k: "pending", label: "Active" }, { k: "unpaid", label: "Unpaid" }, { k: "completed", label: "Paid" },
  ];
  return (
    <div className="hidden flex-wrap gap-1.5 sm:flex">
      {items.map((i) => (
        <span key={i.k} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium", COLORS[i.k])}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />{i.label}
        </span>
      ))}
    </div>
  );
}