import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  UtensilsCrossed, Scissors, Coffee, Sparkles, ChevronRight, ChevronLeft,
  Check, SkipForward, Save, Download, Printer, Plus, Trash2, QrCode, Store,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { readProfile, saveProfile, type RestaurantProfile, type SalonProfile } from "@/lib/business-profile";
import { setBusinessType, markOnboarded, type BusinessType } from "@/lib/business-type";
import {
  type BusinessCategory, categoryToType,
  readDraft, saveDraft, clearDraft, setPaused,
  readCampaignSettings, saveCampaignSettings, type CampaignSettings,
  defaultDraft, defaultCampaignSettings,
} from "@/lib/wizard-store";
import { useMenu, saveMenu, type MenuItem } from "@/lib/menu-store";
import { useSalonServices, upsertSalonService, removeSalonService, type SalonService } from "@/lib/services-store";
import { readLoyaltySettings, saveLoyaltySettings, defaultLoyaltySettings, calcPointsForAmount, type LoyaltySettings } from "@/lib/loyalty-store";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; initialType?: BusinessType }

const CATEGORIES: { id: BusinessCategory; label: string; icon: any; desc: string }[] = [
  { id: "restaurant", label: "Restaurant", icon: UtensilsCrossed, desc: "Tables, menu & orders" },
  { id: "cafe", label: "Cafe", icon: Coffee, desc: "Counter & QR orders" },
  { id: "salon", label: "Salon", icon: Scissors, desc: "Chairs & appointments" },
  { id: "spa", label: "Spa", icon: Sparkles, desc: "Rooms & services" },
];

const RESTAURANT_CATS = ["Starters", "Main Course", "Pizza", "Drinks", "Desserts"];
const SALON_CATS = ["Hair", "Skin", "Nails", "Facial", "Spa", "Makeup", "Massage"];

