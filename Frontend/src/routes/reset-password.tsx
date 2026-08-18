import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import { Check, CheckCircle2, AlertCircle, ArrowRight, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "sonner";
import { resetPasswordApi } from "@/lib/auth";
import { PasswordInput } from "@/components/ui/password-input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — NextVisit" },
      {
        name: "description",
        content: "Choose a new secure password for your NextVisit account.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    !token ? "This password reset link is invalid or has expired." : ""
  );

  const passwordRequirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One number", met: /[0-9]/.test(password) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(password) },
  ];

  const isPasswordValid = passwordRequirements.every((r) => r.met);
  const doPasswordsMatch = password && confirmPassword && password === confirmPassword;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || success) return;

    if (!token) {
      setErrorMessage("This password reset link is invalid or has expired.");
      return;
    }

    if (!isPasswordValid) {
      toast.error("Please satisfy all password requirements.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      await resetPasswordApi({
        token,
        password,
        confirm_password: confirmPassword,
      });
      setSuccess(true);
      toast.success("Password reset successfully!");
    } catch (err: any) {
      const msg = err.message || "This password reset link is invalid or has expired.";
      setErrorMessage(msg);
      toast.error(msg);
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
        <div className="w-full max-w-md">
          {success ? (
            /* Reset Success View */
            <div className="rounded-2xl border bg-card p-8 text-center shadow-elegant space-y-4 animate-in fade-in-50 duration-300">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h1 className="font-display text-2xl font-semibold">Password Reset Successfully</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your password has been updated successfully. You can now sign in with your new password.
                </p>
              </div>

              <div className="pt-4">
                <Button
                  onClick={() => navigate("/login")}
                  className="w-full rounded-full gradient-brand text-primary-foreground shadow-glow"
                >
                  Back to Sign In
                </Button>
              </div>
            </div>
          ) : errorMessage ? (
            /* Invalid / Expired Token Error View */
            <div className="rounded-2xl border bg-card p-8 text-center shadow-elegant space-y-4 animate-in fade-in-50 duration-300">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <AlertCircle className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h1 className="font-display text-2xl font-semibold">Invalid or Expired Link</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {errorMessage}
                </p>
              </div>

              <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
                Password reset links are single-use and expire after 45 minutes for your account security.
              </div>

              <div className="pt-4 space-y-2">
                <Link to="/forgot-password" className="block w-full">
                  <Button className="w-full rounded-full gradient-brand text-primary-foreground shadow-glow">
                    Request New Reset Link
                  </Button>
                </Link>
                <Link to="/login" className="block w-full">
                  <Button variant="ghost" className="w-full rounded-full text-xs text-muted-foreground hover:text-foreground">
                    Return to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            /* New Password Form View */
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <KeyRound className="h-6 w-6" />
                </div>
                <h1 className="font-display text-2xl font-semibold">Set New Password</h1>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  Choose a new strong password to secure your NextVisit account.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">
                    Password <span className="text-destructive font-bold">*</span>
                  </Label>
                  <PasswordInput
                    id="password"
                    required
                    disabled={loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm_password">
                    Confirm password <span className="text-destructive font-bold">*</span>
                  </Label>
                  <PasswordInput
                    id="confirm_password"
                    required
                    disabled={loading}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs font-medium text-destructive">Passwords do not match.</p>
                  )}
                </div>

                {/* Password Requirements Checklist */}
                <div className="rounded-xl border bg-muted/40 p-3.5 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1.5">Password must contain:</p>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {passwordRequirements.map((req, i) => (
                      <li
                        key={i}
                        className={`flex items-center gap-1.5 transition-colors ${
                          req.met ? "text-success font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {req.met ? (
                          <Check className="h-3.5 w-3.5 text-success shrink-0 stroke-[2.5]" />
                        ) : (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40 mx-1 shrink-0" />
                        )}
                        <span>{req.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !isPasswordValid || password !== confirmPassword}
                  className="w-full rounded-full gradient-brand text-primary-foreground shadow-glow"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting Password…
                    </>
                  ) : (
                    <>
                      Reset Password <ArrowRight className="ml-1.5 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
