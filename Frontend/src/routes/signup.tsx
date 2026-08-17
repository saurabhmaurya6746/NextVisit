import { Link, useNavigate } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import { useState, useEffect, type FormEvent } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "sonner";
import { getBusinessTypesApi, registerApi } from "@/lib/auth";
import { PasswordInput } from "@/components/ui/password-input";
import { useFormValidation } from "@/hooks/use-form-validation";
import { ValidatedField } from "@/components/ui/validated-field";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — NextVisit" }] }),
  component: SignupPage,
});

export default function SignupPage() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [businessTypes, setBusinessTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");

  const {
    values: form,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    registerRef,
  } = useFormValidation(
    {
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
    },
    {
      business: { required: true, requiredMessage: "Business name is required" },
      owner: { required: true, requiredMessage: "Owner name is required" },
      phone: { required: true, isPhone: true, requiredMessage: "10-digit mobile number required" },
      email: { required: true, isEmail: true, requiredMessage: "Valid email is required" },
      password: { required: true, minLength: 6, requiredMessage: "Password (min 6 characters) required" },
      confirm: {
        required: true,
        custom: (val) => (val !== form.password ? "Passwords don't match" : null),
      },
      country: { required: true, requiredMessage: "Country is required" },
      city: { required: true, requiredMessage: "City is required" },
      terms: { required: true, requiredMessage: "You must accept the terms" },
    }
  );

  useEffect(() => {
    getBusinessTypesApi().then((types) => {
      if (Array.isArray(types) && types.length > 0) {
        setBusinessTypes(types);
        setSelectedTypeId(types[0].id);
      }
    }).catch(() => {});
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateAll()) {
      toast.error("Please correct the highlighted fields before submitting.");
      return;
    }

    setLoading(true);

    try {
      const typeId = selectedTypeId || businessTypes.find(t => t.name.toLowerCase() === form.type.toLowerCase())?.id || businessTypes[0]?.id;
      if (!typeId) {
        toast.error("Invalid business type. Please refresh and try again.");
        setLoading(false);
        return;
      }

      await registerApi({
        business: {
          business_type_id: typeId,
          business_name: form.business.trim(),
          phone: form.phone.trim(),
          country: form.country.trim(),
          currency: "INR",
          timezone: "Asia/Kolkata",
          address: form.city.trim() || "Default Address",
        },
        owner: {
          owner_name: form.owner.trim(),
          owner_email: form.email.trim(),
          password: form.password,
        },
      });

      toast.success("Account created successfully!");
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/"><BrandLogo /></Link>
          <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground">← Back to sign in</Link>
        </div>
        {submitted ? (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-elegant">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl font-semibold">Account Created Successfully</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your account is currently under review. Our team will review your application and contact you within 12 hours at <span className="font-medium text-foreground">{form.email}</span>.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning">
              <Clock className="h-3.5 w-3.5" /> Pending Approval
            </div>
            <Button className="mt-6 w-full rounded-full gradient-brand text-primary-foreground" onClick={() => navigate("/login")}>
              Back to Sign In
            </Button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl font-semibold">Create your business account</h1>
            <p className="mt-1 text-sm text-muted-foreground">New accounts need admin approval before you can sign in.</p>
            <form onSubmit={submit} className="mt-8 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <ValidatedField label="Business name" required error={errors.business} touched={touched.business}>
                  <Input
                    ref={registerRef("business")}
                    value={form.business}
                    onChange={(e) => handleChange("business", e.target.value)}
                    onBlur={() => handleBlur("business")}
                    autoComplete="organization"
                    placeholder="Aroma Bistro"
                  />
                </ValidatedField>
                <ValidatedField label="Owner name" required error={errors.owner} touched={touched.owner}>
                  <Input
                    ref={registerRef("owner")}
                    value={form.owner}
                    onChange={(e) => handleChange("owner", e.target.value)}
                    onBlur={() => handleBlur("owner")}
                    autoComplete="name"
                    placeholder="Priya Sharma"
                  />
                </ValidatedField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Business type <span className="text-destructive font-bold">*</span></Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => {
                      handleChange("type", v);
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
                <ValidatedField label="Phone Number" required error={errors.phone} touched={touched.phone}>
                  <Input
                    ref={registerRef("phone")}
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    onBlur={() => handleBlur("phone")}
                    maxLength={10}
                    type="tel"
                    autoComplete="tel"
                    placeholder="10-digit mobile number"
                  />
                </ValidatedField>
              </div>
              <ValidatedField label="Email Address" required error={errors.email} touched={touched.email}>
                <Input
                  ref={registerRef("email")}
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  onBlur={() => handleBlur("email")}
                  autoComplete="email"
                  placeholder="you@business.com"
                />
              </ValidatedField>
              <div className="grid gap-4 sm:grid-cols-2">
                <ValidatedField label="Password" required error={errors.password} touched={touched.password}>
                  <PasswordInput
                    ref={registerRef("password")}
                    value={form.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    onBlur={() => handleBlur("password")}
                    autoComplete="new-password"
                  />
                </ValidatedField>
                <ValidatedField label="Confirm password" required error={errors.confirm} touched={touched.confirm}>
                  <PasswordInput
                    ref={registerRef("confirm")}
                    value={form.confirm}
                    onChange={(e) => handleChange("confirm", e.target.value)}
                    onBlur={() => handleBlur("confirm")}
                    autoComplete="new-password"
                  />
                </ValidatedField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ValidatedField label="Country" required error={errors.country} touched={touched.country}>
                  <Input
                    ref={registerRef("country")}
                    value={form.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                    onBlur={() => handleBlur("country")}
                    autoComplete="country-name"
                    placeholder="India"
                  />
                </ValidatedField>
                <ValidatedField label="City" required error={errors.city} touched={touched.city}>
                  <Input
                    ref={registerRef("city")}
                    value={form.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    onBlur={() => handleBlur("city")}
                    autoComplete="address-level2"
                    placeholder="Mumbai"
                  />
                </ValidatedField>
              </div>
              <ValidatedField error={errors.terms} touched={touched.terms}>
                <label className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <Checkbox
                    checked={form.terms}
                    onCheckedChange={(v) => handleChange("terms", !!v)}
                    className="mt-0.5"
                  />
                  <span>I accept the <Link to="/docs" className="text-primary hover:underline">Terms</Link> and <Link to="/docs" className="text-primary hover:underline">Privacy Policy</Link>.</span>
                </label>
              </ValidatedField>
              <p className="rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
                ✅ Once approved, you'll get a 14-day full-access free trial — no card required.
              </p>
              <Button type="submit" disabled={loading} className="w-full rounded-full gradient-brand text-primary-foreground shadow-glow gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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