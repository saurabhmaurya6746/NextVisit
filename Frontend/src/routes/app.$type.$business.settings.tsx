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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { SkeletonRows } from "@/components/skeletons";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Store,
  MessageSquare,
  Globe,
  FileText,
  Percent,
  Sparkles,
  Shield,
  Database,
  QrCode,
  Upload,
  Loader2,
  AlertTriangle,
  Download,
  Key,
  LogOut,
  Scissors,
  Brain,
  RefreshCw,
  FileCheck,
  Users,
  Smartphone,
} from "lucide-react";
import { TestPaymentDialog } from "@/components/test-payment-dialog";
import { API_BASE_URL } from "@/lib/auth";
import { formatCurrency } from "@/lib/currency";
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
  exportCatalogPdfApi,
  type BusinessSettings,
  type BusinessProfile,
  type UserSessionItem,
} from "@/lib/business-settings-api";
import { getSubscriptionUsageApi } from "@/lib/subscription-api";
import { SubscriptionUpgradeModal } from "@/components/subscription-upgrade-modal";
import { BuyAiCreditsModal } from "@/components/buy-ai-credits-modal";
import { getMyCreditPurchaseRequestsApi } from "@/lib/credit-management-api";
import { exportCustomersApi } from "@/lib/customers-api";
import { downloadReportsPdfApi } from "@/lib/reports-api";

export const Route = createFileRoute("/app/$type/$business/settings")({ component: SettingsPage });

