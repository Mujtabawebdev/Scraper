import { BriefcaseBusiness, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "../../../components/feedback/empty-state";

export function JobEmptyState({ filtered = false }: { filtered?: boolean }) {
  return (
    <EmptyState
      action={
        filtered ? undefined : (
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            to="/dashboard/jobs/new"
          >
            <Plus aria-hidden="true" className="size-4" />
            Create your first job
          </Link>
        )
      }
      description={
        filtered
          ? "No jobs match the current filters. Adjust or clear them to see more results."
          : "Create a permitted fixture collection job to begin gathering business leads."
      }
      icon={<BriefcaseBusiness aria-hidden="true" className="size-6" />}
      title={filtered ? "No matching jobs" : "No scraping jobs yet"}
    />
  );
}
