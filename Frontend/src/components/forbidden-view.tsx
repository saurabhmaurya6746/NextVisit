import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLink } from "@/lib/app-nav";

export function ForbiddenView({ moduleName = "this page" }: { moduleName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10 text-destructive mb-4">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold font-display text-foreground">403 Forbidden — Access Denied</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        You do not have permission to access <strong className="text-foreground">{moduleName}</strong>.
        Please contact your Business Owner to assign access to this module.
      </p>
      <div className="mt-6">
        <Button asChild className="rounded-full gradient-brand text-primary-foreground">
          <AppLink path="dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Return to Dashboard
          </AppLink>
        </Button>
      </div>
    </div>
  );
}
