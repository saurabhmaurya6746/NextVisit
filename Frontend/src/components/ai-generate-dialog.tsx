import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles, Wand2, AlertCircle, RefreshCw, Globe, Clock, Percent, Gift, AlignLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  description?: string;
  customerId?: string;
  campaignType?: string; // "welcome" | "birthday" | "anniversary" | "festival" | "recovery" | "vip" | "review" | "loyalty" | "coupon"
  festivalId?: string;
  festivalName?: string;
  couponCode?: string;
  discountPercent?: number | string;
  onCouponChange?: (coupon: string) => void;
  onDiscountChange?: (discount: string) => void;
  generate?: () => string;
  onUse: (message: string) => void;
  useLabel?: string;
}

const TONES = [
  "Funny", "Friendly", "Premium", "Emotional", "Casual",
  "Luxury", "Minimal", "Festive", "Cute"
];

const LANGUAGES = [
  { id: "auto", label: "Auto Detect" },
  { id: "hinglish", label: "Hinglish" },
  { id: "english", label: "English" },
  { id: "hindi", label: "Hindi" },
];

const LENGTHS = [
  { id: "short", label: "Short (40–60 words)" },
  { id: "medium", label: "Medium (60–90 words)" },
  { id: "long", label: "Long (90–120 words)" },
];

const TIMINGS = [
  { id: "birthday_morning", label: "Morning Wish" },
  { id: "7_days_before", label: "7 Days Before" },
  { id: "15_days_before", label: "15 Days Before" },
  { id: "1_day_after", label: "1 Day After" },
];

