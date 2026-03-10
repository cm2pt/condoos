import { useQuery } from "@tanstack/react-query";
import { fetchCharges } from "../../services/condoosApi.js";
import { queryKeys } from "../../services/queryKeys.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

export function useCharges() {
  const { apiSession, isServerMode } = useAuth();

  return useQuery({
    queryKey: queryKeys.charges(apiSession?.tenantId),
    queryFn: () => fetchCharges(apiSession),
    enabled: isServerMode,
    staleTime: 30_000,
  });
}
