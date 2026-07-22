import { AppLink } from "@/lib/app-nav";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Crown, MessageCircle, Sparkles, Phone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { PageTransition } from "@/components/page-transition";
import { EmptyState } from "@/components/empty-state";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { useActiveCustomers } from "@/lib/archive-store";
import { openWhatsApp } from "@/lib/celebration-utils";
import { logWhatsApp } from "@/lib/whatsapp-history";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$type/$business/vip")({ component: VipPage });

function vipMessage(name: string, fav: string) {
  const first = name.split(" ")[0];
  return `Hi ${first} 💎\nAs one of our most valued guests, we've reserved something special for you.\nEnjoy a complimentary ${fav || "signature dish"} on your next visit — coupon VIP25 unlocks 25% off the rest of your bill.\nThank you for being part of our story ❤️\n— Aroma Bistro`;
}

function VipPage() {
  const active = useActiveCustomers();
  const vips = active.filter((c) => c.visits >= 20 || c.spent >= 1000 || c.status === "VIP").sort((a, b) => b.spent - a.spent);
  const [aiFor, setAiFor] = useState<any | null>(null);
  const [custom, setCustom] = useState<Record<string, string>>({});

  function send(c: any) {
    const msg = custom[c.id] ?? vipMessage(c.name, c.favorites?.[0]);
    openWhatsApp(c.phone, msg);
    logWhatsApp({ customerId: c.id, kind: "campaign", message: msg });
    toast.success("VIP message opened in WhatsApp");
  }

  const lifetime = vips.reduce((s, c) => s + c.spent, 0);
  return (
    <PageTransition>
      <PageHeader title="VIP customers" description="Your top guests, identified automatically by visits and lifetime spend." />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="VIPs" value={vips.length} icon={Crown} accent="primary" />
        <StatCard label="Lifetime spend" value={`$${lifetime.toLocaleString()}`} accent="accent" />
        <StatCard label="Avg visits" value={vips.length ? Math.round(vips.reduce((s, c) => s + c.visits, 0) / vips.length) : 0} accent="warning" />
      </div>

      {vips.length === 0 ? (
        <EmptyState title="No VIPs yet" description="Guests with 20+ visits or $1,000+ lifetime spend appear here." icon={<Crown className="h-7 w-7" />} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vips.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ scale: 1.02 }}>
              <Card className="overflow-hidden rounded-2xl transition-all hover:shadow-glow">
                <div className="h-1.5 gradient-brand" />
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11"><AvatarFallback className="gradient-brand text-primary-foreground text-sm">{c.initials}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <AppLink path="customers/$id" params={{ id: c.id }} className="truncate font-semibold hover:text-primary block">{c.name}</AppLink>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    </div>
                    <Badge className="rounded-full text-[10px]"><Crown className="mr-1 h-3 w-3" /> VIP</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-muted/60 p-2"><p className="font-display font-semibold">{c.visits}</p><p className="text-[10px] text-muted-foreground">Visits</p></div>
                    <div className="rounded-lg bg-muted/60 p-2"><p className="font-display font-semibold">${c.spent}</p><p className="text-[10px] text-muted-foreground">Lifetime</p></div>
                    <div className="rounded-lg bg-muted/60 p-2"><p className="font-display font-semibold">{c.points}</p><p className="text-[10px] text-muted-foreground">Points</p></div>
                  </div>
                  <p className="mt-2 truncate text-xs text-muted-foreground"><span className="text-foreground/70">Favorite:</span> {c.favorites?.[0] || "—"}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button size="sm" className="h-8 rounded-full gradient-brand text-primary-foreground text-xs" onClick={() => send(c)}>
                      <MessageCircle className="mr-1 h-3 w-3" /> Send WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setAiFor(c)}>
                      <Sparkles className="mr-1 h-3 w-3 text-primary" /> AI Generate
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => window.open(`tel:${c.phone.replace(/[^\d+]/g, "")}`)}>
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <AiGenerateDialog
        open={!!aiFor}
        onOpenChange={(o) => !o && setAiFor(null)}
        title="AI VIP message"
        description={aiFor ? `Personalized for ${aiFor.name}` : ""}
        generate={() => aiFor ? vipMessage(aiFor.name, aiFor.favorites?.[0]) : ""}
        onUse={(m) => { if (aiFor) setCustom((p) => ({ ...p, [aiFor.id]: m })); toast.success("AI message ready"); }}
      />
    </PageTransition>
  );
}