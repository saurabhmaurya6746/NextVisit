import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Printer,
  RefreshCw,
  Wifi,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Scissors,
  DollarSign,
  Play,
  Save,
} from "lucide-react";
import {
  PrinterConfig,
  getPrinterConfig,
  savePrinterConfig,
  listSystemPrinters,
  printTestReceipt,
} from "@/lib/printer/printer-service";
import { isDesktopApp } from "@/lib/desktop";
import { getSession } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigSaved?: (config: PrinterConfig) => void;
}

export function PrinterSettingsDialog({ open, onOpenChange, onConfigSaved }: Props) {
  const session = getSession();
  const businessId = session?.clientId || "default";
  const isDesktop = isDesktopApp();

  const [config, setConfig] = useState<PrinterConfig>(() => getPrinterConfig(businessId));
  const [systemPrinters, setSystemPrinters] = useState<string[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [testingPrint, setTestingPrint] = useState(false);

  // Sync state whenever dialog opens
  useEffect(() => {
    if (open) {
      const current = getPrinterConfig(businessId);
      setConfig(current);
      if (isDesktop) {
        fetchPrinters();
      }
    }
  }, [open, businessId, isDesktop]);

  const fetchPrinters = async () => {
    setLoadingPrinters(true);
    try {
      const list = await listSystemPrinters();
      setSystemPrinters(list);
      // If system printer is not set, select the first one if available
      if (list.length > 0 && !config.system_printer_name) {
        setConfig((prev) => ({ ...prev, system_printer_name: list[0] }));
      }
    } catch (err) {
      console.warn("Failed to query system printers:", err);
    } finally {
      setLoadingPrinters(false);
    }
  };

  const handleSave = () => {
    savePrinterConfig(businessId, config);
    toast.success("Printer configuration saved!");
    if (onConfigSaved) onConfigSaved(config);
    onOpenChange(false);
  };

  const handleTestPrint = async () => {
    setTestingPrint(true);
    try {
      const res = await printTestReceipt(config);
      if (res.success) {
        toast.success(res.message, {
          description: `Mode: ${res.method_used} (${res.bytes_sent} bytes dispatched)`,
        });
      } else {
        toast.error(`Test slip failed: ${res.message}`, {
          description: "Verify that the printer is turned on, has paper, and cables/network are connected.",
        });
      }
    } catch (err: any) {
      toast.error(`Print test error: ${err?.message || String(err)}`);
    } finally {
      setTestingPrint(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-5 border-b shrink-0 bg-background">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Printer className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-display text-base">Receipt & Thermal Printer Setup</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Configure ESC/POS thermal printing for physical POS counter or browser fallback.
                </DialogDescription>
              </div>
            </div>
            {isDesktop ? (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                Desktop POS Mode
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                Web Browser Mode
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 1. Connection Target Selector */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Printer Connection Method
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setConfig((p) => ({ ...p, target: "SYSTEM" }))}
                disabled={!isDesktop}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24",
                  config.target === "SYSTEM"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20 text-foreground"
                    : "border-border/60 hover:border-border text-muted-foreground",
                  !isDesktop && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <Monitor className="h-4 w-4 text-primary" />
                  {config.target === "SYSTEM" && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Windows Spooler</p>
                  <p className="text-[10px] leading-tight text-muted-foreground mt-0.5">USB / Bluetooth / Driver</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setConfig((p) => ({ ...p, target: "NETWORK" }))}
                disabled={!isDesktop}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24",
                  config.target === "NETWORK"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20 text-foreground"
                    : "border-border/60 hover:border-border text-muted-foreground",
                  !isDesktop && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <Wifi className="h-4 w-4 text-primary" />
                  {config.target === "NETWORK" && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Network (TCP)</p>
                  <p className="text-[10px] leading-tight text-muted-foreground mt-0.5">LAN / Wi-Fi (Port 9100)</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setConfig((p) => ({ ...p, target: "BROWSER" }))}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24",
                  config.target === "BROWSER"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20 text-foreground"
                    : "border-border/60 hover:border-border text-muted-foreground"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <Printer className="h-4 w-4 text-primary" />
                  {config.target === "BROWSER" && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Browser Print</p>
                  <p className="text-[10px] leading-tight text-muted-foreground mt-0.5">Standard OS dialog</p>
                </div>
              </button>
            </div>
            {!isDesktop && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg">
                Direct ESC/POS hardware spooler and raw socket streaming require the NextVisit Desktop app. Browser mode will use system print dialog.
              </p>
            )}
          </div>

          {/* 2. Target Specific Settings */}
          {config.target === "SYSTEM" && isDesktop && (
            <div className="rounded-xl border p-3.5 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Installed Windows Printer</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchPrinters}
                  disabled={loadingPrinters}
                  className="h-7 text-xs gap-1.5 px-2"
                >
                  <RefreshCw className={cn("h-3 w-3", loadingPrinters && "animate-spin")} /> Refresh
                </Button>
              </div>

              {systemPrinters.length > 0 ? (
                <Select
                  value={config.system_printer_name || ""}
                  onValueChange={(val) => setConfig((p) => ({ ...p, system_printer_name: val }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select installed printer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {systemPrinters.map((p) => (
                      <SelectItem key={p} value={p} className="text-xs font-mono">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-center py-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                  {loadingPrinters ? "Scanning Windows printers..." : "No Windows printers detected. Install USB/POS driver or use Browser mode."}
                </div>
              )}
            </div>
          )}

          {config.target === "NETWORK" && isDesktop && (
            <div className="rounded-xl border p-3.5 bg-card space-y-3">
              <Label className="text-xs font-semibold">Network POS Device (Raw Port 9100)</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">IP Address / Hostname</span>
                  <Input
                    placeholder="192.168.1.200"
                    value={config.network_host || ""}
                    onChange={(e) => setConfig((p) => ({ ...p, network_host: e.target.value.trim() }))}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Port</span>
                  <Input
                    type="number"
                    value={config.network_port || 9100}
                    onChange={(e) => setConfig((p) => ({ ...p, network_port: parseInt(e.target.value, 10) || 9100 }))}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. Paper Width Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Thermal Paper Width
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfig((p) => ({ ...p, paper_width: "58mm" }))}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between",
                  config.paper_width === "58mm"
                    ? "border-primary bg-primary/5 text-foreground font-semibold"
                    : "border-border/60 hover:border-border text-muted-foreground"
                )}
              >
                <div>
                  <p className="text-xs font-bold">58mm (2 Inch)</p>
                  <p className="text-[10px] text-muted-foreground">32 columns (Compact receipt)</p>
                </div>
                {config.paper_width === "58mm" && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </button>

              <button
                type="button"
                onClick={() => setConfig((p) => ({ ...p, paper_width: "80mm" }))}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between",
                  config.paper_width === "80mm"
                    ? "border-primary bg-primary/5 text-foreground font-semibold"
                    : "border-border/60 hover:border-border text-muted-foreground"
                )}
              >
                <div>
                  <p className="text-xs font-bold">80mm (3 Inch)</p>
                  <p className="text-[10px] text-muted-foreground">48 columns (Standard POS)</p>
                </div>
                {config.paper_width === "80mm" && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </button>
            </div>
          </div>

          {/* 4. Hardware Behavior Options */}
          <div className="rounded-xl border p-4 bg-card space-y-3.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hardware Actions
            </Label>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Scissors className="h-3.5 w-3.5 text-primary" /> Auto-Cut Paper
                </div>
                <p className="text-[10px] text-muted-foreground">Sends ESC/POS GS V 1 partial cut command after receipt</p>
              </div>
              <Switch
                checked={config.auto_cut}
                onCheckedChange={(val) => setConfig((p) => ({ ...p, auto_cut: val }))}
              />
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <DollarSign className="h-3.5 w-3.5 text-primary" /> Kick Cash Drawer
                </div>
                <p className="text-[10px] text-muted-foreground">Fires 24V pulse (ESC p 0) to open connected RJ-11 cash drawer</p>
              </div>
              <Switch
                checked={config.open_cash_drawer}
                onCheckedChange={(val) => setConfig((p) => ({ ...p, open_cash_drawer: val }))}
              />
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Printer className="h-3.5 w-3.5 text-primary" /> Auto-Print on Settle
                </div>
                <p className="text-[10px] text-muted-foreground">Automatically sends receipt upon successful order settlement</p>
              </div>
              <Switch
                checked={config.auto_print_on_settle}
                onCheckedChange={(val) => setConfig((p) => ({ ...p, auto_print_on_settle: val }))}
              />
            </div>
          </div>

          {/* Non-fatal Safety Guarantee Notice */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs flex items-start gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px]">
              <strong className="text-foreground">Zero Order Loss Guarantee:</strong> If the physical printer goes offline, runs out of paper, or disconnects, the order and payment are safely preserved in local storage and the system automatically invokes the browser print fallback.
            </p>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-muted/10 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestPrint}
            disabled={testingPrint}
            className="text-xs rounded-full gap-1.5"
          >
            <Play className={cn("h-3.5 w-3.5 text-primary", testingPrint && "animate-spin")} />
            {testingPrint ? "Dispatching..." : "Print Test Slip"}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-full"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="text-xs rounded-full gradient-brand text-primary-foreground font-semibold gap-1.5 px-4"
            >
              <Save className="h-3.5 w-3.5" /> Save Configuration
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
