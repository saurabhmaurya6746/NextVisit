import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { SkeletonRows } from "@/components/skeletons";
import { toast } from "sonner";
import {
  Store,
  MessageSquare,
  Globe,
  FileText,
  Percent,
  Bell,
  Sparkles,
  Monitor,
  Shield,
  Database,
  QrCode,
  Upload,
  Loader2,
  AlertTriangle,
  Download,
  Key,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/auth";
import {
  getBusinessSettingsApi,
  updateBusinessSettingsApi,
  getBusinessProfileApi,
  updateBusinessProfileApi,
  uploadPaymentQRApi,
  changePasswordApi,
  toggle2faApi,
  getActiveSessionsApi,
  logoutOtherDevicesApi,
  downloadDataExportApi,
  type BusinessSettings,
  type BusinessProfile,
  type UserSessionItem,
} from "@/lib/business-settings-api";

export const Route = createFileRoute("/app/$type/$business/settings")({ component: SettingsPage });

function SettingsPage() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      console.error("[SETTINGS] Load error:", err);
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
        <PageHeader title="Settings" description="Loading business configuration..." />
        <Card className="rounded-2xl p-6">
          <SkeletonRows rows={8} cols={2} />
        </Card>
      </div>
    );
  }

  if (error || !settings || !profile) {
    return (
      <div className="space-y-4">
        <PageHeader title="Settings" description="Business configuration & preferences." />
        <EmptyState
          title="Failed to load settings"
          description={error || "Could not retrieve settings from server."}
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
        description="Day-to-day configuration: General, WhatsApp, Invoices, Tax, AI, POS, Security & Backups."
        actions={<Badge variant="outline" className="rounded-full">{profile.name}</Badge>}
      />

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 rounded-2xl bg-muted/50 p-1.5 h-auto">
          <TabsTrigger value="general" className="rounded-xl gap-1.5 text-xs">
            <Store className="h-3.5 w-3.5" /> General
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="rounded-xl gap-1.5 text-xs">
            <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="google" className="rounded-xl gap-1.5 text-xs">
            <Globe className="h-3.5 w-3.5" /> Google
          </TabsTrigger>
          <TabsTrigger value="invoice" className="rounded-xl gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> Invoice
          </TabsTrigger>
          <TabsTrigger value="tax" className="rounded-xl gap-1.5 text-xs">
            <Percent className="h-3.5 w-3.5" /> Tax
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-xl gap-1.5 text-xs">
            <Bell className="h-3.5 w-3.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="ai" className="rounded-xl gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" /> AI
          </TabsTrigger>
          <TabsTrigger value="pos" className="rounded-xl gap-1.5 text-xs">
            <Monitor className="h-3.5 w-3.5" /> POS
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl gap-1.5 text-xs">
            <Shield className="h-3.5 w-3.5" /> Security
          </TabsTrigger>
          <TabsTrigger value="backup" className="rounded-xl gap-1.5 text-xs">
            <Database className="h-3.5 w-3.5" /> Backup
          </TabsTrigger>
        </TabsList>

        {/* 1. GENERAL TAB */}
        <TabsContent value="general">
          <GeneralTab profile={profile} settings={settings} onSaved={loadData} />
        </TabsContent>

        {/* 2. WHATSAPP TAB */}
        <TabsContent value="whatsapp">
          <WhatsAppTab settings={settings} onSaved={loadData} />
        </TabsContent>

        {/* 3. GOOGLE TAB */}
        <TabsContent value="google">
          <GoogleTab settings={settings} onSaved={loadData} />
        </TabsContent>

        {/* 4. INVOICE TAB */}
        <TabsContent value="invoice">
          <InvoiceTab settings={settings} onSaved={loadData} />
        </TabsContent>

        {/* 5. TAX TAB */}
        <TabsContent value="tax">
          <TaxTab settings={settings} onSaved={loadData} />
        </TabsContent>

        {/* 6. NOTIFICATION TAB */}
        <TabsContent value="notifications">
          <NotificationTab settings={settings} onSaved={loadData} />
        </TabsContent>

        {/* 7. AI TAB */}
        <TabsContent value="ai">
          <AiTab settings={settings} onSaved={loadData} />
        </TabsContent>

        {/* 8. POS TAB */}
        <TabsContent value="pos">
          <PosTab settings={settings} onSaved={loadData} />
        </TabsContent>

        {/* 9. SECURITY TAB */}
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>

        {/* 10. BACKUP TAB */}
        <TabsContent value="backup">
          <BackupTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. GENERAL TAB
 * ────────────────────────────────────────────────────────────────────────────*/
function GeneralTab({ profile, settings, onSaved }: { profile: BusinessProfile; settings: BusinessSettings; onSaved: () => void }) {
  const routerParams = useParams({ strict: false }) as Record<string, string>;
  const isSalon = routerParams?.type === "salon";
  const [logo, setLogo] = useState(settings.logo || profile.logo_url || "");
  const [coverImage, setCoverImage] = useState(settings.cover_image || "");
  const [name, setName] = useState(profile.name || "");
  const [email, setEmail] = useState(profile.email || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [website, setWebsite] = useState(settings.website || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all([
        updateBusinessProfileApi({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          logo_url: logo.trim() || undefined,
        }),
        updateBusinessSettingsApi({
          logo: logo.trim() || undefined,
          cover_image: coverImage.trim() || undefined,
          website: website.trim() || undefined,
        }),
      ]);
      toast.success("General settings saved successfully!");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to save general settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-base">{isSalon ? "General Salon Settings" : "General Restaurant Settings"}</CardTitle>
        <CardDescription>Brand logo, cover image, and primary contact info.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted border overflow-hidden">
              {logo ? <img src={logo} alt="Logo" className="h-full w-full object-cover" /> : <Store className="h-7 w-7 text-muted-foreground" />}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{isSalon ? "Salon Logo URL" : "Restaurant Logo URL"}</Label>
              <Input className="w-64" placeholder="https://..." value={logo} onChange={(e) => setLogo(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="grid h-16 w-32 place-items-center rounded-2xl bg-muted border overflow-hidden">
              {coverImage ? <img src={coverImage} alt="Cover" className="h-full w-full object-cover" /> : <span className="text-[10px] text-muted-foreground">Cover Image</span>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Cover Image URL</Label>
              <Input className="w-64" placeholder="https://..." value={coverImage} onChange={(e) => setCoverImage(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Fld label="Business Name" value={name} onChange={setName} />
          <Fld label="Support Email" value={email} onChange={setEmail} />
          <Fld label="Support Phone" value={phone} onChange={setPhone} />
          <Fld label="Website" value={website} onChange={setWebsite} placeholder="https://yourrestaurant.com" />
        </div>

        <div className="flex justify-end pt-2">
          <Button disabled={saving} onClick={handleSave} className="rounded-full gradient-brand text-primary-foreground font-semibold">
            {saving ? "Saving..." : "Save General Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. WHATSAPP TAB
 * ────────────────────────────────────────────────────────────────────────────*/
function WhatsAppTab({ settings, onSaved }: { settings: BusinessSettings; onSaved: () => void }) {
  const [waNum, setWaNum] = useState(settings.whatsapp_number || "");
  const [countryCode, setCountryCode] = useState(settings.default_country_code || "+91");
  const [signature, setSignature] = useState(settings.default_message_signature || "");
  const [waCampaigns, setWaCampaigns] = useState(settings.enable_whatsapp_campaigns);
  const [welcomeMsgs, setWelcomeMsgs] = useState(settings.enable_welcome_messages);
  const [reviewReqs, setReviewReqs] = useState(settings.review_booster_enabled);
  const [recoveryCamps, setRecoveryCamps] = useState(settings.recovery_enabled);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateBusinessSettingsApi({
        whatsapp_number: waNum.trim() || undefined,
        default_country_code: countryCode.trim(),
        default_message_signature: signature.trim() || undefined,
        enable_whatsapp_campaigns: waCampaigns,
        enable_welcome_messages: welcomeMsgs,
        review_booster_enabled: reviewReqs,
        recovery_enabled: recoveryCamps,
      });
      toast.success("WhatsApp settings updated!");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to update WhatsApp settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-base">WhatsApp Configuration</CardTitle>
        <CardDescription>Manage WhatsApp messaging behavior and automation triggers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Fld label="Business WhatsApp Number" value={waNum} onChange={setWaNum} placeholder="+91 98765 43210" />
          <Fld label="Default Country Code" value={countryCode} onChange={setCountryCode} placeholder="+91" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Default Message Signature</Label>
          <Textarea rows={2} placeholder="e.g. — Aroma Bistro · Mumbai" value={signature} onChange={(e) => setSignature(e.target.value)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleCard title="Enable WhatsApp Campaigns" desc="Send bulk promotional messages via WhatsApp" checked={waCampaigns} onChange={setWaCampaigns} />
          <ToggleCard title="Enable Welcome Messages" desc="Send automated welcome greetings to new customers" checked={welcomeMsgs} onChange={setWelcomeMsgs} />
          <ToggleCard title="Enable Review Requests" desc="Automatically invite customers to leave a Google review" checked={reviewReqs} onChange={setReviewReqs} />
          <ToggleCard title="Enable Recovery Campaigns" desc="Re-engage churned customers with winback offers" checked={recoveryCamps} onChange={setRecoveryCamps} />
        </div>

        <div className="flex justify-end pt-2">
          <Button disabled={saving} onClick={handleSave} className="rounded-full gradient-brand text-primary-foreground font-semibold">
            {saving ? "Saving..." : "Save WhatsApp Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. GOOGLE TAB
 * ────────────────────────────────────────────────────────────────────────────*/
function GoogleTab({ settings, onSaved }: { settings: BusinessSettings; onSaved: () => void }) {
  const [reviewLink, setReviewLink] = useState(settings.review_link || "");
  const [mapsLink, setMapsLink] = useState(settings.maps_link || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateBusinessSettingsApi({
        review_link: reviewLink.trim() || undefined,
        maps_link: mapsLink.trim() || undefined,
      });
      toast.success("Google links updated!");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to update Google links");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-base">Google Business & Review Links</CardTitle>
        <CardDescription>Links used for Google Review Booster campaigns and customer navigation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Fld label="Google Review Link" value={reviewLink} onChange={setReviewLink} placeholder="https://g.page/r/your-review-link/review" />
        <Fld label="Google Maps Location Link" value={mapsLink} onChange={setMapsLink} placeholder="https://maps.google.com/..." />
        <div className="flex justify-end pt-2">
          <Button disabled={saving} onClick={handleSave} className="rounded-full gradient-brand text-primary-foreground font-semibold">
            {saving ? "Saving..." : "Save Google Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. INVOICE TAB
 * ────────────────────────────────────────────────────────────────────────────*/
function InvoiceTab({ settings, onSaved }: { settings: BusinessSettings; onSaved: () => void }) {
  const [prefix, setPrefix] = useState(settings.invoice_prefix || "INV-");
  const [footer, setFooter] = useState(settings.invoice_footer || "Thank you for dining with us!");
  const [showGst, setShowGst] = useState(settings.show_gst_on_invoice);
  const [showQr, setShowQr] = useState(settings.show_qr_on_invoice);
  const [autoPrint, setAutoPrint] = useState(settings.auto_print_invoice);
  const [qrImage, setQrImage] = useState(settings.payment_qr_image || "");
  const [upiId, setUpiId] = useState(settings.payment_upi_id || "");
  const [uploadingQr, setUploadingQr] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateBusinessSettingsApi({
        invoice_prefix: prefix.trim(),
        invoice_footer: footer.trim() || undefined,
        show_gst_on_invoice: showGst,
        show_qr_on_invoice: showQr,
        auto_print_invoice: autoPrint,
        payment_upi_id: upiId.trim() || undefined,
      });
      toast.success("Invoice settings updated!");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to update invoice settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleQrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    try {
      const res = await uploadPaymentQRApi(file);
      setQrImage(res.payment_qr_image);
      toast.success("Payment QR code uploaded successfully!");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to upload QR image");
    } finally {
      setUploadingQr(false);
    }
  }

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-base">Invoice & Receipt Printing</CardTitle>
        <CardDescription>Format printed receipts, invoice numbering, and UPI QR display.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Fld label="Invoice Prefix" value={prefix} onChange={setPrefix} placeholder="INV-" />
          <Fld label="Payment UPI ID" value={upiId} onChange={setUpiId} placeholder="merchant@upi" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Invoice Footer Text</Label>
          <Input value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Thank you for visiting!" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <ToggleCard title="Show GST Breakup" desc="Display tax details on printed bills" checked={showGst} onChange={setShowGst} />
          <ToggleCard title="Show UPI QR Code" desc="Print payment QR code on invoice" checked={showQr} onChange={setShowQr} />
          <ToggleCard title="Auto Print Invoice" desc="Trigger print dialog on order settlement" checked={autoPrint} onChange={setAutoPrint} />
        </div>

        {/* QR Code Upload Section */}
        <div className="rounded-xl border p-4 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-primary" /> Invoice UPI QR Code Image
              </p>
              <p className="text-xs text-muted-foreground">Upload a PNG/JPG QR image printed on bills.</p>
            </div>
            <div className="relative">
              <input type="file" id="inv-qr-file" accept="image/*" className="hidden" onChange={handleQrUpload} disabled={uploadingQr} />
              <Label htmlFor="inv-qr-file" className="cursor-pointer inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium border bg-background hover:bg-muted transition-colors">
                {uploadingQr ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <Upload className="h-3.5 w-3.5 text-primary" />} Upload QR
              </Label>
            </div>
          </div>
          {qrImage && (
            <div className="flex items-center gap-3 pt-2">
              <img src={qrImage.startsWith("http") ? qrImage : `${API_BASE_URL}${qrImage.startsWith("/") ? "" : "/"}${qrImage}`} alt="Payment QR" className="h-20 w-20 object-contain rounded-lg border bg-background" />
              <span className="text-[11px] font-mono text-muted-foreground truncate">{qrImage}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button disabled={saving} onClick={handleSave} className="rounded-full gradient-brand text-primary-foreground font-semibold">
            {saving ? "Saving..." : "Save Invoice Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. TAX TAB
 * ────────────────────────────────────────────────────────────────────────────*/
function TaxTab({ settings, onSaved }: { settings: BusinessSettings; onSaved: () => void }) {
  const [gstPct, setGstPct] = useState(settings.tax_percentage || 0);
  const [serviceCharge, setServiceCharge] = useState(settings.service_charge || 0);
  const [roundOff, setRoundOff] = useState(settings.round_off_bill);
  const [gstNum, setGstNum] = useState(settings.gst_number || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateBusinessSettingsApi({
        tax_percentage: Number(gstPct) || 0,
        service_charge: Number(serviceCharge) || 0,
        round_off_bill: roundOff,
        gst_number: gstNum.trim() || undefined,
      });
      toast.success("Tax settings updated!");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to update tax settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-base">Tax & Service Charges</CardTitle>
        <CardDescription>Configure GST percentage, service fees, and rounding options.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Fld label="GSTIN Number" value={gstNum} onChange={setGstNum} placeholder="27AAAAA0000A1Z5" />
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">GST Rate (%)</Label>
            <Input type="number" step="0.1" value={gstPct} onChange={(e) => setGstPct(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Service Charge (%)</Label>
            <Input type="number" step="0.1" value={serviceCharge} onChange={(e) => setServiceCharge(Number(e.target.value))} />
          </div>
        </div>

        <ToggleCard title="Round Off Bill Total" desc="Automatically round bill total to nearest whole integer" checked={roundOff} onChange={setRoundOff} />

        <div className="flex justify-end pt-2">
          <Button disabled={saving} onClick={handleSave} className="rounded-full gradient-brand text-primary-foreground font-semibold">
            {saving ? "Saving..." : "Save Tax Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6. NOTIFICATION TAB
 * ────────────────────────────────────────────────────────────────────────────*/
function NotificationTab({ settings, onSaved }: { settings: BusinessSettings; onSaved: () => void }) {
  const [orders, setOrders] = useState(settings.notify_orders);
  const [qrOrders, setQrOrders] = useState(settings.notify_qr_orders);
  const [campaigns, setCampaigns] = useState(settings.notify_campaigns);
  const [reviews, setReviews] = useState(settings.notify_reviews);
  const [email, setEmail] = useState(settings.notify_email);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateBusinessSettingsApi({
        notify_orders: orders,
        notify_qr_orders: qrOrders,
        notify_campaigns: campaigns,
        notify_reviews: reviews,
        notify_email: email,
      });
      toast.success("Notification preferences saved!");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to update notifications");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-base">Notification Preferences</CardTitle>
        <CardDescription>Control live sound, bell alerts, and email notifications.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleCard title="Order Notifications" desc="Alert when a new POS or staff order is created" checked={orders} onChange={setOrders} />
          <ToggleCard title="QR Order Notifications" desc="Instant alert & sound when customer scans QR order" checked={qrOrders} onChange={setQrOrders} />
          <ToggleCard title="Campaign Notifications" desc="Alert when scheduled WhatsApp campaigns complete" checked={campaigns} onChange={setCampaigns} />
          <ToggleCard title="Review Notifications" desc="Alert when a new customer leaves a review" checked={reviews} onChange={setReviews} />
          <ToggleCard title="Email Notifications" desc="Receive daily & weekly summary reports by email" checked={email} onChange={setEmail} />
        </div>

        <div className="flex justify-end pt-2">
          <Button disabled={saving} onClick={handleSave} className="rounded-full gradient-brand text-primary-foreground font-semibold">
            {saving ? "Saving..." : "Save Notifications"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 7. AI TAB
 * ────────────────────────────────────────────────────────────────────────────*/
function AiTab({ settings, onSaved }: { settings: BusinessSettings; onSaved: () => void }) {
  const [enableAi, setEnableAi] = useState(settings.review_booster_ai_enabled);
  const [tone, setTone] = useState(settings.ai_default_tone || "Friendly");
  const [lang, setLang] = useState(settings.language || "en");
  const [maxReqs, setMaxReqs] = useState(settings.ai_max_monthly_requests || 500);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateBusinessSettingsApi({
        review_booster_ai_enabled: enableAi,
        ai_default_tone: tone,
        language: lang,
        ai_max_monthly_requests: Number(maxReqs) || 500,
      });
      toast.success("AI Settings updated!");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to update AI settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-base">Gemini AI Assistant Configuration</CardTitle>
        <CardDescription>Tailor tone style, language, and monthly AI generation limits.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ToggleCard title="Enable Gemini AI Message Generator" desc="Allow AI generation for campaigns and review follow-ups" checked={enableAi} onChange={setEnableAi} />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Default AI Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Friendly">Friendly</SelectItem>
                <SelectItem value="Professional">Professional</SelectItem>
                <SelectItem value="Casual">Casual</SelectItem>
                <SelectItem value="Funny & Witty">Funny & Witty</SelectItem>
                <SelectItem value="Urgent & Exclusive">Urgent & Exclusive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Language</Label>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hinglish / Hindi</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Maximum Monthly AI Requests</Label>
            <Input type="number" value={maxReqs} onChange={(e) => setMaxReqs(Number(e.target.value))} />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button disabled={saving} onClick={handleSave} className="rounded-full gradient-brand text-primary-foreground font-semibold">
            {saving ? "Saving..." : "Save AI Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 8. POS TAB
 * ────────────────────────────────────────────────────────────────────────────*/
function PosTab({ settings, onSaved }: { settings: BusinessSettings; onSaved: () => void }) {
  const [autoComplete, setAutoComplete] = useState(settings.pos_auto_complete_order);
  const [autoFreeTable, setAutoFreeTable] = useState(settings.pos_auto_free_table);
  const [defaultPayment, setDefaultPayment] = useState(settings.pos_default_payment_method || "CASH");
  const [dineIn, setDineIn] = useState(settings.enable_dine_in);
  const [parcel, setParcel] = useState(settings.enable_parcel);
  const [takeaway, setTakeaway] = useState(settings.enable_takeaway);
  const [qrOrdering, setQrOrdering] = useState(settings.enable_qr_ordering);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateBusinessSettingsApi({
        pos_auto_complete_order: autoComplete,
        pos_auto_free_table: autoFreeTable,
        pos_default_payment_method: defaultPayment,
        enable_dine_in: dineIn,
        enable_parcel: parcel,
        enable_takeaway: takeaway,
        enable_qr_ordering: qrOrdering,
      });
      toast.success("POS Settings updated!");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to update POS settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-base">Point of Sale & Ordering Options</CardTitle>
        <CardDescription>Configure order completion, table automation, and available order types.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleCard title="Auto Complete Order" desc="Automatically mark order SERVED upon payment settlement" checked={autoComplete} onChange={setAutoComplete} />
          <ToggleCard title="Auto Free Table After Payment" desc="Reset table status to Empty as soon as bill is paid" checked={autoFreeTable} onChange={setAutoFreeTable} />
        </div>

        <div className="space-y-1.5 max-w-xs">
          <Label className="text-xs font-semibold">Default Payment Method</Label>
          <Select value={defaultPayment} onValueChange={setDefaultPayment}>
            <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="UPI">UPI / Digital</SelectItem>
              <SelectItem value="CARD">Credit / Debit Card</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <ToggleCard title="Enable Dine In" desc="Dine-in seating orders" checked={dineIn} onChange={setDineIn} />
          <ToggleCard title="Enable Parcel" desc="Packaged parcel orders" checked={parcel} onChange={setParcel} />
          <ToggleCard title="Enable Takeaway" desc="Pick up takeaway orders" checked={takeaway} onChange={setTakeaway} />
          <ToggleCard title="Enable QR Self-Order" desc="Table QR code self ordering" checked={qrOrdering} onChange={setQrOrdering} />
        </div>

        <div className="flex justify-end pt-2">
          <Button disabled={saving} onClick={handleSave} className="rounded-full gradient-brand text-primary-foreground font-semibold">
            {saving ? "Saving..." : "Save POS Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 9. SECURITY TAB
 * ────────────────────────────────────────────────────────────────────────────*/
function SecurityTab() {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [changingPass, setChangingPass] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);

  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const data = await getActiveSessionsApi();
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!oldPass || !newPass) {
      toast.error("Please fill in both old and new password fields.");
      return;
    }
    setChangingPass(true);
    try {
      const res = await changePasswordApi({ old_password: oldPass, new_password: newPass });
      toast.success(res.message || "Password changed successfully!");
      setOldPass("");
      setNewPass("");
    } catch (e: any) {
      toast.error(e.message || "Failed to change password");
    } finally {
      setChangingPass(false);
    }
  }

  async function handleToggle2fa(val: boolean) {
    setTwoFactor(val);
    try {
      const res = await toggle2faApi(val);
      toast.success(res.message);
    } catch (e: any) {
      setTwoFactor(!val);
      toast.error(e.message || "Failed to update 2FA");
    }
  }

  async function handleLogoutOthers() {
    try {
      const res = await logoutOtherDevicesApi();
      toast.success(res.message);
      loadSessions();
    } catch (e: any) {
      toast.error(e.message || "Failed to revoke sessions");
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Change Password Form */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" /> Change Password
          </CardTitle>
          <CardDescription>Update your merchant account login password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Fld label="Current Password" type="password" value={oldPass} onChange={setOldPass} />
            <Fld label="New Password" type="password" value={newPass} onChange={setNewPass} />
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={changingPass} className="rounded-full gradient-brand text-primary-foreground font-semibold">
                {changingPass ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication & Active Sessions */}
      <div className="space-y-6">
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Two-Factor Authentication (2FA)
            </CardTitle>
            <CardDescription>Enhance account security with SMS / App 2FA.</CardDescription>
          </CardHeader>
          <CardContent>
            <ToggleCard title="Enable 2FA Verification" desc="Require verification code on new device sign-ins" checked={twoFactor} onChange={handleToggle2fa} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="font-display text-base">Active Sessions</CardTitle>
              <CardDescription>Devices logged into your account.</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="rounded-full text-xs text-destructive" onClick={handleLogoutOthers}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Logout Other Devices
            </Button>
          </CardHeader>
          <CardContent className="divide-y text-xs">
            {loadingSessions ? (
              <div className="py-4 text-center text-muted-foreground">Loading active sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground">1 Active Session (Current Browser)</div>
            ) : (
              sessions.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{s.user_agent || "Browser Session"}</p>
                    <p className="text-[10px] text-muted-foreground">IP: {s.ip_address || "Localhost"}</p>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] border-emerald-500/40 text-emerald-600">Active</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 10. BACKUP TAB
 * ────────────────────────────────────────────────────────────────────────────*/
function BackupTab() {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleExport(type: "database" | "customers" | "orders" | "menu") {
    setDownloading(type);
    try {
      await downloadDataExportApi(type);
      toast.success(`${type.toUpperCase()} export downloaded successfully!`);
    } catch (e: any) {
      toast.error(e.message || `Failed to export ${type}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-base">Data Backup & Export</CardTitle>
        <CardDescription>Export full database JSON bundles or targeted CSV reports anytime.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <ExportCard
          title="Export Full Database"
          desc="Download complete JSON backup of business settings, customers, orders & menu"
          type="database"
          loading={downloading === "database"}
          onClick={() => handleExport("database")}
        />
        <ExportCard
          title="Export Customers List"
          desc="Download CSV containing all customer profiles, spend history, and contacts"
          type="customers"
          loading={downloading === "customers"}
          onClick={() => handleExport("customers")}
        />
        <ExportCard
          title="Export Orders & Visits"
          desc="Download CSV containing complete order records, bill totals, and payment status"
          type="orders"
          loading={downloading === "orders"}
          onClick={() => handleExport("orders")}
        />
        <ExportCard
          title="Export Menu / Services"
          desc="Download CSV containing all categories, item prices, and availability status"
          type="menu"
          loading={downloading === "menu"}
          onClick={() => handleExport("menu")}
        />
      </CardContent>
    </Card>
  );
}

/* Helper Components */
function Fld({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      <Input type={type} placeholder={placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ToggleCard({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border p-3 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
      <div className="pr-3">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function ExportCard({ title, desc, loading, onClick }: { title: string; desc: string; type: string; loading: boolean; onClick: () => void }) {
  return (
    <div className="rounded-xl border p-4 flex flex-col justify-between space-y-3 bg-card shadow-sm hover:border-primary/50 transition-all">
      <div>
        <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
          <Database className="h-4 w-4 text-primary" /> {title}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      </div>
      <div className="pt-2 flex justify-end">
        <Button size="sm" variant="outline" disabled={loading} onClick={onClick} className="rounded-full text-xs gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <Download className="h-3.5 w-3.5 text-primary" />} Download Export
        </Button>
      </div>
    </div>
  );
}