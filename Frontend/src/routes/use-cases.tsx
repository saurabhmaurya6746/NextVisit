import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { UtensilsCrossed, Scissors, Sparkles, Coffee, Check } from "lucide-react";

export const Route = createFileRoute("/use-cases")({
  head: () => ({ meta: [
    { title: "Use Cases — NextVisit" },
    { name: "description", content: "See how restaurants, salons, spas and cafés use NextVisit to grow repeat revenue on autopilot." },
    { property: "og:title", content: "Use Cases — NextVisit" },
    { property: "og:description", content: "Real-world scenarios showing how local businesses grow with NextVisit." },
  ] }),
  component: UseCasesPage,
});

const cases = [
  {
    icon: UtensilsCrossed,
    tag: "For Restaurants",
    title: "Turn one-time diners into weekly regulars",
    problem: "Walk-ins never come back and there's no way to reach them after they leave.",
    solution: "Capture every guest at checkout or QR order, then run birthday, anniversary and win-back WhatsApp campaigns on autopilot.",
    outcomes: ["Repeat rate up 2–3x in 90 days", "Table sessions with itemized bills & GST", "QR self-ordering linked to customer phone"],
  },
  {
    icon: Scissors,
    tag: "For Salons",
    title: "Fill empty chairs without discounting",
    problem: "Clients disappear after 2–3 visits and stylists rely on manual reminders.",
    solution: "Track every appointment, auto-nudge clients due for a rebook, and reward loyalty with points that clients actually redeem.",
    outcomes: ["Rebook rate up to 60%+", "Staff-wise appointment calendar", "Automated review requests to Google"],
  },
  {
    icon: Sparkles,
    tag: "For Spas & Beauty Clinics",
    title: "Grow high-ticket packages with VIP care",
    problem: "Top clients aren't recognized and package renewals slip through the cracks.",
    solution: "Auto-tag VIPs by spend, send personalized WhatsApp offers, and run festival campaigns to your best customers first.",
    outcomes: ["VIP segmentation by lifetime value", "Anniversary & festival campaign flows", "WhatsApp history on every profile"],
  },
  {
    icon: Coffee,
    tag: "For Cafés",
    title: "Reward loyalty without a plastic card",
    problem: "Regulars come daily but there's no way to thank them or increase basket size.",
    solution: "Every ₹ spent earns points automatically. Guests see rewards after each order and get birthday freebies on WhatsApp.",
    outcomes: ["Configurable points & bonuses", "QR ordering with instant loyalty", "Birthday & 'we miss you' recovery flows"],
  },
];

function UseCasesPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 gradient-mesh" />
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Use Cases</p>
          <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Built for the businesses people love coming back to.</h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">One platform that adapts to how you actually run — whether that's tables, chairs, treatment rooms or the espresso bar.</p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {cases.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.title} className="rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl gradient-brand text-primary-foreground shadow-glow">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">{c.tag}</p>
                </div>
                <h2 className="mt-4 font-display text-xl font-semibold">{c.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">Problem: </span>{c.problem}</p>
                <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">Solution: </span>{c.solution}</p>
                <ul className="mt-4 space-y-1.5">
                  {c.outcomes.map((o) => (
                    <li key={o} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 flex-none text-primary" />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}