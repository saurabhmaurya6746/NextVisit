import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <div className={`mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl ${destructive ? "bg-destructive/15 text-destructive" : "gradient-brand text-primary-foreground shadow-glow"}`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center font-display">{title}</DialogTitle>
          {description && <DialogDescription className="text-center">{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
          <Button
            className={`rounded-full ${destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "gradient-brand text-primary-foreground"}`}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}