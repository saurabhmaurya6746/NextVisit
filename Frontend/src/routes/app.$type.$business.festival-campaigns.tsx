import { createFileRoute } from "@/lib/route-compat";
import { useParams } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  MessageCircle,
  Save,
  PartyPopper,
  Calendar,
  Users,
  Clock,
  Percent,
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  FileText,
  Tag
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PageTransition } from "@/components/page-transition";
import { AiGenerateDialog } from "@/components/ai-generate-dialog";
import { CampaignSendModal, SendCustomerItem } from "@/components/campaign-send-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listCustomersApi } from "@/lib/customers-api";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/auth";

export const Route = createFileRoute("/app/$type/$business/festival-campaigns")({
  component: FestivalsPage,
});

const SALON_TONES = [
  "Festive", "Glam", "Luxury", "Friendly", "Funny",
  "Premium", "Emotional", "Minimal", "Pampering", "Casual"
];

const RESTAURANT_TONES = [
  "Festive", "Foodie", "Gourmet", "Friendly", "Funny",
  "Luxury", "Premium", "Emotional", "Family", "Casual"
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
  title?: string;
  description?: string;
  festival_date: string;
  start_date?: string;
  end_date?: string;
  days_remaining: number;
  coupon_code?: string;
  discount_percent?: string;
  image_url?: string;
  language: string;
  tone: string;
  message: string;
  ai_generated: boolean;
  enabled: boolean;
  is_custom?: boolean;
  eligible_customers: number;
  sent_count: number;
  pending_count: number;
}

