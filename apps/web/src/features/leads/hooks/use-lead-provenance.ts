import { useQuery } from "@tanstack/react-query";

import { leadQueryKeys } from "../api/lead-query-keys";
import { getLeadProvenance } from "../api/leads.api";

export const useLeadProvenance = (leadId: string) =>
  useQuery({
    queryKey: leadQueryKeys.provenance(leadId),
    queryFn: () => getLeadProvenance(leadId),
    enabled: Boolean(leadId),
    retry: false,
  });
