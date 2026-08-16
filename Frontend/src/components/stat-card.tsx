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
      className="group relative overflow-hidden rounded-2xl border bg-card p-3 sm:p-5 shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-glow h-full flex flex-col justify-between min-h-[120px] sm:min-h-[140px]"
    >
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-28 w-28 sm:h-32 sm:w-32 rounded-full bg-gradient-to-br opacity-70 blur-2xl", accentMap[accent])} />
      
      <div className="relative flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-snug line-clamp-2">
            {label}
          </p>
        </div>
        {Icon && (
          <div className={cn("grid h-7 w-7 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-lg sm:rounded-xl bg-gradient-to-br", accentMap[accent])}>
            <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
          </div>
        )}
      </div>

      <div className="relative mt-2 sm:mt-3 flex-1 flex flex-col justify-end">
        <p className="font-display text-lg sm:text-3xl font-bold tracking-tight text-foreground tabular-nums truncate">
          {value}
        </p>
        <div className="min-h-[16px] sm:min-h-[18px] mt-0.5 sm:mt-1 flex items-center">
          {delta ? (
            <p className={cn("text-[10px] sm:text-xs font-medium truncate leading-none", trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground")}>
              <span className="mr-0.5">{trend === "up" ? "▲" : trend === "down" ? "▼" : "•"}</span>
              {delta}
            </p>
          ) : (
            <span className="text-[10px] sm:text-xs text-muted-foreground/30 leading-none select-none">
              —
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}