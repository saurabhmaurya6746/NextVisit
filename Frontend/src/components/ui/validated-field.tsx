import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface ValidatedFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  touched?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function ValidatedField({
  label,
  required,
  error,
  touched,
  className,
  children,
}: ValidatedFieldProps) {
  const showError = Boolean(touched && error);

  return (
    <div className={cn("space-y-1.5 w-full", className)}>
      {label && (
        <Label className="text-xs font-semibold flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-destructive font-bold">*</span>}
        </Label>
      )}
      <div className="relative">
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return child;
          return React.cloneElement(child, {
            className: cn(
              child.props.className,
              showError && "border-destructive focus-visible:ring-destructive"
            ),
          } as any);
        })}
      </div>
      {showError && (
        <p className="text-[11px] font-medium text-destructive animate-in fade-in-50 duration-150">
          {error}
        </p>
      )}
    </div>
  );
}
