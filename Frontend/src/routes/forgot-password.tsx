import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "sonner";
import { forgotPasswordApi } from "@/lib/auth";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password — NextVisit" },
      {
        name: "description",
        content: "Reset your NextVisit business or staff account password securely.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailError, setEmailError] = useState("");

  const validateEmail = (val: string): boolean => {
    const clean = val.trim();
    if (!clean) {
      setEmailError("Email address is required.");
      return false;
    }
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(clean)) {
      setEmailError("Please enter a valid email address.");
      return false;
    }
    setEmailError("");
    return true;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!validateEmail(email)) {
      return;
    }

    setLoading(true);

    try {
      await forgotPasswordApi(email.trim());
      setSubmitted(true);
      toast.success("Password reset request submitted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to process request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 gradient-mesh opacity-40" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between p-6">
        <Link to="/">
          <BrandLogo />
        </Link>
        <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to sign in
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          {submitted ? (
            <div className="rounded-2xl border bg-card p-8 text-center shadow-elegant space-y-4 animate-in fade-in-50 duration-300">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h1 className="font-display text-2xl font-semibold">Check Your Inbox</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If an account exists with this email, we've sent you a password reset link. Please check your inbox.
                </p>
              </div>

              <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
                The reset link will expire in <strong>45 minutes</strong>. If you don't see it, check your spam or junk folder.
              </div>

              <div className="pt-2 space-y-2">
                <Link to="/login" className="block w-full">
                  <Button className="w-full rounded-full gradient-brand text-primary-foreground shadow-glow">
                    Back to Sign In
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail("");
                  }}
                  className="w-full rounded-full text-xs text-muted-foreground hover:text-foreground"
                >
                  Try another email
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="font-display text-2xl font-semibold">Forgot your password?</h1>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  Enter your registered email address and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    disabled={loading}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) validateEmail(e.target.value);
                    }}
                    onBlur={() => validateEmail(email)}
                    placeholder="owner@business.com"
                    autoComplete="email"
                    className={emailError ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {emailError && <p className="text-xs font-medium text-destructive">{emailError}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full gradient-brand text-primary-foreground shadow-glow"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Reset Link…
                    </>
                  ) : (
                    <>
                      Send Reset Link <ArrowRight className="ml-1.5 h-4 w-4" />
                    </>
                  )}
                </Button>

                <div className="pt-2 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Sign In
                  </Link>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
