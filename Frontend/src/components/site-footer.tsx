import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/brand-logo";
import { Twitter, Linkedin, Instagram, Youtube, Mail, Phone } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t bg-background/60 backdrop-blur">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand Column */}
        <div className="space-y-3">
          <BrandLogo />
          <p className="max-w-xs text-sm text-muted-foreground">
            The customer growth platform for local businesses.
          </p>
          <div className="flex items-center gap-3 pt-2 text-muted-foreground">
            <a href="#" aria-label="Twitter" className="hover:text-foreground transition-colors">
              <Twitter className="h-4 w-4" />
            </a>
            <a href="#" aria-label="LinkedIn" className="hover:text-foreground transition-colors">
              <Linkedin className="h-4 w-4" />
            </a>
            <a href="#" aria-label="Instagram" className="hover:text-foreground transition-colors">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="#" aria-label="YouTube" className="hover:text-foreground transition-colors">
              <Youtube className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Product Column */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-foreground">Product</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
            </li>
            <li>
              <Link to="/features" className="hover:text-foreground transition-colors">
                Features
              </Link>
            </li>
            <li>
              <Link to="/pricing" className="hover:text-foreground transition-colors">
                Pricing
              </Link>
            </li>
            <li>
              <Link to="/use-cases" className="hover:text-foreground transition-colors">
                Use Cases
              </Link>
            </li>
            <li>
              <Link to="/docs" className="hover:text-foreground transition-colors">
                Docs
              </Link>
            </li>
          </ul>
        </div>

        {/* Resources Column */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-foreground">Resources</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/docs" className="hover:text-foreground transition-colors">
                FAQ
              </Link>
            </li>
            <li>
              <Link to="/docs" className="hover:text-foreground transition-colors">
                Getting Started
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-foreground transition-colors">
                Terms &amp; Conditions
              </Link>
            </li>
            <li>
              <a href="mailto:hello@growthos.app" className="hover:text-foreground transition-colors">
                Support
              </a>
            </li>
          </ul>
        </div>

        {/* Contact Column */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-foreground">Contact</p>
          <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <a
                href="tel:9555702945"
                className="inline-flex items-center gap-2 hover:text-foreground transition-colors"
              >
                <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>9555702945</span>
              </a>
            </li>
            <li>
              <a
                href="mailto:hello@growthos.app"
                className="inline-flex items-center gap-2 hover:text-foreground transition-colors"
              >
                <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>hello@growthos.app</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Sub-Footer Bar */}
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 NextVisit. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms &amp; Conditions
            </Link>
            <span>•</span>
            <a href="tel:9555702945" className="hover:text-foreground transition-colors">
              9555702945
            </a>
            <span>•</span>
            <a href="mailto:hello@growthos.app" className="hover:text-foreground transition-colors">
              hello@growthos.app
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}