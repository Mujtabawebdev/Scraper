import {
  CheckCircle2,
  Copy,
  ListChecks,
  TriangleAlert,
} from "lucide-react";

import type { ScrapingJobDetail } from "../types/scraping-job.types";

const statistics = [
  {
    key: "processedCount",
    label: "Processed",
    icon: ListChecks,
    className: "bg-blue-50 text-blue-700",
  },
  {
    key: "successCount",
    label: "Successful",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700",
  },
  {
    key: "failureCount",
    label: "Failed records",
    icon: TriangleAlert,
    className: "bg-red-50 text-red-700",
  },
  {
    key: "duplicateCount",
    label: "Duplicates",
    icon: Copy,
    className: "bg-violet-50 text-violet-700",
  },
] as const;

export function JobStatisticsCards({ job }: { job: ScrapingJobDetail }) {
  return (
    <section
      aria-labelledby="job-statistics-heading"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <h2 className="sr-only" id="job-statistics-heading">
        Job statistics
      </h2>
      {statistics.map(({ className, icon: Icon, key, label }) => (
        <div
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          key={key}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-600">{label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {job[key].toLocaleString()}
              </p>
            </div>
            <span
              aria-hidden="true"
              className={[
                "flex size-10 items-center justify-center rounded-xl",
                className,
              ].join(" ")}
            >
              <Icon className="size-5" />
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
