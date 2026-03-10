import { useQuery } from "@tanstack/react-query";
import { fetchAuditLog } from "../../services/condoosApi.js";
import { queryKeys } from "../../services/queryKeys.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

export function useAuditLog() {
  const { apiSession, isServerMode } = useAuth();

  return useQuery({
    queryKey: queryKeys.auditLog(apiSession?.tenantId),
    queryFn: () => fetchAuditLog(apiSession),
    enabled: isServerMode,
    staleTime: 30_000,
  });
}
