import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Mail, MessageCircle, Phone, Plus } from "lucide-react";
import { festivals, aiSuggestions } from "@/lib/sample-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$type/$business/marketing")({ component: MarketingPage });

const templates = [
  { channel: "Email", icon: Mail, title: "Weekend brunch launch", copy: "Introducing our new weekend brunch — book by Friday for early bird pricing." },
  { channel: "WhatsApp", icon: MessageCircle, title: "VIP tasting menu", copy: "Reserved for Diamond members: a private tasting menu, Saturday 8 PM." },
  { channel: "SMS", icon: Phone, title: "Flash coupon", copy: "Today only: 20% off dinner with code FLASH20." },
];

function MarketingPage() {
  return (
    <>
      <PageHeader title="Marketing" description="Festivals, templates and AI ideas — all in one place."
        actions={<Button size="sm" className="rounded-full gradient-brand text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> New campaign</Button>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader><CardTitle className="font-display">Upcoming festivals</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {festivals.map((f) => (
              <div key={f.name} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between"><p className="font-display text-lg font-semibold">{f.name}</p><Badge variant="secondary" className="rounded-full">{f.date}</Badge></div>
                <p className="mt-2 text-sm text-muted-foreground">{f.template}</p>
                <Button size="sm" className="mt-3 rounded-full gradient-brand text-primary-foreground" onClick={() => toast.success(`${f.name} campaign drafted`)}>Draft campaign</Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="font-display flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI campaign ideas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {aiSuggestions.map((s) => (
              <div key={s.title} className="glass rounded-xl p-3">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 rounded-2xl">
        <CardHeader><CardTitle className="font-display">Templates</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {templates.map((t) => (
            <div key={t.title} className="rounded-2xl border p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><t.icon className="h-5 w-5" /></div>
              <p className="mt-3 font-medium">{t.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.copy}</p>
              <div className="mt-3 flex items-center justify-between"><Badge variant="outline" className="rounded-full text-[10px]">{t.channel}</Badge><Button size="sm" variant="ghost" onClick={() => toast("Template opened")}>Use</Button></div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}