import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "../../../components/ui/button";

export function AdminDialog({
  children,
  confirmLabel,
  danger = false,
  isPending = false,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      aria-labelledby="admin-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold text-slate-950" id="admin-dialog-title">
          {title}
        </h2>
        <div className="mt-3 space-y-4 text-sm text-slate-600">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            disabled={isPending}
            onClick={onCancel}
            ref={cancelRef}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            isLoading={isPending}
            loadingText="Saving"
            onClick={onConfirm}
            variant={danger ? "danger" : "primary"}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
