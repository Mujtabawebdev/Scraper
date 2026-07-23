import { ChevronLeft, ChevronRight } from "lucide-react";

import type { PaginationMetadata } from "@lead-saas/shared-types";

import { Button } from "../ui/button";

export interface PaginationControlsProps {
  disabled?: boolean;
  onPageChange: (page: number) => void;
  pagination: PaginationMetadata;
}

export function PaginationControls({
  disabled = false,
  onPageChange,
  pagination,
}: PaginationControlsProps) {
  if (pagination.totalPages === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-slate-600">
        Page <span className="font-semibold">{pagination.page}</span> of{" "}
        <span className="font-semibold">{pagination.totalPages}</span>
        <span className="hidden sm:inline">
          {" "}
          ({pagination.totalItems.toLocaleString()} total)
        </span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          aria-label="Go to previous page"
          disabled={disabled || !pagination.hasPreviousPage}
          onClick={() => onPageChange(pagination.page - 1)}
          size="sm"
          variant="outline"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Previous
        </Button>
        <Button
          aria-label="Go to next page"
          disabled={disabled || !pagination.hasNextPage}
          onClick={() => onPageChange(pagination.page + 1)}
          size="sm"
          variant="outline"
        >
          Next
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
