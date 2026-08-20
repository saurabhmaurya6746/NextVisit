import { useState, useEffect, useRef, type FormEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import { CheckCircle2, Clock, Loader2, ArrowRight, RefreshCw, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "sonner";
import { verifyEmailApi, resendVerificationApi } from "@/lib/auth";

export const Route = createFileRoute("/verify-email")({
  head: () => ({ meta: [{ title: "Verify Email — NextVisit" }] }),
  component: VerifyEmailPage,
});

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const queryEmail = searchParams.get("email") || "";
  const stateEmail = (location.state as { email?: string })?.email || "";
  const initialEmail = (stateEmail || queryEmail || "").trim();

  const [email, setEmail] = useState<string>(initialEmail);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [verified, setVerified] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Start 60s cooldown timer on initial mount
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus first input box on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, []);

  const handleDigitChange = (index: number, val: string) => {
    // Only accept numeric digit
    const cleaned = val.replace(/\D/g, "");
    if (!cleaned) {
      const nextDigits = [...digits];
      nextDigits[index] = "";
      setDigits(nextDigits);
      return;
    }

    const lastChar = cleaned.slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = lastChar;
    setDigits(nextDigits);

    // Auto advance to next box
    if (index < 5 && lastChar) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // Move focus backward on backspace if current is empty
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    const cleaned = pasteData.replace(/\D/g, "").slice(0, 6);
    if (!cleaned) return;

    const nextDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      nextDigits[i] = cleaned[i] || "";
    }
    setDigits(nextDigits);

    const focusIdx = Math.min(cleaned.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const codeString = digits.join("");
  const isCodeComplete = codeString.length === 6;

  const handleVerify = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!email) {
      toast.error("Please enter your registered email address.");
      return;
    }
    if (!isCodeComplete) {
      toast.error("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      await verifyEmailApi(email, codeString);
      toast.success("Email verified successfully!");
      setVerified(true);
    } catch (err: any) {
      toast.error(err.message || "Verification failed. Please check your code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    if (!email) {
      toast.error("Please provide your registered email address.");
      return;
    }

    setResending(true);
    try {
      const res = await resendVerificationApi(email);
      toast.success(res.message || "A new verification code has been sent.");
      setCooldown(60);
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      toast.error(err.message || "Failed to resend verification code.");
    } finally {
      setResending(false);
    }
  };

  const maskedEmail = (() => {
    if (!email || !email.includes("@")) return email;
    const [user, domain] = email.split("@");
    if (user.length <= 2) return `${user}***@${domain}`;
    return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
  })();

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/"><BrandLogo /></Link>
          <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to sign in
          </Link>
        </div>

        {verified ? (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-elegant animate-in fade-in-50 duration-300">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-foreground">
              Email Verified Successfully
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your email has been verified. Your registration request has been submitted to the Super Admin for approval.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3.5 py-1.5 text-xs font-medium text-warning">
              <Clock className="h-3.5 w-3.5" /> Pending Administrator Approval
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              We will notify you at <span className="font-medium text-foreground">{email}</span> as soon as your account is approved.
            </p>
            <Button
              className="mt-6 w-full rounded-full gradient-brand text-primary-foreground shadow-glow"
              onClick={() => navigate("/login")}
            >
              Back to Sign In
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-8 shadow-elegant">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Mail className="h-6 w-6" />
            </div>

            <h1 className="font-display text-2xl font-semibold text-center text-foreground">
              Verify your email
            </h1>
            <p className="mt-1.5 text-sm text-center text-muted-foreground">
              We sent a 6-digit verification code to
            </p>
            <p className="text-sm font-semibold text-center text-foreground mt-0.5">
              {maskedEmail || "your email address"}
            </p>

            {!initialEmail && (
              <div className="mt-4">
                <label className="text-xs font-medium text-muted-foreground">Registered Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@business.com"
                  className="mt-1"
                  required
                />
              </div>
            )}

            <form onSubmit={handleVerify} className="mt-6 space-y-6">
              <div>
                <label className="block text-xs font-medium text-center text-muted-foreground mb-3">
                  Enter the 6-digit code
                </label>
                <div className="flex justify-center gap-2 sm:gap-2.5">
                  {digits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      onPaste={handlePaste}
                      className="h-12 w-11 sm:h-13 sm:w-12 rounded-xl border border-input bg-background text-center text-xl font-bold tracking-tight text-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      disabled={loading}
                      autoComplete="one-time-code"
                    />
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                disabled={!isCodeComplete || loading}
                className="w-full rounded-full gradient-brand text-primary-foreground shadow-glow h-11"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    Verify Email <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                Didn't receive the code?{" "}
                {cooldown > 0 ? (
                  <span className="font-medium text-foreground">
                    Resend in {cooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="inline-flex items-center text-primary font-medium hover:underline disabled:opacity-50"
                  >
                    {resending ? (
                      <>
                        <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Sending…
                      </>
                    ) : (
                      "Resend code"
                    )}
                  </button>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
