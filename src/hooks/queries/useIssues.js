import { useQuery } from "@tanstack/react-query";
import { fetchIssues } from "../../services/condoosApi.js";
import { queryKeys } from "../../services/queryKeys.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

export function useIssues() {
  const { apiSession, isServerMode } = useAuth();

  return useQuery({
    queryKey: queryKeys.issues(apiSession?.tenantId),
    queryFn: () => fetchIssues(apiSession),
    enabled: isServerMode,
    staleTime: 30_000,
  });
}
