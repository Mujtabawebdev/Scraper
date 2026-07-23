import type { ReactNode } from "react";

import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { getApiErrorMessage } from "../../../services/api-client";

export function AdminPageHeader({
  action,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-violet-700">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">{description}</p>
      </div>
      {action}
    </header>
  );
}

export function AdminQueryError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Alert title="Could not load admin data" variant="error">
      <p>{getApiErrorMessage(error)}</p>
      <Button className="mt-3" onClick={onRetry} size="sm" variant="outline">
        Try again
      </Button>
    </Alert>
  );
}
