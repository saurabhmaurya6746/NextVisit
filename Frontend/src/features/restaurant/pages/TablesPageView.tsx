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

export function TablesPageView() {
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

  const activeBizName = authBiz?.name || authBizName || session?.businessName || (profile?.name !== "Aroma Bistro" ? profile?.name : null) || "restaurant";
  const activeSlug = (scope?.business && scope.business !== "business" && scope.business !== "restaurant")
    ? scope.business
    : (session?.businessSlug || slugify(activeBizName));

  const bizSlug = activeSlug || "restaurant";

  const handleOpenQrModal = (table: any) => {
    const relPath = `/restaurant/qr/${bizSlug}/${table.id}`;
    const fullUrl = `${window.location.origin}${relPath}`;
    setSelectedQrTable({
      tableName: table.table_name,
      url: fullUrl,
      path: relPath,
    });
    setQrStatus("loading");
    setQrKey((k) => k + 1);
  };

  const handleCopyQrUrl = () => {
    if (!selectedQrTable) return;
    navigator.clipboard.writeText(selectedQrTable.url);
    toast.success("QR Link copied to clipboard!");
  };

  const handleDownloadQrCode = () => {
    if (!selectedQrTable) return;
    const imgEl = document.getElementById("qr-code-img") as HTMLImageElement | null;
    if (!imgEl) {
      toast.error("QR Code image not available");
      return;
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = imgEl.naturalWidth || 300;
    canvas.height = imgEl.naturalHeight || 300;
    ctx.drawImage(imgEl, 0, 0);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `QR-${selectedQrTable.tableName.replace(/\s+/g, "_")}.png`;
    a.click();
    toast.success(`Downloaded QR Code for ${selectedQrTable.tableName}`);
  };

  const handlePrintQrCode = () => {
    if (!selectedQrTable) return;
    const printWin = window.open("", "_blank", "width=600,height=600");
    if (!printWin) {
      toast.error("Please allow popups to print QR code");
      return;
    }
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print QR Code - ${selectedQrTable.tableName}</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            h2 { margin-bottom: 4px; }
            p { margin-top: 0; color: #666; font-size: 14px; }
            img { width: 260px; height: 260px; margin: 20px 0; }
            .badge { background: #f3f4f6; padding: 6px 12px; border-radius: 9999px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>${profile.businessName || "Restaurant"}</h2>
          <div class="badge">${selectedQrTable.tableName}</div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(selectedQrTable.url)}" />
          <p>Scan to view digital menu & place order</p>
          <script>
            window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Tables & Digital QR"
          subtitle="Real-time occupancy, floor map, digital QR links & table billing."
        />

        {/* Live Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <span className="text-muted-foreground font-semibold">Table Statuses:</span>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Empty / Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>Active Order (Preparing)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
              <span>Served (Food Delivered)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-900 dark:bg-neutral-100" />
              <span>Bill Paid (Release Required)</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Auto-syncs every 10s · Select empty table to open POS
          </div>
        </div>

        {/* Loading State */}
        {isLoading && <SkeletonTablesGrid />}

        {/* Error State */}
        {isError && (
          <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <h3 className="font-semibold text-base">Failed to load floor map</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {error instanceof Error ? error.message : "Backend service temporarily unavailable."}
            </p>
          </Card>
        )}

        {/* Main Floor Plan Grid */}
        {!isLoading && !isError && (
          <div className="space-y-8">
            {diningAreas.map((area: any) => (
              <div key={area.id} className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-display font-semibold text-base text-foreground flex items-center gap-2">
                    {area.area_name}
                    <Badge variant="secondary" className="text-xs font-normal">
                      {area.tables?.length || 0} Tables
                    </Badge>
                  </h3>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {area.tables.map((table: any) => {
                    const statusKey = table.status || "EMPTY";
                    const isOccupied = statusKey !== "EMPTY";

                    return (
                      <Card
                        key={table.id}
                        className={cn(
                          "relative flex flex-col justify-between border-2 p-4 transition-all duration-200 hover:shadow-md",
                          STATUS_COLORS[statusKey] || STATUS_COLORS.EMPTY
                        )}
                      >
                        {/* Top Info Bar */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-display font-bold text-lg leading-tight">
                              {table.table_name}
                            </h4>
                            <p className="text-xs opacity-80 mt-0.5">
                              Capacity: {table.capacity} Persons
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="bg-background/80 font-bold text-[10px] uppercase tracking-wider backdrop-blur-sm"
                          >
                            {statusKey === "EMPTY" ? "AVAILABLE" : statusKey}
                          </Badge>
                        </div>

                        {/* Active Order Details */}
                        {isOccupied && (
                          <div className="my-3 space-y-1 rounded-lg bg-background/60 p-2.5 backdrop-blur-sm text-xs">
                            <div className="flex justify-between font-semibold">
                              <span>Order #{table.current_order_number || "—"}</span>
                              <span className="text-primary font-bold">
                                {fmt(table.current_order_total || 0)}
                              </span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-[11px]">
                              <span>Items: {table.current_item_count || 0}</span>
                              <span>Source: {table.order_source || "POS"}</span>
                            </div>
                          </div>
                        )}

                        {!isOccupied && (
                          <div className="my-4 text-center py-2 text-xs text-muted-foreground/80 border border-dashed border-current/20 rounded-lg">
                            Ready for new guests
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-2 border-t border-current/15">
                          {/* QR Code Trigger */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 shrink-0 bg-background/80 hover:bg-background"
                                  onClick={() => handleOpenQrModal(table)}
                                >
                                  <QrCode className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Digital Customer QR Code</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Primary Action Button */}
                          {isOccupied ? (
                            <Button
                              className="flex-1 font-medium shadow-sm h-9 text-xs"
                              variant="default"
                              onClick={() => setOpenOrderId(table.current_order_id)}
                            >
                              View Active Bill
                            </Button>
                          ) : (
                            <Button
                              className="flex-1 font-medium h-9 text-xs"
                              variant="secondary"
                              onClick={() => {
                                setPresetTableId(table.id);
                                setPresetTableName(table.table_name);
                              }}
                            >
                              + New Staff Order
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --------------------------------------------------------------------- */}
        {/* Customer Self-Ordering QR Code Modal */}
        {/* --------------------------------------------------------------------- */}
        <Dialog
          open={!!selectedQrTable}
          onOpenChange={(open) => !open && setSelectedQrTable(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-lg">
                <QrCode className="h-5 w-5 text-primary" />
                Customer QR — {selectedQrTable?.tableName}
              </DialogTitle>
            </DialogHeader>

            {selectedQrTable && (
              <div className="flex flex-col items-center space-y-4 py-4 text-center">
                {/* QR Code Container with Loading Skeleton */}
                <div className="relative flex h-64 w-64 items-center justify-center rounded-2xl border-2 border-primary/20 bg-white p-4 shadow-inner">
                  {qrStatus === "loading" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 rounded-2xl backdrop-blur-xs">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                      <span className="text-xs text-muted-foreground">Generating QR Code…</span>
                    </div>
                  )}

                  <img
                    id="qr-code-img"
                    key={qrKey}
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(selectedQrTable.url)}`}
                    alt={`QR Code for ${selectedQrTable.tableName}`}
                    className="h-full w-full object-contain"
                    onLoad={() => setQrStatus("success")}
                    onError={() => setQrStatus("error")}
                  />
                </div>

                {qrStatus === "error" && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Failed to load QR preview. Direct link works.
                  </p>
                )}

                <div className="space-y-1 max-w-xs">
                  <p className="text-xs font-semibold text-foreground">
                    Scan to Open Menu & Self-Order
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Place this QR standee on {selectedQrTable.tableName}. Guests can scan, order & pay directly.
                  </p>
                </div>

                {/* Direct Link Box */}
                <div className="flex w-full items-center space-x-2 rounded-lg border bg-muted/50 p-2 text-xs">
                  <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground">
                    {selectedQrTable.url}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={handleCopyQrUrl}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    asChild
                  >
                    <a
                      href={selectedQrTable.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleDownloadQrCode}
                disabled={qrStatus === "loading"}
              >
                <Download className="mr-2 h-4 w-4" /> Download PNG
              </Button>
              <Button
                type="button"
                variant="default"
                className="flex-1"
                onClick={handlePrintQrCode}
                disabled={qrStatus === "loading"}
              >
                <Printer className="mr-2 h-4 w-4" /> Print Standee
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --------------------------------------------------------------------- */}
        {/* New Order POS Dialog Component */}
        {/* --------------------------------------------------------------------- */}
        {presetTableId && (
          <NewOrderDialog
            open={!!presetTableId}
            onOpenChange={(open) => {
              if (!open) {
                setPresetTableId(null);
                setPresetTableName(null);
              }
            }}
            presetTableId={presetTableId}
            presetTableName={presetTableName || undefined}
          />
        )}

        {/* --------------------------------------------------------------------- */}
        {/* Active Order Billing Detail Sheet Component */}
        {/* --------------------------------------------------------------------- */}
        {openOrderId && (
          <OrderDetailSheet
            orderId={openOrderId}
            open={!!openOrderId}
            onOpenChange={(open) => {
              if (!open) setOpenOrderId(null);
            }}
          />
        )}
      </div>
    </PageTransition>
  );
}
