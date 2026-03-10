import { useQuery } from "@tanstack/react-query";
import { fetchDocuments } from "../../services/condoosApi.js";
import { queryKeys } from "../../services/queryKeys.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

export function useDocuments() {
  const { apiSession, isServerMode } = useAuth();

  return useQuery({
    queryKey: queryKeys.documents(apiSession?.tenantId),
    queryFn: () => fetchDocuments(apiSession),
    enabled: isServerMode,
    staleTime: 30_000,
  });
}
