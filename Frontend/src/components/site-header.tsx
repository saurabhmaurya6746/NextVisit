import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Use Cases", href: "/use-cases" },
  { label: "Docs", href: "/docs" },
];

export function SiteHeader() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
      <Link to="/" onClick={() => setMobileMenuOpen(false)}>
        <BrandLogo />
      </Link>

      {/* Desktop Navigation */}
      <nav className="hidden items-center gap-8 text-sm md:flex">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "transition-colors",
              isActive(item.href)
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Desktop Action Buttons */}
      <div className="hidden items-center gap-2 md:flex">
        <ThemeToggle />
        <Button asChild variant="ghost" size="sm" className="rounded-full">
          <Link to="/login">Sign in</Link>
        </Button>
        <Button asChild size="sm" className="rounded-full gradient-brand text-primary-foreground shadow-glow">
          <Link to="/signup">
            Start free <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {/* Mobile Controls & Hamburger */}
      <div className="flex items-center gap-2 md:hidden">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-9 w-9"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 z-50 px-6 py-4 mx-6 mt-2 rounded-2xl border bg-background/95 backdrop-blur-lg shadow-xl md:hidden">
          <nav className="flex flex-col space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "py-1.5 text-sm transition-colors",
                  isActive(item.href)
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-border flex flex-col gap-2">
              <Button asChild variant="ghost" size="sm" className="w-full justify-start rounded-xl">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  Sign in
                </Link>
              </Button>
              <Button asChild size="sm" className="w-full rounded-xl gradient-brand text-primary-foreground shadow-glow">
                <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                  Start free <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}