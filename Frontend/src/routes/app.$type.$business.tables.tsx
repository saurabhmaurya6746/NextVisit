import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QrCode, Copy, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useProfile } from "@/lib/business-profile";
import { getTablesMapApi, type TableMapItem } from "@/lib/orders-api";
import { NewOrderDialog } from "@/components/new-order-dialog";
import { OrderDetailSheet } from "@/components/order-detail-sheet";
import { SkeletonTablesGrid } from "@/components/skeletons";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$type/$business/tables")({ component: TablesPage });

const STATUS_COLORS: Record<string, string> = {
  EMPTY: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  OCCUPIED: "bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300",
  SERVED: "bg-indigo-500/15 border-indigo-500/50 text-indigo-700 dark:text-indigo-300",
  COMPLETED: "bg-neutral-900/90 border-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-100",
};

function TablesPage() {
  const profile = useProfile("restaurant");
  const [presetTableId, setPresetTableId] = useState<string | null>(null);
  const [presetTableName, setPresetTableName] = useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Live Table Map via React Query
  // ---------------------------------------------------------------------------
  const {
    data: diningAreas = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["tables", "map"],
    queryFn: getTablesMapApi,
    refetchInterval: 10000, // Refresh every 10s for live table updates
  });

  const bizSlug =
    (profile.name || "business")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "business";

  const allTables = diningAreas.flatMap((area) => area.tables);

  return (
    <PageTransition>
      <PageHeader
        title="Tables"
        description="Live table map · click a table to view or start order"
        actions={<Legend />}
      />

      {isLoading && <SkeletonTablesGrid count={8} />}

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {(error as Error)?.message || "Failed to load table map."}
        </div>
      )}

      {!isLoading && !isError && diningAreas.length === 0 && (
        <Card className="rounded-2xl p-8 text-center text-muted-foreground">
          <p>No dining areas or tables configured yet. Set up tables in setup wizard.</p>
        </Card>
      )}

      {/* Grouped Dining Areas Grid */}
      {!isLoading && !isError && (
        <div className="space-y-6">
          {diningAreas.map((area) => (
            <div key={area.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {area.name}
                </h3>
                <span className="text-xs text-muted-foreground">({area.tables.length} tables)</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {area.tables.map((t) => {
                  const isOccupied = t.status === "OCCUPIED" && !!t.current_order_id;
                  const colorClass = STATUS_COLORS[t.status] || STATUS_COLORS.EMPTY;

                  const inner = (
                    <div
                      className={cn(
                        "rounded-2xl border-2 p-4 transition-all hover:-translate-y-0.5 hover:shadow-glow",
                        colorClass
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-display text-lg font-semibold">{t.table_name}</p>
                        <Badge variant="outline" className="rounded-full bg-background/70 text-[10px]">
                          {isOccupied ? "Occupied" : "Empty"}
                        </Badge>
                      </div>

                      <div className="mt-3 text-xs opacity-90">
                        {isOccupied ? (
                          <>
                            <p>
                              {t.item_count} items · {fmt(t.pending_amount)}
                            </p>
                            <p className="opacity-70 mt-0.5">
                              Order #{t.current_order_id?.slice(-6)}
                            </p>
                            {t.order_source && (
                              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-background/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                                <QrCode className="h-2.5 w-2.5" /> {t.order_source} Order
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="opacity-70">Tap to start order</p>
                        )}
                      </div>
                    </div>
                  );

                  return (
                    <button
                      key={t.id}
                      type="button"
                      className="text-left"
                      onClick={() => {
                        if (isOccupied && t.current_order_id) {
                          setOpenOrderId(t.current_order_id);
                        } else {
                          setPresetTableId(t.id);
                          setPresetTableName(t.table_name);
                        }
                      }}
                    >
                      {inner}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Self-Order Links Section */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <QrCode className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">QR Self-Order Links</h2>
          <span className="text-xs text-muted-foreground">Print a QR of each URL and place it on the table.</span>
        </div>
        <Card className="rounded-2xl p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {allTables.map((t) => {
              // Use the table UUID directly in the QR URL — guarantees exact backend lookup
              const path = `/qr/${bizSlug}/${t.id}`;
              const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl border p-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.table_name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{url}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        toast.success("Link copied");
                      }}
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" /> Copy Link
                    </Button>
                    <a href={path} target="_blank" rel="noreferrer">
                      <Button size="icon" variant="ghost">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Dialogs */}
      <NewOrderDialog
        open={!!presetTableId || !!presetTableName}
        onOpenChange={(o) => {
          if (!o) {
            setPresetTableId(null);
            setPresetTableName(null);
          }
        }}
        presetTableId={presetTableId || undefined}
        presetTable={presetTableName || undefined}
      />

      <OrderDetailSheet
        orderId={openOrderId}
        open={!!openOrderId}
        onOpenChange={(o) => !o && setOpenOrderId(null)}
      />
    </PageTransition>
  );
}

function Legend() {
  const items = [
    { k: "EMPTY", label: "Empty" },
    { k: "OCCUPIED", label: "Occupied" },
  ];
  return (
    <div className="hidden flex-wrap gap-1.5 sm:flex">
      {items.map((i) => (
        <span
          key={i.k}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            STATUS_COLORS[i.k]
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {i.label}
        </span>
      ))}
    </div>
  );
}