import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { leadQueryKeys } from "../api/lead-query-keys";
import { listLeads } from "../api/leads.api";
import type { LeadListFilters } from "../types/lead.types";

export const useLeads = (filters: LeadListFilters) =>
  useQuery({
    queryKey: leadQueryKeys.list(filters),
    queryFn: () => listLeads(filters),
    placeholderData: keepPreviousData,
  });
