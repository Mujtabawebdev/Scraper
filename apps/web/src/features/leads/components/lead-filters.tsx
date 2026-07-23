import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { useDebouncedValue } from "../../../hooks/use-debounced-value";
import type { ScrapingJobSummary } from "../../scraping-jobs/types/scraping-job.types";
import {
  DEFAULT_LEAD_FILTERS,
  LEAD_SORT_FIELDS,
  type LeadListFilters,
  type LeadSortField,
  type SortOrder,
} from "../types/lead.types";

export interface LeadFiltersProps {
  disabled?: boolean;
  filters: LeadListFilters;
  jobs?: ScrapingJobSummary[];
  onChange: (filters: LeadListFilters) => void;
}

type OptionalLeadFilter =
  | "search"
  | "jobId"
  | "source"
  | "category"
  | "city"
  | "state"
  | "hasPhone"
  | "hasEmail"
  | "hasWebsite"
  | "createdFrom"
  | "createdTo";

const withoutOptionalFilter = (
  filters: LeadListFilters,
  key: OptionalLeadFilter,
): LeadListFilters => {
  const copy = { ...filters };
  delete copy[key];
  return copy;
};

const readBooleanFilter = (value: string): boolean | undefined => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

export function LeadFilters({
  disabled = false,
  filters,
  jobs = [],
  onChange,
}: LeadFiltersProps) {
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

  const updateTextFilter = (
    key:
      | "jobId"
      | "source"
      | "category"
      | "city"
      | "state"
      | "createdFrom"
      | "createdTo",
    value: string,
  ) => {
    const next = withoutOptionalFilter(filters, key);
    const normalized = value.trim();
    onChange({
      ...next,
      page: 1,
      ...(normalized ? { [key]: normalized } : {}),
    });
  };

  const updateBooleanFilter = (
    key: "hasPhone" | "hasEmail" | "hasWebsite",
    value: string,
  ) => {
    const next = withoutOptionalFilter(filters, key);
    const booleanValue = readBooleanFilter(value);
    onChange({
      ...next,
      page: 1,
      ...(booleanValue !== undefined ? { [key]: booleanValue } : {}),
    });
  };

  const hasFilters =
    Boolean(filters.search) ||
    Boolean(filters.jobId) ||
    Boolean(filters.source) ||
    Boolean(filters.category) ||
    Boolean(filters.city) ||
    Boolean(filters.state) ||
    filters.hasPhone !== undefined ||
    filters.hasEmail !== undefined ||
    filters.hasWebsite !== undefined ||
    Boolean(filters.createdFrom) ||
    Boolean(filters.createdTo) ||
    filters.sortBy !== DEFAULT_LEAD_FILTERS.sortBy ||
    filters.sortOrder !== DEFAULT_LEAD_FILTERS.sortOrder ||
    filters.pageSize !== DEFAULT_LEAD_FILTERS.pageSize;

  const selectedJobIsMissing =
    filters.jobId && !jobs.some((job) => job.id === filters.jobId);

  return (
    <section
      aria-labelledby="lead-filters-heading"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2
          className="flex items-center gap-2 text-sm font-semibold text-slate-900"
          id="lead-filters-heading"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Filter leads
        </h2>
        {hasFilters ? (
          <Button
            disabled={disabled}
            onClick={() => onChange(DEFAULT_LEAD_FILTERS)}
            size="sm"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" />
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div className="sm:col-span-2">
          <Label htmlFor="lead-search">Search leads</Label>
          <div className="relative mt-1.5">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-3 size-5 text-slate-400"
            />
            <Input
              className="pl-10"
              disabled={disabled}
              id="lead-search"
              maxLength={100}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Business, phone, email, website, city or state..."
              type="search"
              value={searchValue}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="lead-job-filter">Job</Label>
          <Select
            className="mt-1.5"
            disabled={disabled}
            id="lead-job-filter"
            onChange={(event) =>
              updateTextFilter("jobId", event.target.value)
            }
            value={filters.jobId ?? ""}
          >
            <option value="">All jobs</option>
            {selectedJobIsMissing ? (
              <option value={filters.jobId}>Selected job</option>
            ) : null}
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.searchQuery} — {job.location}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="lead-source-filter">Source</Label>
          <Select
            className="mt-1.5"
            disabled={disabled}
            id="lead-source-filter"
            onChange={(event) =>
              updateTextFilter("source", event.target.value)
            }
            value={filters.source ?? ""}
          >
            <option value="">All sources</option>
              <option value="fixture-business-directory">
                Fixture business directory
              </option>
              <option value="permitted-http-directory">
                Approved development directory
              </option>
            </Select>
        </div>
        <div>
          <Label htmlFor="lead-category-filter">Category</Label>
          <Input
            className="mt-1.5"
            disabled={disabled}
            id="lead-category-filter"
            maxLength={150}
            onChange={(event) =>
              updateTextFilter("category", event.target.value)
            }
            placeholder="e.g. Plumbing"
            value={filters.category ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="lead-city-filter">City</Label>
          <Input
            className="mt-1.5"
            disabled={disabled}
            id="lead-city-filter"
            maxLength={120}
            onChange={(event) => updateTextFilter("city", event.target.value)}
            placeholder="e.g. Austin"
            value={filters.city ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="lead-state-filter">State</Label>
          <Input
            className="mt-1.5"
            disabled={disabled}
            id="lead-state-filter"
            maxLength={100}
            onChange={(event) => updateTextFilter("state", event.target.value)}
            placeholder="e.g. TX"
            value={filters.state ?? ""}
          />
        </div>
        {[
          ["hasPhone", "Has phone"],
          ["hasEmail", "Has email"],
          ["hasWebsite", "Has website"],
        ].map(([key, label]) => (
          <div key={key}>
            <Label htmlFor={`lead-${key}-filter`}>{label}</Label>
            <Select
              className="mt-1.5"
              disabled={disabled}
              id={`lead-${key}-filter`}
              onChange={(event) =>
                updateBooleanFilter(
                  key as "hasPhone" | "hasEmail" | "hasWebsite",
                  event.target.value,
                )
              }
              value={
                filters[key as "hasPhone" | "hasEmail" | "hasWebsite"] ===
                undefined
                  ? ""
                  : String(
                      filters[
                        key as "hasPhone" | "hasEmail" | "hasWebsite"
                      ],
                    )
              }
            >
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </Select>
          </div>
        ))}
        <div>
          <Label htmlFor="lead-sort-by">Sort by</Label>
          <Select
            className="mt-1.5"
            disabled={disabled}
            id="lead-sort-by"
            onChange={(event) =>
              onChange({
                ...filters,
                page: 1,
                sortBy: event.target.value as LeadSortField,
              })
            }
            value={filters.sortBy}
          >
            {LEAD_SORT_FIELDS.map((field) => (
              <option key={field} value={field}>
                {field === "createdAt"
                  ? "Collected date"
                  : field === "businessName"
                    ? "Business name"
                    : field.charAt(0).toUpperCase() + field.slice(1)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="lead-sort-order">Sort order</Label>
          <Select
            className="mt-1.5"
            disabled={disabled}
            id="lead-sort-order"
            onChange={(event) =>
              onChange({
                ...filters,
                page: 1,
                sortOrder: event.target.value as SortOrder,
              })
            }
            value={filters.sortOrder}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="lead-page-size">Rows per page</Label>
          <Select
            className="mt-1.5"
            disabled={disabled}
            id="lead-page-size"
            onChange={(event) =>
              onChange({
                ...filters,
                page: 1,
                pageSize: Number(event.target.value),
              })
            }
            value={filters.pageSize}
          >
            {[10, 25, 50, 100].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="lead-created-from">Collected from</Label>
          <Input
            className="mt-1.5"
            disabled={disabled}
            id="lead-created-from"
            onChange={(event) =>
              updateTextFilter("createdFrom", event.target.value)
            }
            type="date"
            value={filters.createdFrom ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="lead-created-to">Collected to</Label>
          <Input
            className="mt-1.5"
            disabled={disabled}
            id="lead-created-to"
            onChange={(event) =>
              updateTextFilter("createdTo", event.target.value)
            }
            type="date"
            value={filters.createdTo ?? ""}
          />
        </div>
      </div>
    </section>
  );
}
