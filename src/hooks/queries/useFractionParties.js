import { useQuery } from "@tanstack/react-query";
import { fetchFractionParties } from "../../services/condoosApi.js";
import { queryKeys } from "../../services/queryKeys.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

export function useFractionParties() {
  const { apiSession, isServerMode } = useAuth();

  return useQuery({
    queryKey: queryKeys.fractionParties(apiSession?.tenantId),
    queryFn: () => fetchFractionParties(apiSession),
    enabled: isServerMode,
    staleTime: 30_000,
  });
}
