import { createFileRoute, Link } from "@tanstack/react-router";
import { Store, ClipboardCheck, Settings as SettingsIcon, ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  getPlatformSettingsApi,
  updatePlatformSettingsApi,
  listPendingApprovalsApi,
  type PlatformSettingsModel,
} from "@/lib/admin-api";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const [settings, setSettings] = useState<PlatformSettingsModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, aRes] = await Promise.all([
        getPlatformSettingsApi(),
        listPendingApprovalsApi(1, 1),
      ]);
      setSettings(sRes);
      setPendingCount(aRes.total || 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to load platform settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener("nextvisit:admin-data-changed", loadData);
    return () => {
      window.removeEventListener("nextvisit:admin-data-changed", loadData);
    };
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await updatePlatformSettingsApi(settings);
      setSettings(updated);
      toast.success("Global platform settings saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update platform settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading platform configuration…</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Admin settings" description="Global platform profile, client approvals, and system parameters." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" /> Platform Identity & Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field
              label="Platform name"
              value={settings.platform_name}
              onChange={(v) => setSettings({ ...settings, platform_name: v })}
            />
            <Field
              label="Logo URL"
              value={settings.logo_url || ""}
              onChange={(v) => setSettings({ ...settings, logo_url: v })}
              placeholder="https://…"
            />
            <Field
              label="Support Email"
              value={settings.support_email}
              onChange={(v) => setSettings({ ...settings, support_email: v })}
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" /> Client Approvals Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="text-sm text-muted-foreground">Pending Registration Approvals</p>
                <p className="font-display text-3xl font-semibold">{pendingCount}</p>
              </div>
              <Badge variant={pendingCount ? "default" : "secondary"} className="rounded-full">
                {pendingCount ? "Action needed" : "All clear"}
              </Badge>
            </div>
            <Button asChild className="w-full rounded-full" variant="outline">
              <Link to="/admin/approvals">
                Review Approvals <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-primary" /> System Parameters & Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Default Plan</Label>
              <Select
                value={settings.default_plan}
                onValueChange={(v) => setSettings({ ...settings, default_plan: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">FREE</SelectItem>
                  <SelectItem value="STARTER">STARTER</SelectItem>
                  <SelectItem value="PROFESSIONAL">PROFESSIONAL</SelectItem>
                  <SelectItem value="ENTERPRISE">ENTERPRISE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field
              label="Default Trial Period (days)"
              value={settings.trial_days.toString()}
              onChange={(v) => setSettings({ ...settings, trial_days: parseInt(v, 10) || 0 })}
            />
            <Field
              label="Maximum Clients Allowed"
              value={settings.max_clients.toString()}
              onChange={(v) => setSettings({ ...settings, max_clients: parseInt(v, 10) || 1000 })}
            />
            <div className="space-y-1.5">
              <Label>Default Currency</Label>
              <Select
                value={settings.default_currency}
                onValueChange={(v) => setSettings({ ...settings, default_currency: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">₹ INR (Indian Rupee)</SelectItem>
                  <SelectItem value="USD">$ USD</SelectItem>
                  <SelectItem value="EUR">€ EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <Label>Allow New Merchant Registrations</Label>
                <p className="text-xs text-muted-foreground">Enable self-service business signups</p>
              </div>
              <Switch
                checked={settings.allow_new_registrations}
                onCheckedChange={(checked) => setSettings({ ...settings, allow_new_registrations: checked })}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <Label className="text-destructive">Maintenance Mode</Label>
                <p className="text-xs text-muted-foreground">Restrict platform access to Super Admins only</p>
              </div>
              <Switch
                checked={settings.maintenance_mode}
                onCheckedChange={(checked) => setSettings({ ...settings, maintenance_mode: checked })}
              />
            </div>

            <div className="sm:col-span-2 flex justify-end pt-2">
              <Button
                disabled={saving}
                onClick={handleSave}
                className="rounded-full gradient-brand text-primary-foreground shadow-glow"
              >
                {saving ? "Saving settings…" : "Save platform settings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}