import { LoginShell } from "@/components/login-shell";

export default function LoginBusiness() {
  return (
    <LoginShell
      role="Business Owner"
      target="/app"
      tagline="Turn every walk-in into a regular — on autopilot."
      quote="Our repeat rate went from 34% to 61% in three months. Birthdays alone paid for the plan."
      author="Marco De Luca, The Daily Grind Café"
    />
  );
}