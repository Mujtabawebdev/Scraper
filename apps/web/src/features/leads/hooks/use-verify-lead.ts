import { useMutation, useQueryClient } from "@tanstack/react-query";

import { leadQueryKeys } from "../api/lead-query-keys";
import { verifyLeadPhone } from "../api/leads.api";

export const useVerifyLead = (leadId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => verifyLeadPhone(leadId),
    onSuccess: async (lead) => {
      queryClient.setQueryData(leadQueryKeys.detail(leadId), lead);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: leadQueryKeys.lists() }),
        queryClient.invalidateQueries({
          queryKey: leadQueryKeys.provenance(leadId),
        }),
      ]);
    },
  });
};
