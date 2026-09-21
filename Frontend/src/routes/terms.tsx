import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createFileRoute } from "@/lib/route-compat";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ArrowLeft,
  FileText,
  ShieldCheck,
  Scale,
  Clock,
  Printer,
  ChevronRight,
  Sparkles,
  Building2,
  Mail,
  Phone,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — NextVisit" },
      {
        name: "description",
        content:
          "Official Terms & Conditions and service agreement governing account registration, approval, acceptable use, data responsibilities, subscriptions, and limitations of liability for the NextVisit SaaS platform.",
      },
    ],
  }),
  component: TermsPage,
});

interface SectionItem {
  id: string;
  number: number;
  title: string;
  category: "General" | "Account & Security" | "Data & Usage" | "Subscriptions" | "Legal & Disclaimers";
  content: React.ReactNode;
}

export default function TermsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("section-1");

  // Determine if user arrived from signup
  const fromSignup = location.state?.from === "signup" || document.referrer.includes("/signup");

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/signup");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Terms & Conditions URL copied to clipboard");
  };

  const sections: SectionItem[] = useMemo(
    () => [
      {
        id: "section-1",
        number: 1,
        title: "Introduction",
        category: "General",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Welcome to <span className="font-semibold text-foreground">NextVisit</span> (referred to as{" "}
              <span className="font-semibold text-foreground">"NextVisit"</span>,{" "}
              <span className="font-semibold text-foreground">"we"</span>,{" "}
              <span className="font-semibold text-foreground">"us"</span>, or{" "}
              <span className="font-semibold text-foreground">"our"</span>). NextVisit is a proprietary cloud-based
              Software-as-a-Service (SaaS) platform designed for local businesses, including restaurants, salons, cafes,
              and retail service establishments.
            </p>
            <p>
              The NextVisit platform provides digital point-of-sale (POS) order management, table QR code ordering,
              customer relationship management (CRM), automated marketing communications, loyalty reward points, and
              operational business reporting tools.
            </p>
          </div>
        ),
      },
      {
        id: "section-2",
        number: 2,
        title: "Acceptance of Terms",
        category: "General",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              These Terms &amp; Conditions (referred to as <span className="font-semibold text-foreground">"Terms"</span>)
              constitute a legally binding contract between NextVisit and the commercial enterprise or authorized
              individual (referred to as <span className="font-semibold text-foreground">"Business"</span>,{" "}
              <span className="font-semibold text-foreground">"Merchant"</span>,{" "}
              <span className="font-semibold text-foreground">"User"</span>, or{" "}
              <span className="font-semibold text-foreground">"you"</span>) accessing, registering for, or using the Platform.
            </p>
            <p>
              By registering an account, clicking an "I accept" checkbox, accessing our web application, or using any of
              our Services, you confirm that you have read, understood, and agreed to be bound by these Terms in full. If
              you do not agree to these Terms, you must not create an account or use the Platform.
            </p>
          </div>
        ),
      },
      {
        id: "section-3",
        number: 3,
        title: "Account Registration and Eligibility",
        category: "Account & Security",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              To register for a NextVisit account, you must be at least eighteen (18) years of age, operate a bona fide
              commercial business, and possess the legal authority to bind your business entity to this agreement.
            </p>
            <p>
              You agree to provide true, accurate, current, and complete business information during registration, including
              your legal business name, registered owner name, valid 10-digit mobile phone number, operating address, and
              contact email address. Providing false, misleading, or deceptive information is strictly prohibited and
              constitutes grounds for immediate rejection or account termination.
            </p>
          </div>
        ),
      },
      {
        id: "section-4",
        number: 4,
        title: "Business Account Approval",
        category: "Account & Security",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>No Automatic Approval Guarantee:</strong> Submitting a registration form does not automatically grant
              or guarantee platform access or activation.
            </p>
            <p>
              All newly registered accounts are placed in a <span className="font-semibold text-foreground">PENDING</span> review
              queue and are subject to verification and approval by NextVisit Super Administrators. NextVisit reserves the
              sole discretion to approve, request supplemental verification documentation, or reject any registration
              application to maintain platform integrity, security, and compliance.
            </p>
            <p>
              Upon successful administrative review, an approval confirmation email is dispatched to the registered owner
              email address, enabling immediate merchant login.
            </p>
          </div>
        ),
      },
      {
        id: "section-5",
        number: 5,
        title: "Account Rejection and Re-application",
        category: "Account & Security",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              If a merchant application is rejected by an Administrator (for reasons such as unverified business details,
              incomplete address, or unsupported business category), an explanatory status update email is sent to the
              applicant's email address.
            </p>
            <p>
              <strong>Re-application Rights:</strong> Rejected applicants are permitted to re-apply by submitting a new
              signup request with updated and corrected information using the same email address. The system will reset
              the status to pending review for administrator re-evaluation without blocking the user.
            </p>
          </div>
        ),
      },
      {
        id: "section-6",
        number: 6,
        title: "Account Security and Password Responsibilities",
        category: "Account & Security",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              NextVisit enforces strict password complexity requirements (minimum 8 characters, uppercase and lowercase
              letters, numerical digits, and special characters) and industry-standard cryptographic hashing.
            </p>
            <p>
              You are solely responsible for maintaining the confidentiality of your login credentials. You agree not to
              share your master password with unauthorized third parties. The Business Owner is fully responsible for all
              activities, orders, transactions, customer records, and communications initiated under their account credentials.
            </p>
            <p>
              You must notify NextVisit immediately at{" "}
              <a href="mailto:hello@growthos.app" className="text-primary hover:underline font-medium">
                hello@growthos.app
              </a>{" "}
              if you discover or suspect any unauthorized access or compromise of your account.
            </p>
          </div>
        ),
      },
      {
        id: "section-7",
        number: 7,
        title: "Use of the NextVisit Platform",
        category: "Data & Usage",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              NextVisit grants you a limited, non-exclusive, non-transferable, revocable license to access and use the
              Platform during your active subscription or promotional trial period solely for your internal business
              operations.
            </p>
            <p>
              You agree to use the Platform in compliance with all applicable local, state, national, and international laws,
              statutes, ordinances, and commercial regulations.
            </p>
          </div>
        ),
      },
      {
        id: "section-8",
        number: 8,
        title: "Business Data and Customer Data",
        category: "Data & Usage",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>Merchant Responsibility for Data:</strong> The Business is solely responsible for the accuracy,
              integrity, and legality of all information entered into the platform, including item descriptions, menu prices,
              tax rates (GST), service charges, UPI identifiers, and customer contact information.
            </p>
            <p>
              <strong>Customer Data Ownership &amp; Consent:</strong> The Business represents and warrants that it has
              lawfully collected all customer names, phone numbers, visit timestamps, and celebration dates in accordance
              with applicable data protection and consumer laws. NextVisit acts purely as a technical software processor
              operating under the instructions of the Business.
            </p>
          </div>
        ),
      },
      {
        id: "section-9",
        number: 9,
        title: "Customer Communications and Marketing Automation",
        category: "Data & Usage",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              NextVisit provides automated communication tools, including welcome greetings, birthday and anniversary
              wishes, customer recovery win-back messages, review boosters, and promotional broadcast templates.
            </p>
            <p>
              <strong>Express Customer Consent:</strong> The Business guarantees that it has obtained all necessary prior
              express consents and opt-ins from its customers before triggering automated WhatsApp, SMS, or email
              messages. The Business is solely liable for honoring customer opt-out requests and adhering to national
              telecom regulations and Do-Not-Disturb (DND) registries.
            </p>
            <p>
              NextVisit does not warrant 100% instantaneous delivery for every outgoing message, as delivery is contingent
              upon third-party telecom carriers, device connectivity, and WhatsApp network policies.
            </p>
          </div>
        ),
      },
      {
        id: "section-10",
        number: 10,
        title: "QR Ordering and Transaction Information",
        category: "Data & Usage",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              NextVisit provides table-specific QR codes and mobile web interfaces to facilitate customer self-ordering and
              bill calculation.
            </p>
            <p>
              NextVisit is a software platform provider and is <span className="font-semibold text-foreground">NOT</span> a
              food provider, salon operator, bank, or payment processor. The Business is solely responsible for food
              preparation, salon services, pricing accuracy, order fulfillment, refund handling, and physical service
              quality.
            </p>
          </div>
        ),
      },
      {
        id: "section-11",
        number: 11,
        title: "Loyalty, Coupons and Promotional Features",
        category: "Subscriptions",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              NextVisit includes configurable loyalty points engines and coupon management modules (percentage, flat, BOGO,
              and free-item discounts).
            </p>
            <p>
              The Business maintains complete autonomy and responsibility over the discount amounts, earning rules, point
              conversion rates, minimum order thresholds, and expiry parameters offered to its retail patrons.
            </p>
          </div>
        ),
      },
      {
        id: "section-12",
        number: 12,
        title: "Third-Party Services and Integrations",
        category: "Data & Usage",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              The Platform relies upon and integrates with third-party providers, including WhatsApp Business API / Meta,
              Resend email delivery services, cloud hosting infrastructure, and payment gateway interfaces.
            </p>
            <p>
              Your utilization of integrated third-party features is subject to the respective third party's operating terms.
              NextVisit is not responsible or liable for third-party network downtimes, rate limits, policy revisions, or
              service interruptions outside our reasonable control.
            </p>
          </div>
        ),
      },
      {
        id: "section-13",
        number: 13,
        title: "Payments, Subscriptions and Billing",
        category: "Subscriptions",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Access to NextVisit is offered under subscription plans billed on recurring monthly or annual intervals. Newly
              approved accounts may receive a complimentary 14-day evaluation trial without requiring credit card details.
            </p>
            <p>
              All stated subscription fees are exclusive of applicable statutory taxes (such as GST). You may cancel your
              subscription at any time through the dashboard, which takes effect at the end of the current billing cycle.
            </p>
          </div>
        ),
      },
      {
        id: "section-14",
        number: 14,
        title: "Platform Availability and Service Changes",
        category: "Subscriptions",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              We strive to maintain high system availability and operational resilience. However, NextVisit does not
              guarantee uninterrupted, error-free, or continuous availability of the Platform.
            </p>
            <p>
              We may perform scheduled maintenance, database optimizations, and feature enhancements. We reserve the right
              to update, modify, evolve, or deprecate specific features over time.
            </p>
          </div>
        ),
      },
      {
        id: "section-15",
        number: 15,
        title: "Prohibited Activities",
        category: "Data & Usage",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>You agree NOT to engage in any of the following prohibited activities:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Using the Platform for fraudulent, unlawful, deceptive, or misleading commercial activities;</li>
              <li>Sending unsolicited mass spam, harassment, or abusive promotions to consumers;</li>
              <li>Attempting to probe, scan, breach, or bypass any security or authentication controls;</li>
              <li>Reverse engineering, decompiling, disassembling, or extracting source code from the Platform;</li>
              <li>Introducing malicious code, viruses, automated scrapers, or bots into the Platform infrastructure;</li>
              <li>Reselling, sub-licensing, or redistributing NextVisit software without prior written authorization.</li>
            </ul>
          </div>
        ),
      },
      {
        id: "section-16",
        number: 16,
        title: "Intellectual Property",
        category: "General",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              All software, source code, user interface designs, logos, trademarks, database models, algorithms, and
              documentation comprising NextVisit are the exclusive intellectual property of NextVisit.
            </p>
            <p>
              The Business retains full intellectual property ownership in its uploaded business logos, menu item names,
              descriptions, photographs, and customer records. You grant NextVisit a limited license to host and display
              your content solely for providing the Services.
            </p>
          </div>
        ),
      },
      {
        id: "section-17",
        number: 17,
        title: "Privacy and Data Protection",
        category: "Data & Usage",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              NextVisit processes data in accordance with our Privacy Policy. We maintain technical and operational
              safeguards, including encryption in transit (HTTPS/TLS) and isolated tenant databases. We do not sell or
              monetize your customer data.
            </p>
          </div>
        ),
      },
      {
        id: "section-18",
        number: 18,
        title: "Account Suspension and Termination",
        category: "Account & Security",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              NextVisit reserves the right to immediately suspend or terminate any Account upon: (a) material breach of
              these Terms or the Acceptable Use Policy; (b) repeated spam complaints from consumers; (c) fraudulent or
              illegal business operations; (d) non-payment of subscription dues; or (e) security threats posed to the
              Platform.
            </p>
            <p>
              You may terminate your Account at any time through account settings or by submitting a support request.
            </p>
          </div>
        ),
      },
      {
        id: "section-19",
        number: 19,
        title: "Limitation of Liability",
        category: "Legal & Disclaimers",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              To the maximum extent permitted by applicable law, in no event shall NextVisit, its founders, directors, or
              employees be liable for any indirect, incidental, special, consequential, or punitive damages, including loss
              of business revenue, profits, customer goodwill, or data.
            </p>
            <p>
              NextVisit's total aggregate liability arising out of or relating to these Terms shall not exceed the total
              amount actually paid by you to NextVisit in the twelve (12) months preceding the claim.
            </p>
          </div>
        ),
      },
      {
        id: "section-20",
        number: 20,
        title: "Disclaimer",
        category: "Legal & Disclaimers",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              NextVisit is provided strictly on an <span className="font-semibold text-foreground">"AS IS"</span> and{" "}
              <span className="font-semibold text-foreground">"AS AVAILABLE"</span> basis. NextVisit does not guarantee
              specific revenue growth, footfall increases, marketing returns, review volumes, or uninterrupted message
              delivery.
            </p>
            <p>
              NextVisit is not a bank, payment gateway, financial advisor, or legal counsel.
            </p>
          </div>
        ),
      },
      {
        id: "section-21",
        number: 21,
        title: "Changes to These Terms",
        category: "General",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              NextVisit reserves the right to update or revise these Terms from time to time. The "Last Updated" date at the
              top of this page reflects the latest version. Your continued use of the Platform after changes are published
              constitutes your acceptance of the revised Terms.
            </p>
          </div>
        ),
      },
      {
        id: "section-22",
        number: 22,
        title: "Governing Law and Jurisdiction",
        category: "Legal & Disclaimers",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              These Terms shall be governed by and construed in accordance with the applicable laws of{" "}
              <span className="font-semibold text-foreground">
                [Applicable jurisdiction to be specified by NextVisit operator]
              </span>
              . Any legal action or proceeding arising under these Terms shall be resolved through good-faith informal
              consultation or brought before competent courts of jurisdiction.
            </p>
          </div>
        ),
      },
      {
        id: "section-23",
        number: 23,
        title: "Contact Information",
        category: "General",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>For inquiries, legal notices, or questions regarding these Terms, please contact us at:</p>
            <div className="rounded-xl border bg-muted/40 p-4">
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    <strong>Platform Operator:</strong> NextVisit SaaS Platform
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    <strong>Email:</strong>{" "}
                    <a href="mailto:hello@growthos.app" className="text-primary hover:underline font-medium">
                      hello@growthos.app
                    </a>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    <strong>Support Phone:</strong>{" "}
                    <a href="tel:9555702945" className="text-primary hover:underline font-medium">
                      +91 9555702945
                    </a>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    <strong>Governance:</strong> Super Admin Compliance Team
                  </span>
                </div>
              </div>
            </div>
          </div>
        ),
      },
    ],
    []
  );

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter((s) => s.title.toLowerCase().includes(q) || s.number.toString().includes(q));
  }, [searchQuery, sections]);

  // Scrollspy
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 140;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveSection(s.id);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const topOffset = 80;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setActiveSection(id);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Breadcrumb & Actions Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-foreground">Terms &amp; Conditions</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="h-8 rounded-full gap-1.5 text-xs font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {fromSignup ? "Back to Sign Up" : "Back"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              className="h-8 rounded-full gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className="h-8 rounded-full text-xs text-muted-foreground hover:text-foreground"
            >
              Copy Link
            </Button>
          </div>
        </div>

        {/* Hero Header */}
        <div className="mb-10 rounded-2xl border bg-card/60 p-6 sm:p-8 backdrop-blur shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="secondary" className="rounded-full gap-1 text-xs">
              <Scale className="h-3 w-3 text-primary" /> Legal Agreement
            </Badge>
            <Badge variant="outline" className="rounded-full text-xs">
              NextVisit SaaS
            </Badge>
            <Badge variant="outline" className="rounded-full gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> Last Updated: August 18, 2026
            </Badge>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Terms &amp; Conditions
          </h1>
          <p className="mt-2 max-w-3xl text-sm sm:text-base text-muted-foreground leading-relaxed">
            Please review these terms carefully before registering or using NextVisit. This agreement outlines your
            rights, obligations, account review and approval processes, customer messaging consent rules, and limitations of
            liability.
          </p>

          {/* Quick Notice Banner */}
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Important Notice for All Merchant Accounts:</p>
              <p className="text-muted-foreground leading-relaxed">
                NextVisit requires Super Admin review prior to account activation. Creating an account does not guarantee
                automatic approval. The Business is strictly responsible for customer data accuracy, express opt-in consent
                for automated messaging, and credential security.
              </p>
            </div>
          </div>

          {/* In-Page Search Filter */}
          <div className="relative mt-6 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter terms by topic or section number…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border bg-card/60 p-4 backdrop-blur shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 mb-2">
                Table of Contents (23 Sections)
              </p>
              <nav className="space-y-0.5 text-xs">
                {filteredSections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollToSection(s.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                      activeSection === s.id
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span className="truncate">
                      {s.number}. {s.title}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Section Cards */}
          <div className="space-y-6">
            {filteredSections.length === 0 ? (
              <Card className="rounded-2xl p-8 text-center text-muted-foreground">
                <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="font-medium text-foreground">No matching terms found</p>
                <p className="text-xs mt-1">Try clearing your search query to view all sections.</p>
                <Button variant="outline" size="sm" onClick={() => setSearchQuery("")} className="mt-4 rounded-full text-xs">
                  Reset Filter
                </Button>
              </Card>
            ) : (
              filteredSections.map((s) => (
                <Card
                  key={s.id}
                  id={s.id}
                  className={`scroll-mt-24 rounded-2xl border bg-card p-6 sm:p-7 shadow-sm transition-all ${
                    activeSection === s.id ? "ring-1 ring-primary/40 border-primary/30" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {s.number}
                      </span>
                      <h2 className="font-display text-lg font-semibold text-foreground">{s.title}</h2>
                    </div>
                    <Badge variant="secondary" className="text-[10px] uppercase font-semibold tracking-wider">
                      {s.category}
                    </Badge>
                  </div>
                  <div>{s.content}</div>
                </Card>
              ))
            )}

            {/* Bottom Actions Card */}
            <div className="mt-8 rounded-2xl border bg-muted/30 p-6 text-center space-y-4">
              <h3 className="font-display text-base font-semibold">Have Questions About Our Terms?</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Our support team is available to assist you with questions regarding platform terms, data handling, or
                account review.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button onClick={handleBack} className="rounded-full gradient-brand text-primary-foreground text-xs gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {fromSignup ? "Return to Sign Up Form" : "Back to Previous Page"}
                </Button>
                <a href="mailto:hello@growthos.app">
                  <Button variant="outline" className="rounded-full text-xs">
                    Contact Support
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
