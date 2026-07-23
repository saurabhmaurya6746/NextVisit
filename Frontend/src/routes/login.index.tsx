import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "sonner";
import { setBusinessType } from "@/lib/business-type";
import { readProfile } from "@/lib/business-profile";
import { slugify } from "@/lib/app-nav";
import { loginApi, setSession } from "@/lib/auth";

export const Route = createFileRoute("/login/")({
  head: () => ({ meta: [{ title: "Sign in — NextVisit" }] }),
  component: UnifiedLogin,
});

// Demo credentials → role routing.
const DEMO: Record<string, { role: string; type?: "restaurant" | "salon"; adminTarget?: string }> = {
  "admin@growthos.com": { role: "Super Admin", adminTarget: "/admin" },
  "demo@restaurant.com": { role: "Restaurant Owner", type: "restaurant" },
  "demo@salon.com": { role: "Salon Owner", type: "salon" },
};

function appTargetFor(type: "restaurant" | "salon", nameOverride?: string) {
  const profile = readProfile(type) as { name?: string };
  const name = nameOverride || profile?.name || type;
  const business = slugify(name);
  return { url: `/app/${type}/${business}/dashboard`, slug: business, name };
}

function UnifiedLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (email.toLowerCase() === "admin@growthos.com") {
        setSession({ role: "admin", email });
        toast.success(`Welcome — signing you into Super Admin`);
        window.location.href = "/admin";
        return;
      }

      console.log("[LOGIN/INDEX] Calling loginApi with:", { email, password });
      const session = await loginApi(email, password);
      const type: "restaurant" | "salon" = email.toLowerCase().includes("salon") ? "salon" : "restaurant";
      const slug = slugify(session.businessName || type);
      setBusinessType(type);
      setSession({
        ...session,
        businessType: type,
        businessSlug: slug,
      });
      toast.success(`Welcome back — signing you into NextVisit`);
      window.location.href = `/app/${type}/${slug}/dashboard`;
    } catch (err: any) {
      console.error("[LOGIN/INDEX] loginApi error:", err);
      toast.error(err.message || "Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 gradient-mesh opacity-40" />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between p-6">
        <Link to="/"><BrandLogo /></Link>
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to home</Link>
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          <div className="text-center">
            <h1 className="font-display text-2xl font-semibold">Sign in to NextVisit</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your credentials to access your dashboard.</p>
          </div>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" /></div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" onClick={() => toast("Password reset link sent if the email exists.")} className="text-xs text-muted-foreground hover:text-foreground">Forgot password?</button>
              </div>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-full gradient-brand text-primary-foreground shadow-glow">
              {loading ? "Signing in…" : (<>Sign in <ArrowRight className="ml-1.5 h-4 w-4" /></>)}
            </Button>
          </form>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            New here? <Link to="/signup" className="text-primary hover:underline">Create an account</Link>
          </p>
        </div>
      </main>
    </div>
  );
}