function SettingsPage() {
  const params = useParams({ strict: false }) as Record<string, string>;
  const typeParam = params?.type || "";

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

  const effectiveType = typeParam || profile.type || "";
  const isSalon = effectiveType.toLowerCase().includes("salon") || effectiveType.toLowerCase().includes("spa");

  return (
    <>
      <PageHeader
        title={isSalon ? "Salon Settings" : "Restaurant Settings"}
        description={
          isSalon
            ? "Clean business configuration: General, WhatsApp, Invoices, Tax, AI, Security & Reports Export."
            : "Clean business configuration: General, WhatsApp, Invoices, Tax, AI, Security & Reports Export."
        }
        actions={
          <Badge variant="outline" className="rounded-full flex items-center gap-1.5 px-3 py-1 font-medium">
            {isSalon ? <Scissors className="h-3.5 w-3.5 text-primary" /> : <Store className="h-3.5 w-3.5 text-primary" />}
            {profile.name}
          </Badge>
        }
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
          <TabsTrigger value="ai" className="rounded-xl gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" /> AI
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl gap-1.5 text-xs">
            <Shield className="h-3.5 w-3.5" /> Security
          </TabsTrigger>
          <TabsTrigger value="backup" className="rounded-xl gap-1.5 text-xs">
            <Database className="h-3.5 w-3.5" /> Backup & Reports
          </TabsTrigger>
        </TabsList>

        {/* 1. GENERAL TAB */}
        <TabsContent value="general">
          <GeneralTab profile={profile} settings={settings} onSaved={loadData} isSalon={isSalon} />
        </TabsContent>

        {/* 2. WHATSAPP TAB */}
        <TabsContent value="whatsapp">
          <WhatsAppTab settings={settings} onSaved={loadData} isSalon={isSalon} />
        </TabsContent>

        {/* 3. GOOGLE TAB */}
        <TabsContent value="google">
          <GoogleTab settings={settings} onSaved={loadData} />
        </TabsContent>

        {/* 4. INVOICE TAB */}
        <TabsContent value="invoice">
          <InvoiceTab settings={settings} onSaved={loadData} isSalon={isSalon} />
        </TabsContent>

        {/* 5. TAX TAB */}
        <TabsContent value="tax">
          <TaxTab settings={settings} onSaved={loadData} />
        </TabsContent>

        {/* 6. AI TAB */}
        <TabsContent value="ai">
          <AiTab settings={settings} onSaved={loadData} />
        </TabsContent>

        {/* 7. SECURITY TAB */}
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>

        {/* 8. BACKUP TAB */}
        <TabsContent value="backup">
          <BackupTab isSalon={isSalon} />
        </TabsContent>
      </Tabs>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. GENERAL TAB
 * ────────────────────────────────────────────────────────────────────────────*/
function GeneralTab({
  profile,
  settings,
  onSaved,
  isSalon,
}: {
  profile: BusinessProfile;
  settings: BusinessSettings;
  onSaved: () => void;
  isSalon: boolean;
}) {
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
        <CardTitle className="font-display text-base">
          {isSalon ? "General Salon Details" : "General Restaurant Details"}
        </CardTitle>
        <CardDescription>
          {isSalon ? "Brand logo, cover banner, and primary salon contact info." : "Brand logo, cover image, and primary restaurant contact info."}
        </CardDescription>
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
              {coverImage ? <img src={coverImage} alt="Cover" className="h-full w-full object-cover" /> : <span className="text-[10px] text-muted-foreground">Cover Banner</span>}
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
          <Fld
            label="Website"
            value={website}
            onChange={setWebsite}
            placeholder={isSalon ? "https://yoursalon.com" : "https://yourrestaurant.com"}
          />
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
function WhatsAppTab({
  settings,
  onSaved,
  isSalon,
}: {
  settings: BusinessSettings;
  onSaved: () => void;
  isSalon: boolean;
}) {
  const [waNum, setWaNum] = useState(settings.whatsapp_number || "");
  const [countryCode, setCountryCode] = useState(settings.default_country_code || "+91");
  const [signature, setSignature] = useState(settings.default_message_signature || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateBusinessSettingsApi({
        whatsapp_number: waNum.trim() || undefined,
        default_country_code: countryCode.trim(),
        default_message_signature: signature.trim() || undefined,
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
        <CardDescription>Primary WhatsApp contact number and default message signature.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Fld label="Business WhatsApp Number" value={waNum} onChange={setWaNum} placeholder="+91 98765 43210" />
          <Fld label="Default Country Code" value={countryCode} onChange={setCountryCode} placeholder="+91" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Default Message Signature</Label>
          <Textarea
            rows={2}
            placeholder={isSalon ? "e.g. — Glamour Salon & Spa · Mumbai" : "e.g. — Aroma Bistro · Mumbai"}
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
          />
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
        <CardTitle className="font-display text-base">Google Business Links</CardTitle>
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
function InvoiceTab({
  settings,
  onSaved,
  isSalon,
}: {
  settings: BusinessSettings;
  onSaved: () => void;
  isSalon: boolean;
}) {
  const defaultFooter = isSalon ? "Thank you for visiting our salon!" : "Thank you for dining with us!";
  const [prefix, setPrefix] = useState(settings.invoice_prefix || "INV-");
  const [footer, setFooter] = useState(settings.invoice_footer || defaultFooter);
  const [showGst, setShowGst] = useState(settings.show_gst_on_invoice);
  const [showQr, setShowQr] = useState(settings.show_qr_on_invoice);
  const [payeeName, setPayeeName] = useState(settings.payment_payee_name || (settings as any).payment_payee_name || "");
  const [upiId, setUpiId] = useState(settings.payment_upi_id || "");
  const [saving, setSaving] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);

  async function handleSave() {
    const trimmedPayee = payeeName.trim();
    const trimmedUpi = upiId.trim();

    if (!trimmedPayee) {
      toast.error("Payee Name is required");
      return;
    }
    if (!trimmedUpi) {
      toast.error("UPI ID is required");
      return;
    }
    if (!trimmedUpi.includes("@") || trimmedUpi.startsWith("@") || trimmedUpi.endsWith("@")) {
      toast.error("Please enter a valid UPI ID (e.g. merchant@upi)");
      return;
    }

    setSaving(true);
    try {
      await updateBusinessSettingsApi({
        invoice_prefix: prefix.trim(),
        invoice_footer: footer.trim() || undefined,
        show_gst_on_invoice: showGst,
        show_qr_on_invoice: showQr,
        payment_payee_name: trimmedPayee,
        payment_upi_id: trimmedUpi,
      } as any);
      toast.success("Invoice & payment settings updated!");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-base">Invoice & Payment Setup</CardTitle>
        <CardDescription>Format printed receipts, invoice numbering, and UPI payment details for dynamic QR generation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Fld label="Invoice Prefix" value={prefix} onChange={setPrefix} placeholder="INV-" />
          <Fld label="Payee Name *" value={payeeName} onChange={setPayeeName} placeholder="e.g. Saurabh Maurya" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Fld label="Payment UPI ID *" value={upiId} onChange={setUpiId} placeholder="saurabhmauryajnp28-1@oksbi" />
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Invoice Footer Text</Label>
            <Input value={footer} onChange={(e) => setFooter(e.target.value)} placeholder={defaultFooter} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleCard title="Show GST Breakup" desc="Display itemized tax details on printed bills" checked={showGst} onChange={setShowGst} />
          <ToggleCard title="Show UPI QR Code" desc="Print dynamic payment QR code on invoice" checked={showQr} onChange={setShowQr} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-primary/30 text-primary hover:bg-primary/10 font-semibold text-xs px-5 h-9"
            onClick={() => {
              if (!payeeName.trim()) {
                toast.error("Please enter Payee Name before testing.");
                return;
              }
              if (!upiId.trim() || !upiId.includes("@")) {
                toast.error("Please enter a valid UPI ID before testing.");
                return;
              }
              setTestModalOpen(true);
            }}
          >
            <Smartphone className="mr-1.5 h-3.5 w-3.5" /> Test Payment
          </Button>
          <Button disabled={saving} onClick={handleSave} className="rounded-full gradient-brand text-primary-foreground font-semibold h-9 px-6 text-xs">
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        <TestPaymentDialog
          open={testModalOpen}
          onOpenChange={setTestModalOpen}
          payeeName={payeeName}
          upiId={upiId}
        />
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. TAX TAB
 * ────────────────────────────────────────────────────────────────────────────*/
function TaxTab({ settings, onSaved }: { settings: BusinessSettings; onSaved: () => void }) {
  const [enableGst, setEnableGst] = useState(settings.enable_gst ?? true);
  const [gstPct, setGstPct] = useState(settings.tax_percentage ?? 18.0);
  const [priceIncludesGst, setPriceIncludesGst] = useState(settings.price_includes_gst ?? false);
  const [gstNum, setGstNum] = useState(settings.gst_number || "");
  const [serviceCharge, setServiceCharge] = useState(settings.service_charge || 0);
  const [roundOff, setRoundOff] = useState(settings.round_off_bill);
  const [saving, setSaving] = useState(false);

  const INDIAN_GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  // Live Price Calculation Preview for ₹500
  const samplePrice = 500;
  const rate = Math.max(0, Math.min(100, Number(gstPct) || 0));
  let taxablePreview = samplePrice;
  let gstAmountPreview = 0;
  let totalPreview = samplePrice;

  if (enableGst && rate > 0) {
    if (priceIncludesGst) {
      totalPreview = samplePrice;
      taxablePreview = Math.round((totalPreview / (1 + rate / 100)) * 100) / 100;
      gstAmountPreview = Math.round((totalPreview - taxablePreview) * 100) / 100;
    } else {
      taxablePreview = samplePrice;
      gstAmountPreview = Math.round((taxablePreview * (rate / 100)) * 100) / 100;
      totalPreview = Math.round((taxablePreview + gstAmountPreview) * 100) / 100;
    }
  }

  async function handleSave() {
    const cleanGstNum = gstNum.trim().toUpperCase();
    if (enableGst && cleanGstNum && !INDIAN_GST_REGEX.test(cleanGstNum)) {
      toast.error("Invalid Indian GST format. Example: 09ABCDE1234F1Z5");
      return;
    }
    if (gstPct < 0 || gstPct > 100) {
      toast.error("GST percentage must be between 0% and 100%");
      return;
    }

    setSaving(true);
    try {
      await updateBusinessSettingsApi({
        enable_gst: enableGst,
        tax_percentage: Number(gstPct) || 0,
        price_includes_gst: priceIncludesGst,
        gst_number: cleanGstNum || undefined,
        service_charge: Number(serviceCharge) || 0,
        round_off_bill: roundOff,
      });
      toast.success("Business GST settings updated!");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to update GST settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-base">Business Tax &amp; GST Settings</CardTitle>
        <CardDescription>
          Configure business-specific GST percentage, inclusive/exclusive pricing modes, and GSTIN registration details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleCard
            title="Enable GST"
            desc="Enable GST tax computation and invoice tax headers for this business"
            checked={enableGst}
            onChange={setEnableGst}
          />
          <ToggleCard
            title="Price Includes GST"
            desc={priceIncludesGst ? "Mode 1: Product/service price includes GST (Inclusive)" : "Mode 2: GST is added on top of price (Exclusive)"}
            checked={priceIncludesGst}
            onChange={setPriceIncludesGst}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">GSTIN Number</Label>
            <Input
              placeholder="e.g. 09ABCDE1234F1Z5"
              value={gstNum}
              onChange={(e) => setGstNum(e.target.value.toUpperCase())}
              disabled={!enableGst}
              className="text-xs uppercase font-mono rounded-xl"
            />
            <p className="text-[11px] text-muted-foreground">Standard 15-character Indian GST format</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">GST Percentage (%)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={gstPct}
              onChange={(e) => setGstPct(Number(e.target.value))}
              disabled={!enableGst}
              className="text-xs rounded-xl"
            />
            <p className="text-[11px] text-muted-foreground">Range: 0% to 100% (Default: 18%)</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Service Charge (%)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={serviceCharge}
              onChange={(e) => setServiceCharge(Number(e.target.value))}
              className="text-xs rounded-xl"
            />
            <p className="text-[11px] text-muted-foreground">Optional operational service charge</p>
          </div>
        </div>

        {/* GST CALCULATION ENGINE PREVIEW CARD */}
        <div className="rounded-xl border p-4 bg-muted/20 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
              GST Price Calculation Engine Preview (Sample ₹500 Item)
            </h4>
            <Badge variant="outline" className="text-[10px] uppercase font-bold">
              {enableGst ? (priceIncludesGst ? "Inclusive Mode" : "Exclusive Mode") : "GST Disabled"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border bg-background p-3">
              <span className="text-muted-foreground">Sample Service Price:</span>
              <p className="font-bold text-foreground text-sm font-display">{formatCurrency(samplePrice, "INR")}</p>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <span className="text-muted-foreground">Taxable Value:</span>
              <p className="font-bold text-foreground text-sm font-display">{formatCurrency(taxablePreview, "INR")}</p>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <span className="text-muted-foreground">GST ({enableGst ? `${rate}%` : "0%"}):</span>
              <p className="font-bold text-violet-600 dark:text-violet-400 text-sm font-display">{formatCurrency(gstAmountPreview, "INR")}</p>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <span className="text-muted-foreground">Final Bill Total:</span>
              <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm font-display">{formatCurrency(totalPreview, "INR")}</p>
            </div>
          </div>
        </div>

        <ToggleCard title="Round Off Bill Total" desc="Automatically round bill total to nearest whole integer" checked={roundOff} onChange={setRoundOff} />

        <div className="flex justify-end pt-2">
          <Button disabled={saving} onClick={handleSave} className="rounded-full gradient-brand text-primary-foreground font-semibold">
            {saving ? "Saving..." : "Save GST Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6. AI TAB
 * ────────────────────────────────────────────────────────────────────────────*/
function AiTab({ settings, onSaved }: { settings: BusinessSettings; onSaved: () => void }) {
  const [enableAi, setEnableAi] = useState(settings.review_booster_ai_enabled);
  const [saving, setSaving] = useState(false);
  const [aiUsage, setAiUsage] = useState<any>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [buyCreditsModalOpen, setBuyCreditsModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const [creditRequests, setCreditRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchAiUsage = useCallback(() => {
    setLoadingUsage(true);
    getSubscriptionUsageApi()
      .then((data) => setAiUsage(data.ai_usage))
      .catch(() => null)
      .finally(() => setLoadingUsage(false));
  }, []);

  const fetchCreditRequests = useCallback(() => {
    setLoadingRequests(true);
    getMyCreditPurchaseRequestsApi()
      .then((data) => setCreditRequests(data || []))
      .catch(() => setCreditRequests([]))
      .finally(() => setLoadingRequests(false));
  }, []);

  useEffect(() => {
    fetchAiUsage();
    fetchCreditRequests();
  }, [fetchAiUsage, fetchCreditRequests]);

  const planName = aiUsage?.plan_name || "Free";
  const monthlyPlanCredits = aiUsage?.monthly_plan_credits ?? 0;
  const monthlyUsed = aiUsage?.monthly_used_credits ?? 0;
  const monthlyRemaining = aiUsage?.monthly_remaining_credits ?? Math.max(0, monthlyPlanCredits - monthlyUsed);
  const purchasedRemaining = aiUsage?.purchased_remaining_credits ?? 0;
  const resetDate = aiUsage?.reset_date || "1 September 2026";
  const usagePct = monthlyPlanCredits > 0 ? Math.min(100, Math.round((monthlyUsed / monthlyPlanCredits) * 100)) : 0;
  const isAiDisabled = aiUsage && (!aiUsage.ai_enabled || (monthlyPlanCredits === 0 && purchasedRemaining === 0));

  async function handleSave() {
    setSaving(true);
    try {
      await updateBusinessSettingsApi({
        review_booster_ai_enabled: enableAi,
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
        <CardTitle className="font-display text-base">Gemini AI Assistant &amp; Credits</CardTitle>
        <CardDescription>Configure AI message generation and monitor monthly &amp; purchased credit balances.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ToggleCard
          title="Enable AI Messages"
          desc="Allow Gemini AI generation for WhatsApp campaigns, customer recovery, and review responses"
          checked={enableAi}
          onChange={setEnableAi}
        />

        {/* PART 2: HIDE AI DASHBOARD IF AI IS DISABLED */}
        {loadingUsage ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : isAiDisabled ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center space-y-3">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Brain className="h-6 w-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="font-display font-bold text-base text-foreground">
                AI is not included in your current subscription
              </h3>
              <p className="text-xs text-muted-foreground">
                Your active plan (<strong className="text-foreground">{planName}</strong>) does not include monthly AI Credits. Upgrade your subscription to use AI features.
              </p>
            </div>
            <div className="pt-2">
              <Button
                onClick={() => setUpgradeModalOpen(true)}
                className="rounded-full gradient-brand text-primary-foreground font-semibold text-xs px-6"
              >
                Upgrade Subscription
              </Button>
            </div>
            <SubscriptionUpgradeModal
              open={upgradeModalOpen}
              onOpenChange={setUpgradeModalOpen}
              title="Upgrade Subscription Plan for AI Features"
              description="Unlock monthly Gemini AI Credits, higher staff limits, and active devices."
            />
          </div>
        ) : (
          /* PART 1: DYNAMIC AI CREDITS DASHBOARD */
          <div className="rounded-2xl border p-4 bg-muted/20 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="h-4 w-4 text-violet-500" /> AI Credits Dashboard
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Current Plan:</span>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-bold uppercase">
                  {planName}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Monthly Subscription Credits */}
              <div className="rounded-xl border bg-background p-4 space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span>Monthly Subscription Credits</span>
                  <span className="text-foreground font-semibold">{monthlyPlanCredits} Credits / Month</span>
                </div>
                <p className="text-2xl font-bold text-foreground font-display">
                  {monthlyUsed} <span className="text-xs font-normal text-muted-foreground">Used</span>
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full gradient-brand transition-all duration-300"
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground pt-1 flex justify-between">
                  <span>Remaining: <strong className="text-foreground">{monthlyRemaining} Credits</strong></span>
                  <span>{usagePct}% consumed</span>
                </p>
              </div>

              {/* Purchased Extra Credits */}
              <div className="rounded-xl border bg-background p-4 space-y-2 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Purchased Extra Credits</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-display">
                    {purchasedRemaining} <span className="text-xs font-normal text-muted-foreground">Remaining</span>
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Purchased credits <strong>never expire</strong> until consumed.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs pt-2 border-t gap-2 text-muted-foreground">
              <span>
                Next Reset: <strong className="text-foreground">{resetDate}</strong>
              </span>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full text-xs font-semibold border-violet-500/40 hover:border-violet-500 text-violet-600 dark:text-violet-400"
                onClick={() => setBuyCreditsModalOpen(true)}
              >
                <Brain className="mr-1.5 h-3.5 w-3.5" /> Purchase Extra Credits
              </Button>
            </div>
          </div>
        )}

        {/* PURCHASE REQUEST HISTORY */}
        <div className="rounded-2xl border p-4 bg-background space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
              Purchase Requests
            </h4>
            <Button size="sm" variant="ghost" className="h-7 text-xs rounded-full" onClick={fetchCreditRequests}>
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh History
            </Button>
          </div>

          {loadingRequests ? (
            <div className="py-4 text-center text-xs text-muted-foreground">Loading purchase requests...</div>
          ) : creditRequests.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">No purchase requests submitted yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Request Date</TableHead>
                    <TableHead>Credit Pack</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Approval Status</TableHead>
                    <TableHead className="text-right">Approved On / Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditRequests.map((req) => (
                    <TableRow key={req.id} className="text-xs">
                      <TableCell className="text-muted-foreground">
                        {req.requested_at ? new Date(req.requested_at).toLocaleString() : "N/A"}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {req.pack_name}
                      </TableCell>
                      <TableCell className="font-bold text-violet-600 dark:text-violet-400">
                        +{req.ai_credits?.toLocaleString()} Credits
                      </TableCell>
                      <TableCell className="font-semibold">
                        {req.amount === 0 ? "Free" : formatCurrency(req.amount, "INR")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            req.payment_status === "PAID"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : req.payment_status === "FAILED"
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          }
                        >
                          {req.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            req.approval_status === "APPROVED"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : req.approval_status === "REJECTED"
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                              : req.approval_status === "CANCELLED"
                              ? "bg-muted text-muted-foreground"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          }
                        >
                          {req.approval_status === "PENDING" ? "Pending Approval" : req.approval_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {req.approval_status === "APPROVED" ? (
                          <span className="text-emerald-600 text-[11px]">
                            {req.approved_at ? new Date(req.approved_at).toLocaleString() : "Approved"}
                          </span>
                        ) : req.approval_status === "REJECTED" ? (
                          <span className="text-rose-600 text-[11px] font-semibold">
                            {req.rejection_reason || "Rejected"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* PART 4 & 5: DYNAMIC PURCHASE AI CREDITS POPUP */}
        <BuyAiCreditsModal
          open={buyCreditsModalOpen}
          onOpenChange={setBuyCreditsModalOpen}
          onSuccess={() => {
            fetchAiUsage();
            fetchCreditRequests();
          }}
        />

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
 * 7. SECURITY TAB
 * ────────────────────────────────────────────────────────────────────────────*/
function SecurityTab() {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [changingPass, setChangingPass] = useState(false);

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
    if (!oldPass || !oldPass.trim()) {
      toast.error("Current password is required.");
      return;
    }
    if (!newPass || !newPass.trim()) {
      toast.error("New password is required.");
      return;
    }
    if (newPass.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (oldPass === newPass) {
      toast.error("New password cannot be the same as the current password.");
      return;
    }

    setChangingPass(true);
    try {
      const res = await changePasswordApi({ old_password: oldPass, new_password: newPass });
      toast.success(res.message || "Password updated successfully.");
      setOldPass("");
      setNewPass("");
    } catch (e: any) {
      toast.error(e.message || "Unable to update password. Please try again.");
    } finally {
      setChangingPass(false);
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

      {/* Active Sessions */}
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
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 8. BACKUP TAB (Redesigned Clean PDF Exports)
 * ────────────────────────────────────────────────────────────────────────────*/
function BackupTab({ isSalon }: { isSalon: boolean }) {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleExportCustomers() {
    setDownloading("customers");
    try {
      await exportCustomersApi({ format: "pdf" });
      toast.success("Customer PDF Report generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to export Customer PDF");
    } finally {
      setDownloading(null);
    }
  }

  async function handleExportActivity() {
    setDownloading("activity");
    try {
      await downloadReportsPdfApi();
      toast.success(isSalon ? "Appointments PDF Report generated!" : "Orders PDF Report generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to export Activity PDF");
    } finally {
      setDownloading(null);
    }
  }

  async function handleExportCatalog() {
    setDownloading("catalog");
    try {
      await exportCatalogPdfApi();
      toast.success(isSalon ? "Services Catalog PDF generated!" : "Menu Catalog PDF generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to export Catalog PDF");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-base">Data Exports & Reports</CardTitle>
        <CardDescription>Download clean, professional PDF reports for your business records.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <CleanExportCard
          title="Export Customers (PDF)"
          desc="Download branded PDF report of all customer directory details and lifetime spend."
          loading={downloading === "customers"}
          onClick={handleExportCustomers}
        />
        <CleanExportCard
          title={isSalon ? "Export Appointments (PDF)" : "Export Orders (PDF)"}
          desc={
            isSalon
              ? "Download branded PDF report of appointment records, revenue trends, and visits."
              : "Download branded PDF report of order records, revenue trends, and sales."
          }
          loading={downloading === "activity"}
          onClick={handleExportActivity}
        />
        <CleanExportCard
          title={isSalon ? "Export Services (PDF)" : "Export Menu (PDF)"}
          desc={
            isSalon
              ? "Download branded PDF catalog of salon services, categories, and prices."
              : "Download branded PDF catalog of menu items, categories, and prices."
          }
          loading={downloading === "catalog"}
          onClick={handleExportCatalog}
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
      {type === "password" ? (
        <PasswordInput placeholder={placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input type={type} placeholder={placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      )}
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

function CleanExportCard({ title, desc, loading, onClick }: { title: string; desc: string; loading: boolean; onClick: () => void }) {
  return (
    <div className="rounded-xl border p-4 flex flex-col justify-between space-y-3 bg-card shadow-sm hover:border-primary/50 transition-all">
      <div>
        <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
          <FileCheck className="h-4 w-4 text-primary" /> {title}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      </div>
      <div className="pt-2 flex justify-end">
        <Button size="sm" variant="outline" disabled={loading} onClick={onClick} className="rounded-full text-xs gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <Download className="h-3.5 w-3.5 text-primary" />} Download PDF
        </Button>
      </div>
    </div>
  );
}