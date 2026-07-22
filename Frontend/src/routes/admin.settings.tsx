import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Store, ClipboardCheck, Settings as SettingsIcon, ArrowRight } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { usePendingClients } from "@/lib/pending-clients-store";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const pending = usePendingClients().filter((p) => p.status === "pending").length;
  const [profile, setProfile] = useState({ name: "NextVisit", logo: "", contact: "support@growthos.com" });
  const [platform, setPlatform] = useState({ defaultPlan: "Free Trial", trialDays: "60", maxClients: "500", currency: "INR" });
  return (
    <>
      <PageHeader title="Admin settings" description="Platform profile, approvals and defaults." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-display flex items-center gap-2"><Store className="h-4 w-4 text-primary" /> Business profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Platform name" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} />
            <Field label="Logo URL" value={profile.logo} onChange={(v) => setProfile({ ...profile, logo: v })} placeholder="https://…" />
            <Field label="Support contact" value={profile.contact} onChange={(v) => setProfile({ ...profile, contact: v })} />
            <div className="flex justify-end"><Button onClick={() => toast.success("Profile saved")} className="rounded-full gradient-brand text-primary-foreground">Save</Button></div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-display flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary" /> Client approvals</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="text-sm text-muted-foreground">Pending approvals</p>
                <p className="font-display text-3xl font-semibold">{pending}</p>
              </div>
              <Badge variant={pending ? "default" : "secondary"} className="rounded-full">{pending ? "Action needed" : "All clear"}</Badge>
            </div>
            <Button asChild className="w-full rounded-full" variant="outline">
              <Link to="/admin/approvals">Review approvals <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader><CardTitle className="font-display flex items-center gap-2"><SettingsIcon className="h-4 w-4 text-primary" /> Platform settings</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Default plan</Label>
              <Select value={platform.defaultPlan} onValueChange={(v) => setPlatform({ ...platform, defaultPlan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Free Trial">Free Trial (2 months)</SelectItem>
                  <SelectItem value="Starter">Starter</SelectItem>
                  <SelectItem value="Professional">Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field label="Trial period (days)" value={platform.trialDays} onChange={(v) => setPlatform({ ...platform, trialDays: v })} />
            <Field label="Max clients allowed" value={platform.maxClients} onChange={(v) => setPlatform({ ...platform, maxClients: v })} />
            <div className="space-y-1.5">
              <Label>Default currency</Label>
              <Select value={platform.currency} onValueChange={(v) => setPlatform({ ...platform, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">₹ INR (Indian Rupee)</SelectItem>
                  <SelectItem value="USD">$ USD</SelectItem>
                  <SelectItem value="EUR">€ EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button onClick={() => toast.success("Platform settings saved")} className="rounded-full gradient-brand text-primary-foreground">Save platform settings</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (<div className="space-y-1.5"><Label>{label}</Label><Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></div>);
}