import { AppLink } from "@/lib/app-nav";
import { motion } from "framer-motion";
import { Phone, MessageCircle, Edit, Trash2, Calendar, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { fmt } from "@/lib/currency";
import { openWhatsApp } from "@/lib/celebration-utils";
import { logWhatsApp } from "@/lib/whatsapp-history";

const statusColor: Record<string, string> = {
  VIP: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  Regular: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  New: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  "At Risk": "bg-destructive/15 text-destructive border-destructive/30",
};

function formatHumanDate(dateStr?: string | null): string {
  if (!dateStr || dateStr === "—" || dateStr === "-") return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export function CustomerCard({
  c,
  index = 0,
  onEdit,
  onDelete,
  onWhatsApp,
}: {
  c: any;
  index?: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onWhatsApp?: () => void;
}) {
  const handleDefaultWhatsApp = () => {
    if (onWhatsApp) {
      onWhatsApp();
      return;
    }
    const firstName = c.name ? c.name.split(" ")[0] : "there";
    const msg = `Hi ${firstName} 👋 — thank you for connecting with us!`;
    const success = openWhatsApp(c.phone, msg);
    if (success) {
      logWhatsApp({ customerId: c.id, kind: "manual", message: msg });
      toast.success(`WhatsApp opened for ${c.name}`);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.02 }} className="h-full min-w-0">
      <Card className="group h-full overflow-hidden rounded-2xl border bg-card p-3 sm:p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 flex flex-col justify-between gap-2.5">
        <div>
          {/* Header Row: Left (Avatar, Name, Phone) | Right (Status Badge) */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 border border-border/60">
                <AvatarFallback className="gradient-brand text-primary-foreground text-xs font-bold">
                  {c.initials || "CU"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <AppLink
                  path="customers/$id"
                  params={{ id: c.id }}
                  className="block font-semibold text-sm text-foreground hover:text-primary break-words leading-snug"
                >
                  {c.name}
                </AppLink>
                <p className="text-xs text-muted-foreground mt-0.5 break-all">{c.phone}</p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn("rounded-full text-[10px] font-semibold tracking-wider uppercase shrink-0 py-0.5 px-2", statusColor[c.status] || "bg-muted text-foreground")}
            >
              {c.status}
            </Badge>
          </div>

          {/* 3-Column Metrics: Points, Visits, Spent */}
          <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
            <Metric label="Points" value={c.points} />
            <Metric label="Visits" value={c.visits} />
            <Metric label="Spent" value={fmt(c.spent)} />
          </div>

          {/* Human-readable Date Section with Label */}
          <div className="mt-2.5 pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-1 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <Calendar className="h-3 w-3 text-primary/70 shrink-0" />
              <span className="text-[10px] sm:text-[11px] text-muted-foreground">Last Visit:</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-foreground truncate">{formatHumanDate(c.lastVisit)}</span>
            </div>
            {c.birthday && c.birthday !== "—" && (
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground">
                <span>🎂</span>
                <span>{formatHumanDate(c.birthday)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons: WhatsApp, Call, Edit, Delete */}
        <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 flex-1 min-w-[150px]">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 sm:h-8 rounded-full text-xs px-2 cursor-pointer justify-center font-medium"
              onClick={handleDefaultWhatsApp}
            >
              <MessageCircle className="mr-1 h-3.5 w-3.5 text-emerald-600 shrink-0" /> WhatsApp
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 sm:h-8 rounded-full text-xs px-2 cursor-pointer justify-center font-medium"
              onClick={() => window.open(`tel:${c.phone ? c.phone.replace(/[^\d+]/g, "") : ""}`)}
            >
              <Phone className="mr-1 h-3.5 w-3.5 text-primary shrink-0" /> Call
            </Button>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
              title="Edit Customer"
              onClick={() => onEdit?.()}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-full text-destructive hover:bg-destructive/10 cursor-pointer"
              title="Delete Customer"
              onClick={() => onDelete?.()}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl bg-muted/40 p-1.5 sm:p-2 text-center min-w-0 border border-border/20">
      <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate">{label}</p>
      <p className="font-display text-xs sm:text-sm font-bold text-foreground mt-0.5 truncate">{value}</p>
    </div>
  );
}