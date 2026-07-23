import { useQuery } from "@tanstack/react-query";

import { leadQueryKeys } from "../api/lead-query-keys";
import { getLead } from "../api/leads.api";

export const useLead = (leadId: string) =>
  useQuery({
    queryKey: leadQueryKeys.detail(leadId),
    queryFn: () => getLead(leadId),
    enabled: leadId.length > 0,
  });
