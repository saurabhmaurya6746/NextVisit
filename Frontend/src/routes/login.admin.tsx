import { createFileRoute } from "@tanstack/react-router";
import { LoginShell } from "@/components/login-shell";

export const Route = createFileRoute("/login/admin")({
  head: () => ({ meta: [{ title: "Admin sign in — NextVisit" }, { name: "description", content: "Sign in to the NextVisit Super Admin console." }] }),
  component: () => (
    <LoginShell
      role="Super Admin"
      target="/admin"
      tagline="One console for every client, every plan, every dollar."
      quote="NextVisit gave us the leverage to onboard 200+ merchants without adding a single ops person."
      author="Iris Novak, Platform Lead"
    />
  ),
});