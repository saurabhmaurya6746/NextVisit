import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { Trophy, Award, Gem, Sparkles } from "lucide-react";
import { customers } from "@/lib/sample-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useLoyaltySettings, saveLoyaltySettings, calcPointsForAmount, defaultLoyaltySettings, type LoyaltySettings } from "@/lib/loyalty-store";
import { fmt } from "@/lib/currency";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$type/$business/loyalty")({ component: LoyaltyPage });

const tiers = [
  { name: "Silver", icon: Award, color: "from-muted to-muted/50 text-foreground", min: 0, max: 499 },
  { name: "Gold", icon: Trophy, color: "from-warning/40 to-warning/10 text-warning-foreground", min: 500, max: 999 },
  { name: "Diamond", icon: Gem, color: "from-primary/40 to-accent/30 text-primary", min: 1000, max: 9999 },
];

function LoyaltyPage() {
  const saved = useLoyaltySettings();
  const [s, setS] = useState<LoyaltySettings>(saved);
  const [preview, setPreview] = useState<number>(500);
  const previewPoints = calcPointsForAmount(preview, s);
  function up<K extends keyof LoyaltySettings>(k: K, v: number) { setS((p) => ({ ...p, [k]: v })); }
  const setNum = (k: keyof LoyaltySettings) => (v: number) => up(k, v);
  return (
    <>
      <PageHeader title="Loyalty program" description="Silver, Gold and Diamond tiers that reward repeat guests." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Members" value="842" icon={Sparkles} accent="primary" />
        <StatCard label="Points earned" value="128K" accent="accent" />
        <StatCard label="Rewards redeemed" value="312" icon={Trophy} accent="warning" />
        <StatCard label="Tier upgrades" value="47" accent="info" />
      </div>

      <Card className="mt-6 rounded-2xl">
        <CardHeader><CardTitle className="font-display">Loyalty settings</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField label="Points per ₹100 spent" value={s.pointsPer100} onChange={setNum("pointsPer100")} />
            <NumField label="Signup bonus" value={s.signupBonus} onChange={setNum("signupBonus")} />
            <NumField label="Visit bonus" value={s.visitBonus} onChange={setNum("visitBonus")} />
            <NumField label="Birthday bonus" value={s.birthdayBonus} onChange={setNum("birthdayBonus")} />
            <NumField label="Referral bonus" value={s.referralBonus} onChange={setNum("referralBonus")} />
            <NumField label="Minimum redemption (pts)" value={s.minRedemption} onChange={setNum("minRedemption")} />
            <NumField label="Max redemption %" value={s.maxRedemptionPct} onChange={setNum("maxRedemptionPct")} />
            <NumField label="Point expiry (days, 0 = never)" value={s.expiryDays} onChange={setNum("expiryDays")} />
          </div>
          <div className="rounded-2xl border p-4 bg-muted/30">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Live preview</p>
            <div className="mt-2">
              <Label className="text-xs">Sample spend</Label>
              <Input type="number" value={preview} onChange={(e) => setPreview(Number(e.target.value) || 0)} />
            </div>
            <div className="mt-4 rounded-xl gradient-brand p-4 text-primary-foreground">
              <p className="text-xs opacity-80">Customer spends {fmt(preview)}</p>
              <p className="mt-1 font-display text-3xl font-semibold">{previewPoints} pts</p>
              <p className="mt-1 text-xs opacity-80">at {s.pointsPer100} pts per ₹100</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" className="rounded-full gradient-brand text-primary-foreground" onClick={() => { saveLoyaltySettings(s); toast.success("Loyalty settings saved"); }}>Save settings</Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => { setS(defaultLoyaltySettings); toast("Reset to defaults"); }}>Reset</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {tiers.map((t) => (
          <Card key={t.name} className="overflow-hidden rounded-2xl">
            <div className={`bg-gradient-to-br ${t.color} p-6`}>
              <t.icon className="h-8 w-8" />
              <h3 className="mt-3 font-display text-2xl font-semibold">{t.name}</h3>
              <p className="mt-1 text-xs opacity-80">{t.min}+ points</p>
            </div>
            <CardContent className="space-y-2 p-4 text-sm">
              <p className="flex justify-between"><span>Free dessert</span><span className="text-muted-foreground">Every visit</span></p>
              <p className="flex justify-between"><span>Priority booking</span><span className="text-success">✓</span></p>
              <p className="flex justify-between"><span>Birthday gift</span><span className="text-success">✓</span></p>
              {t.name !== "Silver" && <p className="flex justify-between"><span>Anniversary experience</span><span className="text-success">✓</span></p>}
              {t.name === "Diamond" && <p className="flex justify-between"><span>Chef's table (1/yr)</span><span className="text-success">✓</span></p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 rounded-2xl">
        <CardHeader><CardTitle className="font-display">Top members</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {[...customers].sort((a, b) => b.points - a.points).slice(0, 6).map((c) => (
            <div key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3">
              <Avatar className="h-9 w-9"><AvatarFallback className="gradient-brand text-primary-foreground text-xs">{c.initials}</AvatarFallback></Avatar>
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <Progress className="mt-1.5 h-1.5" value={Math.min(100, (c.points / 1500) * 100)} />
              </div>
              <div className="text-right">
                <p className="font-display font-semibold">{c.points}</p>
                <Badge variant="outline" className="rounded-full text-[10px]">{c.points > 1000 ? "Diamond" : c.points > 500 ? "Gold" : "Silver"}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}