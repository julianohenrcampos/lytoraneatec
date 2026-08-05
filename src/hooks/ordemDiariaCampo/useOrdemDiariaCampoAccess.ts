import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { checarAcessoCampo } from "@/services/ordemDiariaCampo/ordemCampoService";

/**
 * Retorna se o usuário tem qualquer forma de acesso à visão mobile da
 * Ordem Diária (SuperAdm, permissão administrativa, permissão de campo,
 * ou vínculo como responsável principal/de item em qualquer ordem emitida).
 */
export function useOrdemDiariaCampoAccess() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: ["ordem-campo", "access", userId],
    queryFn: () => checarAcessoCampo(userId),
    enabled: !!isAuthenticated && !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
