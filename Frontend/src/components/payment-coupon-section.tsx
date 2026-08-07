import { useEffect, useState } from "react";
import { Tag, Check, X, Loader2, Percent, Gift } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import {
  CouponItem,
  CouponValidateResponse,
  getCouponsApi,
  validateCouponApi,
} from "@/lib/coupons-api";

interface PaymentCouponSectionProps {
  subtotal: number;
  customerId?: string;
  appliedCoupon: CouponValidateResponse | null;
  onCouponApplied: (coupon: CouponValidateResponse | null) => void;
}

export function PaymentCouponSection({
  subtotal,
  customerId,
  appliedCoupon,
  onCouponApplied,
}: PaymentCouponSectionProps) {
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [activeCoupons, setActiveCoupons] = useState<CouponItem[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);

  // Load available active coupons for current business
  useEffect(() => {
    setLoadingCoupons(true);
    getCouponsApi({ status: "active", pageSize: 50 })
      .then((res) => {
        setActiveCoupons(res?.items || []);
      })
      .catch(() => setActiveCoupons([]))
      .finally(() => setLoadingCoupons(false));
  }, []);

  async function handleApplyCode(codeToApply: string) {
    const cleanCode = codeToApply.trim().toUpperCase();
    if (!cleanCode) {
      toast.error("Please enter a coupon code.");
      return;
    }

    setValidating(true);
    try {
      const res = await validateCouponApi({
        code: cleanCode,
        customer_id: customerId,
        order_amount: subtotal,
      });

      if (!res.valid) {
        toast.error(res.reason || "Coupon validation failed.");
        return;
      }

      onCouponApplied(res);
      setCode("");
      toast.success(`Coupon '${cleanCode}' applied! Discount: ${formatCurrency(res.calculated_discount, "INR")}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to validate coupon.");
    } finally {
      setValidating(false);
    }
  }

  function handleRemoveCoupon() {
    onCouponApplied(null);
    toast.info("Coupon removed.");
  }

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
          <Tag className="h-3.5 w-3.5 text-violet-500" /> Apply Business Coupon
        </span>
        {appliedCoupon && (
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[11px] font-bold">
            -{formatCurrency(appliedCoupon.calculated_discount, "INR")}
          </Badge>
        )}
      </div>

      {appliedCoupon ? (
        /* APPLIED COUPON BADGE & REMOVE BUTTON */
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-emerald-600 text-white font-bold">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-foreground text-xs">
                {appliedCoupon.coupon?.code || "COUPON"}
                <span className="ml-2 font-normal text-muted-foreground">({appliedCoupon.coupon?.reward_description})</span>
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                Saved {formatCurrency(appliedCoupon.calculated_discount, "INR")} on this bill
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 rounded-full text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
            onClick={handleRemoveCoupon}
            title="Remove Coupon"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        /* APPLY COUPON INPUT & QUICK PICK DROPDOWN */
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Coupon Code (e.g. WELCOME10)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="text-xs uppercase font-mono rounded-xl h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApplyCode(code);
              }}
            />
            <Button
              size="sm"
              disabled={validating || !code.trim()}
              onClick={() => handleApplyCode(code)}
              className="h-8 rounded-full gradient-brand text-primary-foreground text-xs font-semibold px-4"
            >
              {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
            </Button>
          </div>

          {/* ACTIVE COUPONS SELECTOR */}
          {activeCoupons.length > 0 && (
            <div className="pt-1">
              <span className="text-[10px] text-muted-foreground font-semibold block mb-1">
                Available Business Coupons:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {activeCoupons.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleApplyCode(c.code)}
                    disabled={validating}
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/40 hover:bg-violet-500/10 hover:border-violet-500/40 px-2.5 py-1 text-[11px] font-mono font-medium transition-all"
                  >
                    <Gift className="h-3 w-3 text-violet-500" />
                    <span>{c.code}</span>
                    <span className="text-[10px] text-muted-foreground">({c.reward_description})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
