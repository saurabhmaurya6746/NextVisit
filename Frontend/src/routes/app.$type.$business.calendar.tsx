import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cake, Heart, CalendarDays, Megaphone, UserCog } from "lucide-react";

export const Route = createFileRoute("/app/$type/$business/calendar")({ component: CalendarPage });

const events = [
  { day: 16, items: [{ icon: Cake, text: "Sarah Johnson · Birthday", tone: "warning" }, { icon: CalendarDays, text: "Table for 4 · Rahul V.", tone: "info" }] },
  { day: 17, items: [{ icon: Cake, text: "Emily Zhang · Birthday", tone: "warning" }, { icon: Megaphone, text: "VIP campaign send", tone: "primary" }] },
  { day: 18, items: [{ icon: Heart, text: "Luca & Sofia · Anniversary", tone: "accent" }] },
  { day: 19, items: [{ icon: UserCog, text: "Kira off (annual leave)", tone: "muted" }, { icon: CalendarDays, text: "Bridal trial · Ananya", tone: "info" }] },
  { day: 20, items: [] },
  { day: 21, items: [{ icon: Cake, text: "Isabella Rossi · Birthday", tone: "warning" }] },
  { day: 22, items: [{ icon: Megaphone, text: "Weekend brunch campaign", tone: "primary" }] },
];

const toneStyle: Record<string, string> = {
  warning: "bg-warning/20 text-warning-foreground",
  info: "bg-info/15 text-info",
  primary: "bg-primary/15 text-primary",
  accent: "bg-accent/25 text-accent-foreground",
  muted: "bg-muted text-muted-foreground",
};

function CalendarPage() {
  return (
    <>
      <PageHeader title="Calendar" description="Birthdays, bookings, campaigns and staff — one view." />
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="font-display">Week of Jul 16, 2026</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {events.map((d) => (
            <div key={d.day} className="rounded-2xl border p-3">
              <div className="mb-2 flex items-center justify-between"><p className="text-xs uppercase tracking-wider text-muted-foreground">Jul</p><p className="font-display text-2xl font-semibold">{d.day}</p></div>
              <div className="space-y-1.5">
                {d.items.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                {d.items.map((it, i) => (
                  <div key={i} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] ${toneStyle[it.tone]}`}>
                    <it.icon className="h-3 w-3 shrink-0" /><span className="truncate">{it.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" className="rounded-full"><span className="mr-1 h-2 w-2 rounded-full bg-warning inline-block" /> Birthdays</Badge>
        <Badge variant="outline" className="rounded-full"><span className="mr-1 h-2 w-2 rounded-full bg-info inline-block" /> Bookings</Badge>
        <Badge variant="outline" className="rounded-full"><span className="mr-1 h-2 w-2 rounded-full bg-primary inline-block" /> Campaigns</Badge>
        <Badge variant="outline" className="rounded-full"><span className="mr-1 h-2 w-2 rounded-full bg-accent inline-block" /> Anniversaries</Badge>
        <Badge variant="outline" className="rounded-full"><span className="mr-1 h-2 w-2 rounded-full bg-muted-foreground inline-block" /> Staff</Badge>
      </div>
    </>
  );
}