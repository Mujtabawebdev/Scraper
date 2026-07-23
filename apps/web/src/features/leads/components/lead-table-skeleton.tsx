import { Skeleton } from "../../../components/ui/skeleton";

export function LeadTableSkeleton() {
  return (
    <div aria-label="Loading leads" className="space-y-3 p-4" role="status">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          className="grid grid-cols-4 gap-4 rounded-xl border border-slate-100 p-4"
          key={index}
        >
          <Skeleton className="h-5" />
          <Skeleton className="h-5" />
          <Skeleton className="h-5" />
          <Skeleton className="h-5" />
        </div>
      ))}
      <span className="sr-only">Loading business leads</span>
    </div>
  );
}
