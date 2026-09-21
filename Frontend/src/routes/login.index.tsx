import { Link, useNavigate } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "sonner";
import { setBusinessType } from "@/lib/business-type";
import { readProfile } from "@/lib/business-profile";
import { slugify } from "@/lib/app-nav";
import { adminLoginApi, loginApi, setSession } from "@/lib/auth";
import { PasswordInput } from "@/components/ui/password-input";

export const Route = createFileRoute("/login/")({
  head: () => ({ meta: [{ title: "Sign in — NextVisit" }] }),
  component: UnifiedLogin,
});

export default function UnifiedLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || transitioning) return;
    setLoading(true);

    const cleanEmail = email.trim();

    try {
      // 1. If email contains 'admin', try Super Admin login first
      if (cleanEmail.toLowerCase().includes("admin")) {
        try {
          console.log("[LOGIN/INDEX] Calling adminLoginApi for super admin...");
          const session = await adminLoginApi(cleanEmail, password);
          setTransitioning(true);
          toast.success(`Welcome back — signing you into Super Admin`);
          window.location.href = "/admin";
          return;
        } catch (adminErr) {
          console.log("[LOGIN/INDEX] Super Admin auth attempt skipped/failed, proceeding to merchant/staff login...", adminErr);
        }
      }

      // 2. Otherwise/Fallback: Business Owner or Staff login
      console.log("[LOGIN/INDEX] Calling loginApi with:", { cleanEmail, password });
      const session = await loginApi(cleanEmail, password);
      setTransitioning(true);
      const type: "restaurant" | "salon" = session.businessType || "restaurant";
      const slug = session.businessSlug || slugify(session.businessName || type);
      setBusinessType(type);
      toast.success(`Welcome back — signing you into NextVisit`);
      window.location.href = `/app/${type}/${slug}/dashboard`;
    } catch (err: any) {
      console.error("[LOGIN/INDEX] loginApi error:", err);
      toast.error(err.message || "Incorrect Email / Staff ID or password.");
      setLoading(false);
      setTransitioning(false);
    }
  };

  const isBusy = loading || transitioning;

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

          {transitioning ? (
            <div className="mt-8 rounded-2xl border bg-card/60 backdrop-blur-sm p-8 text-center space-y-3 shadow-sm animate-in fade-in-50 duration-200">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Signing you in…</p>
                <p className="text-xs text-muted-foreground">Preparing your dashboard</p>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email / Staff Login ID</Label>
                <Input
                  id="email"
                  type="text"
                  required
                  disabled={isBusy}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@business.com or ST001"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  required
                  disabled={isBusy}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                disabled={isBusy}
                className="w-full rounded-full gradient-brand text-primary-foreground shadow-glow"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            New here? <Link to="/signup" className="text-primary hover:underline">Create an account</Link>
          </p>
        </div>
      </main>
    </div>
  );
}