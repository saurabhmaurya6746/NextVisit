import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
      <Link to="/"><BrandLogo /></Link>
      <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
        <Link to="/" hash="features" className="hover:text-foreground">Features</Link>
        <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
        <Link to="/use-cases" className="hover:text-foreground">Use Cases</Link>
        <Link to="/docs" className="hover:text-foreground">Docs</Link>
      </nav>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button asChild variant="ghost" size="sm" className="rounded-full"><Link to="/login">Sign in</Link></Button>
        <Button asChild size="sm" className="rounded-full gradient-brand text-primary-foreground shadow-glow"><Link to="/signup">Start free <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
      </div>
    </header>
  );
}