import { AppLink } from "@/lib/app-nav";
import { Link } from "@tanstack/react-router";
import { Flame, Lock } from "lucide-react";
import { useCurrentClient, TRIAL_DAYS_TOTAL } from "@/lib/clients-store";

export function TrialBanner() {
  const c = useCurrentClient();
  if (!c || !c.trialEnd) return null;
  if (c.isTrialExpired) {
    return (
      <div className="flex items-center gap-3 border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
        <Lock className="h-4 w-4" />
        <span>Your trial has expired. Please upgrade to continue.</span>
        <AppLink path="subscription" className="ml-auto rounded-full bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground">Upgrade now</AppLink>
      </div>
    );
  }
  const days = c.trialDaysRemaining ?? 0;
  if (days > TRIAL_DAYS_TOTAL) return null;
  return (
    <AppLink path="subscription" className="flex items-center gap-3 border-b bg-primary/5 px-4 py-2 text-sm hover:bg-primary/10">
      <Flame className="h-4 w-4 text-primary" />
      <span>🔥 Your 14-day free trial ends in <span className="font-semibold">{days} day{days === 1 ? "" : "s"}</span>. Upgrade now!</span>
      <span className="ml-auto rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Upgrade</span>
    </AppLink>
  );
}