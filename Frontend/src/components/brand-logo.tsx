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
      <img
        src={logo}
        alt="NextVisit"
        className="h-16 w-16 object-contain"
        style={{ 
          background: "transparent",
          mixBlendMode: "multiply"
        }}
      />

      {showText && (
        <span className="font-display text-lg font-bold tracking-tight">
          Next<span className="gradient-text">Visit</span>
        </span>
      )}
    </div>
  );
}