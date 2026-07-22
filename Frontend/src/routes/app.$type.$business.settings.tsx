import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Store, Plus, Trash2, UtensilsCrossed, Scissors } from "lucide-react";
import { useBusinessType, setBusinessType, resetOnboarding, type BusinessType } from "@/lib/business-type";
import { useProfile, saveProfile } from "@/lib/business-profile";
import { useMenu, saveMenu, type MenuItem } from "@/lib/menu-store";
import { cn } from "@/lib/utils";
import { openWizard, clearDraft } from "@/lib/wizard-store";

export const Route = createFileRoute("/app/$type/$business/settings")({ component: SettingsPage });

function SettingsPage() {
  const type = useBusinessType();
  const restaurant = useProfile("restaurant");
  const salon = useProfile("salon");
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
          <ProfileTab type={type} restaurant={restaurant} salon={salon} />
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
              <TablesTab restaurant={restaurant} />
            </TabsContent>
            <TabsContent value="gst" className="mt-4">
              <GstTab restaurant={restaurant} />
            </TabsContent>
          </>
        )}

        {type === "salon" && (
          <TabsContent value="services" className="mt-4">
            <ServicesTab salon={salon} />
          </TabsContent>
        )}

        <TabsContent value="hours" className="mt-4">
          <Card className="rounded-2xl"><CardHeader><CardTitle className="font-display">Business hours</CardTitle></CardHeader>
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

function ProfileTab({ type, restaurant, salon }: { type: BusinessType; restaurant: any; salon: any }) {
  const [rest, setRest] = useState(restaurant);
  const [sal, setSal] = useState(salon);
  const p = type === "restaurant" ? rest : sal;
  const setP = (v: any) => (type === "restaurant" ? setRest(v) : setSal(v));
  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="font-display">Business profile</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl gradient-brand text-primary-foreground shadow-glow"><Store className="h-7 w-7" /></div>
          <Input placeholder="Logo URL" value={p.logo} onChange={(e) => setP({ ...p, logo: e.target.value })} className="max-w-sm" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Fld label="Business name" value={p.name} onChange={(v) => setP({ ...p, name: v })} />
          <Fld label="Currency" value={p.currency} onChange={(v) => setP({ ...p, currency: v })} />
          <Fld label="Google review link" value={p.googleReviewLink} onChange={(v) => setP({ ...p, googleReviewLink: v })} />
          {type === "restaurant" && <Fld label="UPI QR image URL" value={rest.upiQr} onChange={(v) => setRest({ ...rest, upiQr: v })} />}
        </div>
        <div className="flex justify-end">
          <Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => { saveProfile(type, p); toast.success("Profile saved"); }}>Save</Button>
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

function GstTab({ restaurant }: { restaurant: any }) {
  const [p, setP] = useState(restaurant);
  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="font-display">GST & tax</CardTitle><p className="text-xs text-muted-foreground">When enabled, invoices calculate GST on top of the subtotal.</p></CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between rounded-xl border p-3">
          <span>Enable GST on invoices</span>
          <Switch checked={p.gstEnabled} onCheckedChange={(v) => setP({ ...p, gstEnabled: v })} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Fld label="GSTIN" value={p.gstNumber} onChange={(v) => setP({ ...p, gstNumber: v })} />
          <div className="space-y-1.5"><Label>GST %</Label><Input type="number" value={p.gstPercent} onChange={(e) => setP({ ...p, gstPercent: +e.target.value })} /></div>
        </div>
        <div className="flex justify-end">
          <Button className="rounded-full gradient-brand text-primary-foreground" onClick={() => { saveProfile("restaurant", p); toast.success("Tax settings saved"); }}>Save</Button>
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
  return (<div className="space-y-1.5"><Label>{label}</Label><Input value={value} onChange={(e) => onChange(e.target.value)} /></div>);
}