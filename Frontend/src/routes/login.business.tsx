import { createFileRoute } from "@tanstack/react-router";
import { LoginShell } from "@/components/login-shell";

export const Route = createFileRoute("/login/business")({
  head: () => ({ meta: [{ title: "Business sign in — NextVisit" }, { name: "description", content: "Sign in to your NextVisit business dashboard." }] }),
  component: () => (
    <LoginShell
      role="Business Owner"
      target="/app"
      tagline="Turn every walk-in into a regular — on autopilot."
      quote="Our repeat rate went from 34% to 61% in three months. Birthdays alone paid for the plan."
      author="Marco De Luca, The Daily Grind Café"
    />
  ),
});