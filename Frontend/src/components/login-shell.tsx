import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Github, Crown, Store } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "sonner";
import { loginApi, setSession } from "@/lib/auth";
import { setBusinessType } from "@/lib/business-type";
import { readProfile } from "@/lib/business-profile";
import { slugify } from "@/lib/app-nav";

export function LoginShell({ role, target, tagline, quote, author }: { role: "Business Owner" | "Super Admin"; target: string; tagline: string; quote: string; author: string }) {
  const [loading, setLoading] = useState(false);
  const isAdmin = role === "Super Admin";
  const demoEmail = isAdmin ? "admin@growthos.com" : "demo@restaurant.com";
  const demoPass = isAdmin ? "Admin@123" : "Demo@123";
  const [email, setEmail] = useState(demoEmail);
  const [password, setPassword] = useState(demoPass);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    console.log("[LOGIN] Continue button clicked! Form submit triggered with:", { email, password });
    setLoading(true);

    try {
      if (isAdmin) {
        console.log("[LOGIN] Super Admin bypass setting admin session");
        setSession({ role: "admin", email });
        toast.success(`Welcome back — signing you into the ${role} panel`);
        window.location.href = target;
      } else {
        console.log("[LOGIN] Invoking loginApi() for business user...");
        const session = await loginApi(email, password);
        console.log("[LOGIN] loginApi() returned session successfully:", session);
        const type: "restaurant" | "salon" = email.toLowerCase().includes("salon") ? "salon" : "restaurant";
        setBusinessType(type);
        const slug = slugify(session.businessName || type);
        setSession({
          ...session,
          businessType: type,
          businessSlug: slug,
        });
        toast.success(`Welcome back — signing you into NextVisit`);
        window.location.href = `/app/${type}/${slug}/dashboard`;
      }
    } catch (err: any) {
      console.error("[LOGIN] submit error caught:", err);
      toast.error(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-foreground text-background lg:block">
        <div className="pointer-events-none absolute inset-0 gradient-mesh opacity-40" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-primary/40 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <BrandLogo />
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="text-sm uppercase tracking-widest text-background/60">{role}</p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight">{tagline}</h2>
          </motion.div>
          <figure className="max-w-md">
            <blockquote className="text-lg leading-relaxed text-background/90">“{quote}”</blockquote>
            <figcaption className="mt-3 text-sm text-background/60">— {author}</figcaption>
          </figure>
        </div>
      </div>
      <div className="flex flex-col p-6 sm:p-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="lg:hidden"><BrandLogo /></Link>
          <Link to="/" className="ml-auto text-xs text-muted-foreground hover:text-foreground">← Back to home</Link>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <h1 className="font-display text-2xl font-semibold">Sign in to {role}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Demo credentials pre-filled — <span className="font-medium text-foreground">{demoEmail}</span> / <span className="font-medium text-foreground">{demoPass}</span>
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-xs text-primary hover:underline">Forgot?</a>
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-full gradient-brand text-primary-foreground shadow-glow">
              {loading ? "Signing in…" : (<>Continue <ArrowRight className="ml-1.5 h-4 w-4" /></>)}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> Or continue with demo <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => { setSession({ role: "admin", email: "admin@growthos.com" }); window.location.href = "/admin"; }}>
              <Crown className="mr-1.5 h-4 w-4" /> Super Admin
            </Button>
            <Button variant="outline" className="rounded-full" onClick={async () => {
              console.log("[LOGIN] Demo Restaurant Owner button clicked!");
              setEmail("demo@restaurant.com");
              setPassword("Demo@123");
              try {
                const session = await loginApi("demo@restaurant.com", "Demo@123");
                const type = "restaurant";
                const slug = slugify(session.businessName || type);
                setBusinessType(type);
                setSession({
                  ...session,
                  businessType: type,
                  businessSlug: slug,
                });
                window.location.href = `/app/${type}/${slug}/dashboard`;
              } catch (err: any) {
                toast.error(err.message || "Demo login failed");
              }
            }}>
              <Store className="mr-1.5 h-4 w-4" /> Restaurant Owner
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={() => toast("SSO connected (demo)")}>Google</Button>
            <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={() => toast("SSO connected (demo)")}><Github className="mr-1.5 h-3.5 w-3.5" /> GitHub</Button>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            New here?{" "}
            <Link to="/signup" className="text-primary hover:underline">Create an account</Link>
            <span className="text-muted-foreground/70"> (needs admin approval)</span>
            <br />
            Not the {role.toLowerCase()}?{" "}
            <Link to={isAdmin ? "/login/business" : "/login/admin"} className="text-primary hover:underline">
              Switch to {isAdmin ? "Business Owner" : "Super Admin"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}