export function AiGenerateDialog({
  open,
  onOpenChange,
  title = "AI Copywriter Generator",
  description = "Powered by Google Gemini API with complete customer & business context.",
  customerId,
  campaignType = "welcome",
  festivalId,
  festivalName,
  couponCode = "SPECIAL10",
  discountPercent = "15%",
  onCouponChange,
  onDiscountChange,
  onUse,
  useLabel = "Use message",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [selectedTone, setSelectedTone] = useState<string>("Friendly");
  const [selectedLang, setSelectedLang] = useState<string>("auto");
  const [selectedLength, setSelectedLength] = useState<string>("medium");
  const [selectedTiming, setSelectedTiming] = useState<string>("birthday_morning");
  const [couponVal, setCouponVal] = useState<string>(couponCode || "SPECIAL10");
  const [discountVal, setDiscountVal] = useState<string>(String(discountPercent || "15%"));
  const [isAiGenerated, setIsAiGenerated] = useState(false);

  useEffect(() => {
    if (couponCode) setCouponVal(couponCode);
    if (discountPercent) setDiscountVal(String(discountPercent));
  }, [couponCode, discountPercent]);

  const fetchAiMessage = useCallback(
    async (
      toneToUse?: string,
      langToUse?: string,
      lengthToUse?: string,
      timingToUse?: string,
      cVal?: string,
      dVal?: string
    ) => {
      setLoading(true);
      setError(null);
      const targetTone = toneToUse || selectedTone;
      const targetLang = langToUse || selectedLang;
      const targetLength = lengthToUse || selectedLength;
      const targetTiming = timingToUse || selectedTiming;
      const targetCoupon = cVal || couponVal;
      const targetDisc = dVal || discountVal;

      // Festival Campaign Gemini API Route
      if (campaignType === "festival" || festivalName) {
        try {
          const res = await apiFetch("/api/v1/festival-campaigns/generate-ai", {
            method: "POST",
            body: JSON.stringify({
              festival_id: festivalId || null,
              festival_name: festivalName || "Festival",
              language: targetLang === "auto" ? "Hinglish" : targetLang,
              tone: targetTone,
              coupon_code: targetCoupon,
              discount_percent: targetDisc,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "AI message generation failed. Please try again.");
          }

          const data = await res.json();
          setText(data.message);
          setIsAiGenerated(true);
        } catch (err: any) {
          console.error("[AI FESTIVAL GENERATOR] Error calling Gemini backend:", err);
          setError(err.message || "AI message generation failed. Please try again.");
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        const res = await apiFetch("/api/v1/automation/ai-generate", {
          method: "POST",
          body: JSON.stringify({
            customer_id: customerId || "00000000-0000-0000-0000-000000000000",
            campaign_type: campaignType,
            tone: targetTone,
            language: targetLang,
            message_length: targetLength,
            timing: targetTiming,
            coupon_code: targetCoupon,
            discount_percent: targetDisc,
            festival_name: festivalName,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "AI message generation failed. Please try again.");
        }

        const data = await res.json();
        setText(data.message);
        if (data.tone) setSelectedTone(data.tone);
        setIsAiGenerated(data.is_ai_generated ?? true);
      } catch (err: any) {
        console.error("[AI GENERATOR] Error calling Gemini backend:", err);
        setError(err.message || "AI message generation failed. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [customerId, campaignType, festivalId, festivalName, selectedTone, selectedLang, selectedLength, selectedTiming, couponVal, discountVal]
  );

  useEffect(() => {
    if (!open) return;
    fetchAiMessage("Friendly", "auto", "medium", "birthday_morning");
  }, [open]);

  const handleRegenerate = () => {
    const currentIndex = TONES.indexOf(selectedTone);
    const nextTone = TONES[(currentIndex + 1) % TONES.length];
    setSelectedTone(nextTone);
    fetchAiMessage(nextTone, selectedLang, selectedLength, selectedTiming, couponVal, discountVal);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-xl border shadow-xl bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center font-display text-lg">{title}</DialogTitle>
          <DialogDescription className="text-center text-xs">{description}</DialogDescription>
        </DialogHeader>

        {/* SELECTORS & COUPON BAR */}
        <div className="space-y-3 py-1">
          {/* COUPON CODE & DISCOUNT PERCENTAGE INPUTS */}
          <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-2.5">
            <div className="flex items-center gap-1.5">
              <Gift className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-semibold shrink-0">Coupon:</span>
              <Input
                type="text"
                value={couponVal}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setCouponVal(val);
                  if (onCouponChange) onCouponChange(val);
                }}
                placeholder="SPECIAL10"
                className="h-8 text-xs font-mono font-bold rounded-lg border-primary/40 uppercase"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Percent className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-semibold shrink-0">Discount:</span>
              <Input
                type="text"
                value={discountVal}
                onChange={(e) => {
                  const val = e.target.value;
                  setDiscountVal(val);
                  if (onDiscountChange) onDiscountChange(val);
                }}
                placeholder="15%"
                className="h-8 text-xs font-mono font-bold rounded-lg border-primary/40"
              />
            </div>
          </div>

          {/* LANGUAGE SELECTOR */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="flex items-center gap-1 font-medium text-muted-foreground shrink-0 text-[11px]">
              <Globe className="h-3.5 w-3.5" /> Language:
            </span>
            {LANGUAGES.map((l) => (
              <Badge
                key={l.id}
                variant={selectedLang === l.id ? "default" : "outline"}
                className={`cursor-pointer text-[10px] rounded-full px-2.5 py-0.5 transition-all ${
                  selectedLang === l.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
                onClick={() => {
                  setSelectedLang(l.id);
                  fetchAiMessage(selectedTone, l.id, selectedLength, selectedTiming, couponVal, discountVal);
                }}
              >
                {l.label}
              </Badge>
            ))}
          </div>

          {/* MESSAGE LENGTH SELECTOR */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="flex items-center gap-1 font-medium text-muted-foreground shrink-0 text-[11px]">
              <AlignLeft className="h-3.5 w-3.5" /> Length:
            </span>
            {LENGTHS.map((len) => (
              <Badge
                key={len.id}
                variant={selectedLength === len.id ? "secondary" : "outline"}
                className={`cursor-pointer text-[10px] rounded-full px-2.5 py-0.5 transition-all ${
                  selectedLength === len.id ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-muted"
                }`}
                onClick={() => {
                  setSelectedLength(len.id);
                  fetchAiMessage(selectedTone, selectedLang, len.id, selectedTiming, couponVal, discountVal);
                }}
              >
                {len.label}
              </Badge>
            ))}
          </div>

          {/* TONE SELECTION CHIPS */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {TONES.map((t) => (
              <Badge
                key={t}
                variant={selectedTone === t ? "default" : "outline"}
                className={`cursor-pointer text-[10px] rounded-full transition-all ${
                  selectedTone === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
                onClick={() => {
                  setSelectedTone(t);
                  fetchAiMessage(t, selectedLang, selectedLength, selectedTiming, couponVal, discountVal);
                }}
              >
                {t}
              </Badge>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{error}</span>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => fetchAiMessage()}>
              <RefreshCw className="mr-1 h-3 w-3" /> Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2.5 py-6">
            {[92, 74, 88, 60].map((w, i) => (
              <motion.div
                key={i}
                className="h-3.5 rounded-full bg-muted"
                style={{ width: `${w}%` }}
                animate={{ opacity: [0.4, 0.9, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
            <p className="pt-2 text-center text-xs text-muted-foreground">
              Generating Gemini copy ({selectedLength} length) with {selectedTone} tone in {selectedLang}…
            </p>
          </div>
        ) : (
          <div className="relative">
            <Textarea
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="font-mono text-xs rounded-xl leading-relaxed"
            />
            {isAiGenerated && (
              <span className="absolute bottom-2.5 right-2.5 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] text-primary font-medium">
                Gemini AI ({text.split(/\s+/).filter(Boolean).length} words)
              </span>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between pt-2">
          <Button variant="outline" className="rounded-full text-xs" onClick={handleRegenerate} disabled={loading}>
            <Wand2 className="mr-1.5 h-3.5 w-3.5 text-primary" /> Regenerate ({selectedTone})
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" className="rounded-full text-xs" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-full bg-primary text-primary-foreground text-xs"
              disabled={loading || !text.trim()}
              onClick={() => {
                onUse(text);
                onOpenChange(false);
              }}
            >
              {useLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}