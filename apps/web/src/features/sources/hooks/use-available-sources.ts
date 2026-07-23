import { useQuery } from "@tanstack/react-query";

import { fetchAvailableSources } from "../api/sources.api";

export const useAvailableSources = () =>
  useQuery({
    queryKey: ["sources", "available"],
    queryFn: fetchAvailableSources,
    staleTime: 60_000,
    retry: false,
  });
