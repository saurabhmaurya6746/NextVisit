import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { SkeletonRows } from "@/components/skeletons";
import { toast } from "sonner";
import { Store, Plus, Trash2, UtensilsCrossed, Scissors, QrCode, Upload, Loader2, AlertTriangle } from "lucide-react";
import { useBusinessType, setBusinessType, resetOnboarding, type BusinessType } from "@/lib/business-type";
import { useProfile, saveProfile } from "@/lib/business-profile";
import { useMenu, saveMenu, type MenuItem } from "@/lib/menu-store";
import { cn } from "@/lib/utils";
import { openWizard, clearDraft } from "@/lib/wizard-store";
import { API_BASE_URL } from "@/lib/auth";
import {
  getBusinessSettingsApi,
  updateBusinessSettingsApi,
  getBusinessProfileApi,
  updateBusinessProfileApi,
  uploadPaymentQRApi,
  type BusinessSettings,
  type BusinessProfile,
} from "@/lib/business-settings-api";

export const Route = createFileRoute("/app/$type/$business/settings")({ component: SettingsPage });

function SettingsPage() {
  const type = useBusinessType();
  const restaurantProfile = useProfile("restaurant");
  const salonProfile = useProfile("salon");

  // Remote state
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch settings & profile on mount
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profData, settsData] = await Promise.all([
        getBusinessProfileApi(),
        getBusinessSettingsApi(),
      ]);
      setProfile(profData);
      setSettings(settsData);
    } catch (err: any) {
      console.error("[SETTINGS] Error loading business settings/profile:", err);
      setError(err.message || "Failed to load settings from server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Settings"
          description="Loading business configuration..."
          actions={<Badge variant="outline" className="rounded-full capitalize">{type}</Badge>}
        />
        <Card className="rounded-2xl p-6">
          <SkeletonRows rows={6} cols={2} />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Settings"
          description="Business profile, menu / services, hours, integrations and preferences."
          actions={<Badge variant="outline" className="rounded-full capitalize">{type}</Badge>}
        />
        <EmptyState
          title="Failed to load settings"
          description={error}
          icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
          action={
            <Button variant="outline" className="rounded-full" onClick={loadData}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Business profile, menu / services, hours, integrations and preferences."
        actions={<Badge variant="outline" className="rounded-full capitalize">{type}</Badge>}
      />
      <Tabs defaultValue="profile">
        <TabsList className="flex flex-wrap gap-1 rounded-full">
          <TabsTrigger value="profile" className="rounded-full">Profile</TabsTrigger>
          <TabsTrigger value="type" className="rounded-full">Business type</TabsTrigger>
          {type === "restaurant" ? (
            <>
              <TabsTrigger value="menu" className="rounded-full">Menu</TabsTrigger>
              <TabsTrigger value="tables" className="rounded-full">Tables</TabsTrigger>
              <TabsTrigger value="gst" className="rounded-full">GST & tax</TabsTrigger>
            </>
          ) : (
            <TabsTrigger value="services" className="rounded-full">Services</TabsTrigger>
          )}
          <TabsTrigger value="hours" className="rounded-full">Hours</TabsTrigger>
          <TabsTrigger value="channels" className="rounded-full">Channels</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-full">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <ProfileTab
            type={type}
            initialProfile={profile}
            initialSettings={settings}
            onSaved={loadData}
          />
        </TabsContent>

        <TabsContent value="type" className="mt-4">
          <BusinessTypeTab current={type} />
        </TabsContent>

        {type === "restaurant" && (
          <>
            <TabsContent value="menu" className="mt-4">
              <MenuTab />
            </TabsContent>
            <TabsContent value="tables" className="mt-4">
              <TablesTab restaurant={restaurantProfile} />
            </TabsContent>
            <TabsContent value="gst" className="mt-4">
              <GstTab
                restaurant={restaurantProfile}
                initialSettings={settings}
                onSaved={loadData}
              />
            </TabsContent>
          </>
        )}

        {type === "salon" && (
          <TabsContent value="services" className="mt-4">
            <ServicesTab salon={salonProfile} />
          </TabsContent>
        )}

        <TabsContent value="hours" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="font-display">Business hours</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d) => (
                <div key={d} className="grid grid-cols-[100px_1fr_auto] items-center gap-3">
                  <p className="text-sm">{d}</p>
                  <Input defaultValue="12:00 PM – 11:00 PM" />
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl"><CardHeader><CardTitle className="font-display">WhatsApp</CardTitle></CardHeader><CardContent className="space-y-3"><Input placeholder="+91 98765 43210" defaultValue="+91 98765 43210" /><Textarea rows={3} placeholder="Signature line" defaultValue="— Aroma Bistro · Mumbai" /><Button className="w-full rounded-full gradient-brand text-primary-foreground" onClick={() => toast.success("WhatsApp settings saved")}>Save</Button></CardContent></Card>
          <Card className="rounded-2xl"><CardHeader><CardTitle className="font-display">Email</CardTitle></CardHeader><CardContent className="space-y-3"><Input defaultValue="hello@aromabistro.com" /><Input placeholder="Reply-to name" defaultValue="Priya from Aroma Bistro" /><Button className="w-full rounded-full gradient-brand text-primary-foreground" onClick={() => toast.success("Email settings saved")}>Save</Button></CardContent></Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 grid gap-3">
          {["New booking", "Big spender walked in", "Low WhatsApp credits", "Weekly summary email", "Negative review alert"].map((n) => (
            <Card key={n} className="rounded-2xl"><CardContent className="flex items-center justify-between p-4"><span className="text-sm">{n}</span><Switch defaultChecked /></CardContent></Card>
          ))}
        </TabsContent>
      </Tabs>
    </>
  );
}

function ProfileTab({
  type,
  initialProfile,
  initialSettings,
  onSaved,
}: {
  type: BusinessType;
  initialProfile: BusinessProfile | null;
  initialSettings: BusinessSettings | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initialProfile?.name || "");
  const [phone, setPhone] = useState(initialProfile?.phone || "");
  const [currency, setCurrency] = useState(initialProfile?.currency || initialSettings?.currency || "USD");
  const [address, setAddress] = useState(initialProfile?.address || "");
  const [logoUrl, setLogoUrl] = useState(initialProfile?.logo_url || initialSettings?.logo || "");

  const [upiId, setUpiId] = useState(initialSettings?.payment_upi_id || "");
  const [reviewLink, setReviewLink] = useState(initialSettings?.review_link || "");
  const [bookingLink, setBookingLink] = useState(initialSettings?.booking_link || "");
  const [qrImageUrl, setQrImageUrl] = useState(initialSettings?.payment_qr_image || "");

  const [saving, setSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);

  // Sync state if props change
  useEffect(() => {
    if (initialProfile) {
      setName(initialProfile.name || "");
      setPhone(initialProfile.phone || "");
      setCurrency(initialProfile.currency || "USD");
      setAddress(initialProfile.address || "");
      setLogoUrl(initialProfile.logo_url || "");
    }
    if (initialSettings) {
      setUpiId(initialSettings.payment_upi_id || "");
      setReviewLink(initialSettings.review_link || "");
      setBookingLink(initialSettings.booking_link || "");
      setQrImageUrl(initialSettings.payment_qr_image || "");
    }
  }, [initialProfile, initialSettings]);

  // Save profile & settings handler
  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateBusinessProfileApi({
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          currency: currency.trim() || undefined,
          address: address.trim() || undefined,
          logo_url: logoUrl.trim() || undefined,
        }),
        updateBusinessSettingsApi({
          currency: currency.trim() || undefined,
          payment_upi_id: upiId.trim() || undefined,
          review_link: reviewLink.trim() || undefined,
          booking_link: bookingLink.trim() || undefined,
          logo: logoUrl.trim() || undefined,
          payment_qr_image: qrImageUrl || undefined,
        }),
      ]);
      saveProfile(type, { name, currency, logo: logoUrl, upiQr: qrImageUrl });
      toast.success("Business profile & settings saved successfully!");
      onSaved();
    } catch (err: any) {
      console.error("[SETTINGS] Error saving profile:", err);
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  // Payment QR upload handler
  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingQr(true);
    try {
      const res = await uploadPaymentQRApi(file);
      setQrImageUrl(res.payment_qr_image);
      toast.success(res.message || "Payment QR code uploaded successfully!");
      onSaved();
    } catch (err: any) {
      console.error("[SETTINGS] Upload QR error:", err);
      toast.error(err.message || "Failed to upload Payment QR image.");
    } finally {
      setUploadingQr(false);
    }
  };

  const formattedQrUrl = qrImageUrl?.startsWith("http")
    ? qrImageUrl
    : qrImageUrl
    ? `${API_BASE_URL}${qrImageUrl.startsWith("/") ? "" : "/"}${qrImageUrl}`
    : null;

  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="font-display">Business Profile & Payment Settings</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {/* Logo & Basic Info */}
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-glow">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full rounded-2xl object-cover" />
            ) : (
              <Store className="h-7 w-7" />
            )}
          </div>
          <div className="flex-1 max-w-sm">
            <Label className="text-xs">Logo Image URL</Label>
            <Input placeholder="https://..." value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Fld label="Business name" value={name} onChange={setName} />
          <Fld label="Phone" value={phone} onChange={setPhone} />
          <Fld label="Currency (e.g. USD, INR, EUR)" value={currency} onChange={setCurrency} />
          <Fld label="Address" value={address} onChange={setAddress} />
          <Fld label="UPI ID (for payments)" value={upiId} onChange={setUpiId} />
          <Fld label="Google review link" value={reviewLink} onChange={setReviewLink} />
          <Fld label="Online booking link" value={bookingLink} onChange={setBookingLink} />
        </div>

        {/* Payment QR Code Upload & Preview */}
        <div className="rounded-2xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-primary" /> Payment QR Code
              </p>
              <p className="text-xs text-muted-foreground">Upload a PNG, JPG, or WEBP QR code image (max 5 MB).</p>
            </div>
            <div className="relative">
              <input
                type="file"
                id="qr-upload-input"
                accept="image/*"
                className="hidden"
                onChange={handleQrUpload}
                disabled={uploadingQr}
              />
              <Label
                htmlFor="qr-upload-input"
                className={cn(
                  "cursor-pointer inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium border bg-muted/60 hover:bg-muted transition-colors",
                  uploadingQr && "opacity-50 pointer-events-none"
                )}
              >
                {uploadingQr ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 text-primary" /> Upload QR Code
                  </>
                )}
              </Label>
            </div>
          </div>

          {/* QR Code Preview */}
          <div className="flex items-center gap-4 pt-2">
            {formattedQrUrl ? (
              <div className="relative h-28 w-28 rounded-xl border p-1 bg-background shadow-sm">
                <img
                  src={formattedQrUrl}
                  alt="Payment QR Code"
                  className="h-full w-full object-contain rounded-lg"
                />
              </div>
            ) : (
              <div className="h-28 w-28 rounded-xl border border-dashed flex flex-col items-center justify-center p-2 text-center bg-muted/20 text-muted-foreground">
                <QrCode className="h-8 w-8 mb-1 opacity-40" />
                <span className="text-[10px]">No QR code uploaded yet</span>
              </div>
            )}
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Usage in Customer Flow:</p>
              <p>Customers can scan this QR code at checkout to make direct digital payments.</p>
              {formattedQrUrl && (
                <p className="truncate font-mono text-[10px] text-primary">{formattedQrUrl}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            disabled={saving}
            className="rounded-full gradient-brand text-primary-foreground"
            onClick={handleSave}
          >
            {saving ? "Saving..." : "Save Profile & Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BusinessTypeTab({ current }: { current: BusinessType }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="font-display">Business type</CardTitle><p className="text-xs text-muted-foreground">Switch the app between Restaurant and Salon layouts.</p></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {(["restaurant", "salon"] as BusinessType[]).map((t) => (
          <button key={t} onClick={() => { setBusinessType(t); toast.success(`Switched to ${t}`); }}
            className={cn("rounded-2xl border p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-glow",
              current === t ? "border-primary bg-primary/5 shadow-elegant" : "hover:border-primary/50")}>
            <div className="grid h-11 w-11 place-items-center rounded-xl gradient-brand text-primary-foreground">
              {t === "restaurant" ? <UtensilsCrossed className="h-5 w-5" /> : <Scissors className="h-5 w-5" />}
            </div>
            <p className="mt-3 font-display text-lg font-semibold capitalize">{t}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t === "restaurant" ? "Orders, tables, menu" : "Appointments, services, staff"}
            </p>
          </button>
        ))}
        <div className="sm:col-span-2 flex justify-end">
          <Button variant="outline" className="rounded-full" onClick={() => { clearDraft(); resetOnboarding(current); openWizard(); toast.success("Starting setup wizard…"); }}>
            Start setup wizard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MenuTab() {
  const items = useMenu();
  const [list, setList] = useState<MenuItem[]>(items);
  function add() {
    setList([...list, { id: `m${Date.now().toString(36)}`, name: "New item", price: 0, category: "Mains", available: true }]);
  }
  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle className="font-display">Menu management</CardTitle><p className="text-xs text-muted-foreground">Categories, prices and availability used by the Orders flow.</p></div>
        <Button size="sm" variant="outline" className="rounded-full" onClick={add}><Plus className="mr-1.5 h-4 w-4" /> Add item</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.map((it, i) => (
          <div key={it.id} className="grid grid-cols-[1fr_120px_90px_1fr_auto_auto] items-center gap-2">
            <Input value={it.name} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            <Input value={it.category} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, category: e.target.value } : x))} />
            <Input type="number" value={it.price} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, price: +e.target.value } : x))} />
            <Input placeholder="Image URL (optional)" value={it.image || ""} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, image: e.target.value } : x))} />
            <Switch checked={it.available} onCheckedChange={(v) => setList(list.map((x, j) => j === i ? { ...x, available: v } : x))} />
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setList(list.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
        <div className="flex justify-end pt-2">
          <Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => { saveMenu(list); toast.success("Menu saved"); }}>Save menu</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function GstTab({
  restaurant,
  initialSettings,
  onSaved,
}: {
  restaurant: any;
  initialSettings: BusinessSettings | null;
  onSaved: () => void;
}) {
  const [taxPct, setTaxPct] = useState<number>(initialSettings?.tax_percentage ?? restaurant.gstPercent ?? 5);
  const [serviceCharge, setServiceCharge] = useState<number>(initialSettings?.service_charge ?? 0);
  const [gstEnabled, setGstEnabled] = useState(restaurant.gstEnabled ?? true);
  const [gstNumber, setGstNumber] = useState(restaurant.gstNumber ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialSettings) {
      setTaxPct(initialSettings.tax_percentage ?? 5);
      setServiceCharge(initialSettings.service_charge ?? 0);
    }
  }, [initialSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBusinessSettingsApi({
        tax_percentage: Number(taxPct) || 0,
        service_charge: Number(serviceCharge) || 0,
      });
      saveProfile("restaurant", {
        ...restaurant,
        gstEnabled,
        gstNumber,
        gstPercent: taxPct,
      });
      toast.success("Tax & service charge settings saved!");
      onSaved();
    } catch (err: any) {
      console.error("[SETTINGS] Error saving GST/tax settings:", err);
      toast.error(err.message || "Failed to save tax settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="font-display">GST & Tax Settings</CardTitle><p className="text-xs text-muted-foreground">Configures tax rate and service charges applied on invoices.</p></CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between rounded-xl border p-3">
          <span>Enable GST on invoices</span>
          <Switch checked={gstEnabled} onCheckedChange={setGstEnabled} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <Fld label="GSTIN Number" value={gstNumber} onChange={setGstNumber} />
          <div className="space-y-1.5">
            <Label>Tax Percentage (%)</Label>
            <Input type="number" value={taxPct} onChange={(e) => setTaxPct(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Service Charge (%)</Label>
            <Input type="number" value={serviceCharge} onChange={(e) => setServiceCharge(Number(e.target.value))} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button disabled={saving} className="rounded-full gradient-brand text-primary-foreground" onClick={handleSave}>
            {saving ? "Saving..." : "Save Tax Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TablesTab({ restaurant }: { restaurant: any }) {
  const [p, setP] = useState(restaurant);
  function setCount(n: number) {
    n = Math.max(1, Math.min(50, n));
    const names = Array.from({ length: n }, (_, i) => p.tableNames[i] || `Table ${i + 1}`);
    setP({ ...p, tables: n, tableNames: names });
  }
  const holdOptions = [
    { v: 0, label: "Immediate" },
    { v: 30_000, label: "30 seconds" },
    { v: 60_000, label: "60 seconds" },
    { v: 120_000, label: "120 seconds" },
  ];
  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="font-display">Table management</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label>Number of tables</Label><Input type="number" value={p.tables} onChange={(e) => setCount(+e.target.value || 1)} /></div>
          <label className="flex items-center gap-3 rounded-xl border p-3"><Switch checked={p.parcel} onCheckedChange={(v) => setP({ ...p, parcel: v })} /><span>Parcel enabled</span></label>
          <label className="flex items-center gap-3 rounded-xl border p-3"><Switch checked={p.takeaway} onCheckedChange={(v) => setP({ ...p, takeaway: v })} /><span>Take Away enabled</span></label>
        </div>
        <div>
          <Label>Paid → Empty transition</Label>
          <p className="text-xs text-muted-foreground">How long a table shows "Paid" before auto-clearing to Empty.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {holdOptions.map((o) => (
              <button key={o.v} type="button" onClick={() => setP({ ...p, paidHoldMs: o.v })}
                className={cn("rounded-full border px-3 py-1 text-xs transition-all",
                  (p.paidHoldMs ?? 30_000) === o.v ? "gradient-brand text-primary-foreground border-transparent" : "hover:border-primary")}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {p.tableNames.map((n: string, i: number) => (
            <Input key={i} value={n} onChange={(e) => setP({ ...p, tableNames: p.tableNames.map((x: string, j: number) => j === i ? e.target.value : x) })} />
          ))}
        </div>
        <div className="flex justify-end">
          <Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => { saveProfile("restaurant", p); toast.success("Tables saved"); }}>Save tables</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ServicesTab({ salon }: { salon: any }) {
  const [p, setP] = useState(salon);
  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle className="font-display">Services</CardTitle><p className="text-xs text-muted-foreground">Used by the Appointments flow.</p></div>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setP({ ...p, services: [...p.services, { name: "New service", price: 0, duration: 30 }] })}>
          <Plus className="mr-1.5 h-4 w-4" /> Add service
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {p.services.map((s: any, i: number) => (
          <div key={i} className="grid grid-cols-[1fr_90px_90px_auto] items-center gap-2">
            <Input value={s.name} onChange={(e) => setP({ ...p, services: p.services.map((x: any, j: number) => j === i ? { ...x, name: e.target.value } : x) })} />
            <Input type="number" value={s.price} onChange={(e) => setP({ ...p, services: p.services.map((x: any, j: number) => j === i ? { ...x, price: +e.target.value } : x) })} />
            <Input type="number" value={s.duration} onChange={(e) => setP({ ...p, services: p.services.map((x: any, j: number) => j === i ? { ...x, duration: +e.target.value } : x) })} />
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setP({ ...p, services: p.services.filter((_: any, j: number) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
        <div className="flex justify-end pt-2">
          <Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => { saveProfile("salon", p); toast.success("Services saved"); }}>Save services</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Fld({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (<div className="space-y-1.5"><Label>{label}</Label><Input value={value || ""} onChange={(e) => onChange(e.target.value)} /></div>);
}