import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  icon?: LucideIcon;
  accent?: "primary" | "accent" | "warning" | "info" | "destructive";
  index?: number;
}

const accentMap = {
  primary: "from-primary/20 to-primary/5 text-primary",
  accent: "from-accent/25 to-accent/5 text-accent-foreground",
  warning: "from-warning/25 to-warning/5 text-warning-foreground",
  info: "from-info/20 to-info/5 text-info",
  destructive: "from-destructive/20 to-destructive/5 text-destructive",
};

export function StatCard({ label, value, delta, trend = "up", icon: Icon, accent = "primary", index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-glow"
    >
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br opacity-70 blur-2xl", accentMap[accent])} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-semibold text-foreground">{value}</p>
          {delta && (
            <p className={cn("mt-1 text-xs font-medium", trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground")}>
              {trend === "up" ? "▲" : trend === "down" ? "▼" : "•"} {delta}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br", accentMap[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </motion.div>
  );
}