import { useState } from "react";
import { CheckCircle2, AlertTriangle, Smartphone, Mail, Phone, QrCode, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getPublicPlatformSettingsApi } from "@/lib/admin-api";

interface TestPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payeeName: string;
  upiId: string;
}

export function TestPaymentDialog({ open, onOpenChange, payeeName, upiId }: TestPaymentDialogProps) {
  const [step, setStep] = useState<"qr" | "success" | "failed">("qr");

  const { data: platformSettings } = useQuery({
    queryKey: ["platform-settings-public"],
    queryFn: getPublicPlatformSettingsApi,
    staleTime: 60000,
  });

  const supportEmail = platformSettings?.support_email || "support@nextvisit.com";
  const supportPhone = platformSettings?.support_phone || "+91 98765 43210";

  const cleanPayee = (payeeName || "").trim();
  const cleanUpi = (upiId || "").trim();

  // Generate temporary ₹1.00 test QR URI at runtime
  const rawUpiUri = `upi://pay?pa=${cleanUpi}&pn=${encodeURIComponent(cleanPayee)}&am=1.00&cu=INR`;
  const testQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=8&data=${encodeURIComponent(rawUpiUri)}`;

  const handleClose = () => {
    setStep("qr");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 text-foreground bg-card shadow-2xl">
        <DialogHeader className="border-b pb-3 text-center sm:text-left">
          <DialogTitle className="font-display text-lg font-bold flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" /> Test Payment Configuration
          </DialogTitle>
        </DialogHeader>

        {step === "qr" && (
          <div className="space-y-4 py-2 text-center">
            <p className="text-xs text-muted-foreground leading-relaxed px-2 font-medium">
              Scan this QR from another UPI app and complete a <strong>₹1 test payment</strong> to verify your payment configuration.
            </p>

            <div className="p-4 bg-white rounded-2xl border w-56 h-56 mx-auto shadow-xs flex items-center justify-center">
              <img
                src={testQrUrl}
                alt={`Test QR Code for ${cleanPayee}`}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="space-y-1 bg-muted/20 p-2.5 rounded-xl border text-xs font-mono inline-block w-full">
              <p className="text-foreground font-semibold">Payee: {cleanPayee}</p>
              <p className="text-primary font-medium">UPI ID: {cleanUpi}</p>
              <p className="text-emerald-600 font-bold">Test Amount: ₹1.00</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                onClick={() => setStep("success")}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Payment Successful
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 text-xs font-semibold"
                onClick={() => setStep("failed")}
              >
                <XCircle className="mr-1.5 h-4 w-4" /> Payment Failed
              </Button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-4 py-4 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 grid place-items-center mx-auto">
              <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-display text-xl font-bold text-foreground">Great!</h3>
              <p className="text-xs text-muted-foreground leading-relaxed px-4">
                Your payment configuration looks correct. Future customer payments will use this UPI ID.
              </p>
            </div>
            <DialogFooter className="pt-2 sm:justify-center">
              <Button
                className="rounded-full gradient-brand text-primary-foreground text-xs px-8 font-semibold"
                onClick={handleClose}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "failed" && (
          <div className="space-y-4 py-2 text-center sm:text-left">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                Unable to receive payment?
              </div>
              <div className="text-xs text-muted-foreground space-y-1 text-left pl-7">
                <p className="font-semibold text-foreground">Please verify:</p>
                <p>• Payee Name</p>
                <p>• UPI ID</p>
                <p className="pt-1">If the issue continues, contact support.</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-3 text-xs space-y-2">
              <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block text-left">
                Contact Support
              </span>
              <div className="flex items-center justify-between text-foreground font-medium">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 text-primary" /> Support Email:
                </span>
                <a href={`mailto:${supportEmail}`} className="text-primary hover:underline font-mono">
                  {supportEmail}
                </a>
              </div>
              <div className="flex items-center justify-between text-foreground font-medium border-t pt-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 text-primary" /> Support Phone:
                </span>
                <a href={`tel:${supportPhone.replace(/\s+/g, "")}`} className="text-primary hover:underline font-mono">
                  {supportPhone}
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                className="rounded-full text-xs"
                onClick={() => setStep("qr")}
              >
                Try Again
              </Button>
              <Button
                className="rounded-full gradient-brand text-primary-foreground text-xs px-6"
                onClick={handleClose}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
