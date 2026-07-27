import { cn } from "@/lib/utils";
import logo from "@/assets/nextvisit-logo.png";

export function BrandLogo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/20 dark:bg-muted/40 p-1">
        <img
          src={logo}
          alt="NextVisit"
          className="h-8 w-8 object-contain transition-all dark:brightness-110 dark:contrast-110"
        />
      </div>

      {showText && (
        <span className="font-display text-lg font-bold tracking-tight text-foreground">
          Next<span className="gradient-text">Visit</span>
        </span>
      )}
    </div>
  );
}