function qrImg(url: string, size = 180) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(url)}`;
}

export function OnboardingWizard({ open, onOpenChange, initialType = "restaurant" }: Props) {
  const existing = readDraft();
  const [category, setCategory] = useState<BusinessCategory>(existing?.category ?? initialType);
  const [step, setStep] = useState<number>(existing?.step ?? 0);
  const [info, setInfo] = useState(existing?.info ?? defaultDraft.info);

  const type: BusinessType = categoryToType(category);
  const isRestaurantMode = type === "restaurant";

  // Business setup (tables or chairs)
  const initialProfileR = readProfile("restaurant");
  const initialProfileS = readProfile("salon");
  const [rest, setRest] = useState<RestaurantProfile>(initialProfileR);
  const [salon, setSalon] = useState<SalonProfile>(initialProfileS);
  const [chairs, setChairs] = useState<{ count: number; names: string[] }>(() => {
    try {
      const raw = localStorage.getItem("growthos:salon-chairs");
      if (raw) return JSON.parse(raw);
    } catch {}
    return { count: 4, names: ["Chair 1", "Chair 2", "Chair 3", "Chair 4"] };
  });

  // Menu / services
  const menu = useMenu();
  const services = useSalonServices();
  const [menuDraft, setMenuDraft] = useState<MenuItem[]>(menu);
  const [svcDraft, setSvcDraft] = useState<SalonService[]>(services);
  useEffect(() => { setMenuDraft(menu); }, [menu.length]); // eslint-disable-line
  useEffect(() => { setSvcDraft(services); }, [services.length]); // eslint-disable-line

  // Loyalty
  const [loyalty, setLoyalty] = useState<LoyaltySettings>(() => readLoyaltySettings());

  // Campaigns
  const [campaigns, setCampaigns] = useState<CampaignSettings>(() => readCampaignSettings());

  const steps = useMemo(() => {
    const base = [
      "Business Information",
      isRestaurantMode ? "Tables Setup" : "Chairs Setup",
      isRestaurantMode ? "Menu" : "Services",
      "Loyalty Settings",
    ];
    if (isRestaurantMode) base.push("QR Codes");
    base.push("Campaigns", "Ready to Go");
    return base;
  }, [isRestaurantMode]);

  const total = steps.length;
  const clampedStep = Math.min(step, total - 1);

  function persistDraft(nextStep = clampedStep) {
    saveDraft({ step: nextStep, category, info, updatedAt: Date.now() });
  }

  function commitStep(current: number) {
    // Persist the data for the step being left
    if (current === 0) {
      const target = type;
      const patch: any = { name: info.businessName || (target === "salon" ? salon.name : rest.name), logo: info.logo };
      if (target === "restaurant") { patch.gstNumber = info.gstNumber; saveProfile("restaurant", { ...rest, ...patch }); setRest({ ...rest, ...patch }); }
      else { saveProfile("salon", { ...salon, ...patch }); setSalon({ ...salon, ...patch }); }
    }
    if (current === 1) {
      if (isRestaurantMode) {
        const names = Array.from({ length: rest.tables }, (_, i) => rest.tableNames[i] || `Table ${i + 1}`);
        const next = { ...rest, tableNames: names };
        saveProfile("restaurant", next); setRest(next);
      } else {
        const names = Array.from({ length: chairs.count }, (_, i) => chairs.names[i] || `Chair ${i + 1}`);
        const next = { count: chairs.count, names };
        localStorage.setItem("growthos:salon-chairs", JSON.stringify(next));
        setChairs(next);
      }
    }
    if (current === 2) {
      if (isRestaurantMode) saveMenu(menuDraft);
      else {
        // Replace via upsert/remove
        const existingIds = new Set(services.map((s) => s.id));
        const draftIds = new Set(svcDraft.map((s) => s.id));
        services.forEach((s) => { if (!draftIds.has(s.id)) removeSalonService(s.id); });
        svcDraft.forEach((s) => upsertSalonService(s));
        void existingIds;
      }
    }
    if (current === 3) saveLoyaltySettings(loyalty);
    if (isRestaurantMode && current === 4) { /* QR - nothing to save */ }
    if (current === (isRestaurantMode ? 5 : 4)) saveCampaignSettings(campaigns);
  }

  function goNext() {
    commitStep(clampedStep);
    const next = Math.min(clampedStep + 1, total - 1);
    setStep(next);
    persistDraft(next);
  }
  function goBack() {
    const prev = Math.max(0, clampedStep - 1);
    setStep(prev);
    persistDraft(prev);
  }
  function skip() {
    const next = Math.min(clampedStep + 1, total - 1);
    setStep(next);
    persistDraft(next);
    toast("Skipped — you can edit this later in Settings.");
  }
  function saveAndClose() {
    commitStep(clampedStep);
    persistDraft(clampedStep);
    setPaused(true);
    setBusinessType(type);
    onOpenChange(false);
    toast.success("Progress saved. Resume anytime from the dashboard.");
  }
  function finish() {
    commitStep(clampedStep);
    setBusinessType(type);
    markOnboarded(type);
    clearDraft();
    onOpenChange(false);
    toast.success("Setup complete — welcome to NextVisit!");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) saveAndClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> First-time setup
            </DialogTitle>
            <Badge variant="outline" className="rounded-full">Step {clampedStep + 1} of {total}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{steps[clampedStep]}</p>
        </DialogHeader>

        <div className="mt-1 mb-4 flex items-center gap-1">
          {steps.map((_, i) => (
            <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-all",
              i < clampedStep ? "bg-primary" : i === clampedStep ? "gradient-brand" : "bg-muted")} />
          ))}
        </div>

        <motion.div key={clampedStep} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="min-h-[340px]">
          {clampedStep === 0 && (
            <Step1 info={info} setInfo={setInfo} category={category} setCategory={setCategory} />
          )}
          {clampedStep === 1 && isRestaurantMode && <TablesStep rest={rest} setRest={setRest} />}
          {clampedStep === 1 && !isRestaurantMode && <ChairsStep chairs={chairs} setChairs={setChairs} />}
          {clampedStep === 2 && isRestaurantMode && <MenuStep items={menuDraft} setItems={setMenuDraft} />}
          {clampedStep === 2 && !isRestaurantMode && <ServicesStep items={svcDraft} setItems={setSvcDraft} />}
          {clampedStep === 3 && <LoyaltyStep loyalty={loyalty} setLoyalty={setLoyalty} />}
          {isRestaurantMode && clampedStep === 4 && <QrStep tableNames={rest.tableNames} businessSlug={slug(info.businessName || rest.name)} />}
          {clampedStep === (isRestaurantMode ? 5 : 4) && <CampaignsStep campaigns={campaigns} setCampaigns={setCampaigns} />}
          {clampedStep === total - 1 && <ReadyStep isRestaurantMode={isRestaurantMode} onFinish={finish} />}
        </motion.div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={goBack} disabled={clampedStep === 0}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            {clampedStep < total - 1 && (
              <Button variant="ghost" size="sm" onClick={skip}>
                <SkipForward className="mr-1 h-4 w-4" /> Skip for now
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onClick={saveAndClose}>
              <Save className="mr-1 h-4 w-4" /> Save & continue later
            </Button>
            {clampedStep < total - 1 ? (
              <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={goNext}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={finish}>
                Go to Dashboard <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function slug(s: string) { return (s || "business").toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""); }

// ---------------- Step 1: Business info ----------------
function Step1({ info, setInfo, category, setCategory }: { info: any; setInfo: (v: any) => void; category: BusinessCategory; setCategory: (c: BusinessCategory) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Business type</Label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = category === c.id;
            return (
              <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                className={cn("rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5",
                  active ? "border-primary bg-primary/5 shadow-elegant" : "hover:border-primary/50")}>
                <div className="grid h-9 w-9 place-items-center rounded-lg gradient-brand text-primary-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-2 font-medium">{c.label}</p>
                <p className="text-[11px] text-muted-foreground">{c.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Fld label="Business name" value={info.businessName} onChange={(v) => setInfo({ ...info, businessName: v })} placeholder="Aroma Bistro" />
        <Fld label="Owner name" value={info.ownerName} onChange={(v) => setInfo({ ...info, ownerName: v })} placeholder="Priya Sharma" />
        <Fld label="Phone" value={info.phone} onChange={(v) => setInfo({ ...info, phone: v })} placeholder="+91 98765 43210" />
        <Fld label="Email" value={info.email} onChange={(v) => setInfo({ ...info, email: v })} placeholder="owner@business.com" />
        <Fld label="Country" value={info.country} onChange={(v) => setInfo({ ...info, country: v })} />
        <Fld label="City" value={info.city} onChange={(v) => setInfo({ ...info, city: v })} placeholder="Bengaluru" />
        <Fld label="GST number (optional)" value={info.gstNumber} onChange={(v) => setInfo({ ...info, gstNumber: v })} />
        <Fld label="Business logo URL (optional)" value={info.logo} onChange={(v) => setInfo({ ...info, logo: v })} />
      </div>
    </div>
  );
}

// ---------------- Step 2a: Tables ----------------
function TablesStep({ rest, setRest }: { rest: RestaurantProfile; setRest: (v: RestaurantProfile) => void }) {
  function setCount(n: number) {
    n = Math.max(1, Math.min(50, n));
    const names = Array.from({ length: n }, (_, i) => rest.tableNames[i] || `Table ${i + 1}`);
    setRest({ ...rest, tables: n, tableNames: names });
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <Label>Number of tables</Label>
          <Input type="number" value={rest.tables} onChange={(e) => setCount(+e.target.value || 1)} />
        </div>
        <label className="flex items-center gap-2 rounded-xl border p-3">
          <Switch checked={rest.parcel} onCheckedChange={(v) => setRest({ ...rest, parcel: v })} />
          <span className="text-sm">Parcel counter</span>
        </label>
        <label className="flex items-center gap-2 rounded-xl border p-3">
          <Switch checked={rest.takeaway} onCheckedChange={(v) => setRest({ ...rest, takeaway: v })} />
          <span className="text-sm">Take Away</span>
        </label>
      </div>
      <div>
        <Label>Table names (optional)</Label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {rest.tableNames.map((n, i) => (
            <Input key={i} value={n} onChange={(e) => setRest({ ...rest, tableNames: rest.tableNames.map((x, j) => j === i ? e.target.value : x) })}
              placeholder={`Table ${i + 1}`} />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">e.g. Family Table, VIP Cabin, Terrace, Parcel Counter, Take Away</p>
      </div>
    </div>
  );
}

// ---------------- Step 2b: Chairs (salon/spa) ----------------
function ChairsStep({ chairs, setChairs }: { chairs: { count: number; names: string[] }; setChairs: (v: any) => void }) {
  function setCount(n: number) {
    n = Math.max(1, Math.min(50, n));
    const names = Array.from({ length: n }, (_, i) => chairs.names[i] || `Chair ${i + 1}`);
    setChairs({ count: n, names });
  }
  return (
    <div className="space-y-4">
      <div className="sm:w-1/3">
        <Label>Number of chairs / stations</Label>
        <Input type="number" value={chairs.count} onChange={(e) => setCount(+e.target.value || 1)} />
      </div>
      <div>
        <Label>Chair / station names (optional)</Label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {chairs.names.map((n, i) => (
            <Input key={i} value={n} onChange={(e) => setChairs({ ...chairs, names: chairs.names.map((x, j) => j === i ? e.target.value : x) })}
              placeholder={`Chair ${i + 1}`} />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">e.g. Hair Wash, Nail Station, VIP Chair, Facial Room, Spa Room</p>
      </div>
    </div>
  );
}

// ---------------- Step 3a: Menu ----------------
function MenuStep({ items, setItems }: { items: MenuItem[]; setItems: (v: MenuItem[]) => void }) {
  const cats = Array.from(new Set([...RESTAURANT_CATS, ...items.map((i) => i.category)]));
  function add() {
    setItems([...items, { id: `m${Date.now().toString(36)}`, name: "", price: 0, category: cats[0] || "Mains", available: true }]);
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => <Badge key={c} variant="secondary" className="rounded-full">{c}</Badge>)}
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {items.map((it, i) => (
          <div key={it.id} className="grid grid-cols-1 gap-2 rounded-xl border p-2 sm:grid-cols-[1fr_130px_90px_auto_auto]">
            <Input placeholder="Name" value={it.name} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            <Input placeholder="Category" value={it.category} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, category: e.target.value } : x))} />
            <Input type="number" placeholder="Price" value={it.price} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, price: +e.target.value } : x))} />
            <div className="flex items-center gap-2"><Switch checked={it.available} onCheckedChange={(v) => setItems(items.map((x, j) => j === i ? { ...x, available: v } : x))} /><span className="text-xs">Available</span></div>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" className="rounded-full" onClick={add}><Plus className="mr-1 h-4 w-4" /> Add menu item</Button>
    </div>
  );
}

// ---------------- Step 3b: Services ----------------
function ServicesStep({ items, setItems }: { items: SalonService[]; setItems: (v: SalonService[]) => void }) {
  function add() {
    setItems([...items, { id: `s${Date.now().toString(36)}`, name: "", category: SALON_CATS[0], duration: 30, price: 0, available: true }]);
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {SALON_CATS.map((c) => <Badge key={c} variant="secondary" className="rounded-full">{c}</Badge>)}
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {items.map((s, i) => (
          <div key={s.id} className="grid grid-cols-1 gap-2 rounded-xl border p-2 sm:grid-cols-[1fr_120px_90px_90px_auto_auto]">
            <Input placeholder="Service" value={s.name} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            <Input placeholder="Category" value={s.category} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, category: e.target.value } : x))} />
            <Input type="number" placeholder="Price" value={s.price} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, price: +e.target.value } : x))} />
            <Input type="number" placeholder="Mins" value={s.duration} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, duration: +e.target.value } : x))} />
            <div className="flex items-center gap-2"><Switch checked={s.available} onCheckedChange={(v) => setItems(items.map((x, j) => j === i ? { ...x, available: v } : x))} /><span className="text-xs">On</span></div>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" className="rounded-full" onClick={add}><Plus className="mr-1 h-4 w-4" /> Add service</Button>
    </div>
  );
}

// ---------------- Step 4: Loyalty ----------------
function LoyaltyStep({ loyalty, setLoyalty }: { loyalty: LoyaltySettings; setLoyalty: (v: LoyaltySettings) => void }) {
  const preview = calcPointsForAmount(500, loyalty);
  const num = (k: keyof LoyaltySettings, label: string, hint?: string) => (
    <div>
      <Label>{label}</Label>
      <Input type="number" value={loyalty[k] as number} onChange={(e) => setLoyalty({ ...loyalty, [k]: +e.target.value })} />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        {num("pointsPer100", "Points per ₹100")}
        {num("signupBonus", "Signup bonus")}
        {num("visitBonus", "Visit bonus")}
        {num("birthdayBonus", "Birthday bonus")}
        {num("referralBonus", "Referral bonus")}
        {num("minRedemption", "Minimum redemption")}
        {num("maxRedemptionPct", "Max redemption %")}
        {num("expiryDays", "Point expiry (days)", "0 = never expires")}
      </div>
      <Card className="rounded-2xl bg-primary/5 border-primary/20">
        <CardContent className="p-6 text-center space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Live preview</p>
          <p className="text-sm">A customer spends</p>
          <p className="font-display text-3xl font-bold">₹500</p>
          <ChevronRight className="mx-auto h-5 w-5 text-primary rotate-90" />
          <p className="text-sm">They earn</p>
          <p className="font-display text-3xl font-bold text-primary">{preview} points</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Step 5: QR ----------------
function QrStep({ tableNames, businessSlug }: { tableNames: string[]; businessSlug: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  function urlFor(t: string) { return `${origin}/qr/${businessSlug}/${encodeURIComponent(t)}`; }
  function printAll() {
    const w = window.open("", "_blank"); if (!w) return;
    const html = `<html><head><title>Table QR Codes</title>
      <style>body{font-family:system-ui;padding:24px} .g{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
      .c{border:1px solid #ddd;border-radius:12px;padding:16px;text-align:center;page-break-inside:avoid}
      img{width:180px;height:180px} h3{margin:8px 0 4px} p{color:#666;font-size:12px;word-break:break-all}</style></head>
      <body><h1>${businessSlug} — Table QR codes</h1><div class="g">
      ${tableNames.map((t) => `<div class="c"><img src="${qrImg(urlFor(t), 260)}" /><h3>${t}</h3><p>${urlFor(t)}</p></div>`).join("")}
      </div><script>window.onload=()=>setTimeout(()=>window.print(),400)</script></body></html>`;
    w.document.write(html); w.document.close();
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Print or download a QR for every table. Customers scan to order directly.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-full" onClick={printAll}><Printer className="mr-1 h-4 w-4" /> Print all</Button>
        </div>
      </div>
      <div className="grid max-h-[340px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
        {tableNames.map((t) => (
          <Card key={t} className="rounded-2xl">
            <CardContent className="p-3 text-center space-y-2">
              <img src={qrImg(urlFor(t))} alt={t} className="mx-auto rounded-lg" width={180} height={180} />
              <p className="text-sm font-medium truncate">{t}</p>
              <div className="flex justify-center gap-1">
                <a href={qrImg(urlFor(t), 512)} download={`${t}.png`} target="_blank" rel="noreferrer">
                  <Button size="icon" variant="ghost" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
                </a>
                <a href={urlFor(t)} target="_blank" rel="noreferrer">
                  <Button size="icon" variant="ghost" className="h-7 w-7"><QrCode className="h-3.5 w-3.5" /></Button>
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------- Step 6: Campaigns ----------------
function CampaignsStep({ campaigns, setCampaigns }: { campaigns: CampaignSettings; setCampaigns: (v: CampaignSettings) => void }) {
  const rows: { k: keyof CampaignSettings; label: string; desc: string }[] = [
    { k: "birthday", label: "Birthday campaign", desc: "Auto-message on customer birthdays." },
    { k: "anniversary", label: "Anniversary campaign", desc: "Wish customers on their anniversary." },
    { k: "welcome", label: "Welcome campaign", desc: "Greet new customers after their first visit." },
    { k: "recovery", label: "Recovery campaign", desc: "Re-engage customers who haven't visited recently." },
    { k: "festival", label: "Festival campaign", desc: "Broadcast wishes and offers during festivals." },
    { k: "review", label: "Review request", desc: "Request a Google review after a great visit." },
    { k: "vip", label: "VIP campaign", desc: "Exclusive perks for your top spenders." },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <label key={r.k} className="flex items-start gap-3 rounded-xl border p-3">
          <Switch checked={campaigns[r.k]} onCheckedChange={(v) => setCampaigns({ ...campaigns, [r.k]: v })} />
          <div className="flex-1">
            <p className="text-sm font-medium">{r.label}</p>
            <p className="text-xs text-muted-foreground">{r.desc}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

// ---------------- Final ----------------
function ReadyStep({ isRestaurantMode, onFinish }: { isRestaurantMode: boolean; onFinish: () => void }) {
  const items = [
    { label: "Business setup", ok: true },
    { label: isRestaurantMode ? "Menu" : "Services", ok: true },
    { label: "Loyalty program", ok: true },
    ...(isRestaurantMode ? [{ label: "QR codes", ok: true }] : []),
    { label: "Campaigns", ok: true },
  ];
  return (
    <div className="text-center space-y-4">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-glow">
        <Check className="h-8 w-8" />
      </div>
      <div>
        <p className="font-display text-2xl font-bold">🎉 Your business is ready</p>
        <p className="text-sm text-muted-foreground">Everything you configured has been saved. You can change any of it from Settings.</p>
      </div>
      <div className="mx-auto grid max-w-md gap-1.5 text-left">
        {items.map((i) => (
          <div key={i.label} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <Check className="h-4 w-4 text-primary" /> {i.label}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={onFinish}>
          <Store className="mr-1 h-4 w-4" /> Go to Dashboard
        </Button>
      </div>
    </div>
  );
}

function Fld({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// Re-export defaults for consumers if needed
export { defaultCampaignSettings, defaultLoyaltySettings };
export type { Props as OnboardingWizardProps };

// Textarea is imported but not used directly at top level; keep import silent
void Textarea;