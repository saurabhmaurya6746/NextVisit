import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "sonner";
import { getBusinessTypesApi, registerApi } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — NextVisit" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
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
              Your account is currently under review. We'll notify you at <span className="font-medium text-foreground">{form.email}</span> after approval.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning">
              <Clock className="h-3.5 w-3.5" /> Pending Approval
            </div>
            <Button className="mt-6 w-full rounded-full gradient-brand text-primary-foreground" onClick={() => navigate({ to: "/login" })}>
              Back to sign in
            </Button>
          </div>
        ) : (
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
                  <Input id="password" type="password" required value={form.password} onChange={(e) => set("password")(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input id="confirm" type="password" required value={form.confirm} onChange={(e) => set("confirm")(e.target.value)} />
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
              <Button type="submit" className="w-full rounded-full gradient-brand text-primary-foreground shadow-glow">
                Create account
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