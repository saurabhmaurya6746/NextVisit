import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const internalRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => internalRef.current as HTMLInputElement);

    const toggleVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const input = internalRef.current;
      if (input) {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        setShowPassword((prev) => !prev);
        requestAnimationFrame(() => {
          input.focus();
          if (start !== null && end !== null) {
            input.setSelectionRange(start, end);
          }
        });
      } else {
        setShowPassword((prev) => !prev);
      }
    };

    return (
      <div className="relative flex items-center w-full">
        <input
          type={showPassword ? "text" : "password"}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-10 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
          ref={internalRef}
          disabled={disabled}
          {...props}
        />
        <button
          type="button"
          onClick={toggleVisibility}
          disabled={disabled}
          tabIndex={-1}
          className="absolute right-3 grid h-6 w-6 place-items-center text-muted-foreground hover:text-foreground focus:outline-none disabled:opacity-50"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
