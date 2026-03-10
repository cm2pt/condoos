import { useQuery } from "@tanstack/react-query";
import { fetchPeople } from "../../services/condoosApi.js";
import { queryKeys } from "../../services/queryKeys.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

export function usePeople() {
  const { apiSession, isServerMode } = useAuth();

  return useQuery({
    queryKey: queryKeys.people(apiSession?.tenantId),
    queryFn: () => fetchPeople(apiSession),
    enabled: isServerMode,
    staleTime: 30_000,
  });
}
