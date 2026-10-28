import React, { useEffect, useState } from "react";
import {
  Cloud,
  CloudCheck,
  CloudAlert,
  CloudOff,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  HardDrive,
  Info,
} from "lucide-react";
import { isDesktopApp } from "@/lib/desktop";
import { getSession } from "@/lib/auth";
import { getStoredDeviceBinding } from "@/lib/devices-api";
import {
  syncWorker,
  type SyncEngineState,
} from "@/lib/sync/sync-worker";
import {
  listOutboxItems,
  type OutboxItemDto,
} from "@/lib/sync/sync-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export function SyncStatusIndicator({ className }: { className?: string } = {}) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [syncState, setSyncState] = useState<SyncEngineState>(syncWorker.getState());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [outboxItems, setOutboxItems] = useState<OutboxItemDto[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const session = getSession();
  const businessId = session?.clientId;

  useEffect(() => {
    setIsDesktop(isDesktopApp());
  }, []);

  useEffect(() => {
    if (!isDesktop || !businessId) return;

    // Subscribe to sync worker updates
    const unsubscribe = syncWorker.subscribe((state) => {
      setSyncState(state);
    });

    return () => {
      unsubscribe();
    };
  }, [isDesktop, businessId]);

  // Load items when dialog opens or activeTab changes
  useEffect(() => {
    if (dialogOpen && businessId) {
      loadItems();
    }
  }, [dialogOpen, businessId, activeTab]);

  const loadItems = async () => {
    if (!businessId) return;
    setItemsLoading(true);
    try {
      const filter = activeTab === "ALL" ? undefined : activeTab;
      const items = await listOutboxItems(businessId, filter, 50);
      setOutboxItems(items);
    } catch (err) {
      console.warn("Failed to load outbox items:", err);
    } finally {
      setItemsLoading(false);
    }
  };

  const handleManualSync = () => {
    toast.info("Triggering background synchronization...");
    syncWorker.triggerFlush();
    setTimeout(() => {
      loadItems();
    }, 1500);
  };

  const handleRetryItem = async (clientTxId: string) => {
    setRetryingId(clientTxId);
    try {
      const ok = await syncWorker.retryItem(clientTxId);
      if (ok) {
        toast.success(`Queued transaction for immediate retry`);
        await loadItems();
      } else {
        toast.error("Failed to queue transaction retry");
      }
    } catch (err) {
      toast.error(`Retry error: ${err}`);
    } finally {
      setRetryingId(null);
    }
  };

  if (!isDesktop) return null;

  const summary = syncState.summary;
  const pendingCount = (summary?.pendingCount || summary?.pending_count || 0) as number;
  const sendingCount = (summary?.sendingCount || summary?.sending_count || 0) as number;
  const failedCount = (summary?.failedCount || summary?.failed_count || 0) as number;
  const conflictCount = (summary?.conflictCount || summary?.conflict_count || 0) as number;
  const committedCount = (summary?.committedCount || summary?.committed_count || 0) as number;

  const deviceBinding = businessId ? getStoredDeviceBinding(businessId) : null;
  const isOnline = syncState.isOnline;
  const isSyncing = syncState.isSyncing || sendingCount > 0;
  const hasIssues = failedCount > 0 || conflictCount > 0;

  // Determine pill appearance
  let pillColor = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20";
  let PillIcon = CheckCircle2;
  let pillText = "POS Synced";

  if (!isOnline) {
    pillColor = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20";
    PillIcon = CloudOff;
    pillText = pendingCount > 0 ? `Offline (${pendingCount} pending)` : "Offline (Local POS)";
  } else if (hasIssues) {
    pillColor = "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20";
    PillIcon = AlertTriangle;
    pillText = `${failedCount + conflictCount} Sync Issue${failedCount + conflictCount > 1 ? "s" : ""}`;
  } else if (isSyncing) {
    pillColor = "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20";
    PillIcon = RefreshCw;
    pillText = "Syncing...";
  } else if (pendingCount > 0) {
    pillColor = "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/20";
    PillIcon = Cloud;
    pillText = `${pendingCount} Pending Sync`;
  }

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer shadow-2xs whitespace-nowrap shrink-0 select-none ${pillColor} ${className || ""}`}
        title="Click to view durable sync outbox status"
      >
        <PillIcon className={`h-3.5 w-3.5 shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
        <span className="whitespace-nowrap">{pillText}</span>
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="shrink-0 pb-2 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-primary" />
                  Durable Sync Engine — Operator Outbox
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Local SQLite persistence, transactional batch push, and per-item acknowledgements
                </DialogDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleManualSync}
                disabled={isSyncing || !isOnline}
                className="gap-1.5 text-xs h-8"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                Sync Now
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pt-4 pr-1">
            {/* System Clock Skew Warning Alert */}
            {syncState.isClockSkewCritical && (
              <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Clock Skew Detected ({syncState.clockSkewSeconds}s offset)</p>
                  <p className="mt-0.5 text-destructive/90">
                    Your desktop clock is out of sync with the cloud server by more than 5 minutes. The engine will safely use server timestamps to prevent data drift. Please sync your Windows system clock in Settings.
                  </p>
                </div>
              </div>
            )}

            {/* Connection and Device Info Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Card className="p-2.5 bg-muted/30">
                <p className="text-muted-foreground">Connectivity</p>
                <div className="flex items-center gap-1.5 mt-1 font-semibold">
                  <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {isOnline ? "Online" : "Offline"}
                </div>
              </Card>

              <Card className="p-2.5 bg-muted/30">
                <p className="text-muted-foreground">Registered Terminal</p>
                <p className="font-semibold mt-1 truncate" title={deviceBinding?.deviceName || "Unregistered"}>
                  {deviceBinding?.deviceName || "POS Terminal"} ({deviceBinding?.devicePrefix || "POS"})
                </p>
              </Card>

              <Card className="p-2.5 bg-muted/30">
                <p className="text-muted-foreground">Last Sync</p>
                <p className="font-semibold mt-1">
                  {syncState.lastSyncAt
                    ? new Date(syncState.lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                    : "Not yet"}
                </p>
              </Card>

              <Card className="p-2.5 bg-muted/30">
                <p className="text-muted-foreground">Server Skew</p>
                <p className="font-semibold mt-1">
                  {syncState.clockSkewSeconds !== null ? `${Math.abs(syncState.clockSkewSeconds)}s ${syncState.clockSkewSeconds >= 0 ? "ahead" : "behind"}` : "Synced"}
                </p>
              </Card>
            </div>

            {/* Outbox Metrics Stats */}
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              <div className="rounded-lg border p-2 bg-card">
                <p className="text-muted-foreground text-[11px]">Pending</p>
                <p className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">{pendingCount}</p>
              </div>
              <div className="rounded-lg border p-2 bg-card">
                <p className="text-muted-foreground text-[11px]">Syncing</p>
                <p className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">{sendingCount}</p>
              </div>
              <div className="rounded-lg border p-2 bg-card">
                <p className="text-muted-foreground text-[11px]">Synced</p>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{committedCount}</p>
              </div>
              <div className="rounded-lg border p-2 bg-card">
                <p className="text-muted-foreground text-[11px]">Failed</p>
                <p className={`text-base font-bold mt-0.5 ${failedCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>{failedCount}</p>
              </div>
              <div className="rounded-lg border p-2 bg-card">
                <p className="text-muted-foreground text-[11px]">Conflict</p>
                <p className={`text-base font-bold mt-0.5 ${conflictCount > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{conflictCount}</p>
              </div>
            </div>

            {/* Transaction Queue Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <div className="flex items-center justify-between border-b pb-2">
                    <TabsList className="h-8">
                      <TabsTrigger value="ALL" className="text-xs px-2.5">All</TabsTrigger>
                      <TabsTrigger value="PENDING" className="text-xs px-2.5">
                        Pending ({pendingCount})
                      </TabsTrigger>
                      <TabsTrigger value="FAILED" className="text-xs px-2.5 text-destructive">
                        Failed ({failedCount})
                      </TabsTrigger>
                      <TabsTrigger value="CONFLICT" className="text-xs px-2.5 text-amber-600">
                        Conflict ({conflictCount})
                      </TabsTrigger>
                      <TabsTrigger value="COMMITTED" className="text-xs px-2.5">
                        Synced ({committedCount})
                      </TabsTrigger>
                    </TabsList>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadItems}
                      disabled={itemsLoading}
                      className="h-7 text-xs"
                    >
                      <RefreshCw className={`h-3 w-3 ${itemsLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </div>

                  <TabsContent value={activeTab} className="pt-2">
                    {itemsLoading ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        Loading outbox queue...
                      </div>
                    ) : outboxItems.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground border rounded-lg bg-muted/10">
                        No transactions found in this view.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {outboxItems.map((item) => {
                          let orderNumber = "—";
                          try {
                            const p = JSON.parse(item.payload_json);
                            orderNumber = p.order_number || p.client_order_id || p.order_id || "—";
                          } catch {
                            // ignore
                          }

                          const isActionable = item.status === "FAILED" || item.status === "CONFLICT";
                          const isRetrying = retryingId === item.client_tx_id;

                          return (
                            <div
                              key={item.client_tx_id}
                              className="flex items-center justify-between p-2.5 rounded-lg border text-xs bg-card hover:bg-muted/40 transition-colors"
                            >
                              <div className="space-y-1 min-w-0 flex-1 pr-3">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] uppercase font-mono font-bold">
                                    {item.operation_type}
                                  </Badge>
                                  <span className="font-semibold text-foreground truncate">
                                    {orderNumber}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className={`text-[10px] uppercase font-bold ${
                                      item.status === "COMMITTED"
                                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                        : item.status === "FAILED"
                                        ? "bg-destructive/15 text-destructive"
                                        : item.status === "CONFLICT"
                                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                        : item.status === "SENDING"
                                        ? "bg-primary/15 text-primary"
                                        : "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                                    }`}
                                  >
                                    {item.status}
                                  </Badge>
                                </div>

                                {item.last_error && (
                                  <p className="text-[11px] text-destructive break-words line-clamp-2">
                                    Error: {item.last_error}
                                  </p>
                                )}

                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                  <span>Created: {new Date(item.created_at).toLocaleTimeString()}</span>
                                  {item.retry_count > 0 && <span>Retries: {item.retry_count}</span>}
                                  {item.next_retry_at && (
                                    <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                                      <Clock className="h-2.5 w-2.5" /> Next: {new Date(item.next_retry_at).toLocaleTimeString()}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {isActionable && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isRetrying}
                                  onClick={() => handleRetryItem(item.client_tx_id)}
                                  className="h-7 text-xs gap-1 shrink-0 border-primary/40 text-primary hover:bg-primary/10"
                                >
                                  <RotateCcw className={`h-3 w-3 ${isRetrying ? "animate-spin" : ""}`} />
                                  Retry
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
