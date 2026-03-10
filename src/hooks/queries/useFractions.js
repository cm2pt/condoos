import { useQuery } from "@tanstack/react-query";
import { fetchFractions } from "../../services/condoosApi.js";
import { queryKeys } from "../../services/queryKeys.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

export function useFractions() {
  const { apiSession, isServerMode } = useAuth();

  return useQuery({
    queryKey: queryKeys.fractions(apiSession?.tenantId),
    queryFn: () => fetchFractions(apiSession),
    enabled: isServerMode,
    staleTime: 30_000,
  });
}
