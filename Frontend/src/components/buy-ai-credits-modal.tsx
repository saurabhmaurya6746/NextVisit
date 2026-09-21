import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Check, Coins, Loader2, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import { AiCreditPackModel, buyCreditPackApi, getPublicCreditPacksApi } from "@/lib/credit-management-api";

interface BuyAiCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BuyAiCreditsModal({ open, onOpenChange, onSuccess }: BuyAiCreditsModalProps) {
  const [packs, setPacks] = useState<AiCreditPackModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchasingPackId, setPurchasingPackId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getPublicCreditPacksApi()
        .then((data) => setPacks(data || []))
        .catch((err) => toast.error(err.message || "Failed to load credit packs"))
        .finally(() => setLoading(false));
    }
  }, [open]);

  async function handleBuyPack(pack: AiCreditPackModel) {
    setPurchasingPackId(pack.id);
    try {
      const res = await buyCreditPackApi(pack.id);
      toast.success(res.message);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete credit pack purchase.");
    } finally {
      setPurchasingPackId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-semibold text-xs uppercase tracking-wider">
            <Brain className="h-4 w-4" /> AI Credit Top-Up Packs
          </div>
          <DialogTitle className="font-display text-xl">Purchase AI Credits</DialogTitle>
          <DialogDescription>
            Purchased credits <strong>never expire</strong> and remain active until fully consumed.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            <p className="text-sm text-muted-foreground">Loading credit packs...</p>
          </div>
        ) : packs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            No credit packs available at the moment. Please check back later or contact support.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className="rounded-2xl border bg-card p-5 space-y-4 flex flex-col justify-between hover:border-violet-500/50 transition-all shadow-sm relative"
              >
                <div className="space-y-2">
                  <h3 className="font-display font-bold text-base text-foreground">{pack.name}</h3>
                  <div>
                    <span className="text-2xl font-bold font-display text-violet-600 dark:text-violet-400">
                      {pack.ai_credits.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground"> AI Credits</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground pt-1">
                    {pack.price === 0 ? "Free" : formatCurrency(pack.price, "INR")}
                  </p>
                  <ul className="space-y-1.5 text-xs text-muted-foreground pt-2">
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>Never Expires</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>Instant Activation</span>
                    </li>
                  </ul>
                </div>

                <Button
                  disabled={purchasingPackId === pack.id}
                  onClick={() => handleBuyPack(pack)}
                  className="w-full rounded-full bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs"
                >
                  {purchasingPackId === pack.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Coins className="mr-1.5 h-3.5 w-3.5" /> Buy Credits
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="text-xs text-muted-foreground flex justify-between items-center sm:justify-between border-t pt-3">
          <span>Prices exclude applicable GST. DirectWa wa.me messaging included.</span>
          <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
