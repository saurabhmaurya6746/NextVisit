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
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — NextVisit" },
      {
        name: "description",
        content:
          "Comprehensive platform service agreement, user responsibilities, acceptable use, subscription policies, and legal terms for NextVisit SaaS.",
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
        title: "Introduction and Acceptance of Terms",
        category: "General",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>1.1 What NextVisit Is:</strong> NextVisit (referred to herein as{" "}
              <span className="font-semibold text-foreground">"NextVisit"</span>,{" "}
              <span className="font-semibold text-foreground">"we"</span>,{" "}
              <span className="font-semibold text-foreground">"us"</span>, or{" "}
              <span className="font-semibold text-foreground">"our"</span>) is a cloud-based Software-as-a-Service
              (SaaS) business automation and customer retention platform. NextVisit provides tools including digital QR
              ordering, visit management, automated marketing communications, customer loyalty rewards, analytics, and
              merchant operational workflows for restaurants, salons, cafes, spas, and service businesses.
            </p>
            <p>
              <strong>1.2 Agreement Between Parties:</strong> These Terms &amp; Conditions (
              <span className="font-semibold text-foreground">"Terms"</span>) constitute a legally binding agreement
              between NextVisit and the commercial entity or authorized individual (
              <span className="font-semibold text-foreground">"Business"</span>,{" "}
              <span className="font-semibold text-foreground">"Merchant"</span>,{" "}
              <span className="font-semibold text-foreground">"User"</span>, or{" "}
              <span className="font-semibold text-foreground">"you"</span>) accessing or subscribing to the Platform.
            </p>
            <p>
              <strong>1.3 Acceptance of Terms:</strong> By creating an account, clicking any checkbox or button
              indicating acceptance (such as during registration), accessing our websites, or using any part of the
              NextVisit software, you acknowledge that you have read, understood, and agreed to be bound by these Terms
              in their entirety. If you do not agree to these Terms, you must immediately cease all access and use of the
              Platform.
            </p>
            <p>
              <strong>1.4 Authority to Bind:</strong> If you are registering or acting on behalf of a company, partnership,
              or other legal entity, you represent and warrant that you possess full legal authority to bind such entity to
              these Terms.
            </p>
          </div>
        ),
      },
      {
        id: "section-2",
        number: 2,
        title: "Definitions and Interpretation",
        category: "General",
        content: (
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>Throughout these Terms, capitalized terms shall have the specific meanings assigned below:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-foreground">"Account"</strong> means the digital merchant profile, credentials,
                and associated records provisioned for a Business upon registration and approval.
              </li>
              <li>
                <strong className="text-foreground">"Administrator" or "Super Admin"</strong> means authorized NextVisit
                system personnel responsible for platform management, verification, and governance.
              </li>
              <li>
                <strong className="text-foreground">"Automated Communications"</strong> means automated WhatsApp messages,
                transactional emails, SMS alerts, review requests, customer recovery triggers, and promotional campaign
                deliveries executed through or integrated with the Platform.
              </li>
              <li>
                <strong className="text-foreground">"Business" or "Merchant"</strong> means the enterprise, sole
                proprietorship, partnership, or corporate entity on whose behalf the Platform is licensed and utilized.
              </li>
              <li>
                <strong className="text-foreground">"Content"</strong> means text, menus, pricing, graphics, images, logos,
                trademarks, promotional templates, and operational information uploaded or configured by the Business.
              </li>
              <li>
                <strong className="text-foreground">"Customer" or "End-User"</strong> means the retail client, patron, or
                diner of the Business who interacts with QR codes, receives campaigns, or visits the merchant's establishment.
              </li>
              <li>
                <strong className="text-foreground">"Owner"</strong> means the primary authorized account holder and legal
                representative associated with the Business Account.
              </li>
              <li>
                <strong className="text-foreground">"Platform"</strong> means the NextVisit cloud software, web
                applications, QR interfaces, APIs, databases, algorithms, and documentation.
              </li>
              <li>
                <strong className="text-foreground">"Services"</strong> means all software features, tools, hosted
                infrastructure, and customer support made available by NextVisit under an active Subscription or trial.
              </li>
              <li>
                <strong className="text-foreground">"Subscription"</strong> means the paid or promotional licensing tier
                granting access to specific features, quotas, and service capabilities.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: "section-3",
        number: 3,
        title: "Eligibility and Account Registration",
        category: "Account & Security",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>3.1 Eligibility Requirements:</strong> To register for NextVisit, you must be at least eighteen (18)
              years of age, operate a legitimate commercial enterprise, and possess full legal capacity to enter into
              commercial contracts.
            </p>
            <p>
              <strong>3.2 Accurate Registration Information:</strong> You agree to provide true, accurate, current, and
              complete information during registration, including your legal business name, owner contact information,
              valid business phone number, and commercial email address.
            </p>
            <p>
              <strong>3.3 One Account Per Business Establishment:</strong> Unless expressly authorized in writing by
              NextVisit for multi-location enterprise subscriptions, each business establishment shall maintain one primary
              account.
            </p>
            <p>
              <strong>3.4 Super Admin Review and Approval Process:</strong> New account submissions undergo manual or
              algorithmic review by NextVisit Administrators. Registration alone does not grant immediate platform
              activation. NextVisit reserves the absolute right to approve, request additional verification documents, or
              reject any application at its sole discretion.
            </p>
            <p>
              <strong>3.5 Reapplication Rights:</strong> In the event that an application is rejected due to incomplete or
              unverified details, the applicant may submit updated information for reconsideration in accordance with
              NextVisit's merchant onboarding protocols.
            </p>
          </div>
        ),
      },
      {
        id: "section-4",
        number: 4,
        title: "Account Security and Credentials",
        category: "Account & Security",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>4.1 Password Confidentiality &amp; Complexity:</strong> You are responsible for safeguarding your
              login credentials. NextVisit enforces rigorous password complexity rules (including length, character
              diversity, and hashing). You agree never to disclose your master password to unauthorized parties.
            </p>
            <p>
              <strong>4.2 Responsibility for Account Activity:</strong> The Business Owner is fully responsible for all
              actions, communications, orders, modifications, and financial transactions executed through their account,
              whether authorized by the Owner or performed by designated staff members.
            </p>
            <p>
              <strong>4.3 Duty to Report Breaches:</strong> You must immediately notify NextVisit at{" "}
              <a href="mailto:hello@growthos.app" className="text-primary hover:underline font-medium">
                hello@growthos.app
              </a>{" "}
              upon discovering or suspecting any unauthorized access, security incident, credential compromise, or
              suspected breach of your account.
            </p>
            <p>
              <strong>4.4 Staff Accounts and Role-Based Permissions:</strong> If you provision sub-accounts or staff
              credentials, you must ensure that each staff member adheres strictly to these Terms. You remain solely liable
              for any misconduct or unauthorized activity performed via staff credentials.
            </p>
          </div>
        ),
      },
      {
        id: "section-5",
        number: 5,
        title: "Business Information and Customer Data",
        category: "Data & Usage",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>5.1 Accuracy of Uploaded Business Data:</strong> The Business represents and warrants that all
              operating hours, menu items, service catalogs, prices, tax percentages, UPI details, and contact details
              provided on the Platform are accurate, truthful, and up-to-date.
            </p>
            <p>
              <strong>5.2 Lawful Collection of Customer Data:</strong> The Business is solely responsible for ensuring that
              all end-customer phone numbers, names, birthdates, anniversaries, visit history, and related personal
              information imported into or collected via NextVisit are acquired lawfully and transparently.
            </p>
            <p>
              <strong>5.3 Express Consent Requirement:</strong> The Business guarantees that it has obtained all necessary
              prior express consents and opt-ins from its customers required under applicable data protection, consumer
              rights, and telecommunication laws before initiating any automated marketing, WhatsApp broadcasts, or email
              campaigns.
            </p>
            <p>
              <strong>5.4 Indemnity for Customer Disputes:</strong> NextVisit operates strictly as a software processor. The
              Business shall bear sole legal liability for any consumer disputes, spam grievances, or regulatory inquiries
              arising from customer data uploaded or managed by the Business.
            </p>
          </div>
        ),
      },
      {
        id: "section-6",
        number: 6,
        title: "Platform Usage and Acceptable Use Policy",
        category: "Data & Usage",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>You agree to use NextVisit strictly for lawful commercial purposes. You expressly agree NOT to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Engage in, facilitate, or promote any illegal, fraudulent, deceptive, or unauthorized business activities;</li>
              <li>
                Transmit unsolicited bulk messages, spam, abusive promotions, or communications that violate national
                Do-Not-Disturb (DND) or telecommunication regulations;
              </li>
              <li>Harass, threaten, defame, impersonate, or violate the legal rights of any individual or entity;</li>
              <li>
                Attempt to bypass, disable, probe, or breach any security mechanism, authentication checkpoint, or rate limit
                of the Platform;
              </li>
              <li>
                Reverse-engineer, decompile, disassemble, copy, decipher, or extract source code, proprietary algorithms, or
                architectural models of NextVisit;
              </li>
              <li>
                Introduce viruses, trojans, worms, logic bombs, or other technologically malicious materials into the Platform
                infrastructure;
              </li>
              <li>
                Use automated bots, scrapers, or scripts to harvest data or generate artificial load on NextVisit servers;
              </li>
              <li>
                Resell, sub-license, rent, lease, or redistribute NextVisit software without prior explicit written agreement
                from NextVisit.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: "section-7",
        number: 7,
        title: "Automated Messaging and Communications",
        category: "Data & Usage",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>7.1 Communication Capabilities:</strong> NextVisit provides intelligent messaging modules, including:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Instant welcome messages upon customer check-in or first visit;</li>
              <li>Automated birthday and wedding anniversary celebration greetings and reward coupons;</li>
              <li>Customer recovery campaigns targeting dormant or churn-risk patrons;</li>
              <li>Loyalty tier updates, point balance summaries, and reward redemption confirmations;</li>
              <li>Google review boosters and post-visit feedback requests;</li>
              <li>Seasonal, festival, and bespoke promotional broadcasts.</li>
            </ul>
            <p>
              <strong>7.2 Merchant Responsibilities:</strong> The Business is solely responsible for: (a) verifying the
              accuracy of recipient numbers; (b) ensuring message content is truthful, non-offensive, and compliant with
              advertising standards; (c) honoring consumer opt-out requests immediately; and (d) adhering to all applicable
              telecommunication and privacy guidelines.
            </p>
            <p>
              <strong>7.3 Delivery Disclaimer:</strong> While NextVisit employs high-reliability delivery pipelines, message
              delivery depends upon mobile network operators, WhatsApp infrastructure, device connectivity, and anti-spam
              filters. NextVisit does not warrant 100% instantaneous delivery for every outgoing communication.
            </p>
          </div>
        ),
      },
      {
        id: "section-8",
        number: 8,
        title: "Third-Party Services and Integrations",
        category: "Data & Usage",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>8.1 External Integrations:</strong> NextVisit integrates with specialized third-party services,
              including but not limited to WhatsApp Business API / Meta infrastructure, Resend transactional email
              services, cloud database hosting, UPI payment providers, and mapping APIs.
            </p>
            <p>
              <strong>8.2 Third-Party Terms &amp; Outages:</strong> Your utilization of integrated features may be governed by
              the respective third party's terms of service and privacy policies. NextVisit is not liable for service
              interruptions, policy changes, account suspensions, rate limits, or network failures caused directly by
              third-party providers.
            </p>
          </div>
        ),
      },
      {
        id: "section-9",
        number: 9,
        title: "Subscriptions, Plans, and Payments",
        category: "Subscriptions",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>9.1 Subscription Plans:</strong> Access to NextVisit is offered under tiered subscription plans with
              specified quotas, feature access levels, and billing intervals as outlined in the active platform pricing
              schedules.
            </p>
            <p>
              <strong>9.2 Billing &amp; Renewal:</strong> Subscriptions are billed in advance on a recurring monthly or annual
              cycle. Unless cancelled prior to the renewal date, subscriptions automatically renew for the equivalent term.
            </p>
            <p>
              <strong>9.3 Applicable Taxes:</strong> All stated fees are exclusive of applicable statutory taxes (such as
              Goods and Services Tax / GST) unless explicitly indicated otherwise.
            </p>
            <p>
              <strong>9.4 Payment Failures:</strong> In the event of payment failure or overdue invoices, NextVisit reserves
              the right to temporarily suspend access to premium automation features, marketing queues, and reporting until
              outstanding balances are resolved.
            </p>
            <p>
              <strong>9.5 Cancellation &amp; Refund Policy:</strong> Subscriptions may be cancelled at any time through the
              merchant dashboard. Cancellations take effect at the conclusion of the current paid billing cycle. Refunds are
              governed by NextVisit's prevailing operational refund policies as defined on the platform.
            </p>
          </div>
        ),
      },
      {
        id: "section-10",
        number: 10,
        title: "Free Trials and Promotional Offers",
        category: "Subscriptions",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>10.1 Evaluation Period:</strong> NextVisit may provide complimentary evaluation periods (Free Trials)
              to newly approved merchant accounts to explore platform features.
            </p>
            <p>
              <strong>10.2 Transition to Paid Service:</strong> At the conclusion of a promotional trial, the Business may
              select an active paid subscription plan to retain uninterrupted access to automated campaigns, loyalty
              tracking, and business intelligence.
            </p>
            <p>
              <strong>10.3 Modifications to Trials:</strong> NextVisit reserves the right to modify trial durations, feature
              availability, or eligibility criteria at any time without prior liability.
            </p>
          </div>
        ),
      },
      {
        id: "section-11",
        number: 11,
        title: "Intellectual Property Rights",
        category: "General",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>11.1 NextVisit Intellectual Property:</strong> All rights, title, and interest in and to the NextVisit
              Platform—including software code, user interface designs, logos, trademarks, database architectures, graphics,
              visual workflows, documentation, and underlying proprietary algorithms—are and shall remain the exclusive
              intellectual property of NextVisit.
            </p>
            <p>
              <strong>11.2 Limited License:</strong> Subject to compliance with these Terms, NextVisit grants you a limited,
              revocable, non-exclusive, non-transferable license to access and use the Platform during your active
              subscription solely for internal business operations.
            </p>
            <p>
              <strong>11.3 Feedback:</strong> Any suggestions, enhancements, feature requests, or feedback you submit
              regarding NextVisit may be freely adopted, incorporated, or commercialized by NextVisit without obligation or
              compensation to you.
            </p>
          </div>
        ),
      },
      {
        id: "section-12",
        number: 12,
        title: "User-Submitted Content and Licenses",
        category: "General",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>12.1 Merchant Content Ownership:</strong> You retain all intellectual property rights and ownership in
              the menus, logos, photographs, business descriptions, customer data, and marketing copy you upload to the
              Platform.
            </p>
            <p>
              <strong>12.2 License to Host &amp; Process:</strong> You grant NextVisit a worldwide, non-exclusive, royalty-free
              license to store, host, reproduce, format, and transmit your Content solely to the extent necessary to provide,
              maintain, and optimize the Services for your Business.
            </p>
            <p>
              <strong>12.3 Content Representations:</strong> You warrant that your uploaded Content does not infringe upon any
              third-party copyrights, trademarks, privacy rights, or proprietary trade secrets.
            </p>
          </div>
        ),
      },
      {
        id: "section-13",
        number: 13,
        title: "Privacy and Data Protection",
        category: "Data & Usage",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>13.1 Commitment to Privacy:</strong> Your privacy and data confidentiality are of paramount importance.
              Our collection, processing, and handling of personal and operational information are governed by our
              comprehensive Privacy Policy, incorporated herein by reference.
            </p>
            <p>
              <strong>13.2 Software Processor Role:</strong> In processing end-customer records on behalf of your Business,
              NextVisit acts as a technical software processor operating under your commercial instruction.
            </p>
          </div>
        ),
      },
      {
        id: "section-14",
        number: 14,
        title: "Data Retention, Backups, and Deletion",
        category: "Data & Usage",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>14.1 Retention During Active Account:</strong> NextVisit retains your business records, customer
              profiles, transaction histories, and campaign logs throughout the duration of your active account.
            </p>
            <p>
              <strong>14.2 Account Closure &amp; Purging:</strong> Upon formal account termination, NextVisit retains records
              for a limited grace period to allow for subscription reactivation or dispute resolution. Thereafter, data is
              queued for permanent, secure deletion.
            </p>
            <p>
              <strong>14.3 Non-Instantaneous Purging:</strong> You acknowledge that routine system backups and redundant
              disaster recovery archives may retain encrypted residual snapshots for a finite operational cycle before being
              overwritten.
            </p>
          </div>
        ),
      },
      {
        id: "section-15",
        number: 15,
        title: "Service Availability and Maintenance",
        category: "Subscriptions",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>15.1 High-Availability Infrastructure:</strong> NextVisit utilizes robust cloud architecture designed for
              continuous commercial operations. However, you acknowledge that no cloud service is immune to unforeseen
              downtime.
            </p>
            <p>
              <strong>15.2 Scheduled Maintenance:</strong> NextVisit periodically performs system updates, database indexing,
              and security patches. Where feasible, maintenance windows are scheduled during off-peak commercial hours.
            </p>
            <p>
              <strong>15.3 No Guarantee of 100% Uptime:</strong> NextVisit does not guarantee uninterrupted, error-free, or
              continuous availability of the Platform at all times.
            </p>
          </div>
        ),
      },
      {
        id: "section-16",
        number: 16,
        title: "Security Safeguards and Practices",
        category: "Account & Security",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>16.1 Technical Safeguards:</strong> NextVisit implements industry-standard encryption protocols (HTTPS/TLS
              in transit and hashed credential security at rest), role-based permission boundaries, and active database access
              controls.
            </p>
            <p>
              <strong>16.2 Shared Responsibility:</strong> Security is a shared responsibility. The Business must protect its
              hardware terminals, ensure secure internet connections, and prohibit credential sharing among staff members.
            </p>
          </div>
        ),
      },
      {
        id: "section-17",
        number: 17,
        title: "Account Suspension and Termination",
        category: "Account & Security",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>17.1 Grounds for Suspension or Termination:</strong> NextVisit reserves the right to immediately suspend
              or terminate any Account with or without notice upon:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Material breach of any provision of these Terms or the Acceptable Use Policy;</li>
              <li>Repeated customer spam complaints or unauthorized commercial broadcasting;</li>
              <li>Engagement in fraudulent, deceptive, or illegal commercial practices;</li>
              <li>Non-payment of subscription dues or chargeback abuse;</li>
              <li>Attempts to compromise, probe, or breach platform infrastructure security;</li>
              <li>Receipt of binding court orders or government regulatory directives.</li>
            </ul>
            <p>
              <strong>17.2 Voluntary Termination:</strong> You may terminate your Account at any time by accessing your account
              settings or submitting a termination request to customer support.
            </p>
          </div>
        ),
      },
      {
        id: "section-18",
        number: 18,
        title: "Consequences of Termination",
        category: "Account & Security",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>18.1 Immediate Effects:</strong> Upon termination of your Account: (a) all software licenses granted to
              you terminate immediately; (b) your access to the merchant portal, QR ordering tables, and automation queues is
              disabled; and (c) all scheduled campaigns are halted.
            </p>
            <p>
              <strong>18.2 Surviving Clauses:</strong> Sections relating to Intellectual Property, Confidentiality,
              Disclaimers, Limitation of Liability, Indemnification, and Governing Law shall survive termination.
            </p>
          </div>
        ),
      },
      {
        id: "section-19",
        number: 19,
        title: "Disclaimers and Warranties",
        category: "Legal & Disclaimers",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>19.1 "As Is" and "As Available":</strong> The NextVisit Platform and all associated services are provided
              on an <span className="font-semibold text-foreground">"AS IS"</span> and{" "}
              <span className="font-semibold text-foreground">"AS AVAILABLE"</span> basis without warranties of any kind,
              either express, implied, statutory, or otherwise.
            </p>
            <p>
              <strong>19.2 Commercial Outcome Disclaimers:</strong> NextVisit explicitly disclaims any warranty or guarantee
              that the Platform will: (a) increase your business revenue or foot traffic; (b) guarantee specific customer
              acquisition or retention numbers; (c) generate positive review ratings; or (d) deliver messages in all network
              scenarios.
            </p>
          </div>
        ),
      },
      {
        id: "section-20",
        number: 20,
        title: "Limitation of Liability",
        category: "Legal & Disclaimers",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>20.1 Exclusion of Indirect Damages:</strong> To the maximum extent permitted by applicable law, in no
              event shall NextVisit, its founders, directors, employees, affiliates, or licensors be liable for any indirect,
              incidental, special, consequential, punitive, or exemplary damages, including but not limited to loss of profits,
              loss of goodwill, loss of customer relationships, loss of data, business interruption, or system downtime.
            </p>
            <p>
              <strong>20.2 Total Liability Cap:</strong> In all circumstances, NextVisit's total aggregate liability arising out
              of or related to these Terms or your use of the Platform shall be strictly capped at the total amount actually
              paid by you to NextVisit in the twelve (12) months immediately preceding the event giving rise to liability.
            </p>
          </div>
        ),
      },
      {
        id: "section-21",
        number: 21,
        title: "Indemnification",
        category: "Legal & Disclaimers",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              You agree to defend, indemnify, and hold harmless NextVisit, its officers, directors, employees, and agents from
              and against any and all claims, damages, obligations, losses, liabilities, costs, or debt, and expenses (including
              reasonable legal fees) arising from:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Your violation of any provision of these Terms or the Acceptable Use Policy;</li>
              <li>Your violation of any third-party rights, including privacy, publicity, or intellectual property rights;</li>
              <li>
                Any consumer grievances or regulatory fines arising from communications dispatched to customer phone numbers
                uploaded by your Business;
              </li>
              <li>Any food, salon, or retail dispute between your Business and your retail customers.</li>
            </ul>
          </div>
        ),
      },
      {
        id: "section-22",
        number: 22,
        title: "Changes to the Platform",
        category: "General",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              NextVisit continuously innovates to improve functionality. We reserve the right to update, upgrade, modify, or
              temporarily or permanently discontinue specific features, workflows, or integrations at our discretion. Where
              material changes impact active subscribers, reasonable notice will be provided via dashboard announcements or
              email.
            </p>
          </div>
        ),
      },
      {
        id: "section-23",
        number: 23,
        title: "Changes to Terms",
        category: "General",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              NextVisit reserves the right to modify or replace these Terms at any time. When modifications occur, we will
              update the "Last Updated" date at the top of this document. Continued access or use of the Platform following the
              effective date of revised Terms constitutes your full acceptance of the revised Terms.
            </p>
          </div>
        ),
      },
      {
        id: "section-24",
        number: 24,
        title: "Governing Law and Dispute Resolution",
        category: "Legal & Disclaimers",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong>24.1 Governing Jurisdiction:</strong> These Terms and any dispute or claim arising out of or in connection
              with them shall be governed by and construed in accordance with the laws of{" "}
              <span className="font-semibold text-foreground">
                [Applicable jurisdiction to be specified by NextVisit operator]
              </span>
              .
            </p>
            <p>
              <strong>24.2 Amicable Resolution:</strong> Before initiating formal legal proceedings, the parties agree to
              attempt to resolve any dispute through informal good-faith negotiations by notifying{" "}
              <a href="mailto:hello@growthos.app" className="text-primary hover:underline font-medium">
                hello@growthos.app
              </a>
              .
            </p>
          </div>
        ),
      },
      {
        id: "section-25",
        number: 25,
        title: "Severability",
        category: "Legal & Disclaimers",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court of competent
              jurisdiction, such provision shall be modified to the minimum extent necessary to make it enforceable, and the
              remaining provisions shall continue in full force and effect.
            </p>
          </div>
        ),
      },
      {
        id: "section-26",
        number: 26,
        title: "Waiver",
        category: "Legal & Disclaimers",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              No failure or delay by NextVisit in exercising any right, power, or privilege under these Terms shall operate as a
              waiver thereof, nor shall any single or partial exercise preclude any other or further exercise thereof.
            </p>
          </div>
        ),
      },
      {
        id: "section-27",
        number: 27,
        title: "Entire Agreement",
        category: "General",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              These Terms, together with the Privacy Policy and any active Subscription documentation, constitute the entire
              agreement between you and NextVisit regarding the Platform and supersede all prior understandings, agreements, or
              representations.
            </p>
          </div>
        ),
      },
      {
        id: "section-28",
        number: 28,
        title: "Assignment",
        category: "General",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              You may not assign, transfer, or delegate your rights or obligations under these Terms without prior written
              consent from NextVisit. NextVisit may assign or transfer its rights and obligations freely in connection with a
              merger, acquisition, or sale of assets.
            </p>
          </div>
        ),
      },
      {
        id: "section-29",
        number: 29,
        title: "Force Majeure",
        category: "Legal & Disclaimers",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Neither party shall be liable for any failure or delay in performing its obligations (except payment obligations)
              due to causes beyond its reasonable control, including acts of God, war, terrorism, civil unrest, labor disputes,
              telecommunication outages, internet service provider failures, or government restrictions.
            </p>
          </div>
        ),
      },
      {
        id: "section-30",
        number: 30,
        title: "Contact Information and Legal Inquiries",
        category: "General",
        content: (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>For questions, formal notices, compliance inquiries, or clarifications regarding these Terms, please contact:</p>
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
                    <a href="mailto:hello@growthos.app" className="text-primary hover:underline">
                      hello@growthos.app
                    </a>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    <strong>Support Phone:</strong>{" "}
                    <a href="tel:9555702945" className="text-primary hover:underline">
                      +91 9555702945
                    </a>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    <strong>Admin Verification:</strong> Super Admin Governance Team
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

  // Scrollspy to highlight active section
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
        {/* Top Breadcrumb & Return Bar */}
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
              Version 2.4
            </Badge>
            <Badge variant="outline" className="rounded-full gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> Last Updated: August 18, 2026
            </Badge>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Terms &amp; Conditions
          </h1>
          <p className="mt-2 max-w-3xl text-sm sm:text-base text-muted-foreground leading-relaxed">
            Please review these comprehensive terms carefully before accessing or using NextVisit. This agreement
            governs your subscription, business account rights, customer messaging compliance, intellectual property, and
            limitations of liability.
          </p>

          {/* Quick Notice Card */}
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Important Notice for Merchant Accounts:</p>
              <p className="text-muted-foreground leading-relaxed">
                By creating an account and obtaining Super Admin approval, your business agrees to maintain lawful customer
                consent for automated WhatsApp and promotional campaigns, preserve credential security, and adhere to
                applicable telecommunication and commercial regulations.
              </p>
            </div>
          </div>

          {/* In-Page Search */}
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

        {/* Content Layout with Sticky Sidebar */}
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          {/* Table of Contents Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border bg-card/60 p-4 backdrop-blur shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 mb-2">
                Table of Contents (30 Sections)
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

          {/* Sections List */}
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

            {/* Bottom Actions Bar */}
            <div className="mt-8 rounded-2xl border bg-muted/30 p-6 text-center space-y-4">
              <h3 className="font-display text-base font-semibold">Have Questions About Our Terms?</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Our support and legal compliance team is available to assist you with any questions regarding platform
                policies, data rights, or subscriptions.
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
