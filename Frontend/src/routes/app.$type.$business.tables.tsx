import { createFileRoute } from "@/lib/route-compat";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  QrCode,
  Copy,
  ExternalLink,
  AlertCircle,
  Download,
  Printer,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useProfile, useAuthenticatedBusiness } from "@/lib/business-profile";
import { useAppScope, slugify } from "@/lib/app-nav";
import { getSession } from "@/lib/auth";
import { getTablesMapApi } from "@/lib/orders-api";
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

interface QrModalTable {
  tableName: string;
  url: string;
  path: string;
}

export default function TablesPage() {
  const profile = useProfile("restaurant");
  const scope = useAppScope();
  const { name: authBizName, business: authBiz } = useAuthenticatedBusiness();
  const session = getSession();

  const [presetTableId, setPresetTableId] = useState<string | null>(null);
  const [presetTableName, setPresetTableName] = useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [selectedQrTable, setSelectedQrTable] = useState<QrModalTable | null>(null);
  const [qrStatus, setQrStatus] = useState<"loading" | "success" | "error">("loading");
  const [qrKey, setQrKey] = useState<number>(0);

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

  const activeBizName =
    (authBiz?.name && authBiz.name !== "null" && authBiz.name !== "undefined" && authBiz.name !== "Unknown" ? authBiz.name : null) ||
    (authBizName && authBizName !== "NextVisit" && authBizName !== "null" && authBizName !== "undefined" && authBizName !== "Unknown" ? authBizName : null) ||
    (session?.businessName && session.businessName !== "null" && session.businessName !== "undefined" && session.businessName !== "Unknown" ? session.businessName : null) ||
    (profile?.name && profile.name !== "Aroma Bistro" && profile.name !== "null" && profile.name !== "undefined" ? profile.name : null) ||
    (authBiz?.name || authBizName || session?.businessName || profile?.name || "Restaurant");

  const activeSlug = (scope?.business && scope.business !== "business" && scope.business !== "restaurant")
    ? scope.business
    : (session?.businessSlug || slugify(activeBizName));

  const bizSlug = activeSlug || "restaurant";

  const restaurantName = activeBizName;

  const allTables = diningAreas.flatMap((area) => area.tables);

  const handleDownloadQr = async () => {
    if (!selectedQrTable || qrStatus !== "success") return;
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=8&data=${encodeURIComponent(selectedQrTable.url)}`;
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const safeTable = selectedQrTable.tableName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const safeBiz = bizSlug.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      link.download = `${safeTable}-${safeBiz}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success("QR Code downloaded");
    } catch {
      toast.error("Failed to download QR code");
    }
  };

  const handlePrintQr = () => {
    if (!selectedQrTable || qrStatus !== "success") return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print the QR Code");
      return;
    }
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=8&data=${encodeURIComponent(selectedQrTable.url)}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print QR - ${selectedQrTable.tableName}</title>
          <style>
            @page { size: auto; margin: 0; }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 24px;
              background: #ffffff;
              text-align: center;
              color: #111827;
            }
            .print-card {
              border: 2px solid #e5e7eb;
              border-radius: 24px;
              padding: 40px 32px;
              max-width: 380px;
              width: 100%;
              margin: auto;
              box-sizing: border-box;
              box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            }
            h1 { font-size: 26px; font-weight: 700; margin: 0 0 8px 0; color: #0f172a; }
            h2 { font-size: 20px; font-weight: 600; margin: 0 0 24px 0; color: #2563eb; }
            .qr-wrapper {
              margin: 0 auto 24px auto;
              padding: 16px;
              border: 1px solid #f1f5f9;
              border-radius: 16px;
              display: inline-block;
              background: #ffffff;
            }
            img { width: 260px; height: 260px; display: block; border-radius: 8px; }
            p { font-size: 14px; font-weight: 500; color: #64748b; margin: 0; line-height: 1.5; }
            @media print {
              body { padding: 0; }
              .print-card { border: none; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="print-card">
            <h1>${restaurantName}</h1>
            <h2>${selectedQrTable.tableName}</h2>
            <div class="qr-wrapper">
              <img src="${qrImgUrl}" alt="QR Code" />
            </div>
            <p>Scan to view the menu<br/>and place your order</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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
                  const isOccupied = (t.status === "OCCUPIED" || t.status === "RELEASING_SOON") || !!t.current_order_id;
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
                              Order #{t.current_order_id ? t.current_order_id.slice(-6) : "Active"}
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
                        if (isOccupied) {
                          if (t.current_order_id) {
                            setOpenOrderId(t.current_order_id);
                          } else {
                            toast.info("No active order found for this table.");
                          }
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

      {/* QR Self-Order Links Section (Grouped by Dining Area) */}
      <section className="mt-10 space-y-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg gradient-brand text-primary-foreground shadow-2xs">
            <QrCode className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold">QR Self-Order Links</h2>
            <p className="text-xs text-muted-foreground">Grouped by Dining Area. Print or copy the direct QR link for each table.</p>
          </div>
        </div>

        {diningAreas.filter((area) => area.tables && area.tables.length > 0).length === 0 ? (
          <Card className="rounded-2xl p-6 text-center text-muted-foreground text-sm">
            No tables available to generate QR links.
          </Card>
        ) : (
          <div className="space-y-4">
            {diningAreas
              .filter((area) => area.tables && area.tables.length > 0)
              .map((area) => (
                <Card key={area.id} className="rounded-2xl p-4 border bg-card shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b pb-2.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                        {area.name}
                      </h3>
                      <Badge variant="secondary" className="rounded-full text-[10px] font-medium px-2 py-0.5">
                        {area.tables.length} {area.tables.length === 1 ? "table" : "tables"}
                      </Badge>
                    </div>
                  </div>

                  <TooltipProvider>
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {area.tables.map((t) => {
                        // Use the table UUID directly in the QR URL — guarantees exact backend lookup
                        const path = `/restaurant/qr/${bizSlug}/${t.id}`;
                        const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
                        return (
                          <div
                            key={t.id}
                            className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 rounded-xl border bg-muted/20 p-2.5 hover:border-primary/40 hover:bg-muted/40 transition-all"
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                              <p className="text-sm font-semibold truncate text-foreground">{t.table_name}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="rounded-full text-xs font-medium h-7 px-2.5 cursor-pointer"
                                    onClick={() => {
                                      setQrStatus("loading");
                                      setSelectedQrTable({
                                        tableName: t.table_name,
                                        url,
                                        path,
                                      });
                                    }}
                                  >
                                    <QrCode className="mr-1 h-3 w-3" /> QR
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Show QR Code</p>
                                </TooltipContent>
                              </Tooltip>

                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full text-xs font-medium h-7 px-2.5 cursor-pointer"
                                onClick={() => {
                                  navigator.clipboard.writeText(url);
                                  toast.success("Link copied");
                                }}
                              >
                                <Copy className="mr-1 h-3 w-3" /> Copy Link
                              </Button>

                              <a href={path} target="_blank" rel="noreferrer">
                                <Button size="sm" variant="ghost" className="rounded-full text-xs font-medium h-7 px-2 cursor-pointer">
                                  <ExternalLink className="mr-1 h-3 w-3" /> Open
                                </Button>
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </TooltipProvider>
                </Card>
              ))}
          </div>
        )}
      </section>

      {/* Dynamic Client-Side QR Modal */}
      <Dialog
        open={!!selectedQrTable}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedQrTable(null);
            setQrStatus("loading");
          }
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl p-6 text-center">
          <DialogHeader className="text-center sm:text-center space-y-1">
            <DialogTitle className="font-display text-xl font-bold tracking-tight text-foreground">
              {restaurantName}
            </DialogTitle>
            <p className="text-base font-semibold text-primary">{selectedQrTable?.tableName}</p>
          </DialogHeader>

          <div className="my-3 flex flex-col items-center justify-center space-y-3">
            <div className="rounded-2xl border bg-white p-4 shadow-sm min-h-[256px] min-w-[256px] flex items-center justify-center">
              {selectedQrTable && (
                <>
                  {/* Real Image Loader Element */}
                  <img
                    key={`${selectedQrTable.url}-${qrKey}`}
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=8&data=${encodeURIComponent(
                      selectedQrTable.url
                    )}`}
                    alt={`${selectedQrTable.tableName} QR Code`}
                    onLoad={() => setQrStatus("success")}
                    onError={() => setQrStatus("error")}
                    className={cn(
                      "h-56 w-56 object-contain transition-opacity duration-200",
                      qrStatus === "success" ? "block" : "hidden"
                    )}
                  />

                  {/* Loading State */}
                  {qrStatus === "loading" && (
                    <div className="flex flex-col items-center justify-center space-y-2 text-center h-56 w-56">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-xs text-muted-foreground font-medium">Generating QR Code...</p>
                    </div>
                  )}

                  {/* Error State */}
                  {qrStatus === "error" && (
                    <div className="flex flex-col items-center justify-center space-y-2 text-center h-56 w-56 p-2 text-destructive">
                      <AlertCircle className="h-8 w-8" />
                      <p className="text-xs font-medium">Unable to generate QR code. Please try again.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs mt-1"
                        onClick={() => {
                          setQrStatus("loading");
                          setQrKey((k) => k + 1);
                        }}
                      >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try Again
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed">
              Scan to view the menu and place your order
            </p>
          </div>

          <DialogFooter className="flex flex-col sm:flex-col gap-2 mt-1">
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                variant="outline"
                className="rounded-full text-xs font-medium"
                onClick={handleDownloadQr}
                disabled={qrStatus !== "success"}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download QR
              </Button>

              <Button
                variant="outline"
                className="rounded-full text-xs font-medium"
                onClick={handlePrintQr}
                disabled={qrStatus !== "success"}
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" /> Print QR
              </Button>
            </div>

            <DialogClose asChild>
              <Button variant="ghost" className="w-full rounded-full text-xs text-muted-foreground">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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