import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { CheckCircle2, Clock, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "sonner";
import { getBusinessTypesApi, registerApi, verifyOtpApi, resendOtpApi } from "@/lib/auth";
import { PasswordInput } from "@/components/ui/password-input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — NextVisit" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "verify" | "approved_pending">("form");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(60);

  const [businessTypes, setBusinessTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");

  const [form, setForm] = useState({
    business: "",
    owner: "",
    type: "Restaurant",
    phone: "",
    email: "",
    password: "",
    confirm: "",
    country: "India",
    city: "",
    terms: false,
  });

  useEffect(() => {
    getBusinessTypesApi().then((types) => {
      if (Array.isArray(types) && types.length > 0) {
        setBusinessTypes(types);
        setSelectedTypeId(types[0].id);
      }
    }).catch(() => {});
  }, []);

  // 60-second cooldown timer for resending OTP
  useEffect(() => {
    if (step !== "verify" || cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, cooldown]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error("Passwords don't match");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    if (!form.terms) return toast.error("Please accept the Terms to continue");

    setLoading(true);

    try {
      const typeId = selectedTypeId || businessTypes.find(t => t.name.toLowerCase() === form.type.toLowerCase())?.id || businessTypes[0]?.id;
      if (!typeId) {
        toast.error("Invalid business type. Please refresh and try again.");
        return;
      }

      await registerApi({
        business: {
          business_type_id: typeId,
          business_name: form.business,
          phone: form.phone,
          country: form.country,
          currency: "INR",
          timezone: "Asia/Kolkata",
          address: form.city || "Default Address",
        },
        owner: {
          owner_name: form.owner,
          owner_email: form.email,
          password: form.password,
        },
      });

      toast.success("Registration code sent to your email!");
      setStep("verify");
      setCooldown(60);
      setOtp("");
    } catch (err: any) {
      toast.error(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (otp.length < 6) {
      toast.error("Please enter the complete 6-digit code");
      return;
    }

    setVerifying(true);
    try {
      await verifyOtpApi(form.email, otp);
      toast.success("Email verified successfully!");
      setStep("approved_pending");
    } catch (err: any) {
      toast.error(err.message || "Invalid or expired verification code.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await resendOtpApi(form.email);
      toast.success("A new verification code has been sent!");
      setCooldown(60);
      setOtp("");
    } catch (err: any) {
      toast.error(err.message || "Failed to resend verification code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/"><BrandLogo /></Link>
          <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground">← Back to sign in</Link>
        </div>

        {/* Step 1: Verification Successful -> Pending Admin Approval */}
        {step === "approved_pending" && (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-elegant">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl font-semibold">Account Created Successfully</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your email <span className="font-medium text-foreground">{form.email}</span> has been verified. Your account is currently under review. We'll notify you after approval.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning">
              <Clock className="h-3.5 w-3.5" /> Pending Approval
            </div>
            <Button className="mt-6 w-full rounded-full gradient-brand text-primary-foreground" onClick={() => navigate({ to: "/login" })}>
              Back to sign in
            </Button>
          </div>
        )}

        {/* Step 2: Email OTP Verification Screen */}
        {step === "verify" && (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-elegant">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              <Mail className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl font-semibold">Verify your email address</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We've sent a 6-digit verification code to <span className="font-semibold text-foreground">{form.email}</span>. Please enter it below to confirm your account.
            </p>

            <form onSubmit={handleVerify} className="mt-8 flex flex-col items-center space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(val) => {
                    setOtp(val);
                    if (val.length === 6) {
                      // Optionally auto-trigger verification when 6 digits are typed
                    }
                  }}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                type="submit"
                disabled={verifying || otp.length < 6}
                className="w-full rounded-full gradient-brand text-primary-foreground shadow-glow"
              >
                {verifying ? "Verifying code..." : "Verify code"}
              </Button>

              <div className="flex flex-col items-center gap-2 pt-2 text-xs text-muted-foreground">
                {cooldown > 0 ? (
                  <p>Resend code in <span className="font-medium text-foreground">{cooldown}s</span></p>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResend}
                    disabled={resending}
                    className="h-auto p-1 text-xs text-primary hover:text-primary/80 hover:bg-transparent"
                  >
                    {resending ? (
                      <span className="inline-flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Sending...</span>
                    ) : (
                      "Didn't receive a code? Resend OTP"
                    )}
                  </Button>
                )}

                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  ← Wrong email address? Go back
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Registration Form */}
        {step === "form" && (
          <>
            <h1 className="font-display text-3xl font-semibold">Create your business account</h1>
            <p className="mt-1 text-sm text-muted-foreground">New accounts need admin approval before you can sign in.</p>
            <form onSubmit={submit} className="mt-8 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="business">Business name</Label>
                  <Input id="business" required value={form.business} onChange={(e) => set("business")(e.target.value)} placeholder="Aroma Bistro" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="owner">Owner name</Label>
                  <Input id="owner" required value={form.owner} onChange={(e) => set("owner")(e.target.value)} placeholder="Priya Sharma" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Business type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => {
                      set("type")(v);
                      const matched = businessTypes.find((bt) => bt.name.toLowerCase() === v.toLowerCase());
                      if (matched) setSelectedTypeId(matched.id);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {businessTypes.length > 0 ? (
                        businessTypes.map((bt) => (
                          <SelectItem key={bt.id} value={bt.name}>{bt.name}</SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="Restaurant">Restaurant</SelectItem>
                          <SelectItem value="Salon">Salon</SelectItem>
                          <SelectItem value="Spa">Spa</SelectItem>
                          <SelectItem value="Cafe">Cafe</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" required value={form.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => set("email")(e.target.value)} placeholder="you@business.com" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    required
                    value={form.password}
                    onChange={(e) => set("password")(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <PasswordInput
                    id="confirm"
                    required
                    value={form.confirm}
                    onChange={(e) => set("confirm")(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" required value={form.country} onChange={(e) => set("country")(e.target.value)} placeholder="India" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" required value={form.city} onChange={(e) => set("city")(e.target.value)} placeholder="Mumbai" />
                </div>
              </div>
              <label className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                <Checkbox checked={form.terms} onCheckedChange={(v) => setForm((f) => ({ ...f, terms: !!v }))} className="mt-0.5" />
                <span>I accept the <Link to="/docs" className="text-primary hover:underline">Terms</Link> and <Link to="/docs" className="text-primary hover:underline">Privacy Policy</Link>.</span>
              </label>
              <p className="rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
                ✅ Once approved, you'll get a 14-day full-access free trial — no card required.
              </p>
              <Button type="submit" disabled={loading} className="w-full rounded-full gradient-brand text-primary-foreground shadow-glow">
                {loading ? "Creating account..." : "Create account"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}