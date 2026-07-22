import { AppLink } from "@/lib/app-nav";
import { motion } from "framer-motion";
import { Phone, MessageCircle, Edit, Trash2, Calendar, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusColor: Record<string, string> = {
  VIP: "bg-gradient-to-r from-primary/20 to-accent/20 text-primary border-primary/30",
  Regular: "bg-muted text-foreground",
  New: "bg-info/15 text-info border-info/30",
  "At Risk": "bg-destructive/15 text-destructive border-destructive/30",
};

export function CustomerCard({ c, index = 0 }: { c: any; index?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} whileHover={{ scale: 1.02 }}>
      <Card className="group h-full overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow">
        <div className="h-1.5 gradient-brand" />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-11 w-11 shrink-0"><AvatarFallback className="gradient-brand text-primary-foreground text-sm">{c.initials}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <AppLink path="customers/$id" params={{ id: c.id }} className="block truncate font-semibold hover:text-primary">{c.name}</AppLink>
              <p className="truncate text-xs text-muted-foreground">{c.phone}</p>
            </div>
            <Badge variant="outline" className={cn("rounded-full text-[10px]", statusColor[c.status])}>{c.status}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Metric label="Points" value={c.points} />
            <Metric label="Visits" value={c.visits} />
            <Metric label="Spent" value={`$${c.spent}`} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {c.birthday}</span>
            <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {c.anniversary}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => toast.success(`WhatsApp sent to ${c.name}`)}><MessageCircle className="mr-1 h-3 w-3" /> WhatsApp</Button>
            <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => toast(`Calling ${c.phone}`)}><Phone className="mr-1 h-3 w-3" /> Call</Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => toast("Edit dialog")}><Edit className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive" onClick={() => toast.error("Removed (demo)")}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl bg-muted/60 p-2">
      <p className="font-display text-sm font-semibold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}