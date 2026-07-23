import { SearchX, UsersRound } from "lucide-react";

import { EmptyState } from "../../../components/feedback/empty-state";

export function LeadEmptyState({ filtered = false }: { filtered?: boolean }) {
  return (
    <EmptyState
      description={
        filtered
          ? "No leads match the current filters. Adjust or clear them to broaden the results."
          : "Completed scraping jobs will add their collected business leads here."
      }
      icon={
        filtered ? (
          <SearchX aria-hidden="true" className="size-6" />
        ) : (
          <UsersRound aria-hidden="true" className="size-6" />
        )
      }
      title={filtered ? "No matching leads" : "No leads collected yet"}
    />
  );
}
