import { LoginShell } from "@/components/login-shell";

export default function LoginAdmin() {
  return (
    <LoginShell
      role="Super Admin"
      target="/admin"
      tagline="One console for every client, every plan, every dollar."
      quote="NextVisit gave us the leverage to onboard 200+ merchants without adding a single ops person."
      author="Iris Novak, Platform Lead"
    />
  );
}