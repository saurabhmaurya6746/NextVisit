/**
 * NextVisit Desktop POS Device Onboarding Dialog
 *
 * Provides a minimal, robust Windows POS onboarding dialog:
 * - Detects missing device registration or business tenant mismatch on desktop
 * - Enforces Owner/Administrator authorization for new device registration
 * - Collects and client-side validates device name and prefix (1-10 uppercase alphanumeric chars)
 * - Registers device via POST /api/v1/devices
 * - Stores device credentials bound to active business ID (zero token storage)
 * - Immediately triggers full master data sync pull and verifies SQLite durability
 * - Handles duplicate prefix conflicts and network errors gracefully
 * - Allows cache pull retries without re-registering
 */

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Monitor,
  Tablet,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth";
import {
  isDesktopApp,
  getDevicePlatform,
  getDefaultDevicePrefix,
} from "@/lib/desktop";
import {
  registerDeviceApi,
  listDevicesApi,
  getStoredDeviceBinding,
  saveStoredDeviceBinding,
  clearStoredDeviceBinding,
  type ClientDeviceResponse,
} from "@/lib/devices-api";
import { pullAndSyncMasterData } from "@/lib/master-data-cache";

interface DesktopDeviceSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigured?: (deviceId: string) => void;
}

export function DesktopDeviceSetupDialog({
  open,
  onOpenChange,
  onConfigured,
}: DesktopDeviceSetupDialogProps) {
  const session = useSession();
  const currentBusinessId = session?.clientId || "";
  const userRoleUpper = session?.userRole ? session.userRole.toUpperCase() : "";
  const isOwnerOrAdmin =
    userRoleUpper === "OWNER" ||
    userRoleUpper === "ADMIN";

  const detectedPlatform = getDevicePlatform();
  const [deviceType, setDeviceType] = useState<string>(
    detectedPlatform === "WEB" ? "DESKTOP_WINDOWS" : detectedPlatform
  );
  const [deviceName, setDeviceName] = useState(
    detectedPlatform === "ANDROID_MOBILE"
      ? "Handheld Mobile POS"
      : detectedPlatform === "ANDROID_TABLET"
      ? "Table-side Tablet POS"
      : "Main Terminal"
  );
  const [devicePrefix, setDevicePrefix] = useState(
    getDefaultDevicePrefix(detectedPlatform === "WEB" ? "DESKTOP_WINDOWS" : detectedPlatform)
  );
  const [existingDevices, setExistingDevices] = useState<ClientDeviceResponse[]>([]);
  const [selectedExistingId, setSelectedExistingId] = useState<string>("");
  const [useExisting, setUseExisting] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncStep, setSyncStep] = useState<
    "idle" | "registering" | "pulling" | "success" | "sync_error"
  >("idle");
  const [registeredDevice, setRegisteredDevice] = useState<ClientDeviceResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncErrorDetail, setSyncErrorDetail] = useState<string | null>(null);

  const binding = getStoredDeviceBinding(currentBusinessId);

  // Load existing registered devices for this business if user is owner/admin
  useEffect(() => {
    if (open && isDesktopApp() && currentBusinessId && isOwnerOrAdmin) {
      listDevicesApi()
        .then((devices) => {
          const active = devices.filter((d) => d.is_active);
          setExistingDevices(active);
          if (active.length > 0 && !binding.deviceId) {
            setUseExisting(true);
            setSelectedExistingId(active[0].id);
          }
        })
        .catch(() => {
          // Non-blocking; user can still register new device
        });
    }
  }, [open, currentBusinessId, isOwnerOrAdmin]);

  // Clean and format prefix on change
  function handlePrefixChange(val: string) {
    const formatted = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    setDevicePrefix(formatted);
  }

  // Initial registration submission
  async function handleRegisterOrBind(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSyncErrorDetail(null);

    if (!isOwnerOrAdmin) {
      setErrorMessage(
        "Only owners and administrators are authorized to register or configure POS terminals."
      );
      return;
    }

    if (!currentBusinessId) {
      setErrorMessage("No active business session found. Please log in again.");
      return;
    }

    setIsSubmitting(true);
    let targetDevice: ClientDeviceResponse | null = null;

    try {
      if (useExisting && selectedExistingId) {
        // Binding to an existing active device profile
        const found = existingDevices.find((d) => d.id === selectedExistingId);
        if (!found) {
          throw new Error("Selected device profile was not found.");
        }
        targetDevice = found;
      } else {
        // Registering a new device
        if (!deviceName.trim()) {
          throw new Error("Device name is required (e.g., 'Main Counter POS').");
        }
        if (!/^[A-Z0-9]{1,10}$/.test(devicePrefix)) {
          throw new Error(
            "Device prefix must be 1-10 uppercase alphanumeric characters (e.g., 'POS01', 'D1')."
          );
        }

        setSyncStep("registering");
        targetDevice = await registerDeviceApi({
          device_name: deviceName.trim(),
          device_type: deviceType,
          device_prefix: devicePrefix,
          device_identifier: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 100) : null,
        });
      }

      // 1. Save device binding to localStorage (zero tokens stored)
      saveStoredDeviceBinding(targetDevice);
      setRegisteredDevice(targetDevice);

      // 2. Perform initial master data pull & SQLite cache verification
      await executeInitialPull(targetDevice.id, currentBusinessId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setSyncStep("idle");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Pulls master data and verifies SQLite durability
  async function executeInitialPull(deviceId: string, businessId: string) {
    setSyncStep("pulling");
    setSyncErrorDetail(null);

    const pullResult = await pullAndSyncMasterData(deviceId, businessId, {
      forceFullSnapshot: true,
    });

    if (pullResult.source === "network" && pullResult.persistedToDesktop) {
      setSyncStep("success");
      toast.success("POS terminal registered and master data cached to SQLite!");
      onConfigured?.(deviceId);
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } else {
      setSyncStep("sync_error");
      const err =
        pullResult.error ||
        "Master data could not be saved to local SQLite. Please check disk permissions and retry.";
      setSyncErrorDetail(err);
    }
  }

  // Retry pull using already registered device ID without duplicate registration
  async function handleRetryPull() {
    const deviceId = registeredDevice?.id || binding.deviceId;
    if (!deviceId || !currentBusinessId) {
      setErrorMessage("Missing device or business identity for retry.");
      return;
    }
    setIsSubmitting(true);
    try {
      await executeInitialPull(deviceId, currentBusinessId);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Reset binding if tenant mismatch occurred
  function handleResetMismatch() {
    clearStoredDeviceBinding();
    setErrorMessage(null);
    setRegisteredDevice(null);
    setSyncStep("idle");
  }

  if (!isDesktopApp()) {
    return null;
  }

  const FormIcon =
    deviceType === "ANDROID_MOBILE"
      ? Smartphone
      : deviceType === "ANDROID_TABLET"
      ? Tablet
      : Monitor;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FormIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {deviceType === "ANDROID_MOBILE"
                  ? "Handheld POS Setup"
                  : deviceType === "ANDROID_TABLET"
                  ? "Tablet POS Setup"
                  : "Windows POS Terminal Setup"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Register this {deviceType === "ANDROID_MOBILE" ? "handheld" : deviceType === "ANDROID_TABLET" ? "tablet" : "desktop"} terminal to enable offline orders, local SQLite caching, and durable cloud sync.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tenant Mismatch Warning */}
        {binding.isMismatch && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Business Account Switch Detected</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed">
              This terminal was previously bound to another business ({binding.boundBusinessId?.slice(0, 8)}...).
              To protect tenant isolation, you must register or bind this terminal for your active business.
            </p>
            <div className="mt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-amber-500/50"
                onClick={handleResetMismatch}
              >
                Clear Previous Terminal Binding
              </Button>
            </div>
          </div>
        )}

        {/* Staff Non-Admin Warning */}
        {!isOwnerOrAdmin && !binding.isMismatch && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>Owner / Administrator Authorization Required</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed">
              Your account ({session?.userRole || "Staff"}) is not authorized to register POS terminals.
              Please have an Owner or Administrator log in on this PC once to complete device setup.
            </p>
          </div>
        )}

        {/* General Error Banner */}
        {errorMessage && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}

        {/* Sync Failure Banner with Retry */}
        {syncStep === "sync_error" && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Device Registered, but Initial Cache Sync Failed</span>
            </div>
            <p className="mt-1 text-[11px]">{syncErrorDetail}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Device ID is safely stored ({registeredDevice?.id?.slice(0, 8)}...). You do not need to re-register.
            </p>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleRetryPull}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Retry Master Data Sync
              </Button>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {syncStep === "success" && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-200">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>POS Terminal Ready & Durable</span>
            </div>
            <p className="mt-1 text-[11px]">
              Device registered and master data safely cached in SQLite for offline viewing.
            </p>
          </div>
        )}

        {/* Registration Form (Visible to Owner/Admin when not in success or sync_error) */}
        {isOwnerOrAdmin && !binding.isMismatch && syncStep !== "success" && syncStep !== "sync_error" && (
          <form onSubmit={handleRegisterOrBind} className="space-y-4 py-2">
            {/* Toggle between existing or new if existing devices exist */}
            {existingDevices.length > 0 && (
              <div className="flex items-center gap-2 border-b pb-3 text-xs">
                <Button
                  type="button"
                  variant={useExisting ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={() => setUseExisting(true)}
                >
                  Bind to Existing Device Profile
                </Button>
                <Button
                  type="button"
                  variant={!useExisting ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={() => setUseExisting(false)}
                >
                  Register New Terminal
                </Button>
              </div>
            )}

            {useExisting && existingDevices.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-xs">Select Registered Terminal</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={selectedExistingId}
                  onChange={(e) => setSelectedExistingId(e.target.value)}
                  disabled={isSubmitting}
                >
                  {existingDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.device_name} (Prefix: {d.device_prefix})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Binds this PC to an existing server device profile and pulls master data.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Device Form Factor</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDeviceType("DESKTOP_WINDOWS");
                        if (devicePrefix === "MOB01" || devicePrefix === "TAB01") setDevicePrefix("POS01");
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs gap-1 transition-colors min-h-[44px] ${
                        deviceType === "DESKTOP_WINDOWS"
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <Monitor className="h-4 w-4" />
                      <span>Desktop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeviceType("ANDROID_TABLET");
                        if (devicePrefix === "POS01" || devicePrefix === "MOB01") setDevicePrefix("TAB01");
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs gap-1 transition-colors min-h-[44px] ${
                        deviceType === "ANDROID_TABLET"
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <Tablet className="h-4 w-4" />
                      <span>Tablet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeviceType("ANDROID_MOBILE");
                        if (devicePrefix === "POS01" || devicePrefix === "TAB01") setDevicePrefix("MOB01");
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs gap-1 transition-colors min-h-[44px] ${
                        deviceType === "ANDROID_MOBILE"
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <Smartphone className="h-4 w-4" />
                      <span>Handheld</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="device-name" className="text-xs">
                    Terminal Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="device-name"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="e.g. Counter 1 Windows POS"
                    maxLength={100}
                    className="h-8 text-xs"
                    disabled={isSubmitting}
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Human-readable label to identify this PC in reports.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="device-prefix" className="text-xs">
                    Order Number Prefix <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="device-prefix"
                    value={devicePrefix}
                    onChange={(e) => handlePrefixChange(e.target.value)}
                    placeholder="e.g. POS01, D1"
                    maxLength={10}
                    className="h-8 font-mono text-xs uppercase"
                    disabled={isSubmitting}
                    required
                  />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>1-10 alphanumeric uppercase characters. Must be unique per business.</span>
                    <Badge variant="outline" className="text-[9px] font-mono px-1 py-0">
                      {devicePrefix || "NONE"}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                className="w-full gap-2 text-xs"
                disabled={isSubmitting || (!useExisting && (!deviceName.trim() || !devicePrefix.trim()))}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {syncStep === "registering"
                      ? "Registering Device on Server..."
                      : "Seeding Local Master Data Cache..."}
                  </>
                ) : (
                  <>
                    <HardDrive className="h-3.5 w-3.5" />
                    {useExisting
                      ? "Bind Terminal & Seed Local Cache"
                      : "Register Terminal & Seed Local Cache"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
