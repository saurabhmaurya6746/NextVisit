import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand-logo";
import { Twitter, Linkedin, Instagram, Youtube, Mail } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t bg-background/60 backdrop-blur">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-4">
        <div>
          <BrandLogo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">The white-label CRM & marketing automation platform for local businesses.</p>
          <div className="mt-4 flex items-center gap-3 text-muted-foreground">
            <a href="#" aria-label="Twitter" className="hover:text-foreground"><Twitter className="h-4 w-4" /></a>
            <a href="#" aria-label="LinkedIn" className="hover:text-foreground"><Linkedin className="h-4 w-4" /></a>
            <a href="#" aria-label="Instagram" className="hover:text-foreground"><Instagram className="h-4 w-4" /></a>
            <a href="#" aria-label="YouTube" className="hover:text-foreground"><Youtube className="h-4 w-4" /></a>
          </div>
        </div>
        <FooterCol title="Product" links={[["Pricing", "/pricing"], ["Use Cases", "/use-cases"], ["Docs", "/docs"]]} />
        <FooterCol title="Company" links={[["About", "/use-cases"], ["Contact", "/docs"], ["Blog", "/docs"]]} />
        <FooterCol title="Legal" links={[["Privacy Policy", "/docs"], ["Terms of Service", "/docs"], ["Cookie Policy", "/docs"]]} />
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 NextVisit. All rights reserved.</p>
          <a href="mailto:hello@growthos.app" className="inline-flex items-center gap-1.5 hover:text-foreground"><Mail className="h-3.5 w-3.5" /> hello@growthos.app</a>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-foreground">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {links.map(([label, href]) => (
          <li key={label}><Link to={href} className="hover:text-foreground">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}