export default function FestivalsPage() {
  const { type } = useParams<{ type?: string }>();
  const queryClient = useQueryClient();
  const isSalon = type === "salon";

  const availableTones = isSalon ? SALON_TONES : RESTAURANT_TONES;

  // Dialog States
  const [aiFor, setAiFor] = useState<FestivalCampaignItem | null>(null);
  const [sendFor, setSendFor] = useState<FestivalCampaignItem | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<FestivalCampaignItem | null>(null);

  // Add / Edit Modal State
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<FestivalCampaignItem | null>(null);

  // Form State
  const [formFestName, setFormFestName] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formFestDate, setFormFestDate] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formCoupon, setFormCoupon] = useState("");
  const [formDiscount, setFormDiscount] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formLang, setFormLang] = useState("Hinglish");
  const [formTone, setFormTone] = useState("Festive");
  const [formMessage, setFormMessage] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);
  const [isAiGeneratingModal, setIsAiGeneratingModal] = useState(false);

  // Card Quick Edit Drafts
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftLanguages, setDraftLanguages] = useState<Record<string, string>>({});
  const [draftTones, setDraftTones] = useState<Record<string, string>>({});
  const [draftCoupons, setDraftCoupons] = useState<Record<string, string>>({});
  const [draftDiscounts, setDraftDiscounts] = useState<Record<string, string>>({});

  // Fetch Customers List
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

  // Fetch Database Festival Campaigns
  const { data: campaigns = [], isLoading } = useQuery<FestivalCampaignItem[]>({
    queryKey: ["festival-campaigns"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/festival-campaigns");
      if (!res.ok) throw new Error("Failed to fetch festival campaigns");
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Fetch Upcoming Summary Metrics
  const { data: upcoming } = useQuery({
    queryKey: ["festival-upcoming"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/festival-campaigns/upcoming");
      if (!res.ok) throw new Error("Failed to fetch upcoming festivals");
      return res.json();
    },
  });

  // Create Campaign Mutation
  const createMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiFetch("/api/v1/festival-campaigns", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to create festival campaign");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["festival-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["festival-upcoming"] });
      toast.success(`${data.festival_name} campaign created successfully!`);
      closeAddEditModal();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create festival campaign");
    },
  });

  // Update Campaign Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const res = await apiFetch(`/api/v1/festival-campaigns/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update festival campaign");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["festival-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["festival-upcoming"] });
      toast.success(`${data.festival_name} campaign saved successfully!`);
      closeAddEditModal();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save campaign");
    },
  });

  // Delete Campaign Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/v1/festival-campaigns/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to delete festival campaign");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["festival-upcoming"] });
      toast.success("Festival campaign deleted successfully");
      setDeletingCampaign(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete campaign");
    },
  });

  function openAddModal() {
    setEditingCampaign(null);
    setFormFestName("");
    setFormTitle("");
    setFormDescription("");
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    const dateStr = defaultDate.toISOString().split("T")[0];
    setFormFestDate(dateStr);
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormEndDate(dateStr);
    setFormCoupon("FESTIVE20");
    setFormDiscount("20%");
    setFormImageUrl("");
    setFormLang("Hinglish");
    setFormTone("Festive");
    setFormMessage("");
    setFormEnabled(true);
    setIsAddEditOpen(true);
  }

  function openEditModal(f: FestivalCampaignItem) {
    setEditingCampaign(f);
    setFormFestName(f.festival_name);
    setFormTitle(f.title || "");
    setFormDescription(f.description || "");
    setFormFestDate(f.festival_date || "");
    setFormStartDate(f.start_date || f.festival_date || "");
    setFormEndDate(f.end_date || f.festival_date || "");
    setFormCoupon(getCoupon(f));
    setFormDiscount(getDiscount(f));
    setFormImageUrl(f.image_url || "");
    setFormLang(getLang(f));
    setFormTone(getTone(f));
    setFormMessage(getMessage(f));
    setFormEnabled(f.enabled);
    setIsAddEditOpen(true);
  }

  function closeAddEditModal() {
    setIsAddEditOpen(false);
    setEditingCampaign(null);
  }

  async function handleModalAiGenerate() {
    if (!formFestName.trim()) {
      toast.error("Please enter a Festival Name first!");
      return;
    }
    setIsAiGeneratingModal(true);
    try {
      const res = await apiFetch("/api/v1/festival-campaigns/generate-ai", {
        method: "POST",
        body: JSON.stringify({
          festival_id: editingCampaign?.festival_id || null,
          festival_name: formFestName,
          language: formLang,
          tone: formTone,
          coupon_code: formCoupon,
          discount_percent: formDiscount,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "AI generation failed");
      }
      const data = await res.json();
      setFormMessage(data.message);
      toast.success(`AI message generated for ${formFestName}!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate AI message");
    } finally {
      setIsAiGeneratingModal(false);
    }
  }

  function handleFormSubmit() {
    if (!formFestName.trim()) {
      toast.error("Festival Name is required");
      return;
    }
    if (!formFestDate) {
      toast.error("Festival Date is required");
      return;
    }

    const payload = {
      festival_name: formFestName.trim(),
      title: formTitle.trim() || undefined,
      description: formDescription.trim() || undefined,
      festival_date: formFestDate,
      start_date: formStartDate || formFestDate,
      end_date: formEndDate || undefined,
      coupon_code: formCoupon.trim() || undefined,
      discount_percent: formDiscount.trim() || undefined,
      image_url: formImageUrl.trim() || undefined,
      language: formLang,
      tone: formTone,
      message: formMessage.trim() || undefined,
      enabled: formEnabled,
    };

    if (editingCampaign) {
      updateMutation.mutate({ id: editingCampaign.id, body: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

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
    return draftDiscounts[f.id] ?? f.discount_percent ?? "20%";
  }

  function handleSaveCard(f: FestivalCampaignItem) {
    updateMutation.mutate({
      id: f.id,
      body: {
        message: getMessage(f),
        language: getLang(f),
        tone: getTone(f),
        coupon_code: getCoupon(f),
        discount_percent: getDiscount(f),
      },
    });
  }

  const nextFest = upcoming?.next_festival;

  return (
    <PageTransition>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader
          title={isSalon ? "Salon Festival Campaigns" : "Restaurant Festival Campaigns"}
          description={
            isSalon
              ? "Database-driven salon festival automation — personalized beauty & hair D2C WhatsApp copy powered by Gemini AI."
              : "Database-driven restaurant festival automation — personalized food & dining D2C WhatsApp copy powered by Gemini AI."
          }
        />
        <Button
          onClick={openAddModal}
          className="rounded-full gradient-brand text-primary-foreground text-xs font-semibold shadow-md hover:shadow-lg transition-all shrink-0 px-4 h-9"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add Festival Campaign
        </Button>
      </div>

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
              <p className="text-xs text-primary font-medium">
                {nextFest ? `${nextFest.days_remaining} days remaining (${nextFest.festival_date})` : "Check back soon"}
              </p>
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
              <Card className="overflow-hidden rounded-2xl transition-all hover:shadow-glow bg-card border">
                <div className="h-1.5 gradient-brand" />
                <CardContent className="space-y-3.5 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-display text-lg font-semibold">{f.festival_name}</p>
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          {f.days_remaining === 0 ? "Today!" : f.days_remaining === 1 ? "Tomorrow" : `${f.days_remaining} days away`}
                        </Badge>

                        {f.enabled ? (
                          <Badge variant="outline" className="rounded-full text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full text-[9px] bg-muted text-muted-foreground">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{f.festival_date}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={() => openEditModal(f)}
                        title="Edit Festival Campaign"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingCampaign(f)}
                        title="Delete Festival Campaign"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {f.title && (
                    <p className="text-xs font-semibold text-foreground/90">{f.title}</p>
                  )}

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
                        {availableTones.map((t) => (
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
                      rows={4}
                      className="font-mono text-xs leading-relaxed rounded-xl"
                      value={getMessage(f)}
                      onChange={(e) => setDrafts((p) => ({ ...p, [f.id]: e.target.value }))}
                      placeholder={isSalon ? "Use {customer_name} or {salon_name}..." : "Use {customer_name} or {restaurant_name}..."}
                    />
                    {f.ai_generated && (
                      <span className="absolute bottom-2 right-2 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] text-primary font-medium">
                        Gemini AI ({getLang(f)} · {getTone(f)})
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" className="h-8 rounded-full gradient-brand text-primary-foreground text-xs font-medium" onClick={() => setSendFor(f)}>
                        <MessageCircle className="mr-1 h-3 w-3" /> Send ({sendCustomerList.length})
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-all"
                        onClick={() => setAiFor(f)}
                      >
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI Generate
                      </Button>
                    </div>

                    <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => handleSaveCard(f)} disabled={updateMutation.isPending}>
                      <Save className="mr-1 h-3 w-3" /> Save template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* DYNAMIC PLACEHOLDER HELP FOOTER */}
      <p className="mt-6 inline-flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <PartyPopper className="h-3.5 w-3.5 text-primary" /> Supported Placeholders:
        {isSalon ? (
          <>
            <code className="font-mono text-primary">{"{customer_name}"}</code>,
            <code className="font-mono text-primary">{"{salon_name}"}</code>,
            <code className="font-mono text-primary">{"{service_name}"}</code>,
            <code className="font-mono text-primary">{"{stylist_name}"}</code>,
            <code className="font-mono text-primary">{"{coupon}"}</code>,
            <code className="font-mono text-primary">{"{discount}"}</code>,
            <code className="font-mono text-primary">{"{festival}"}</code>
          </>
        ) : (
          <>
            <code className="font-mono text-primary">{"{customer_name}"}</code>,
            <code className="font-mono text-primary">{"{restaurant_name}"}</code>,
            <code className="font-mono text-primary">{"{favorite_dish}"}</code>,
            <code className="font-mono text-primary">{"{table_booking_link}"}</code>,
            <code className="font-mono text-primary">{"{coupon}"}</code>,
            <code className="font-mono text-primary">{"{discount}"}</code>,
            <code className="font-mono text-primary">{"{festival}"}</code>
          </>
        )}
      </p>

      {/* ADD / EDIT FESTIVAL CAMPAIGN MODAL DIALOG */}
      <Dialog open={isAddEditOpen} onOpenChange={(o) => !o && closeAddEditModal()}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingCampaign ? `Edit ${editingCampaign.festival_name}` : "Add Festival Campaign"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure festival campaign parameters, discount offers, dates, and message copy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* FESTIVAL NAME & TITLE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Festival Name *</Label>
                <Input
                  className="mt-1 h-9 rounded-xl text-xs"
                  placeholder="e.g. Diwali, Holi, Summer Beauty Fest"
                  value={formFestName}
                  onChange={(e) => setFormFestName(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Campaign Title (Optional)</Label>
                <Input
                  className="mt-1 h-9 rounded-xl text-xs"
                  placeholder="e.g. Festival Glam Special"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>
            </div>

            {/* DESCRIPTION */}
            <div>
              <Label className="text-xs font-semibold">Campaign Description (Optional)</Label>
              <Input
                className="mt-1 h-9 rounded-xl text-xs"
                placeholder="Brief internal note or promotional highlight"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            {/* DATES: FESTIVAL DATE, START DATE, END DATE */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Festival Date *</Label>
                <Input
                  type="date"
                  className="mt-1 h-9 rounded-xl text-xs"
                  value={formFestDate}
                  onChange={(e) => setFormFestDate(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Start Date</Label>
                <Input
                  type="date"
                  className="mt-1 h-9 rounded-xl text-xs"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">End Date</Label>
                <Input
                  type="date"
                  className="mt-1 h-9 rounded-xl text-xs"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* COUPON, DISCOUNT & IMAGE URL */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Coupon Code</Label>
                <Input
                  className="mt-1 h-9 rounded-xl font-mono text-xs uppercase"
                  placeholder="FESTIVE20"
                  value={formCoupon}
                  onChange={(e) => setFormCoupon(e.target.value.toUpperCase())}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Discount Offer</Label>
                <Input
                  className="mt-1 h-9 rounded-xl font-mono text-xs"
                  placeholder="20% OFF"
                  value={formDiscount}
                  onChange={(e) => setFormDiscount(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Image URL (Optional)</Label>
                <Input
                  className="mt-1 h-9 rounded-xl text-xs"
                  placeholder="https://example.com/banner.jpg"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                />
              </div>
            </div>

            {/* LANGUAGE & TONE */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Language</Label>
                <select
                  value={formLang}
                  onChange={(e) => setFormLang(e.target.value)}
                  className="mt-1 w-full h-9 rounded-xl border bg-background px-3 text-xs shadow-sm focus:outline-none"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Tone</Label>
                <select
                  value={formTone}
                  onChange={(e) => setFormTone(e.target.value)}
                  className="mt-1 w-full h-9 rounded-xl border bg-background px-3 text-xs shadow-sm focus:outline-none"
                >
                  {availableTones.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* MESSAGE TEMPLATE & AI GENERATE BUTTON */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold">Message Template *</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 rounded-full text-[11px] bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                  onClick={handleModalAiGenerate}
                  disabled={isAiGeneratingModal}
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  {isAiGeneratingModal ? "Generating..." : "AI Generate Message"}
                </Button>
              </div>
              <Textarea
                rows={5}
                className="font-mono text-xs leading-relaxed rounded-xl"
                placeholder={
                  isSalon
                    ? "e.g. Happy {festival} {customer_name}! Celebrate at {salon_name} with coupon {coupon}..."
                    : "e.g. Happy {festival} {customer_name}! Celebrate at {restaurant_name} with coupon {coupon}..."
                }
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
              />
            </div>

            {/* ENABLE / DISABLE SWITCH */}
            <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/30">
              <div>
                <p className="font-semibold text-xs">Enable Campaign</p>
                <p className="text-[11px] text-muted-foreground">Active campaigns participate in automated dispatching.</p>
              </div>
              <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={closeAddEditModal} className="rounded-xl">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleFormSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="rounded-xl gradient-brand text-primary-foreground font-semibold"
            >
              {editingCampaign ? "Save Changes" : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION MODAL DIALOG */}
      <Dialog open={!!deletingCampaign} onOpenChange={(o) => !o && setDeletingCampaign(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              Delete Festival Campaign?
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              This action cannot be undone. Are you sure you want to permanently delete the campaign{" "}
              <strong className="text-foreground">{deletingCampaign?.festival_name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setDeletingCampaign(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deletingCampaign && deleteMutation.mutate(deletingCampaign.id)}
              disabled={deleteMutation.isPending}
              className="rounded-xl font-semibold"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          initialMessage={getMessage(aiFor)}
          onCouponChange={(c) => setDraftCoupons((p) => ({ ...p, [aiFor.id]: c }))}
          onDiscountChange={(d) => setDraftDiscounts((p) => ({ ...p, [aiFor.id]: d }))}
          onUse={(m) => {
            setDrafts((p) => ({ ...p, [aiFor.id]: m }));
            toast.success(`Festival template updated for ${aiFor.festival_name}! Click Save template to persist.`);
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