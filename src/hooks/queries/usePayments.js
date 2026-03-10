import { useQuery } from "@tanstack/react-query";
import { fetchPayments } from "../../services/condoosApi.js";
import { queryKeys } from "../../services/queryKeys.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

export function usePayments() {
  const { apiSession, isServerMode } = useAuth();

  return useQuery({
    queryKey: queryKeys.payments(apiSession?.tenantId),
    queryFn: () => fetchPayments(apiSession),
    enabled: isServerMode,
    staleTime: 30_000,
  });
}
