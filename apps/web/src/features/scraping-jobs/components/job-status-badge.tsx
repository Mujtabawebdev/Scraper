import {
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock3,
  LoaderCircle,
  XCircle,
} from "lucide-react";

import type { ScrapingJobStatus } from "../types/scraping-job.types";

const statusPresentation: Record<
  ScrapingJobStatus,
  {
    className: string;
    icon: typeof Clock3;
    label: string;
  }
> = {
  PENDING: {
    className: "bg-slate-100 text-slate-700 ring-slate-200",
    icon: Clock3,
    label: "Pending",
  },
  QUEUED: {
    className: "bg-blue-50 text-blue-800 ring-blue-200",
    icon: CircleDashed,
    label: "Queued",
  },
  RUNNING: {
    className: "bg-amber-50 text-amber-900 ring-amber-200",
    icon: LoaderCircle,
    label: "Running",
  },
  COMPLETED: {
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    icon: CheckCircle2,
    label: "Completed",
  },
  FAILED: {
    className: "bg-red-50 text-red-800 ring-red-200",
    icon: XCircle,
    label: "Failed",
  },
  CANCELLED: {
    className: "bg-violet-50 text-violet-800 ring-violet-200",
    icon: Ban,
    label: "Cancelled",
  },
};

export function JobStatusBadge({ status }: { status: ScrapingJobStatus }) {
  const presentation = statusPresentation[status];
  const Icon = presentation.icon;

  return (
    <span
      aria-label={`Job status: ${presentation.label}`}
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        presentation.className,
      ].join(" ")}
    >
      <Icon
        aria-hidden="true"
        className={[
          "size-3.5",
          status === "RUNNING" ? "animate-spin motion-reduce:animate-none" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {presentation.label}
    </span>
  );
}
