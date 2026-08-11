import { motion } from "framer-motion";
import { Cake, Gift, CalendarDays, CalendarRange, ArrowRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type Kind } from "@/lib/celebration-utils";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/auth";

const accentMap = {
  primary: "from-primary/20 to-primary/5 text-primary",
  accent: "from-accent/25 to-accent/5 text-accent-foreground",
  warning: "from-warning/25 to-warning/5 text-warning-foreground",
} as const;

function ClickableStat({
  label,
  value,
  to,
  Icon,
  accent,
  index,
}: {
  label: string;
  value: number | string;
  to: string;
  Icon: typeof Cake;
  accent: keyof typeof accentMap;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: "easeOut" }}
      whileHover={{ scale: 1.02 }}
    >
      <Link to={to as any} className="block">
        <Card className="group relative overflow-hidden rounded-2xl p-5 shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-glow bg-card">
          <div className={cn("pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br opacity-70 blur-2xl", accentMap[accent])} />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="mt-2 font-display text-3xl font-semibold text-foreground">{value}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                View list <ArrowRight className="h-3 w-3" />
              </p>
            </div>
            <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br", accentMap[accent])}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

export default function CelebrationPage({ kind }: { kind: Kind }) {
  const params = useParams({ strict: false });
  const type = params.type || "restaurant";
  const business = params.business || "my-business";

  const isBday = kind === "birthday";
  const title = isBday ? "Birthday campaigns" : "Anniversary campaigns";
  const emoji = isBday ? "🎂" : "❤️";
  const campaignPath = isBday ? "birthday-campaigns" : "anniversary-campaigns";
  const base = `/app/${type}/${business}/${campaignPath}`;
  const labelToday = isBday ? "Today's Birthdays" : "Today's Anniversaries";

  // Fetch real database summary counts for birthday or anniversary
  const summaryEndpoint = isBday ? "/api/v1/customers/birthday-summary" : "/api/v1/customers/anniversary-summary";
  const { data: summary } = useQuery({
    queryKey: [isBday ? "birthday-summary" : "anniversary-summary"],
    queryFn: async () => {
      const res = await apiFetch(summaryEndpoint);
      if (!res.ok) throw new Error("Failed to fetch celebration summary");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const todayCount = summary?.today ?? 0;
  const tomCount = summary?.tomorrow ?? 0;
  const weekCount = summary?.this_week ?? 0;
  const monthCount = summary?.this_month ?? 0;

  return (
    <>
      <PageHeader title={title} description={`${emoji} Delight guests on their special day — click a card to open its list.`} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ClickableStat label={labelToday} value={todayCount} to={`${base}/today`} Icon={Cake} accent="primary" index={0} />
        <ClickableStat label="Tomorrow" value={tomCount} to={`${base}/tomorrow`} Icon={Gift} accent="accent" index={1} />
        <ClickableStat label="This Week" value={weekCount} to={`${base}/week`} Icon={CalendarDays} accent="warning" index={2} />
        <ClickableStat label="This Month" value={monthCount} to={`${base}/month`} Icon={CalendarRange} accent="primary" index={3} />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Tip: from any list you can open WhatsApp with the prefilled personalized AI message — just tap Send.
      </p>
    </>
  );
}