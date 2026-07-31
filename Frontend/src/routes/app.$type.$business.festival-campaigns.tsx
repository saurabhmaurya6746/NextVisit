import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, MessageCircle, Save, PartyPopper, Calendar, Users, Clock, Percent } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/page-transition";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { CampaignSendModal, SendCustomerItem } from "@/components/campaign-send-modal";
import { listCustomersApi } from "@/lib/customers-api";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/auth";

export const Route = createFileRoute("/app/$type/$business/festival-campaigns")({ component: FestivalsPage });

const TONES = [
  "Festive", "Friendly", "Funny", "Luxury", "Premium",
  "Emotional", "Minimal", "Family", "Foodie", "Casual"
];

const LANGUAGES = [
  { id: "Hinglish", label: "Hinglish" },
  { id: "English", label: "English" },
  { id: "Hindi", label: "Hindi" },
];

export interface FestivalCampaignItem {
  id: string;
  festival_id: string;
  festival_name: string;
  festival_date: string;
  days_remaining: number;
  coupon_code: string;
  language: string;
  tone: string;
  message: string;
  ai_generated: boolean;
  enabled: boolean;
  eligible_customers: number;
  sent_count: number;
  pending_count: number;
}

function FestivalsPage() {
  const queryClient = useQueryClient();

  const [aiFor, setAiFor] = useState<FestivalCampaignItem | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftLanguages, setDraftLanguages] = useState<Record<string, string>>({});
  const [draftTones, setDraftTones] = useState<Record<string, string>>({});
  const [draftCoupons, setDraftCoupons] = useState<Record<string, string>>({});
  const [draftDiscounts, setDraftDiscounts] = useState<Record<string, string>>({});
  const [sendFor, setSendFor] = useState<FestivalCampaignItem | null>(null);

  // Fetch 100% database-driven active customer list
  const { data: realCustomers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: listCustomersApi,
    refetchInterval: 30000,
  });

  const sendCustomerList: SendCustomerItem[] = realCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    status: c.status,
    visit_count: c.visits,
    total_spent: c.spent,
  }));

  // Fetch 100% database-driven festival campaigns
  const { data: campaigns = [], isLoading } = useQuery<FestivalCampaignItem[]>({
    queryKey: ["festival-campaigns"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/festival-campaigns");
      if (!res.ok) throw new Error("Failed to fetch festival campaigns");
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Fetch upcoming summary metrics
  const { data: upcoming } = useQuery({
    queryKey: ["festival-upcoming"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/festival-campaigns/upcoming");
      if (!res.ok) throw new Error("Failed to fetch upcoming festivals");
      return res.json();
    },
  });

  // Update campaign mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const res = await apiFetch(`/api/v1/festival-campaigns/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update festival campaign");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["festival-campaigns"] });
      toast.success(`${data.festival_name} campaign template saved!`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save campaign");
    },
  });

  function getMessage(f: FestivalCampaignItem) {
    return drafts[f.id] ?? f.message;
  }

  function getLang(f: FestivalCampaignItem) {
    return draftLanguages[f.id] ?? f.language ?? "Hinglish";
  }

  function getTone(f: FestivalCampaignItem) {
    return draftTones[f.id] ?? f.tone ?? "Festive";
  }

  function getCoupon(f: FestivalCampaignItem) {
    return draftCoupons[f.id] ?? f.coupon_code ?? "FESTIVE20";
  }

  function getDiscount(f: FestivalCampaignItem) {
    return draftDiscounts[f.id] ?? "20%";
  }

  function handleSave(f: FestivalCampaignItem) {
    updateMutation.mutate({
      id: f.id,
      body: {
        message: getMessage(f),
        language: getLang(f),
        tone: getTone(f),
        coupon_code: getCoupon(f),
      },
    });
  }

  const nextFest = upcoming?.next_festival;

  return (
    <PageTransition>
      <PageHeader
        title="Festival campaigns"
        description="Database-driven festival automation — personalized D2C WhatsApp copy powered by Gemini AI."
      />

      {/* UPCOMING METRICS CARDS */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl p-4 shadow-sm bg-card border">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Next Festival</p>
              <p className="font-display text-lg font-semibold">{nextFest ? nextFest.festival_name : "None Scheduled"}</p>
              <p className="text-xs text-primary font-medium">{nextFest ? `${nextFest.days_remaining} days remaining (${nextFest.festival_date})` : "Check back soon"}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl p-4 shadow-sm bg-card border">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/20 text-accent-foreground">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Next 30 Days</p>
              <p className="font-display text-2xl font-semibold">{upcoming?.next_30_days?.length ?? 0} Festivals</p>
              <p className="text-xs text-muted-foreground">Automated audience ready</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl p-4 shadow-sm bg-card border">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Eligible Customers</p>
              <p className="font-display text-2xl font-semibold">{sendCustomerList.length}</p>
              <p className="text-xs text-muted-foreground">Active merchant database</p>
            </div>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading database festival campaigns…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((f, i) => (
            <motion.div key={f.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="overflow-hidden rounded-2xl transition-all hover:shadow-glow bg-card">
                <div className="h-1.5 gradient-brand" />
                <CardContent className="space-y-3.5 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-display text-lg font-semibold">{f.festival_name}</p>
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          {f.days_remaining === 0 ? "Today!" : f.days_remaining === 1 ? "Tomorrow" : `${f.days_remaining} days away`}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{f.festival_date}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full font-mono text-[10px]">{getCoupon(f)}</Badge>
                  </div>

                  {/* SELECTORS FOR LANGUAGE, TONE, COUPON & DISCOUNT */}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-1 block">Language</Label>
                      <select
                        value={getLang(f)}
                        onChange={(e) => setDraftLanguages((p) => ({ ...p, [f.id]: e.target.value }))}
                        className="w-full h-8 rounded-full border bg-background px-2 text-[11px] shadow-sm focus:outline-none"
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.id} value={l.id}>{l.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-1 block">Tone</Label>
                      <select
                        value={getTone(f)}
                        onChange={(e) => setDraftTones((p) => ({ ...p, [f.id]: e.target.value }))}
                        className="w-full h-8 rounded-full border bg-background px-2 text-[11px] shadow-sm focus:outline-none"
                      >
                        {TONES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-1 block">Discount %</Label>
                      <div className="relative">
                        <Input
                          className="h-8 rounded-full text-xs font-mono font-semibold pl-2 pr-6"
                          value={getDiscount(f)}
                          onChange={(e) => setDraftDiscounts((p) => ({ ...p, [f.id]: e.target.value }))}
                          placeholder="20%"
                        />
                        <Percent className="absolute right-2 top-2.5 h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>

                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-1 block">Coupon Code</Label>
                      <Input
                        className="h-8 rounded-full text-[11px] font-mono"
                        value={getCoupon(f)}
                        onChange={(e) => setDraftCoupons((p) => ({ ...p, [f.id]: e.target.value.toUpperCase() }))}
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <Textarea
                      rows={5}
                      className="font-mono text-xs leading-relaxed rounded-xl"
                      value={getMessage(f)}
                      onChange={(e) => setDrafts((p) => ({ ...p, [f.id]: e.target.value }))}
                      placeholder="Use {name} to insert the customer's first name."
                    />
                    {f.ai_generated && (
                      <span className="absolute bottom-2 right-2 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] text-primary font-medium">
                        Gemini AI ({getLang(f)} · {getTone(f)})
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button size="sm" className="h-8 rounded-full gradient-brand text-primary-foreground text-xs" onClick={() => setSendFor(f)}>
                      <MessageCircle className="mr-1 h-3 w-3" /> Send WhatsApp ({sendCustomerList.length})
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-all"
                      onClick={() => setAiFor(f)}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI Generate
                    </Button>

                    <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => handleSave(f)} disabled={updateMutation.isPending}>
                      <Save className="mr-1 h-3 w-3" /> Save template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <PartyPopper className="h-3.5 w-3.5" /> Placeholders supported: <code className="font-mono text-primary">{"{name}"}</code>, <code className="font-mono text-primary">{"{restaurant_name}"}</code>, <code className="font-mono text-primary">{"{coupon}"}</code>, <code className="font-mono text-primary">{"{discount}"}</code>, <code className="font-mono text-primary">{"{festival}"}</code>.
      </p>

      {/* INTERACTIVE GEMINI AI POPUP DIALOG */}
      {aiFor && (
        <AiGenerateDialog
          open={!!aiFor}
          onOpenChange={(o) => !o && setAiFor(null)}
          title={`AI ${aiFor.festival_name} Wish Generator`}
          description={`Powered by Gemini AI · ${aiFor.festival_name} (${aiFor.festival_date})`}
          campaignType="festival"
          festivalId={aiFor.festival_id}
          festivalName={aiFor.festival_name}
          couponCode={getCoupon(aiFor)}
          discountPercent={getDiscount(aiFor)}
          onDiscountChange={(d) => setDraftDiscounts((p) => ({ ...p, [aiFor.id]: d }))}
          onUse={(m) => {
            setDrafts((p) => ({ ...p, [aiFor.id]: m }));
            toast.success(`AI template generated for ${aiFor.festival_name}! Click Save template to persist.`);
          }}
          useLabel="Use this festival template"
        />
      )}

      {/* REUSABLE MULTI-CUSTOMER WHATSAPP SEND MODAL WITH REAL DATABASE CUSTOMERS */}
      {sendFor && (
        <CampaignSendModal
          open={!!sendFor}
          onOpenChange={(o) => !o && setSendFor(null)}
          campaignId={sendFor.id}
          campaignTitle={sendFor.festival_name}
          campaignType="festival"
          templateMessage={getMessage(sendFor)}
          couponCode={getCoupon(sendFor)}
          discountPercent={getDiscount(sendFor)}
          festivalName={sendFor.festival_name}
          customers={sendCustomerList}
        />
      )}
    </PageTransition>
  );
}