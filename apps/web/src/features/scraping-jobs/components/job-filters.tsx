import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { useDebouncedValue } from "../../../hooks/use-debounced-value";
import {
  APPROVED_SOURCE_OPTIONS,
  DEFAULT_JOB_FILTERS,
  JOB_SORT_FIELDS,
  SCRAPING_JOB_STATUSES,
  type ApprovedScrapingSource,
  type JobSortField,
  type ScrapingJobListFilters,
  type ScrapingJobStatus,
  type SortOrder,
} from "../types/scraping-job.types";

export interface JobFiltersProps {
  disabled?: boolean;
  filters: ScrapingJobListFilters;
  onChange: (filters: ScrapingJobListFilters) => void;
}

const withoutOptionalFilter = <
  TKey extends "status" | "source" | "search" | "createdFrom" | "createdTo",
>(
  filters: ScrapingJobListFilters,
  key: TKey,
): ScrapingJobListFilters => {
  const copy = { ...filters };
  delete copy[key];
  return copy;
};

export function JobFilters({
  disabled = false,
  filters,
  onChange,
}: JobFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search ?? "");
  const debouncedSearch = useDebouncedValue(searchValue);

  useEffect(() => {
    setSearchValue(filters.search ?? "");
  }, [filters.search]);

  useEffect(() => {
    const normalized = debouncedSearch.trim();
    if (normalized === (filters.search ?? "")) return;
    const next = withoutOptionalFilter(filters, "search");
    onChange({
      ...next,
      page: 1,
      ...(normalized ? { search: normalized } : {}),
    });
  }, [debouncedSearch, filters, onChange]);

  const updateStatus = (value: string) => {
    const next = withoutOptionalFilter(filters, "status");
    onChange({
      ...next,
      page: 1,
      ...(value ? { status: value as ScrapingJobStatus } : {}),
    });
  };

  const updateSource = (value: string) => {
    const next = withoutOptionalFilter(filters, "source");
    onChange({
      ...next,
      page: 1,
      ...(value ? { source: value as ApprovedScrapingSource } : {}),
    });
  };

  const updateDate = (
    key: "createdFrom" | "createdTo",
    value: string,
  ) => {
    const next = withoutOptionalFilter(filters, key);
    onChange({
      ...next,
      page: 1,
      ...(value ? { [key]: value } : {}),
    });
  };

  const hasFilters =
    Boolean(filters.search) ||
    Boolean(filters.status) ||
    Boolean(filters.source) ||
    Boolean(filters.createdFrom) ||
    Boolean(filters.createdTo) ||
    filters.sortBy !== DEFAULT_JOB_FILTERS.sortBy ||
    filters.sortOrder !== DEFAULT_JOB_FILTERS.sortOrder;

  return (
    <section
      aria-labelledby="job-filters-heading"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2
          className="flex items-center gap-2 text-sm font-semibold text-slate-900"
          id="job-filters-heading"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Filter jobs
        </h2>
        {hasFilters ? (
          <Button
            disabled={disabled}
            onClick={() => onChange(DEFAULT_JOB_FILTERS)}
            size="sm"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" />
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sm:col-span-2">
          <Label htmlFor="job-search">Search query or location</Label>
          <div className="relative mt-1.5">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-3 size-5 text-slate-400"
            />
            <Input
              className="pl-10"
              disabled={disabled}
              id="job-search"
              maxLength={100}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search jobs..."
              type="search"
              value={searchValue}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="job-status-filter">Status</Label>
          <Select
            className="mt-1.5"
            disabled={disabled}
            id="job-status-filter"
            onChange={(event) => updateStatus(event.target.value)}
            value={filters.status ?? ""}
          >
            <option value="">All statuses</option>
            {SCRAPING_JOB_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="job-source-filter">Source</Label>
          <Select
            className="mt-1.5"
            disabled={disabled}
            id="job-source-filter"
            onChange={(event) => updateSource(event.target.value)}
            value={filters.source ?? ""}
          >
            <option value="">All sources</option>
            {APPROVED_SOURCE_OPTIONS.map((source) => (
              <option key={source.value} value={source.value}>
                {source.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="job-sort-by">Sort by</Label>
          <Select
            className="mt-1.5"
            disabled={disabled}
            id="job-sort-by"
            onChange={(event) =>
              onChange({
                ...filters,
                page: 1,
                sortBy: event.target.value as JobSortField,
              })
            }
            value={filters.sortBy}
          >
            {JOB_SORT_FIELDS.map((field) => (
              <option key={field} value={field}>
                {field === "createdAt"
                  ? "Created"
                  : field === "updatedAt"
                    ? "Updated"
                    : field === "progressPercentage"
                      ? "Progress"
                      : field === "successCount"
                        ? "Leads"
                        : "Status"}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="job-sort-order">Sort order</Label>
          <Select
            className="mt-1.5"
            disabled={disabled}
            id="job-sort-order"
            onChange={(event) =>
              onChange({
                ...filters,
                page: 1,
                sortOrder: event.target.value as SortOrder,
              })
            }
            value={filters.sortOrder}
          >
            <option value="desc">Newest / highest first</option>
            <option value="asc">Oldest / lowest first</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="job-created-from">Created from</Label>
          <Input
            className="mt-1.5"
            disabled={disabled}
            id="job-created-from"
            onChange={(event) =>
              updateDate("createdFrom", event.target.value)
            }
            type="date"
            value={filters.createdFrom ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="job-created-to">Created to</Label>
          <Input
            className="mt-1.5"
            disabled={disabled}
            id="job-created-to"
            onChange={(event) => updateDate("createdTo", event.target.value)}
            type="date"
            value={filters.createdTo ?? ""}
          />
        </div>
      </div>
    </section>
  );
}
